import OpenAI from "openai";
import { db, llmProvidersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

async function getActiveClient(): Promise<{ client: OpenAI; model: string }> {
  try {
    const [provider] = await db
      .select()
      .from(llmProvidersTable)
      .where(eq(llmProvidersTable.isActive, true))
      .limit(1);

    if (provider && provider.apiKey) {
      return {
        client: new OpenAI({ baseURL: provider.baseUrl, apiKey: provider.apiKey }),
        model: provider.defaultModel,
      };
    }
  } catch (err) {
    logger.warn({ err }, "llm: failed to load active provider from DB, falling back to env");
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("没有可用的大模型配置，请在后台激活一个供应商");
  return {
    client: new OpenAI({ baseURL: "https://api.deepseek.com", apiKey }),
    model: "deepseek-chat",
  };
}

export async function callLLM(
  messages: LLMMessage[],
  tools?: LLMTool[],
  model?: string
): Promise<LLMResponse> {
  const { client, model: defaultModel } = await getActiveClient();
  const resolvedModel = model ?? defaultModel;

  const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model: resolvedModel,
    messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
    ...(tools && tools.length > 0 ? { tools } : {}),
  };

  const completion = await client.chat.completions.create(params);
  const choice = completion.choices[0];

  const reasoningContent: string | undefined =
    (choice.message as any).reasoning_content ?? undefined;

  return {
    content: choice.message.content,
    toolCalls: choice.message.tool_calls as ToolCall[] | undefined,
    finishReason: choice.finish_reason,
    ...(reasoningContent !== undefined ? { reasoningContent } : {}),
  };
}

export async function* streamLLM(
  messages: LLMMessage[],
  model?: string
): AsyncGenerator<string> {
  const { client, model: defaultModel } = await getActiveClient();
  const resolvedModel = model ?? defaultModel;

  const stream = await client.chat.completions.create({
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
}

export async function isLLMAvailable(): Promise<boolean> {
  try {
    const [provider] = await db
      .select({ id: llmProvidersTable.id })
      .from(llmProvidersTable)
      .where(eq(llmProvidersTable.isActive, true))
      .limit(1);
    if (provider) return true;
  } catch {
  }
  return !!process.env.DEEPSEEK_API_KEY;
}
