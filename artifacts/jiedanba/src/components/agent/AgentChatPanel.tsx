import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Bot, Loader2, Sparkles, RotateCcw, Wrench, CheckCircle2, ClipboardList } from "lucide-react";
import { getValidAccessToken } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface FormSuggestion {
  title?: string;
  type?: string;
  description?: string;
  skillTags?: string[];
  opcLevel?: string;
  budget?: number;
  isUrgent?: boolean;
  milestones?: Array<{ name: string; deadline: string; deliverableDesc: string }>;
}

interface ChatMessage {
  role: "user" | "assistant" | "tool_indicator";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  formSuggestion?: FormSuggestion;
}

interface AgentChatPanelProps {
  open: boolean;
  onClose: () => void;
  sessionKey: string;
  demandId?: number;
  onFillForm?: (suggestion: FormSuggestion) => void;
  /** Called whenever the conversationId is established or updated */
  onConversationId?: (conversationId: number) => void;
  /** inline: embedded in layout (no fixed positioning); drawer: slide-in from right on desktop, bottom sheet on mobile (default) */
  mode?: "inline" | "drawer";
}

const DEMAND_TYPE_LABELS: Record<string, string> = {
  ai_education:     "AI教育课程开发",
  gov_training:     "政企AI培训",
  ai_research:      "AI研学项目",
  party_building:   "党建AI应用",
  livestream_media: "直播与新媒体",
  ai_tool_dev:      "AI工具开发定制",
  other:            "其他",
};

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

function stripCodeBlocks(text: string): string {
  // Remove ```lang...``` fenced code blocks entirely (they contain JSON not meant for display)
  return text.replace(/```[\w]*\n?[\s\S]*?```/g, "").trim();
}

function parseFormSuggestion(content: string): { text: string; suggestion: FormSuggestion | null } {
  // Format 1 (new): form_suggestion_json:{...} — marker + inline JSON
  const marker = "form_suggestion_json:";
  const idx = content.indexOf(marker);
  if (idx !== -1) {
    const afterMarker = content.slice(idx + marker.length);
    const extracted = extractJsonObject(afterMarker);
    if (extracted) {
      try {
        const suggestion = JSON.parse(extracted.json) as FormSuggestion;
        const textBefore = content.slice(0, idx).trim();
        const textAfter = afterMarker.slice(extracted.end).trim();
        const displayText = textAfter ? `${textBefore}\n\n${textAfter}` : textBefore;
        return { text: stripCodeBlocks(displayText).trim(), suggestion };
      } catch { /* fall through */ }
    }
  }

  // Format 2 (old): ```json { "formSuggestion": {...} } ``` code block
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]) as Record<string, unknown>;
      const fs = parsed.formSuggestion as FormSuggestion | undefined;
      if (fs && typeof fs === "object") {
        const textWithout = stripCodeBlocks(content);
        return { text: textWithout, suggestion: fs };
      }
    } catch { /* fall through */ }
  }

  // No suggestion — still strip any stray code blocks so JSON never shows raw
  const stripped = stripCodeBlocks(content);
  return { text: stripped !== content ? stripped : content, suggestion: null };
}

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content: `你好！我是需求分析助手\n\n我会通过几个简短的问题，帮您：\n- 理清需求描述，让OPC一看就懂\n- 拆解合理的里程碑阶段\n- 估算合适的预算范围\n\n**请先告诉我：您想发布什么类型的需求？** 可以用一句话简单描述，例如：我需要开发一套AI赋能党建培训课程。`,
  timestamp: new Date().toISOString(),
};

export function AgentChatPanel({ open, onClose, sessionKey, demandId, onFillForm, onConversationId, mode = "drawer" }: AgentChatPanelProps) {
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

  // Reset drag offset when drawer opens/closes
  useEffect(() => {
    setDragOffset(0);
  }, [open]);

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
        setMessages([WELCOME_MESSAGE]);
        return;
      }
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessages(
          data.messages.map((m: { role: string; content: string; timestamp: string }) => {
            const { text, suggestion } = parseFormSuggestion(m.content ?? "");
            return {
              role: m.role as "user" | "assistant",
              content: text,
              timestamp: m.timestamp,
              formSuggestion: suggestion ?? undefined,
            };
          })
        );
      } else {
        setMessages([WELCOME_MESSAGE]);
      }
      if (data.conversationId) setConversationId(data.conversationId);
      setHistoryLoaded(true);
    } catch {
      setHistoryLoaded(true);
      setMessages([WELCOME_MESSAGE]);
    }
  }, [sessionKey, demandId, historyLoaded]);

  useEffect(() => {
    if (open) {
      loadHistory();
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, [open, loadHistory]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
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
        body: JSON.stringify({ message: text, sessionKey, conversationId: conversationId ?? undefined, demandId: demandId ?? undefined }),
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
            const { text: displayText, suggestion } = parseFormSuggestion(rawContent);
            updateLastMsg({
              content: displayText,
              isStreaming: true,
              formSuggestion: suggestion ?? undefined,
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
            const { text: finalText, suggestion: finalSuggestion } = parseFormSuggestion(rawContent);
            updateLastMsg({
              content: finalText,
              formSuggestion: finalSuggestion ?? undefined,
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
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleClear = () => {
    if (loading) { abortRef.current?.abort(); setLoading(false); }
    setMessages([WELCOME_MESSAGE]);
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

  const panelContent = (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-primary/5 to-blue-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-blue-900">需求分析助手</p>
            <p className="text-xs text-slate-400">一步步帮您填好表单</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleClear} title="清空对话" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <RotateCcw size={15} />
          </button>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={15} />
          </button>
        </div>
      </div>

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
                {msg.formSuggestion && !msg.isStreaming && (
                  <FormSuggestionCard
                    suggestion={msg.formSuggestion}
                    onFill={() => onFillForm?.(msg.formSuggestion!)}
                  />
                )}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 py-4 border-t border-slate-100 bg-white shrink-0">
        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="告诉我您的需求… (Enter 发送，Shift+Enter 换行)"
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
        <p className="text-[10px] text-slate-300 text-center mt-2">AI建议仅供参考，填入后请核对表单内容</p>
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
        {/* Backdrop */}
        <div
          className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Bottom sheet */}
        <div
          ref={drawerRef}
          className={`fixed left-0 right-0 bottom-0 z-50 bg-white flex flex-col rounded-t-2xl shadow-2xl transition-transform duration-300 ease-in-out`}
          style={{
            height: "70vh",
            transform: open
              ? `translateY(${dragOffset}px)`
              : "translateY(100%)",
            transition: dragOffset > 0 ? "none" : undefined,
          }}
        >
          {/* Drag handle */}
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

  // Desktop: right-side drawer
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`fixed top-0 right-0 bottom-0 z-50 w-[440px] max-w-[95vw] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}>
        {panelContent}
      </div>
    </>
  );
}

function FormSuggestionCard({ suggestion, onFill }: { suggestion: FormSuggestion; onFill: () => void }) {
  const [filled, setFilled] = useState(false);

  const rows: Array<{ label: string; value: string }> = [];
  if (suggestion.title) rows.push({ label: "需求标题", value: suggestion.title });
  if (suggestion.type) rows.push({ label: "需求类型", value: DEMAND_TYPE_LABELS[suggestion.type] ?? suggestion.type });
  if (suggestion.description) rows.push({ label: "需求描述", value: suggestion.description.slice(0, 80) + (suggestion.description.length > 80 ? "…" : "") });
  if (suggestion.skillTags?.length) rows.push({ label: "技能标签", value: suggestion.skillTags.join("、") });
  if (suggestion.opcLevel) rows.push({ label: "OPC等级", value: OPC_LEVEL_LABELS[suggestion.opcLevel] ?? suggestion.opcLevel });
  if (suggestion.budget) rows.push({ label: "预算金额", value: `¥${suggestion.budget.toLocaleString()}` });
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

function FormattedContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("```") || line.startsWith("form_suggestion_json:")) return null;
        if (line.startsWith("### ")) return <p key={i} className="font-extrabold text-blue-900 text-sm mt-2 first:mt-0">{line.slice(4)}</p>;
        if (line.startsWith("## ")) return <p key={i} className="font-extrabold text-blue-900 mt-2 first:mt-0">{line.slice(3)}</p>;
        if (line.startsWith("**") && line.endsWith("**") && line.length > 4) return <p key={i} className="font-bold text-slate-800">{line.slice(2, -2)}</p>;
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <p key={i} className="flex gap-2">
              <span className="shrink-0 text-primary mt-0.5">·</span>
              <span>{line.slice(2)}</span>
            </p>
          );
        }
        if (line.match(/^\d+\.\s/)) {
          const m = line.match(/^(\d+)\.\s(.*)/)!;
          return <p key={i} className="flex gap-2"><span className="shrink-0 font-bold text-primary">{m[1]}.</span><span>{m[2]}</span></p>;
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

const TOOL_LABEL_MAP: Record<string, string> = {
  get_demand_types: "需求类型",
  get_skill_tags: "技能标签",
  get_opc_levels: "OPC等级信息",
  suggest_milestones: "里程碑方案",
  estimate_budget: "预算参考",
};
