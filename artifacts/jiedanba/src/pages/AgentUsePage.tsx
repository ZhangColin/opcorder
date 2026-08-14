import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute, Link } from "wouter";
import {
  Bot, Workflow, ArrowLeft, Send, Plus, Trash2, MessageSquare, Loader2, History,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { useToast } from "@/hooks/use-toast";
import {
  tGet, tPost, tDelete, formatDate,
  MarketAgentDetail, AgentConversationSummary, AgentConversationDetail,
  AgentChatMessage, AgentChatResponse, ListResponse,
} from "@/components/tools/api";

export default function AgentUsePage() {
  const [, params] = useRoute("/tools/use/:agentId");
  const agentId = Number(params?.agentId);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: agent, isLoading: agentLoading, isError: agentError, error: agentErr } = useQuery({
    queryKey: ["/tools/market/detail", agentId],
    queryFn: () => tGet<MarketAgentDetail>(`/tools/market/${agentId}`),
    enabled: Number.isFinite(agentId),
  });

  const { data: convos } = useQuery({
    queryKey: ["/tools/agent-conversations", agentId],
    queryFn: () => tGet<ListResponse<AgentConversationSummary>>(`/tools/agents/${agentId}/conversations`),
    enabled: Number.isFinite(agentId),
  });

  const loadConvo = async (id: number) => {
    if (chatMut.isPending) return; // 发送期间禁止切换会话,避免结果落错会话
    try {
      const d = await tGet<AgentConversationDetail>(`/tools/agent-conversations/${id}`);
      setConversationId(d.id);
      setMessages(d.messages);
      setShowHistory(false);
    } catch (e: any) {
      toast({ title: "加载会话失败", description: e.message, variant: "destructive" });
    }
  };

  const newConvo = () => {
    if (chatMut.isPending) return;
    setConversationId(null);
    setMessages([]);
    setShowHistory(false);
  };

  const delMut = useMutation({
    mutationFn: (id: number) => tDelete(`/tools/agent-conversations/${id}`),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["/tools/agent-conversations", agentId] });
      if (id === conversationId) newConvo();
    },
    onError: (e: any) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  const chatMut = useMutation({
    mutationFn: (message: string) =>
      tPost<AgentChatResponse>(`/tools/agents/${agentId}/chat`, {
        message,
        ...(conversationId ? { conversationId } : {}),
      }),
    onSuccess: (r) => {
      setConversationId(r.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: r.reply, at: new Date().toISOString() }]);
      qc.invalidateQueries({ queryKey: ["/tools/agent-conversations", agentId] });
    },
    onError: (e: any, sentMessage) => {
      setMessages((m) => m.slice(0, -1)); // 回退乐观加入的用户消息
      setInput((v) => v || sentMessage); // 找回未发送成功的内容（不覆盖用户新输入）
      toast({ title: "发送失败", description: e.message, variant: "destructive" });
    },
  });

  const send = () => {
    const text = input.trim();
    if (!text || chatMut.isPending) return;
    setMessages((m) => [...m, { role: "user", content: text, at: new Date().toISOString() }]);
    setInput("");
    chatMut.mutate(text);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMut.isPending]);

  if (!Number.isFinite(agentId)) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col pt-16 sm:pt-20 max-w-[1200px] w-full mx-auto px-3 sm:px-6 pb-4">
        {/* Header */}
        <div className="flex items-center gap-3 py-3 border-b border-border/50">
          <button onClick={() => navigate("/tools/market")} className="w-9 h-9 rounded-xl border border-border/60 bg-white flex items-center justify-center text-slate-500 hover:text-primary" aria-label="返回市场">
            <ArrowLeft size={17} />
          </button>
          <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center overflow-hidden flex-shrink-0">
            {agent?.iconUrl
              ? <img src={agent.iconUrl} alt={agent.name} className="w-full h-full object-cover" />
              : agent?.appType === "workflow" ? <Workflow size={19} className="text-primary" /> : <Bot size={19} className="text-primary" />}
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-slate-800 truncate">{agentLoading ? "加载中…" : agent?.name ?? "智能体"}</h1>
            {agent && <p className="text-[11px] text-slate-400 truncate">@{agent.authorName ?? "匿名"} · {agent.category ?? "通用"}</p>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowHistory((v) => !v)} className={`md:hidden w-9 h-9 rounded-xl border flex items-center justify-center ${showHistory ? "border-primary text-primary bg-primary/5" : "border-border/60 bg-white text-slate-500"}`} aria-label="使用历史">
              <History size={16} />
            </button>
            <button onClick={newConvo} className="inline-flex items-center gap-1.5 bg-primary text-white rounded-xl px-3.5 py-2 text-sm font-bold hover:bg-primary/90">
              <Plus size={15} />新对话
            </button>
          </div>
        </div>

        {agentError ? (
          <div className="mt-8 text-center text-sm text-red-500">{(agentErr as Error)?.message ?? "加载失败"}</div>
        ) : agent && !agent.usable ? (
          <div className="mt-12 text-center">
            <p className="text-slate-500 mb-4">该智能体为付费应用，订阅后即可使用</p>
            <Link href="/tools/market" className="inline-flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-bold">前往市场订阅</Link>
          </div>
        ) : (
          <div className="flex-1 flex gap-4 min-h-0 mt-4">
            {/* 使用历史 */}
            <aside className={`${showHistory ? "flex" : "hidden"} md:flex w-full md:w-64 flex-shrink-0 flex-col bg-white rounded-2xl border border-border/50 overflow-hidden`}>
              <div className="px-4 py-3 border-b border-border/40 flex items-center gap-2 text-sm font-bold text-slate-700">
                <History size={15} className="text-primary" />使用历史
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {(convos?.items ?? []).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">暂无历史会话</p>
                ) : (convos!.items.map((c) => (
                  <div key={c.id} className={`group flex items-start gap-2 rounded-xl px-3 py-2.5 cursor-pointer mb-1 ${c.id === conversationId ? "bg-primary/8" : "hover:bg-slate-50"}`} onClick={() => loadConvo(c.id)}>
                    <MessageSquare size={14} className={`mt-0.5 flex-shrink-0 ${c.id === conversationId ? "text-primary" : "text-slate-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] truncate ${c.id === conversationId ? "text-primary font-semibold" : "text-slate-600"}`}>{c.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{c.messageCount} 条消息 · {formatDate(c.updatedAt)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); delMut.mutate(c.id); }}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity"
                      aria-label="删除会话"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )))}
              </div>
            </aside>

            {/* 对话区 */}
            <section className={`${showHistory ? "hidden md:flex" : "flex"} flex-1 min-w-0 flex-col bg-white rounded-2xl border border-border/50 overflow-hidden`}>
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" style={{ minHeight: "40vh", maxHeight: "calc(100vh - 20rem)" }}>
                {messages.length === 0 && !chatMut.isPending ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
                    <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mb-4">
                      {agent?.appType === "workflow" ? <Workflow size={26} className="text-primary" /> : <Bot size={26} className="text-primary" />}
                    </div>
                    <p className="font-bold text-slate-700 mb-1">{agent?.name}</p>
                    <p className="text-sm text-slate-400 max-w-md">{agent?.description || "输入你的问题，开始使用这个智能体"}</p>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        m.role === "user" ? "bg-primary text-white rounded-br-md" : "bg-slate-50 text-slate-700 rounded-bl-md"
                      }`}>
                        {renderMessageContent(m.content)}
                      </div>
                    </div>
                  ))
                )}
                {chatMut.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-slate-50 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-slate-400 inline-flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin" />正在思考…
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div className="border-t border-border/40 p-3 sm:p-4">
                <div className="flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                    }}
                    rows={2}
                    placeholder="输入消息，Enter 发送，Shift+Enter 换行"
                    className="flex-1 resize-none rounded-xl border border-border/60 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={send}
                    disabled={!input.trim() || chatMut.isPending}
                    className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 flex-shrink-0"
                    aria-label="发送"
                  >
                    <Send size={17} />
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

/** 渲染消息内容:支持 ![alt](url) 图片语法,其余按纯文本换行显示 */
function renderMessageContent(content: string) {
  const parts = content.split(/(!\[[^\]]*\]\([^)\s]+\))/g);
  if (parts.length === 1) return content;
  return parts.map((part, i) => {
    const m = part.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (!m) return part;
    return (
      <a key={i} href={m[2]} target="_blank" rel="noreferrer" className="block my-2">
        <img
          src={m[2]}
          alt={m[1]}
          className="rounded-xl border border-border/40 max-w-full sm:max-w-[320px] shadow-sm hover:shadow-md transition-shadow"
          loading="lazy"
        />
      </a>
    );
  });
}
