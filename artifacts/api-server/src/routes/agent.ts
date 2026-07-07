import { logger } from "../lib/logger";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, agentConfigsTable, agentConfigPromptVersionsTable, agentConversationsTable, llmProvidersTable, catCategoriesTable, catTagsTable, v2ClientDemandsTable, v2ClientDemandVersionsTable, opcProfilesTable, usersTable } from "@workspace/db";
import { eq, and, asc, desc, or, ilike } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/adminAuth";
import { callLLM, streamLLM, type LLMMessage, type ToolCall } from "../lib/llm";
import { buildAgentTools, executeTool, type ToolExecutionContext } from "../lib/agentTools";

const router: IRouter = Router();

const DEMAND_ANALYSIS_SCENE_KEY = "demand_analysis";

const TOOL_FREE_SCENE_KEYS = new Set(["v2_outsource_split", "v2_admin_opc_milestone"]);
const ADMIN_ONLY_SCENE_KEYS = new Set(["v2_outsource_split", "v2_admin_opc_demand", "v2_admin_opc_milestone"]);

/** For scenes that only need a subset of tools, list the allowed tool names here. */
const SCENE_ALLOWED_TOOLS = new Map<string, Set<string>>([
  ["v2_demand_analysis", new Set(["get_current_time", "get_demand_types", "get_requirement_template", "estimate_budget", "perform_self_check"])],
  ["v2_admin_opc_demand", new Set(["get_current_time", "get_demand_types", "get_requirement_template", "estimate_budget", "perform_self_check", "get_linked_demand_details", "get_opc_levels"])],
]);

type PersistedMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCallId?: string;
  toolName?: string;
  toolCalls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  reasoningContent?: string;
  timestamp: string;
};

async function getAgentConfig(sceneKey: string = DEMAND_ANALYSIS_SCENE_KEY) {
  const [config] = await db
    .select()
    .from(agentConfigsTable)
    .where(eq(agentConfigsTable.sceneKey, sceneKey))
    .limit(1);
  return config;
}

async function getDemandAnalysisConfig() {
  return getAgentConfig(DEMAND_ANALYSIS_SCENE_KEY);
}

async function getOrCreateConversation(
  userId: number,
  demandId: number | null,
  sessionKey: string | null,
  conversationId?: number,
  linkedClientDemandId?: number
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
    if (existing) {
      // Persist linkedClientDemandId on an existing conversation if not already set
      if (linkedClientDemandId && !existing.linkedClientDemandId) {
        await db.update(agentConversationsTable)
          .set({ linkedClientDemandId })
          .where(eq(agentConversationsTable.id, existing.id));
        existing.linkedClientDemandId = linkedClientDemandId;
      }
      return existing;
    }
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
    if (existing) {
      if (linkedClientDemandId && !existing.linkedClientDemandId) {
        await db.update(agentConversationsTable)
          .set({ linkedClientDemandId })
          .where(eq(agentConversationsTable.id, existing.id));
        existing.linkedClientDemandId = linkedClientDemandId;
      }
      return existing;
    }
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
    if (existing) {
      if (linkedClientDemandId && !existing.linkedClientDemandId) {
        await db.update(agentConversationsTable)
          .set({ linkedClientDemandId })
          .where(eq(agentConversationsTable.id, existing.id));
        existing.linkedClientDemandId = linkedClientDemandId;
      }
      return existing;
    }
  }

  const [created] = await db
    .insert(agentConversationsTable)
    .values({
      userId,
      demandId,
      sessionKey,
      linkedClientDemandId: linkedClientDemandId ?? null,
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
        ...(m.reasoningContent !== undefined ? { reasoning_content: m.reasoningContent } : {}),
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
  const { message, demandId, sessionKey, conversationId, sceneKey: reqSceneKey, mode, existingDemandData, linkedClientDemandId, agentContext } = req.body as {
    message: string;
    demandId?: number;
    sessionKey?: string;
    conversationId?: number;
    sceneKey?: string;
    /** "new" (default) or "edit" — changes system prompt context and expected output */
    mode?: "new" | "edit";
    /** Passed by frontend when mode="edit"; injected as system context block */
    existingDemandData?: {
      title?: string;
      type?: string;
      description?: string;
      budgetMin?: number | null;
      budgetMax?: number | null;
      hopeDeliveryDate?: string | null;
    };
    /** Passed by frontend when creating OPC demand linked to a client demand — agent fetches details via tool call */
    linkedClientDemandId?: number;
    /** Free-form context block to append to the system prompt (used by milestone agent etc.) */
    agentContext?: string;
  };

  const resolvedSceneKey = reqSceneKey || DEMAND_ANALYSIS_SCENE_KEY;

  if (!message || typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({ error: "消息内容不能为空" });
  }

  if (ADMIN_ONLY_SCENE_KEYS.has(resolvedSceneKey) && req.user!.role !== "admin") {
    return res.status(403).json({ error: "无权访问此智能体场景" });
  }

  let config: Awaited<ReturnType<typeof getAgentConfig>>;
  let conversation: Awaited<ReturnType<typeof getOrCreateConversation>>;

  try {
    config = await getAgentConfig(resolvedSceneKey);
    if (!config) return res.status(503).json({ error: "智能体未配置" });
    if (!config.isEnabled) return res.status(503).json({ error: "智能体暂未启用" });

    const userId = req.user!.id;
    conversation = await getOrCreateConversation(
      userId,
      demandId ?? null,
      sessionKey ?? null,
      conversationId,
      linkedClientDemandId
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

  // Fetch active categories (with doc templates) and tags to provide dynamic context to tools
  let toolContext: ToolExecutionContext = {};
  try {
    const [cats, tagRows] = await Promise.all([
      db
        .select({ id: catCategoriesTable.id, code: catCategoriesTable.code, name: catCategoriesTable.name, description: catCategoriesTable.description, docTemplate: catCategoriesTable.docTemplate })
        .from(catCategoriesTable)
        .where(eq(catCategoriesTable.isActive, true))
        .orderBy(asc(catCategoriesTable.sortOrder)),
      db
        .select({ name: catTagsTable.name })
        .from(catTagsTable)
        .where(eq(catTagsTable.isActive, true))
        .orderBy(asc(catTagsTable.sortOrder)),
    ]);
    if (cats.length > 0) {
      toolContext.categories = cats.map(c => ({ id: c.id, code: c.code, name: c.name, description: c.description }));
      // Build docTemplates map: upper-case code → template text
      const docTemplates: Record<string, string> = {};
      for (const c of cats) {
        if (c.docTemplate) {
          docTemplates[c.code.toUpperCase()] = c.docTemplate;
          docTemplates[c.code] = c.docTemplate;
        }
      }
      if (Object.keys(docTemplates).length > 0) toolContext.docTemplates = docTemplates;
    }
    if (tagRows.length > 0) toolContext.tags = tagRows.map(t => t.name);
  } catch (catErr) {
    logger.warn({ catErr }, "Could not fetch categories/tags for tool context, falling back to static list");
  }

  // Build effective system prompt — inject context blocks as needed
  let effectiveSystemPrompt = config.systemPrompt;

  // Edit mode: inject existing demand data
  if (mode === "edit" && existingDemandData) {
    const d = existingDemandData;
    const budgetStr = (d.budgetMin != null && d.budgetMax != null)
      ? `¥${d.budgetMin} ~ ¥${d.budgetMax}`
      : d.budgetMin != null ? `¥${d.budgetMin}` : "(未填写)";
    effectiveSystemPrompt = effectiveSystemPrompt + `

---
【当前需求数据（编辑模式）】
标题：${d.title ?? "(未填写)"}
类型：${d.type ?? "(未填写)"}
预算区间：${budgetStr}
希望交付日期：${d.hopeDeliveryDate ?? "(未填写)"}

需求文档（当前版本）：
${d.description ?? "(暂无内容)"}
---`;
  }

  // Free-form context block (e.g. milestone agent injects demand info from frontend)
  if (agentContext && typeof agentContext === "string" && agentContext.trim()) {
    effectiveSystemPrompt = effectiveSystemPrompt + "\n\n" + agentContext.trim();
  }

  // Linked client demand: pre-fetch details from DB and inject directly into system prompt.
  // This is more reliable than asking the agent to call a tool — the data is always present.
  const effectiveLinkedClientDemandId = conversation.linkedClientDemandId || linkedClientDemandId;
  if (effectiveLinkedClientDemandId) {
    try {
      const [linkedDemand] = await db.select({
        id: v2ClientDemandsTable.id,
        title: v2ClientDemandsTable.title,
        demandType: v2ClientDemandsTable.demandType,
        budgetMin: v2ClientDemandsTable.budgetMin,
        budgetMax: v2ClientDemandsTable.budgetMax,
        hopeDeliveryDate: v2ClientDemandsTable.hopeDeliveryDate,
      }).from(v2ClientDemandsTable)
        .where(eq(v2ClientDemandsTable.id, effectiveLinkedClientDemandId))
        .limit(1);

      if (linkedDemand) {
        const [linkedVersion] = await db.select({
          detail: v2ClientDemandVersionsTable.detail,
        }).from(v2ClientDemandVersionsTable)
          .where(eq(v2ClientDemandVersionsTable.demandId, effectiveLinkedClientDemandId))
          .orderBy(desc(v2ClientDemandVersionsTable.versionNo))
          .limit(1);

        const budgetStr = (linkedDemand.budgetMin != null && linkedDemand.budgetMax != null)
          ? `¥${linkedDemand.budgetMin} ~ ¥${linkedDemand.budgetMax}`
          : linkedDemand.budgetMin != null ? `¥${linkedDemand.budgetMin}（上限未填）` : "（未填写）";
        const deliveryStr = linkedDemand.hopeDeliveryDate
          ? linkedDemand.hopeDeliveryDate.toISOString().split("T")[0]
          : "（未填写）";
        const detailStr = linkedVersion?.detail?.trim() || "（暂无需求详情）";

        // Resolve demandType code to human-readable name using already-loaded categories
        const demandTypeCode = linkedDemand.demandType;
        const demandTypeName = demandTypeCode
          ? (toolContext.categories?.find(c => c.code === demandTypeCode)?.name ?? demandTypeCode)
          : "（未填写）";
        const demandTypeStr = demandTypeCode
          ? `${demandTypeName}（${demandTypeCode}）`
          : "（未填写）";

        effectiveSystemPrompt = effectiveSystemPrompt + `

---
【关联客户需求（背景参考）】
以下是本次关联的客户需求完整内容，已由系统预先获取，直接使用即可，无需调用 get_linked_demand_details 工具。

标题：${linkedDemand.title}
需求类型：${demandTypeStr}
预算区间：${budgetStr}
希望交付日期：${deliveryStr}

需求详情：
${detailStr}

重要提示：新 OPC 需求文档中不得出现原客户需求的名称、客户信息等任何标识。
---`;
      }
    } catch (linkedDemandErr) {
      logger.warn({ linkedDemandErr, effectiveLinkedClientDemandId }, "Failed to pre-fetch linked client demand for system prompt");
    }
  }

  // ── Auto wrap-up injection ───────────────────────────────────────────────────
  // If the conversation has had enough user turns but no form_suggestion_json has
  // appeared in any assistant message yet, inject a reminder into the system prompt
  // so the model is nudged to finish up this turn.
  {
    const userTurns = historyMessages.filter(m => m.role === "user").length;
    const hasSuggestion = historyMessages.some(
      m => m.role === "assistant" && m.content && m.content.includes("form_suggestion_json:")
    );
    // Detect natural wrap-up intent: user asking agent to write doc / produce output
    const wrapUpKeywords = [
      "写文档", "写需求", "写个文档", "出文档", "生成文档", "生成需求",
      "整理文档", "整理需求", "整理一下", "汇总一下", "总结一下",
      "输出表单", "输出结果", "生成结果", "出结果", "出表单",
      "填入表单", "填表单", "一键填", "帮我填",
      "信息差不多了", "差不多了", "够了", "可以了", "就这些了",
      "开始写", "写吧", "你来写", "帮我写", "写出来", "给我文档",
      "需求文档", "整理需求文档", "需求整理",
    ];
    const isManualWrapUp = wrapUpKeywords.some(kw => userMessageTrimmed.includes(kw));

    if (userTurns >= 8 && !hasSuggestion) {
      const forceNote = isManualWrapUp
        ? "\n\n【系统强制指令】用户已明确要求输出结果。请立即整理所有已收集的信息，生成完整需求文档，并在本条消息末尾输出 form_suggestion_json。禁止再追问，禁止省略此步骤。"
        : "\n\n【系统提示】当前对话已进行多轮，信息收集应已基本完整。请在本轮回复结束前评估是否可以进入文档整理阶段——如果信息足够，本条消息末尾必须输出 form_suggestion_json；如确实还有关键缺口，最多再追问一个问题后必须输出。";
      effectiveSystemPrompt = effectiveSystemPrompt + forceNote;
    } else if (isManualWrapUp && !hasSuggestion) {
      effectiveSystemPrompt = effectiveSystemPrompt + "\n\n【系统强制指令】用户已明确要求输出结果。请立即整理所有已收集的信息，生成完整需求文档，并在本条消息末尾输出 form_suggestion_json。禁止再追问，禁止省略此步骤。";
    }
  }

  // ── Tool-result accumulator ─────────────────────────────────────────────────
  // Each ReAct stage that calls a tool is the authoritative source for its field.
  // validate_timeline → bidDeadline + deadline
  // suggest_milestones → milestones (and confirms the two dates above)
  // These accumulated values are injected into form_suggestion_json before streaming,
  // so the contract is fulfilled by the tool calls, not by LLM text generation.
  type AccumulatedMilestone = { name: string; deadline: string; deliverableDesc: string };
  type AccumulatedToolData = {
    bidDeadline?: string;
    deadline?: string;       // deliveryDate from validate_timeline
    milestones?: AccumulatedMilestone[];
  };
  const accumulated: AccumulatedToolData = {};

  // Pre-populate from conversation history so cross-turn tool results are captured.
  // When the user says "give me the form" in a new request, the LLM may not re-call
  // validate_timeline, but its result is already stored in a previous tool message.
  for (const msg of historyMessages) {
    if (msg.role !== "tool" || !msg.content || !msg.toolName) continue;
    try {
      const r = JSON.parse(msg.content) as Record<string, unknown>;
      if (msg.toolName === "validate_timeline" && r.isReasonable === true) {
        if (typeof r.bidDeadline === "string") accumulated.bidDeadline = r.bidDeadline;
        if (typeof r.deliveryDate === "string") accumulated.deadline = r.deliveryDate;
      }
      if (msg.toolName === "suggest_milestones") {
        if (typeof r.bidDeadline === "string") accumulated.bidDeadline = r.bidDeadline;
        if (typeof r.deliveryDate === "string") accumulated.deadline = r.deliveryDate;
        if (Array.isArray(r.milestones)) {
          accumulated.milestones = (r.milestones as Array<Record<string, unknown>>).map(m => ({
            name: String(m.name ?? ""),
            deadline: String(m.deadline ?? ""),
            deliverableDesc: String(m.deliverableDesc ?? m.description ?? ""),
          }));
        }
      }
    } catch { /* ignore malformed history entries */ }
  }

  /** Find and patch form_suggestion_json in content with any accumulated tool values. */
  function injectAccumulatedData(content: string): string {
    const marker = "form_suggestion_json:";
    const markerIdx = content.indexOf(marker);
    if (markerIdx === -1) return content;

    const afterMarker = content.slice(markerIdx + marker.length);
    const objStart = afterMarker.indexOf("{");
    if (objStart === -1) return content;

    // Walk to find the matching closing brace
    let depth = 0, inStr = false, escaped = false, objEnd = -1;
    for (let i = objStart; i < afterMarker.length; i++) {
      const c = afterMarker[i];
      if (escaped) { escaped = false; continue; }
      if (c === "\\" && inStr) { escaped = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { objEnd = i; break; } }
    }
    if (objEnd === -1) return content;

    try {
      const jsonStr = afterMarker.slice(objStart, objEnd + 1);
      const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

      // Inject tool-derived values — they take precedence over whatever the LLM wrote
      if (accumulated.bidDeadline) parsed.bidDeadline = accumulated.bidDeadline;
      if (accumulated.deadline && !parsed.deadline) parsed.deadline = accumulated.deadline;
      if (accumulated.milestones?.length &&
          (!Array.isArray(parsed.milestones) || (parsed.milestones as unknown[]).length === 0)) {
        parsed.milestones = accumulated.milestones;
      }

      const patched = JSON.stringify(parsed);
      return (
        content.slice(0, markerIdx + marker.length) +
        afterMarker.slice(0, objStart) +
        patched +
        afterMarker.slice(objEnd + 1)
      );
    } catch {
      return content;
    }
  }

  const MAX_TOOL_ITERATIONS = 10;
  let iteration = 0;
  const intermediateMessages: PersistedMessage[] = [];
  const llmMessages = buildLLMMessages(effectiveSystemPrompt, historyMessages, userMessageTrimmed);

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

      const allBuiltTools = TOOL_FREE_SCENE_KEYS.has(resolvedSceneKey) ? [] : buildAgentTools(toolContext);
      const allowedToolNames = SCENE_ALLOWED_TOOLS.get(resolvedSceneKey);
      const agentTools = allowedToolNames
        ? allBuiltTools.filter((t) => allowedToolNames.has(t.function.name))
        : allBuiltTools;
      const response = await callLLM(llmMessages, agentTools);

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
          ...(response.reasoningContent !== undefined ? { reasoningContent: response.reasoningContent } : {}),
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

          // ── perform_self_check: server counts how many times it has been called ──
          let result: unknown;
          if (toolName === "get_linked_demand_details") {
            // Priority: agent-passed arg → conversation DB record → request body (fallback)
            const resolvedDemandId = (toolArgs.clientDemandId as number | undefined)
              || conversation.linkedClientDemandId
              || linkedClientDemandId;
            if (!resolvedDemandId) {
              result = { error: "当前没有关联客户需求" };
            } else {
              try {
                const [demand] = await db.select({
                  id: v2ClientDemandsTable.id,
                  title: v2ClientDemandsTable.title,
                  demandType: v2ClientDemandsTable.demandType,
                  budgetMin: v2ClientDemandsTable.budgetMin,
                  budgetMax: v2ClientDemandsTable.budgetMax,
                  hopeDeliveryDate: v2ClientDemandsTable.hopeDeliveryDate,
                }).from(v2ClientDemandsTable)
                  .where(eq(v2ClientDemandsTable.id, resolvedDemandId))
                  .limit(1);

                if (!demand) {
                  result = { error: "关联需求不存在" };
                } else {
                  const [version] = await db.select({
                    detail: v2ClientDemandVersionsTable.detail,
                  }).from(v2ClientDemandVersionsTable)
                    .where(eq(v2ClientDemandVersionsTable.demandId, resolvedDemandId))
                    .orderBy(desc(v2ClientDemandVersionsTable.versionNo))
                    .limit(1);

                  result = {
                    title: demand.title,
                    demandType: demand.demandType ?? null,
                    budgetMin: demand.budgetMin ?? null,
                    budgetMax: demand.budgetMax ?? null,
                    hopeDeliveryDate: demand.hopeDeliveryDate
                      ? demand.hopeDeliveryDate.toISOString().split("T")[0]
                      : null,
                    detail: version?.detail?.trim() || "(暂无需求详情)",
                    instruction: "以上为关联客户需求的完整内容，仅作为背景参考。新 OPC 需求文档中不得出现原客户需求的名称、客户信息、原需求编号等任何标识。",
                  };
                }
              } catch (fetchErr) {
                result = { error: `查询失败: ${(fetchErr as Error).message}` };
              }
            }
          } else if (toolName === "search_opc_candidates") {
            const level = (toolArgs.level as string) || "any";
            const keyword = (toolArgs.keyword as string) || "";
            try {
              const conditions = [eq(usersTable.role, "opc")];
              if (level && level !== "any") {
                conditions.push(eq(opcProfilesTable.level, level as "C" | "B" | "A"));
              }
              const rows = await db
                .select({
                  profileId: opcProfilesTable.id,
                  userId: usersTable.id,
                  nickname: usersTable.nickname,
                  level: opcProfilesTable.level,
                  title: opcProfilesTable.title,
                  totalOrders: opcProfilesTable.totalOrders,
                  avgRating: opcProfilesTable.avgRating,
                  bio: opcProfilesTable.bio,
                })
                .from(opcProfilesTable)
                .innerJoin(usersTable, eq(opcProfilesTable.userId, usersTable.id))
                .where(
                  keyword
                    ? and(...conditions, or(ilike(usersTable.nickname, `%${keyword}%`), ilike(opcProfilesTable.bio, `%${keyword}%`)))
                    : and(...conditions)
                )
                .orderBy(desc(opcProfilesTable.avgRating), desc(opcProfilesTable.totalOrders))
                .limit(20);
              result = {
                count: rows.length,
                candidates: rows.map(r => ({
                  id: r.profileId,
                  userId: r.userId,
                  nickname: r.nickname,
                  level: r.level,
                  title: r.title ?? "",
                  totalOrders: r.totalOrders,
                  avgRating: r.avgRating,
                })),
                instruction: "请将以上 OPC 候选人以 option_choices_json（multi:true）的形式呈现给运营选择。选项格式：'昵称（等级·订单数·评分）'，id 用括号标注在末尾，例如：'张三（A级·15单·4.8）[id:5]'。运营选完后，将所选的 OPC 以 invitedOpcs 数组（含 id 和 nickname）写入 form_suggestion_json。",
              };
            } catch (err) {
              result = { error: `OPC搜索失败: ${(err as Error).message}`, candidates: [] };
            }
          } else if (toolName === "perform_self_check") {
            const MAX_SELF_CHECKS = 10;
            const selfCheckCount = [...historyMessages, ...intermediateMessages]
              .filter(m => m.role === "tool" && m.toolName === "perform_self_check")
              .length;
            result = {
              round: selfCheckCount + 1,
              max_rounds: MAX_SELF_CHECKS,
            };
            logger.info({ agentType, round: selfCheckCount + 1, max_rounds: MAX_SELF_CHECKS }, "🔍 perform_self_check triggered");
          } else {
            result = executeTool(toolName, toolArgs, toolContext);
          }
          const resultStr = JSON.stringify(result);

          // ── Accumulate authoritative values from key tool calls ────────────
          if (toolName === "validate_timeline" && result && typeof result === "object") {
            const r = result as Record<string, unknown>;
            if (r.isReasonable === true) {
              if (typeof r.bidDeadline === "string") accumulated.bidDeadline = r.bidDeadline;
              if (typeof r.deliveryDate === "string") accumulated.deadline = r.deliveryDate;
            }
          }
          if (toolName === "suggest_milestones" && result && typeof result === "object") {
            const r = result as Record<string, unknown>;
            // suggest_milestones also echoes back the dates — update if present
            if (typeof r.bidDeadline === "string") accumulated.bidDeadline = r.bidDeadline;
            if (typeof r.deliveryDate === "string") accumulated.deadline = r.deliveryDate;
            if (Array.isArray(r.milestones)) {
              accumulated.milestones = (r.milestones as Array<Record<string, unknown>>).map(m => ({
                name: String(m.name ?? ""),
                deadline: String(m.deadline ?? ""),
                // tool returns 'description'; form_suggestion_json expects 'deliverableDesc'
                deliverableDesc: String(m.deliverableDesc ?? m.description ?? ""),
              }));
            }
          }

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
          ...(response.reasoningContent !== undefined ? { reasoning_content: response.reasoningContent } : {}),
        });
        llmMessages.push(...toolResultLLMMessages);
        continue;
      }

      // Re-use the already-generated callLLM content to avoid a second LLM call.
      // A second streamLLM call (without tools) tends to produce inconsistent output
      // (e.g. omitting option_choices_json), so we stream the first response directly.
      let finalContent = response.content ?? "";

      if (!finalContent) {
        // Fallback: model returned no content in the non-streaming call, use streamLLM
        try {
          for await (const token of streamLLM(llmMessages)) {
            finalContent += token;
          }
        } catch (streamErr) {
          logger.warn({ streamErr }, "streamLLM fallback also failed");
          finalContent = "";
        }
      }

      // Patch form_suggestion_json with authoritative tool-derived values before streaming
      finalContent = injectAccumulatedData(finalContent);

      if (finalContent) {
        // Stream in word-sized chunks for a natural feel
        const words = finalContent.split(/(?<=\s)|(?=\s)/);
        for (const chunk of words) {
          if (chunk) sendEvent({ type: "token", content: chunk });
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
    const userMsg = "服务暂时繁忙，请稍后重试";
    try {
      await saveAndEndOnError(userMsg);
    } catch {
      res.write(`data: ${JSON.stringify({ type: "error", message: userMsg })}\n\n`);
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
    const { systemPrompt, isEnabled, remark } = req.body as {
      systemPrompt?: string;
      isEnabled?: boolean;
      remark?: string;
    };

    const updateData: Record<string, unknown> = {};
    if (systemPrompt !== undefined) updateData.systemPrompt = systemPrompt;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "没有可更新的字段" });
    }

    // Snapshot current prompt as a version before overwriting
    if (systemPrompt !== undefined) {
      const [current] = await db.select().from(agentConfigsTable).where(eq(agentConfigsTable.id, id)).limit(1);
      if (current) {
        await db.insert(agentConfigPromptVersionsTable).values({
          agentConfigId: id,
          systemPrompt: current.systemPrompt,
          remark: remark ?? null,
        });
      }
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

router.get("/admin/agent-configs/:id/versions", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const versions = await db
      .select()
      .from(agentConfigPromptVersionsTable)
      .where(eq(agentConfigPromptVersionsTable.agentConfigId, id))
      .orderBy(desc(agentConfigPromptVersionsTable.createdAt))
      .limit(50);
    return res.json(versions);
  } catch (error) {
    logger.error({ error }, "Failed to list agent config versions");
    return res.status(500).json({ error: "获取版本历史失败" });
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
