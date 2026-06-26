import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Bot, Loader2, Sparkles, RotateCcw, Wrench, CheckCircle2, ClipboardList, ChevronRight } from "lucide-react";
import { getValidAccessToken } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface FormSuggestion {
  title?: string;
  type?: string;
  description?: string;
  skillTags?: string[];
  opcLevel?: string;
  /** 赛道认证要求 (any/C/B/A) — hidden in publisher form, settable by AI, editable by admin */
  requiredTrackLevel?: string;
  /** @deprecated Use budgetMin / budgetMax */
  budget?: number;
  budgetMin?: number;
  budgetMax?: number;
  isUrgent?: boolean;
  deadline?: string;
  bidDeadline?: string;
  milestones?: Array<{ name: string; deadline: string; deliverableDesc: string }>;
}

/** Output from agent in edit mode — only the description field is updated */
export interface DocUpdate {
  description: string;
}

interface OptionChoices {
  q: string;
  opts: string[];
  multi: boolean;
}

interface ChatMessage {
  role: "user" | "assistant" | "tool_indicator";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  formSuggestion?: FormSuggestion;
  optionChoices?: OptionChoices;
  docUpdate?: DocUpdate;
}

interface AgentChatPanelProps {
  open: boolean;
  onClose: () => void;
  sessionKey: string;
  demandId?: number;
  onFillForm?: (suggestion: FormSuggestion) => void;
  /** Called whenever a doc_update_json is received (edit mode) */
  onDocUpdate?: (update: DocUpdate) => void;
  /** Called whenever the conversationId is established or updated */
  onConversationId?: (conversationId: number) => void;
  /** inline: embedded in layout (no fixed positioning); drawer: slide-in from right on desktop, bottom sheet on mobile (default) */
  mode?: "inline" | "drawer";
  /** Agent scene key — defaults to demand_analysis */
  sceneKey?: string;
  /** "new" (default) or "edit" — controls system prompt context and output format */
  agentMode?: "new" | "edit";
  /** Existing demand data passed to agent when agentMode="edit" */
  existingDemandData?: {
    title?: string;
    type?: string;
    description?: string;
    budgetMin?: number | null;
    budgetMax?: number | null;
    hopeDeliveryDate?: string | null;
  };
}

const DEMAND_TYPE_LABELS: Record<string, string> = {
  education: "教育培训",
  software:  "软件开发",
  marketing: "营销",
  content:   "内容设计",
  other:     "其他",
  ai_education:  "教育培训",
  gov_training:  "教育培训",
  ai_research:   "软件开发",
  ai_tool_dev:   "软件开发",
  ai_marketing:  "营销",
  ai_content:    "内容设计",
  "教育培训": "教育培训",
  "软件开发": "软件开发",
  "营销":    "营销",
  "内容设计": "内容设计",
  "其他":    "其他",
};

/** Normalize AI-returned type value (including new category codes CG/SA/TK/BO/OTHER) to one of the 5 legacy form values */
function normalizeType(raw: string): string {
  const upper = raw.toUpperCase().trim();
  if (upper === "CG") return "content";
  if (upper === "SA") return "software";
  if (upper === "TK") return "education";
  if (upper === "BO") return "marketing";
  if (upper === "OTHER") return "other";
  const lower = raw.toLowerCase();
  if (lower.includes("education") || lower.includes("training") || lower.includes("教育") || lower.includes("培训")) return "education";
  if (lower.includes("software") || lower.includes("dev") || lower.includes("软件") || lower.includes("开发") || lower.includes("research")) return "software";
  if (lower.includes("marketing") || lower.includes("营销")) return "marketing";
  if (lower.includes("content") || lower.includes("design") || lower.includes("内容") || lower.includes("设计")) return "content";
  return "other";
}

const OPC_LEVEL_LABELS: Record<string, string> = {
  C:   "C级·新手（上限 ¥3,000）",
  B:   "B级·进阶（上限 ¥20,000）",
  A:   "A级·专家（上限 ¥200,000）",
  any: "不限等级",
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

function extractJsonObject(str: string): { json: string; end: number } | null {
  const start = str.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (escaped) { escaped = false; continue; }
    if (c === "\\" && inString) { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) return { json: str.slice(start, i + 1), end: i + 1 }; }
  }
  return null;
}

function extractJsonArray(str: string): { json: string; end: number } | null {
  const start = str.indexOf("[");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (escaped) { escaped = false; continue; }
    if (c === "\\" && inString) { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) return { json: str.slice(start, i + 1), end: i + 1 }; }
  }
  return null;
}

function stripCodeBlocks(text: string): string {
  return text.replace(/```[\w]*\n?[\s\S]*?```/g, "").trim();
}

/** Strip DeepSeek DSML tool-call markup and other structural content users should not see */
function stripStructuralContent(text: string): string {
  let result = text
    .replace(/<｜｜DSML｜｜tool_calls>[\s\S]*?<\/｜｜DSML｜｜tool_calls>/g, "")
    .replace(/<｜｜DSML｜｜invoke[\s\S]*?<\/｜｜DSML｜｜invoke>/g, "")
    .replace(/<｜｜DSML｜｜parameter[\s\S]*?<\/｜｜DSML｜｜parameter>/g, "")
    .replace(/<｜｜DSML｜｜[\s\S]*?>/g, "")
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "")
    .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, "")
    .replace(/^\s*\{[\s\S]*?\}\s*$/gm, "")
    .replace(/^\s*"[\w]+":\s*[\[{"].*/gm, "")
    .trim();
  result = result.replace(/\n{3,}/g, "\n\n");
  return result;
}

function parseMessage(content: string): {
  text: string;
  suggestion: FormSuggestion | null;
  optionChoices: OptionChoices | null;
  docUpdate: DocUpdate | null;
} {
  let workingContent = content;
  let suggestion: FormSuggestion | null = null;
  let optionChoices: OptionChoices | null = null;
  let docUpdate: DocUpdate | null = null;

  // Extract doc_update_json: (edit mode output)
  const docUpdateMarker = "doc_update_json:";
  const docUpdateIdx = workingContent.indexOf(docUpdateMarker);
  if (docUpdateIdx !== -1) {
    const afterMarker = workingContent.slice(docUpdateIdx + docUpdateMarker.length);
    const extracted = extractJsonObject(afterMarker);
    if (extracted) {
      try {
        const parsed = JSON.parse(extracted.json) as { description?: string };
        if (parsed.description) {
          docUpdate = { description: parsed.description };
          const before = workingContent.slice(0, docUpdateIdx).trim();
          const after = afterMarker.slice(extracted.end).trim();
          workingContent = after ? `${before}\n\n${after}` : before;
        }
      } catch { /* ignore */ }
    }
  }

  // Extract form_suggestion_json:
  const formMarker = "form_suggestion_json:";
  const formIdx = workingContent.indexOf(formMarker);
  if (formIdx !== -1) {
    const afterMarker = workingContent.slice(formIdx + formMarker.length);
    const extracted = extractJsonObject(afterMarker);
    if (extracted) {
      try {
        suggestion = JSON.parse(extracted.json) as FormSuggestion;
        const before = workingContent.slice(0, formIdx).trim();
        const after = afterMarker.slice(extracted.end).trim();
        workingContent = after ? `${before}\n\n${after}` : before;
      } catch { /* ignore */ }
    }
  }

  // Extract option_choices_json:
  const optMarker = "option_choices_json:";
  const optIdx = workingContent.indexOf(optMarker);
  if (optIdx !== -1) {
    const afterMarker = workingContent.slice(optIdx + optMarker.length);
    // Try object format first
    const extracted = extractJsonObject(afterMarker);
    if (extracted) {
      try {
        const parsed = JSON.parse(extracted.json) as { q?: string; opts?: string[]; multi?: boolean };
        if (parsed.opts && Array.isArray(parsed.opts)) {
          optionChoices = {
            q: parsed.q ?? "",
            opts: parsed.opts,
            multi: parsed.multi ?? false,
          };
          const before = workingContent.slice(0, optIdx).trim();
          const after = afterMarker.slice(extracted.end).trim();
          workingContent = after ? `${before}\n\n${after}` : before;
        }
      } catch { /* ignore */ }
    }
    // Fallback: try array format
    if (!optionChoices) {
      const arrExtracted = extractJsonArray(afterMarker);
      if (arrExtracted) {
        try {
          const opts = JSON.parse(arrExtracted.json) as string[];
          if (Array.isArray(opts)) {
            optionChoices = { q: "", opts, multi: false };
            const before = workingContent.slice(0, optIdx).trim();
            workingContent = before;
          }
        } catch { /* ignore */ }
      }
    }
  }

  // Old code block format
  if (!suggestion) {
    const codeBlockMatch = workingContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1]) as Record<string, unknown>;
        const fs = parsed.formSuggestion as FormSuggestion | undefined;
        if (fs && typeof fs === "object") {
          suggestion = fs;
          workingContent = stripCodeBlocks(workingContent);
        }
      } catch { /* ignore */ }
    }
  }

  const displayText = stripStructuralContent(stripCodeBlocks(workingContent)).trim();

  return { text: displayText || workingContent, suggestion, optionChoices, docUpdate };
}

/** @deprecated Use parseMessage */
function parseFormSuggestion(content: string): { text: string; suggestion: FormSuggestion | null } {
  const { text, suggestion } = parseMessage(content);
  return { text, suggestion };
}

const NEW_WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content: `你好！我是需求分析助手\n\n一起把您的想法梳理成一份清晰、专业的需求文档，让执行方拿到就能动手。\n\n**请先说说：您大概想做什么？** 一句话就行，例如：我要给公司员工做一次AI工具应用培训。`,
  timestamp: new Date().toISOString(),
};

const EDIT_WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content: `你好！我是需求分析助手\n\n我已读取了当前的需求文档内容。您可以告诉我：\n- 哪里描述不够清楚，需要调整\n- 有什么信息需要补充或删除\n- 想换一种表达方式\n\n我会帮您修改需求文档，并输出更新后的版本，您确认后一键更新。\n\n**请说说您想调整什么？**`,
  timestamp: new Date().toISOString(),
};

const WELCOME_MESSAGE = NEW_WELCOME_MESSAGE;

export function AgentChatPanel({ open, onClose, sessionKey, demandId, onFillForm, onDocUpdate, onConversationId, mode = "drawer", sceneKey, agentMode = "new", existingDemandData }: AgentChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (conversationId !== null) {
      onConversationId?.(conversationId);
    }
  }, [conversationId, onConversationId]);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  // Swipe-to-close state for mobile bottom drawer
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);
  const [dragOffset, setDragOffset] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    setDragOffset(0);
  }, [open]);

  const welcomeMessage = agentMode === "edit" ? EDIT_WELCOME_MESSAGE : NEW_WELCOME_MESSAGE;

  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    try {
      const token = await getValidAccessToken(API_BASE);
      const url = demandId
        ? `${API_BASE}/api/agent/demand-analysis/history/${demandId}`
        : `${API_BASE}/api/agent/demand-analysis/history/session?sessionKey=${encodeURIComponent(sessionKey)}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) {
        setHistoryLoaded(true);
        setMessages([welcomeMessage]);
        return;
      }
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessages(
          data.messages.map((m: { role: string; content: string; timestamp: string }) => {
            const { text, suggestion, optionChoices, docUpdate } = parseMessage(m.content ?? "");
            return {
              role: m.role as "user" | "assistant",
              content: text,
              timestamp: m.timestamp,
              formSuggestion: suggestion ?? undefined,
              optionChoices: optionChoices ?? undefined,
              docUpdate: docUpdate ?? undefined,
            };
          })
        );
      } else {
        setMessages([welcomeMessage]);
      }
      if (data.conversationId) setConversationId(data.conversationId);
      setHistoryLoaded(true);
    } catch {
      setHistoryLoaded(true);
      setMessages([welcomeMessage]);
    }
  }, [sessionKey, demandId, historyLoaded, welcomeMessage]);

  useEffect(() => {
    if (open) {
      loadHistory();
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [open, loadHistory]);

  const sendMessageText = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput("");

    setMessages((prev) => [...prev, { role: "user", content: text, timestamp: new Date().toISOString() }]);
    setLoading(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "", timestamp: new Date().toISOString(), isStreaming: true }]);

    abortRef.current = new AbortController();

    try {
      const token = await getValidAccessToken(API_BASE);
      const res = await fetch(`${API_BASE}/api/agent/demand-analysis/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text.trim(),
          sessionKey,
          conversationId: conversationId ?? undefined,
          demandId: demandId ?? undefined,
          ...(sceneKey ? { sceneKey } : {}),
          ...(agentMode === "edit" ? { mode: "edit" } : {}),
          ...(agentMode === "edit" && existingDemandData ? { existingDemandData } : {}),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error(`请求失败 (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let rawContent = "";

      const updateLastMsg = (patch: Partial<ChatMessage>) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.role === "assistant") next[next.length - 1] = { ...last, ...patch };
          return next;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          let event: Record<string, unknown>;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "conversation_id" && typeof event.conversationId === "number") {
            setConversationId(event.conversationId);
          } else if (event.type === "token" && typeof event.content === "string") {
            rawContent += event.content;
            const { text: displayText, suggestion, optionChoices, docUpdate } = parseMessage(rawContent);
            updateLastMsg({
              content: displayText,
              isStreaming: true,
              formSuggestion: suggestion ?? undefined,
              optionChoices: optionChoices ?? undefined,
              docUpdate: docUpdate ?? undefined,
            });
          } else if (event.type === "tool_call" && typeof event.tool === "string") {
            const label = TOOL_LABEL_MAP[event.tool as string] ?? event.tool as string;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant" && last.isStreaming) {
                next.splice(next.length - 1, 0, {
                  role: "tool_indicator",
                  content: label,
                  timestamp: new Date().toISOString(),
                });
              }
              return next;
            });
          } else if (event.type === "done") {
            const { text: finalText, suggestion: finalSuggestion, optionChoices: finalChoices, docUpdate: finalDocUpdate } = parseMessage(rawContent);
            updateLastMsg({
              content: finalText,
              formSuggestion: finalSuggestion ?? undefined,
              optionChoices: finalChoices ?? undefined,
              docUpdate: finalDocUpdate ?? undefined,
              isStreaming: false,
            });
          } else if (event.type === "error") {
            updateLastMsg({ content: `出了点问题，请重试。（${event.message ?? ""}）`, isStreaming: false });
          }
        }
      }

      updateLastMsg({ isStreaming: false });
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant" && last.isStreaming) {
          next[next.length - 1] = { ...last, content: "连接出现问题，请检查网络后重试。", isStreaming: false };
        }
        return next;
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [loading, sessionKey, conversationId, demandId, agentMode, existingDemandData]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    sendMessageText(text);
  }, [input, sendMessageText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleClear = () => {
    if (loading) { abortRef.current?.abort(); setLoading(false); }
    setMessages([welcomeMessage]);
    setConversationId(null);
  };

  // Touch handlers for swipe-down-to-close on mobile bottom drawer
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0) {
      dragCurrentY.current = delta;
      setDragOffset(delta);
    }
  };

  const handleTouchEnd = () => {
    const threshold = 120;
    if (dragCurrentY.current > threshold) {
      onClose();
    }
    dragStartY.current = null;
    dragCurrentY.current = 0;
    setDragOffset(0);
  };

  // Determine which message should show choices (last non-streaming assistant msg)
  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant" && !messages[i].isStreaming) return i;
    }
    return -1;
  })();

  const panelContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-primary/5 to-blue-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-blue-900">需求分析助手</p>
            <p className="text-xs text-slate-400">帮您梳理需求、生成文档</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleClear} title="清空对话" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <RotateCcw size={15} />
          </button>
          <button onClick={onClose} title="收起助手" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !historyLoaded && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles size={28} className="text-primary" />
            </div>
            <p className="text-sm text-slate-400">加载中…</p>
          </div>
        )}

        {messages.map((msg, idx) => {
          if (msg.role === "tool_indicator") {
            return (
              <div key={idx} className="flex items-center gap-2 text-xs text-slate-400 px-1">
                <Wrench size={11} className="shrink-0 text-amber-500" />
                <span>正在查询：{msg.content}</span>
              </div>
            );
          }

          if (msg.role === "user") {
            return (
              <div key={idx} className="flex justify-end">
                <div className="max-w-[82%] bg-primary text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
                  {msg.content}
                </div>
              </div>
            );
          }

          const isLastAssistant = idx === lastAssistantIdx;

          return (
            <div key={idx} className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                {msg.content && (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 leading-relaxed shadow-sm">
                    <FormattedContent content={msg.content} />
                    {msg.isStreaming && msg.content && (
                      <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
                    )}
                  </div>
                )}
                {!msg.content && msg.isStreaming && (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm">
                    <span className="inline-flex items-center gap-1.5 text-slate-400">
                      <Loader2 size={13} className="animate-spin" />
                      思考中…
                    </span>
                  </div>
                )}

                {/* Option choices — only on last assistant message, when not streaming */}
                {isLastAssistant && msg.optionChoices && !msg.isStreaming && (
                  <OptionChoicesCard
                    choices={msg.optionChoices}
                    onSelect={(text) => sendMessageText(text)}
                    onCustom={(prefill) => {
                      setInput(prefill);
                      setTimeout(() => textareaRef.current?.focus(), 50);
                    }}
                  />
                )}

                {/* Doc update card (edit mode) */}
                {msg.docUpdate && !msg.isStreaming && (
                  <DocUpdateCard
                    update={msg.docUpdate}
                    onApply={() => {
                      onDocUpdate?.(msg.docUpdate!);
                      onClose();
                    }}
                  />
                )}

                {/* Form suggestion card */}
                {msg.formSuggestion && !msg.isStreaming && (
                  <FormSuggestionCard
                    suggestion={msg.formSuggestion}
                    onFill={() => {
                      onFillForm?.(msg.formSuggestion!);
                      onClose();
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-slate-100 bg-white shrink-0">
        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="直接输入，或选择上方选项… (Enter 发送，Shift+Enter 换行)"
            rows={2}
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none resize-none leading-relaxed"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="shrink-0 w-9 h-9 flex items-center justify-center bg-primary text-white rounded-xl disabled:opacity-40 hover:bg-primary/90 transition-all shadow-sm"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </>
  );

  if (mode === "inline") {
    return (
      <div className="flex flex-col h-full bg-white">
        {panelContent}
      </div>
    );
  }

  // Mobile: bottom sheet drawer
  if (isMobile) {
    return (
      <>
        <div
          className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={drawerRef}
          className="fixed left-0 right-0 bottom-0 z-50 bg-white flex flex-col rounded-t-2xl shadow-2xl transition-transform duration-300 ease-in-out"
          style={{
            height: "78vh",
            transform: open ? `translateY(${dragOffset}px)` : "translateY(100%)",
            transition: dragOffset > 0 ? "none" : undefined,
          }}
        >
          <div
            className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>
          {panelContent}
        </div>
      </>
    );
  }

  // Desktop: wide right-side panel
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`fixed top-0 bottom-0 right-0 z-50 bg-white flex flex-col shadow-[-8px_0_40px_-4px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-in-out`}
        style={{
          left: "calc(16rem + (100vw - 16rem) * 0.15)",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {panelContent}
      </div>
    </>
  );
}

/* ─── Option Choices Card ─────────────────────────────────────────── */

function OptionChoicesCard({
  choices,
  onSelect,
  onCustom,
}: {
  choices: OptionChoices;
  onSelect: (text: string) => void;
  onCustom: (prefill: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const CUSTOM_OPT = "其他，我来说明";

  const handleSingleClick = (opt: string) => {
    if (opt === CUSTOM_OPT) {
      onCustom("");
      return;
    }
    onSelect(opt);
  };

  const handleMultiToggle = (opt: string) => {
    if (opt === CUSTOM_OPT) {
      onCustom(Array.from(selected).filter(o => o !== CUSTOM_OPT).join("、"));
      return;
    }
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(opt)) next.delete(opt);
      else next.add(opt);
      return next;
    });
  };

  const handleMultiConfirm = () => {
    if (selected.size === 0) return;
    onSelect(Array.from(selected).join("、"));
  };

  if (!choices.multi) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 px-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary/70 bg-primary/8 border border-primary/15 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 inline-block" />
            单选
          </span>
          {choices.q && <p className="text-xs text-slate-400">{choices.q}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {choices.opts.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSingleClick(opt)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-all font-medium ${
                opt === CUSTOM_OPT
                  ? "border-slate-200 text-slate-500 bg-white hover:bg-slate-50"
                  : "border-primary/25 text-primary bg-primary/5 hover:bg-primary/12 hover:border-primary/50"
              }`}
            >
              {opt === CUSTOM_OPT ? (
                <>
                  <span>{opt}</span>
                  <ChevronRight size={11} className="opacity-60" />
                </>
              ) : (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-primary/40 inline-block shrink-0" />
                  {opt}
                </>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Multi-select
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 px-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary/70 bg-primary/8 border border-primary/15 rounded-full px-2 py-0.5">
          <span className="w-3 h-3 rounded-sm border-2 border-primary/50 inline-block" />
          多选·选完点确认
        </span>
        {choices.q && <p className="text-xs text-slate-400">{choices.q}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {choices.opts.map((opt, i) => {
          const isSelected = selected.has(opt);
          if (opt === CUSTOM_OPT) {
            return (
              <button
                key={i}
                onClick={() => handleMultiToggle(opt)}
                className="flex items-center gap-1 text-xs px-3 py-2 rounded-xl border border-slate-200 text-slate-500 bg-white hover:bg-slate-50 transition-all font-medium"
              >
                <span>{opt}</span>
                <ChevronRight size={11} className="opacity-60" />
              </button>
            );
          }
          return (
            <button
              key={i}
              onClick={() => handleMultiToggle(opt)}
              className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-all font-medium ${
                isSelected
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-primary/25 text-primary bg-primary/5 hover:bg-primary/12"
              }`}
            >
              <span className={`w-3 h-3 rounded-sm border-2 inline-block shrink-0 transition-all ${
                isSelected ? "border-white/70 bg-white/20" : "border-primary/40"
              }`} />
              {opt}
            </button>
          );
        })}
      </div>
      <button
        onClick={handleMultiConfirm}
        disabled={selected.size === 0}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        <CheckCircle2 size={13} />
        {selected.size > 0 ? `确认选择（已选 ${selected.size} 项）` : "请先选择选项"}
      </button>
    </div>
  );
}

/* ─── Doc Update Card (edit mode) ────────────────────────────────── */

function DocUpdateCard({ update, onApply }: { update: DocUpdate; onApply: () => void }) {
  const [applied, setApplied] = useState(false);
  const preview = update.description.slice(0, 120) + (update.description.length > 120 ? "…" : "");

  const handleApply = () => {
    onApply();
    setApplied(true);
  };

  return (
    <div className="border border-emerald-200 bg-emerald-50/60 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-100/80 border-b border-emerald-200">
        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
        <p className="text-xs font-extrabold text-emerald-800">需求文档已更新</p>
        <span className="ml-auto text-[10px] text-slate-400">确认后一键写入</span>
      </div>
      <div className="px-4 py-3">
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{preview}</p>
      </div>
      <div className="px-4 pb-3">
        <button
          onClick={handleApply}
          disabled={applied}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
            applied
              ? "bg-green-50 text-green-600 border border-green-200"
              : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
          }`}
        >
          {applied ? (
            <><CheckCircle2 size={13} /> 已更新到表单</>
          ) : (
            <><ClipboardList size={13} /> 一键更新需求文档</>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── Form Suggestion Card ────────────────────────────────────────── */

function FormSuggestionCard({ suggestion, onFill }: { suggestion: FormSuggestion; onFill: () => void }) {
  const [filled, setFilled] = useState(false);

  const rows: Array<{ label: string; value: string }> = [];
  if (suggestion.title) rows.push({ label: "需求标题", value: suggestion.title });
  if (suggestion.type) {
    const normalized = normalizeType(suggestion.type);
    rows.push({ label: "需求类型", value: DEMAND_TYPE_LABELS[normalized] ?? DEMAND_TYPE_LABELS[suggestion.type] ?? suggestion.type });
  }
  if (suggestion.description) rows.push({ label: "需求描述", value: suggestion.description.slice(0, 80) + (suggestion.description.length > 80 ? "…" : "") });
  if (suggestion.skillTags?.length) rows.push({ label: "技能标签", value: suggestion.skillTags.join("、") });
  if (suggestion.opcLevel) rows.push({ label: "OPC等级", value: OPC_LEVEL_LABELS[suggestion.opcLevel] ?? suggestion.opcLevel });

  const bMin = suggestion.budgetMin ?? suggestion.budget;
  const bMax = suggestion.budgetMax ?? suggestion.budget;
  if (bMin && bMax && bMin !== bMax) {
    rows.push({ label: "预算区间", value: `¥${bMin.toLocaleString()} — ¥${bMax.toLocaleString()}` });
  } else if (bMin || bMax) {
    rows.push({ label: "预算金额", value: `¥${(bMin ?? bMax)!.toLocaleString()}` });
  }

  if (suggestion.milestones?.length) rows.push({ label: "里程碑", value: `共 ${suggestion.milestones.length} 个阶段` });

  const handleFill = () => {
    onFill();
    setFilled(true);
  };

  return (
    <div className="border border-primary/20 bg-blue-50/50 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 bg-primary/10 border-b border-primary/10">
        <ClipboardList size={14} className="text-primary shrink-0" />
        <p className="text-xs font-extrabold text-primary">需求表单建议</p>
        <span className="ml-auto text-[10px] text-slate-400">请确认后填入</span>
      </div>
      <div className="px-4 py-3 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="shrink-0 text-slate-400 w-14 text-right">{row.label}</span>
            <span className="flex-1 text-slate-700 font-medium leading-relaxed">{row.value}</span>
          </div>
        ))}
      </div>
      <div className="px-4 pb-3">
        <button
          onClick={handleFill}
          disabled={filled}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
            filled
              ? "bg-green-50 text-green-600 border border-green-200"
              : "bg-primary text-white hover:bg-primary/90 shadow-sm"
          }`}
        >
          {filled ? (
            <><CheckCircle2 size={13} /> 已填入表单</>
          ) : (
            <><ClipboardList size={13} /> 一键填入表单</>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── Markdown Renderer ───────────────────────────────────────────── */

/** Render inline markdown: **bold**, *italic*, `code` */
function renderInline(text: string): React.ReactNode {
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2] !== undefined) {
      parts.push(<strong key={key++} className="font-bold text-slate-800">{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      parts.push(<em key={key++} className="italic text-slate-700">{match[3]}</em>);
    } else if (match[4] !== undefined) {
      parts.push(<code key={key++} className="bg-slate-100 rounded px-1 text-xs font-mono text-slate-700">{match[4]}</code>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length === 0 ? text : parts.length === 1 ? parts[0] : <>{parts}</>;
}

/** Returns true if a line looks like raw JSON or structural markup users shouldn't see */
function isStructuralLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (t.includes("｜｜DSML｜｜") || t.startsWith("<tool_call") || t.startsWith("</tool_call") || t.startsWith("<function_call")) return true;
  if ((t === "{" || t === "}" || t === "[" || t === "]" || t === "}," || t === "]," )) return true;
  if (/^"[\w]+":\s*/.test(t)) return true;
  if (t.startsWith("{") && t.endsWith("}") && t.length > 2) {
    try { JSON.parse(t); return true; } catch { /* not valid JSON */ }
  }
  return false;
}

function FormattedContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("```") || line.startsWith("form_suggestion_json:") || line.startsWith("option_choices_json:")) return null;
        if (isStructuralLine(line)) return null;

        if (line.startsWith("### ")) return <p key={i} className="font-extrabold text-blue-900 text-sm mt-2 first:mt-0">{renderInline(line.slice(4))}</p>;
        if (line.startsWith("## ")) return <p key={i} className="font-extrabold text-blue-900 mt-2 first:mt-0">{renderInline(line.slice(3))}</p>;
        if (line.startsWith("# ")) return <p key={i} className="font-extrabold text-blue-900 text-base mt-2 first:mt-0">{renderInline(line.slice(2))}</p>;

        if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
          return <p key={i} className="font-bold text-slate-800">{line.trim().slice(2, -2)}</p>;
        }

        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <p key={i} className="flex gap-2">
              <span className="shrink-0 text-primary mt-0.5">·</span>
              <span>{renderInline(line.slice(2))}</span>
            </p>
          );
        }

        if (line.match(/^\d+\.\s/)) {
          const m = line.match(/^(\d+)\.\s(.*)/)!;
          return <p key={i} className="flex gap-2"><span className="shrink-0 font-bold text-primary">{m[1]}.</span><span>{renderInline(m[2])}</span></p>;
        }

        if (line.trim() === "") return <div key={i} className="h-1" />;

        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

const TOOL_LABEL_MAP: Record<string, string> = {
  get_requirement_template: "需求文档模板",
  get_demand_types: "需求类型",
  get_skill_tags: "技能标签",
  get_opc_levels: "OPC等级信息",
  suggest_milestones: "里程碑方案",
  estimate_budget: "预算参考",
  validate_timeline: "时间合理性验证",
};

// Keep backward compat export
export { parseFormSuggestion };
