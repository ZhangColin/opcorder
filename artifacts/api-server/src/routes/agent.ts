import { logger } from "../lib/logger";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, agentConfigsTable, agentConversationsTable, llmProvidersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/adminAuth";
import { callLLM, streamLLM, type LLMMessage, type ToolCall } from "../lib/llm";
import { AGENT_TOOLS, executeTool } from "../lib/agentTools";

const router: IRouter = Router();

const DEMAND_ANALYSIS_SCENE_KEY = "demand_analysis";

type PersistedMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCallId?: string;
  toolName?: string;
  toolCalls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  timestamp: string;
};

async function getDemandAnalysisConfig() {
  const [config] = await db
    .select()
    .from(agentConfigsTable)
    .where(eq(agentConfigsTable.sceneKey, DEMAND_ANALYSIS_SCENE_KEY))
    .limit(1);
  return config;
}

async function getOrCreateConversation(
  userId: number,
  demandId: number | null,
  sessionKey: string | null,
  conversationId?: number
) {
  if (conversationId) {
    const [existing] = await db
      .select()
      .from(agentConversationsTable)
      .where(
        and(
          eq(agentConversationsTable.id, conversationId),
          eq(agentConversationsTable.userId, userId)
        )
      )
      .limit(1);
    if (existing) return existing;
  }

  if (demandId) {
    const [existing] = await db
      .select()
      .from(agentConversationsTable)
      .where(
        and(
          eq(agentConversationsTable.demandId, demandId),
          eq(agentConversationsTable.userId, userId)
        )
      )
      .limit(1);
    if (existing) return existing;
  }

  if (sessionKey) {
    const [existing] = await db
      .select()
      .from(agentConversationsTable)
      .where(
        and(
          eq(agentConversationsTable.sessionKey, sessionKey),
          eq(agentConversationsTable.userId, userId)
        )
      )
      .limit(1);
    if (existing) return existing;
  }

  const [created] = await db
    .insert(agentConversationsTable)
    .values({
      userId,
      demandId,
      sessionKey,
      messages: [],
    })
    .returning();

  return created;
}

async function persistMessages(
  conversationId: number,
  demandId: number | undefined,
  existingDemandId: number | null,
  newMessages: PersistedMessage[]
) {
  await db
    .update(agentConversationsTable)
    .set({
      messages: newMessages,
      updatedAt: new Date(),
      ...(demandId && !existingDemandId ? { demandId } : {}),
    })
    .where(eq(agentConversationsTable.id, conversationId));
}

function buildLLMMessages(systemPrompt: string, history: PersistedMessage[], userMessage: string): LLMMessage[] {
  const messages: LLMMessage[] = [{ role: "system", content: systemPrompt }];

  for (const m of history) {
    if (m.role === "system") continue;

    if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: m.content ?? null,
        tool_calls: m.toolCalls,
      });
    } else if (m.role === "tool") {
      messages.push({
        role: "tool",
        content: m.content ?? "",
        tool_call_id: m.toolCallId,
        name: m.toolName,
      });
    } else {
      messages.push({
        role: m.role as "user" | "assistant",
        content: m.content ?? "",
      });
    }
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

router.get("/agent/demand-analysis/status", requireAuth, async (_req: Request, res: Response) => {
  try {
    const config = await getDemandAnalysisConfig();
    return res.json({ isEnabled: config?.isEnabled ?? false });
  } catch (error) {
    logger.error({ error }, "Failed to get agent status");
    return res.status(500).json({ error: "获取智能体状态失败" });
  }
});

router.post("/agent/demand-analysis/chat", requireAuth, async (req: Request, res: Response) => {
  const { message, demandId, sessionKey, conversationId } = req.body as {
    message: string;
    demandId?: number;
    sessionKey?: string;
    conversationId?: number;
  };

  if (!message || typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ error: "消息内容不能为空" });
  }

  let config: Awaited<ReturnType<typeof getDemandAnalysisConfig>>;
  let conversation: Awaited<ReturnType<typeof getOrCreateConversation>>;

  try {
    config = await getDemandAnalysisConfig();
    if (!config) return res.status(503).json({ error: "需求分析智能体未配置" });
    if (!config.isEnabled) return res.status(503).json({ error: "需求分析智能体暂未启用" });

    const userId = req.user!.id;
    conversation = await getOrCreateConversation(
      userId,
      demandId ?? null,
      sessionKey ?? null,
      conversationId
    );
  } catch (setupErr) {
    logger.error({ error: setupErr }, "Agent chat setup error");
    return res.status(500).json({ error: "智能体初始化失败" });
  }

  const historyMessages = (conversation.messages ?? []) as PersistedMessage[];
  const userMessageTrimmed = message.trim();
  const newUserMessage: PersistedMessage = {
    role: "user",
    content: userMessageTrimmed,
    timestamp: new Date().toISOString(),
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  sendEvent({ type: "conversation_id", conversationId: conversation.id });

  const MAX_TOOL_ITERATIONS = 10;
  let iteration = 0;
  const intermediateMessages: PersistedMessage[] = [];
  const llmMessages = buildLLMMessages(config.systemPrompt, historyMessages, userMessageTrimmed);

  const saveAndEnd = async (assistantMsg: PersistedMessage) => {
    const updated: PersistedMessage[] = [
      ...historyMessages,
      newUserMessage,
      ...intermediateMessages,
      assistantMsg,
    ];
    try {
      await persistMessages(conversation.id, demandId, conversation.demandId, updated);
    } catch (dbErr) {
      logger.error({ error: dbErr }, "Failed to persist agent conversation");
    }
    sendEvent({ type: "done", conversationId: conversation.id });
    res.end();
  };

  const saveAndEndOnError = async (errorMsg: string) => {
    const errorAssistantMsg: PersistedMessage = {
      role: "assistant",
      content: `[错误] ${errorMsg}`,
      timestamp: new Date().toISOString(),
    };
    const updated: PersistedMessage[] = [
      ...historyMessages,
      newUserMessage,
      ...intermediateMessages,
      errorAssistantMsg,
    ];
    try {
      await persistMessages(conversation.id, demandId, conversation.demandId, updated);
    } catch (dbErr) {
      logger.error({ error: dbErr }, "Failed to persist error state");
    }
    sendEvent({ type: "error", message: errorMsg });
    res.end();
  };

  try {
    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const response = await callLLM(llmMessages, AGENT_TOOLS);

      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolCalls: ToolCall[] = response.toolCalls;

        intermediateMessages.push({
          role: "assistant",
          content: response.content ?? null,
          toolCalls: toolCalls.map((tc) => ({
            id: tc.id,
            type: tc.type,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
          timestamp: new Date().toISOString(),
        });

        const toolResultLLMMessages: LLMMessage[] = [];

        for (const toolCall of toolCalls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown> = {};
          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            toolArgs = {};
          }

          sendEvent({ type: "tool_call", tool: toolName });

          const result = executeTool(toolName, toolArgs);
          const resultStr = JSON.stringify(result);

          toolResultLLMMessages.push({
            role: "tool",
            content: resultStr,
            tool_call_id: toolCall.id,
            name: toolName,
          });

          intermediateMessages.push({
            role: "tool",
            content: resultStr,
            toolCallId: toolCall.id,
            toolName,
            timestamp: new Date().toISOString(),
          });
        }

        llmMessages.push({
          role: "assistant",
          content: response.content ?? null,
          tool_calls: toolCalls,
        });
        llmMessages.push(...toolResultLLMMessages);
        continue;
      }

      // Re-use the already-generated callLLM content to avoid a second LLM call.
      // A second streamLLM call (without tools) tends to produce inconsistent output
      // (e.g. omitting option_choices_json), so we stream the first response directly.
      let finalContent = response.content ?? "";

      if (finalContent) {
        // Stream in word-sized chunks for a natural feel
        const words = finalContent.split(/(?<=\s)|(?=\s)/);
        for (const chunk of words) {
          if (chunk) sendEvent({ type: "token", content: chunk });
        }
      } else {
        // Fallback: model returned no content in the non-streaming call, use streamLLM
        try {
          for await (const token of streamLLM(llmMessages)) {
            finalContent += token;
            sendEvent({ type: "token", content: token });
          }
        } catch (streamErr) {
          logger.warn({ streamErr }, "streamLLM fallback also failed");
          finalContent = "";
        }
      }

      await saveAndEnd({
        role: "assistant",
        content: finalContent,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    await saveAndEndOnError("超过最大工具调用次数，请重试");
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error }, "Agent chat error");
    try {
      await saveAndEndOnError(errMsg);
    } catch {
      res.write(`data: ${JSON.stringify({ type: "error", message: errMsg })}\n\n`);
      res.end();
    }
  }
});

router.get("/agent/demand-analysis/history/:demandId", requireAuth, async (req: Request, res: Response) => {
  try {
    const demandIdParam = req.params.demandId;
    const demandId = demandIdParam === "session" ? null : parseInt(demandIdParam);
    const sessionKey = req.query.sessionKey as string | undefined;
    const userId = req.user!.id;

    let conversation;

    if (demandId && !isNaN(demandId)) {
      const [found] = await db
        .select()
        .from(agentConversationsTable)
        .where(
          and(
            eq(agentConversationsTable.demandId, demandId),
            eq(agentConversationsTable.userId, userId)
          )
        )
        .limit(1);
      conversation = found;
    } else if (sessionKey) {
      const [found] = await db
        .select()
        .from(agentConversationsTable)
        .where(
          and(
            eq(agentConversationsTable.sessionKey, sessionKey),
            eq(agentConversationsTable.userId, userId)
          )
        )
        .limit(1);
      conversation = found;
    }

    if (!conversation) {
      return res.json({ messages: [], conversationId: null });
    }

    const messages = (conversation.messages ?? []) as PersistedMessage[];

    const visibleMessages = messages
      .filter((m) => m.role === "user" || (m.role === "assistant" && !m.toolCalls))
      .map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));

    return res.json({
      messages: visibleMessages,
      conversationId: conversation.id,
    });
  } catch (error) {
    logger.error({ error }, "Failed to fetch agent history");
    return res.status(500).json({ error: "获取对话历史失败" });
  }
});

router.post("/agent/demand-analysis/bind-demand", requireAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId, demandId } = req.body as { conversationId: number; demandId: number };
    const userId = req.user!.id;

    if (!conversationId || !demandId) {
      return res.status(400).json({ error: "conversationId 和 demandId 不能为空" });
    }

    const [updated] = await db
      .update(agentConversationsTable)
      .set({ demandId, updatedAt: new Date() })
      .where(
        and(
          eq(agentConversationsTable.id, conversationId),
          eq(agentConversationsTable.userId, userId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "对话记录不存在" });
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to bind demand to conversation");
    return res.status(500).json({ error: "绑定需求失败" });
  }
});

router.get("/admin/agent-configs", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const configs = await db.select().from(agentConfigsTable);
    return res.json(configs);
  } catch (error) {
    logger.error({ error }, "Failed to list agent configs");
    return res.status(500).json({ error: "获取智能体配置失败" });
  }
});

router.get("/admin/agent-configs/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [config] = await db
      .select()
      .from(agentConfigsTable)
      .where(eq(agentConfigsTable.id, id))
      .limit(1);

    if (!config) {
      return res.status(404).json({ error: "智能体配置不存在" });
    }

    return res.json(config);
  } catch (error) {
    logger.error({ error }, "Failed to get agent config");
    return res.status(500).json({ error: "获取智能体配置失败" });
  }
});

router.put("/admin/agent-configs/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { systemPrompt, isEnabled } = req.body as {
      systemPrompt?: string;
      isEnabled?: boolean;
    };

    const updateData: Record<string, unknown> = {};
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "没有可更新的字段" });
    }

    const [updated] = await db
      .update(agentConfigsTable)
      .set(updateData)
      .where(eq(agentConfigsTable.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "智能体配置不存在" });
    }

    return res.json(updated);
  } catch (error) {
    logger.error({ error }, "Failed to update agent config");
    return res.status(500).json({ error: "更新智能体配置失败" });
  }
});

/* ─── LLM Providers CRUD ─────────────────────────────────────────── */

router.get("/admin/llm-providers", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const providers = await db.select().from(llmProvidersTable).orderBy(llmProvidersTable.id);
    const masked = providers.map(p => ({
      ...p,
      apiKey: p.apiKey ? "••••••••" + p.apiKey.slice(-4) : "",
    }));
    return res.json(masked);
  } catch (error) {
    logger.error({ error }, "Failed to list llm providers");
    return res.status(500).json({ error: "获取供应商列表失败" });
  }
});

router.post("/admin/llm-providers", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, displayName, baseUrl, apiKey, defaultModel, remark } = req.body as {
      name: string;
      displayName: string;
      baseUrl: string;
      apiKey: string;
      defaultModel: string;
      remark?: string;
    };

    if (!name || !displayName || !baseUrl || !apiKey || !defaultModel) {
      return res.status(400).json({ error: "缺少必填字段" });
    }

    const [created] = await db
      .insert(llmProvidersTable)
      .values({ name, displayName, baseUrl, apiKey, defaultModel, remark: remark ?? null, isActive: false })
      .returning();

    return res.json({ ...created, apiKey: "••••••••" + created.apiKey.slice(-4) });
  } catch (error: any) {
    if (error?.code === "23505") {
      return res.status(400).json({ error: "供应商名称已存在" });
    }
    logger.error({ error }, "Failed to create llm provider");
    return res.status(500).json({ error: "创建供应商失败" });
  }
});

router.put("/admin/llm-providers/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { displayName, baseUrl, apiKey, defaultModel, remark } = req.body as {
      displayName?: string;
      baseUrl?: string;
      apiKey?: string;
      defaultModel?: string;
      remark?: string;
    };

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (displayName !== undefined) updateData.displayName = displayName;
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl;
    if (defaultModel !== undefined) updateData.defaultModel = defaultModel;
    if (remark !== undefined) updateData.remark = remark;
    if (apiKey && !apiKey.startsWith("••••")) updateData.apiKey = apiKey;

    const [updated] = await db
      .update(llmProvidersTable)
      .set(updateData)
      .where(eq(llmProvidersTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "供应商不存在" });

    return res.json({ ...updated, apiKey: "••••••••" + updated.apiKey.slice(-4) });
  } catch (error) {
    logger.error({ error }, "Failed to update llm provider");
    return res.status(500).json({ error: "更新供应商失败" });
  }
});

router.post("/admin/llm-providers/:id/activate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const [target] = await db
      .select()
      .from(llmProvidersTable)
      .where(eq(llmProvidersTable.id, id))
      .limit(1);

    if (!target) return res.status(404).json({ error: "供应商不存在" });

    await db.update(llmProvidersTable).set({ isActive: false, updatedAt: new Date() });
    await db.update(llmProvidersTable).set({ isActive: true, updatedAt: new Date() }).where(eq(llmProvidersTable.id, id));

    return res.json({ success: true, activatedId: id });
  } catch (error) {
    logger.error({ error }, "Failed to activate llm provider");
    return res.status(500).json({ error: "激活供应商失败" });
  }
});

router.delete("/admin/llm-providers/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const [target] = await db
      .select()
      .from(llmProvidersTable)
      .where(eq(llmProvidersTable.id, id))
      .limit(1);

    if (!target) return res.status(404).json({ error: "供应商不存在" });
    if (target.isActive) return res.status(400).json({ error: "当前激活的供应商无法删除，请先切换到其他供应商" });

    await db.delete(llmProvidersTable).where(eq(llmProvidersTable.id, id));

    return res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to delete llm provider");
    return res.status(500).json({ error: "删除供应商失败" });
  }
});

export default router;
