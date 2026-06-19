import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Bot, Loader2, Sparkles, RotateCcw, Scissors, ClipboardList, CheckCircle2 } from "lucide-react";
import { getValidAccessToken } from "@/lib/auth";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface SplitSuggestion {
  title: string;
  detail: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  splits?: SplitSuggestion[];
}

interface AiSplitPanelProps {
  open: boolean;
  onClose: () => void;
  clientDemand: { id: number; title: string; detail?: string | null } | null;
  onApply: (suggestion: SplitSuggestion) => void;
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

function parseSplitMessage(content: string): { text: string; splits: SplitSuggestion[] | null } {
  const marker = "split_suggestion_json:";
  const idx = content.indexOf(marker);
  if (idx === -1) return { text: content, splits: null };

  const afterMarker = content.slice(idx + marker.length);
  const extracted = extractJsonArray(afterMarker);
  if (!extracted) return { text: content, splits: null };

  try {
    const parsed = JSON.parse(extracted.json) as Array<{ title?: string; detail?: string }>;
    const splits: SplitSuggestion[] = parsed
      .filter(s => s.title)
      .map(s => ({ title: s.title!, detail: s.detail ?? "" }));
    const before = content.slice(0, idx).trim();
    const after = afterMarker.slice(extracted.end).trim();
    const text = after ? `${before}\n\n${after}` : before;
    return { text: text || before, splits: splits.length > 0 ? splits : null };
  } catch {
    return { text: content, splits: null };
  }
}

function renderInline(text: string): React.ReactNode {
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[2] !== undefined) parts.push(<strong key={key++} className="font-bold">{match[2]}</strong>);
    else if (match[3] !== undefined) parts.push(<em key={key++}>{match[3]}</em>);
    else if (match[4] !== undefined) parts.push(<code key={key++} className="bg-slate-100 rounded px-1 text-xs font-mono">{match[4]}</code>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length === 0 ? text : parts.length === 1 ? parts[0] : <>{parts}</>;
}

function FormattedContent({ content }: { content: string }) {
  const lines = content.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("split_suggestion_json:")) return null;
        if (line.startsWith("### ")) return <p key={i} className="font-extrabold text-blue-900 text-sm mt-2 first:mt-0">{renderInline(line.slice(4))}</p>;
        if (line.startsWith("## ")) return <p key={i} className="font-extrabold text-blue-900 mt-2 first:mt-0">{renderInline(line.slice(3))}</p>;
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return <p key={i} className="flex gap-2"><span className="shrink-0 text-primary mt-0.5">·</span><span>{renderInline(line.slice(2))}</span></p>;
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function SplitCard({ split, onApply }: { split: SplitSuggestion; onApply: () => void }) {
  const [applied, setApplied] = useState(false);
  const handleApply = () => { onApply(); setApplied(true); };
  return (
    <div className="border border-violet-200 bg-violet-50/60 rounded-xl overflow-hidden shadow-sm">
      <div className="px-3 py-2 bg-violet-100 border-b border-violet-200 flex items-center gap-2">
        <Scissors size={12} className="text-violet-600 shrink-0" />
        <p className="text-xs font-bold text-violet-800 flex-1 truncate">{split.title}</p>
      </div>
      {split.detail && (
        <div className="px-3 py-2 text-xs text-slate-600 leading-relaxed line-clamp-3 whitespace-pre-wrap">
          {split.detail.slice(0, 160)}{split.detail.length > 160 ? "…" : ""}
        </div>
      )}
      <div className="px-3 pb-2">
        <button
          onClick={handleApply}
          disabled={applied}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
            applied ? "bg-green-50 text-green-600 border border-green-200" : "bg-violet-600 text-white hover:bg-violet-700"
          }`}
        >
          {applied ? <><CheckCircle2 size={12} /> 已应用</> : <><ClipboardList size={12} /> 应用到表单</>}
        </button>
      </div>
    </div>
  );
}

export function AiSplitPanel({ open, onClose, clientDemand, onApply }: AiSplitPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [autoSent, setAutoSent] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevClientDemandId = useRef<number | null>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 300);
  }, [open]);

  const sendMessageText = useCallback(async (text: string, isAuto = false) => {
    if (!text.trim() || loading) return;
    setInput("");
    if (!isAuto) {
      setMessages(prev => [...prev, { role: "user", content: text, timestamp: new Date().toISOString() }]);
    }
    setLoading(true);
    setMessages(prev => [...prev, { role: "assistant", content: "", timestamp: new Date().toISOString(), isStreaming: true }]);

    abortRef.current = new AbortController();
    try {
      const token = await getValidAccessToken(API_BASE);
      const sessionKey = clientDemand ? `v2_outsource_split_${clientDemand.id}` : `v2_outsource_split_new`;
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
          sceneKey: "v2_outsource_split",
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error(`请求失败 (${res.status})`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let rawContent = "";

      const updateLastMsg = (patch: Partial<ChatMessage>) => {
        setMessages(prev => {
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
            const { text: displayText, splits } = parseSplitMessage(rawContent);
            updateLastMsg({ content: displayText, isStreaming: true, splits: splits ?? undefined });
          } else if (event.type === "done") {
            const { text: finalText, splits } = parseSplitMessage(rawContent);
            updateLastMsg({ content: finalText, splits: splits ?? undefined, isStreaming: false });
          } else if (event.type === "error") {
            updateLastMsg({ content: `出了点问题，请重试。（${event.message ?? ""}）`, isStreaming: false });
          }
        }
      }
      updateLastMsg({ isStreaming: false });
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      setMessages(prev => {
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
  }, [loading, conversationId, clientDemand]);

  useEffect(() => {
    if (!open || !clientDemand) return;
    if (prevClientDemandId.current === clientDemand.id && autoSent) return;
    prevClientDemandId.current = clientDemand.id;
    setMessages([]);
    setConversationId(null);
    setAutoSent(true);
    const detailPart = clientDemand.detail?.trim()
      ? `\n\n需求详情：\n${clientDemand.detail.trim()}`
      : "";
    const autoMsg = `请分析以下客户需求并给出外包拆分建议：\n\n需求标题：${clientDemand.title}${detailPart}`;
    setTimeout(() => sendMessageText(autoMsg, true), 100);
  }, [open, clientDemand]);

  const handleClear = () => {
    if (loading) { abortRef.current?.abort(); setLoading(false); }
    setMessages([]);
    setConversationId(null);
    setAutoSent(false);
    prevClientDemandId.current = null;
  };

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    sendMessageText(text);
  }, [input, sendMessageText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

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
          width: "min(480px, calc(100vw - 4rem))",
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-purple-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-sm">
              <Bot size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-violet-900">AI辅助拆分</p>
              <p className="text-xs text-slate-400">分析客户需求，生成外包拆分方案</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleClear} title="重新分析" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <RotateCcw size={15} />
            </button>
            <button onClick={onClose} title="关闭" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center">
                <Sparkles size={28} className="text-violet-600" />
              </div>
              <p className="text-sm text-slate-400">请先选择要拆分的客户需求</p>
            </div>
          )}

          {messages.map((msg, idx) => {
            if (msg.role === "user") {
              return (
                <div key={idx} className="flex justify-end">
                  <div className="max-w-[82%] bg-violet-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
                    {msg.content}
                  </div>
                </div>
              );
            }
            return (
              <div key={idx} className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={14} className="text-violet-600" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  {msg.content && (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 leading-relaxed shadow-sm">
                      <FormattedContent content={msg.content} />
                      {msg.isStreaming && msg.content && (
                        <span className="inline-block w-0.5 h-4 bg-violet-600 ml-0.5 animate-pulse align-middle" />
                      )}
                    </div>
                  )}
                  {!msg.content && msg.isStreaming && (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm shadow-sm">
                      <span className="inline-flex items-center gap-1.5 text-slate-400">
                        <Loader2 size={13} className="animate-spin" />
                        分析中…
                      </span>
                    </div>
                  )}
                  {msg.splits && !msg.isStreaming && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-500 px-1">拆分方案建议</p>
                      {msg.splits.map((split, si) => (
                        <SplitCard key={si} split={split} onApply={() => onApply(split)} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-4 border-t border-slate-100 bg-white shrink-0">
          <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus-within:ring-2 focus-within:ring-violet-300 focus-within:border-violet-400 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="追问或调整拆分方案… (Enter 发送)"
              rows={2}
              className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none resize-none leading-relaxed"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="shrink-0 w-9 h-9 flex items-center justify-center bg-violet-600 text-white rounded-xl disabled:opacity-40 hover:bg-violet-700 transition-all shadow-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <p className="text-[10px] text-slate-300 text-center mt-2">AI建议仅供参考，应用后请核对表单内容</p>
        </div>
      </div>
    </>
  );
}
