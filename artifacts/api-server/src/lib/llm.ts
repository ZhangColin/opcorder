import OpenAI from "openai";
import { db, llmProvidersTable } from "@workspace/db";
import { logger } from "./logger";

export type LLMMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
  reasoning_content?: string;
};

export type LLMTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type LLMResponse = {
  content: string | null;
  toolCalls?: ToolCall[];
  finishReason: string;
  reasoningContent?: string;
};

type ProviderEntry = {
  client: OpenAI;
  model: string;
  name: string;
};

async function getOrderedProviders(): Promise<ProviderEntry[]> {
  const entries: ProviderEntry[] = [];

  try {
    const allProviders = await db
      .select()
      .from(llmProvidersTable)
      .orderBy(llmProvidersTable.id);

    const activeProviders = allProviders.filter((p) => p.isActive && p.apiKey);
    const otherProviders = allProviders.filter((p) => !p.isActive && p.apiKey);

    for (const p of [...activeProviders, ...otherProviders]) {
      entries.push({
        client: new OpenAI({ baseURL: p.baseUrl, apiKey: p.apiKey }),
        model: p.defaultModel,
        name: p.displayName,
      });
    }
  } catch (err) {
    logger.warn({ err }, "llm: failed to load providers from DB");
  }

  const envKey = process.env.DEEPSEEK_API_KEY;
  if (envKey && !entries.some((e) => e.name === "DeepSeek (env)")) {
    entries.push({
      client: new OpenAI({ baseURL: "https://api.deepseek.com", apiKey: envKey }),
      model: "deepseek-chat",
      name: "DeepSeek (env)",
    });
  }

  return entries;
}

export async function callLLM(
  messages: LLMMessage[],
  tools?: LLMTool[],
  model?: string
): Promise<LLMResponse> {
  const providers = await getOrderedProviders();
  if (providers.length === 0) {
    throw new Error("没有可用的大模型配置，请在后台激活一个供应商");
  }

  let lastErr: unknown;

  for (const provider of providers) {
    const resolvedModel = model ?? provider.model;
    try {
      const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
        model: resolvedModel,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        ...(tools && tools.length > 0 ? { tools } : {}),
      };

      const completion = await provider.client.chat.completions.create(params);
      const choice = completion.choices[0];
      const reasoningContent: string | undefined =
        (choice.message as any).reasoning_content ?? undefined;

      return {
        content: choice.message.content,
        toolCalls: choice.message.tool_calls as ToolCall[] | undefined,
        finishReason: choice.finish_reason,
        ...(reasoningContent !== undefined ? { reasoningContent } : {}),
      };
    } catch (err) {
      logger.warn({ err, provider: provider.name }, "llm: provider failed, trying next");
      lastErr = err;
    }
  }

  logger.error({ lastErr }, "llm: all providers failed");
  throw new Error("服务暂时繁忙，请稍后重试");
}

export async function* streamLLM(
  messages: LLMMessage[],
  model?: string
): AsyncGenerator<string> {
  const providers = await getOrderedProviders();
  if (providers.length === 0) {
    throw new Error("没有可用的大模型配置，请在后台激活一个供应商");
  }

  let lastErr: unknown;

  for (const provider of providers) {
    const resolvedModel = model ?? provider.model;
    try {
      const stream = await provider.client.chat.completions.create({
        model: resolvedModel,
        messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
      }
      return;
    } catch (err) {
      logger.warn({ err, provider: provider.name }, "llm: stream provider failed, trying next");
      lastErr = err;
    }
  }

  logger.error({ lastErr }, "llm: all stream providers failed");
  throw new Error("服务暂时繁忙，请稍后重试");
}

export async function isLLMAvailable(): Promise<boolean> {
  const providers = await getOrderedProviders();
  return providers.length > 0;
}
