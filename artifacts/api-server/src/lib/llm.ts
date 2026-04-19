import OpenAI from "openai";

function getDeepSeekClient(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY environment variable is not set");
  }
  return new OpenAI({
    baseURL: "https://api.deepseek.com",
    apiKey,
  });
}

export type LLMMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
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
};

export async function callLLM(
  messages: LLMMessage[],
  tools?: LLMTool[],
  model = "deepseek-chat"
): Promise<LLMResponse> {
  const client = getDeepSeekClient();

  const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
    ...(tools && tools.length > 0 ? { tools } : {}),
  };

  const completion = await client.chat.completions.create(params);
  const choice = completion.choices[0];

  return {
    content: choice.message.content,
    toolCalls: choice.message.tool_calls as ToolCall[] | undefined,
    finishReason: choice.finish_reason,
  };
}

export async function* streamLLM(
  messages: LLMMessage[],
  model = "deepseek-chat"
): AsyncGenerator<string> {
  const client = getDeepSeekClient();

  const stream = await client.chat.completions.create({
    model,
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

export function isLLMAvailable(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}
