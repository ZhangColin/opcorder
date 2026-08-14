import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Search, Bot, Workflow, Heart, Star, ArrowRight, Upload, Store, X, Play, Users, Loader2 } from "lucide-react";
import { MarketResponse, AppType, CATEGORIES, tGet, tPost, formatPrice, formatDate, SubscribeResponse, MarketAgentDetail } from "./api";
import { EmptyState, Loading, ErrorBanner, GhostButton, PayDialog } from "./shared";

export default function MarketModule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [appType, setAppType] = useState<"" | AppType>("");
  const [category, setCategory] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);

  const qs = new URLSearchParams();
  if (search.trim()) qs.set("search", search.trim());
  if (appType) qs.set("appType", appType);
  if (category) qs.set("category", category);
  if (onlyFavorites) qs.set("onlyFavorites", "true");
  if (onlyMine) qs.set("onlyMine", "true");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/tools/market", search, appType, category, onlyFavorites, onlyMine],
    queryFn: () => tGet<MarketResponse>(`/tools/market${qs.toString() ? `?${qs}` : ""}`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/tools/market"] });
    qc.invalidateQueries({ queryKey: ["/tools/market/detail"] });
  };

  const [paying, setPaying] = useState<{ agentId: number; agentName: string; qrCodeUrl: string; amountFen: number } | null>(null);

  const subscribeMut = useMutation({
    mutationFn: (id: number) => tPost<SubscribeResponse>(`/tools/market/${id}/subscribe`),
    onSuccess: (r, id) => {
      if (r?.paymentRequired && r.qrCodeUrl) {
        const agent = (data?.items ?? []).find((a) => a.id === id);
        setPaying({ agentId: id, agentName: agent?.name ?? "", qrCodeUrl: r.qrCodeUrl, amountFen: r.amountFen ?? agent?.priceFenPerMonth ?? 0 });
        return;
      }
      invalidate();
      qc.invalidateQueries({ queryKey: ["/tools/subscriptions"] });
      toast({ title: "订阅成功", description: "已添加到「订阅与账单」" });
    },
    onError: (e: any) => toast({ title: "订阅失败", description: e.message, variant: "destructive" }),
  });

  const favMut = useMutation({
    mutationFn: (id: number) => tPost(`/tools/market/${id}/favorite`),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const agents = data?.items ?? [];
  const categories = data?.categories ?? CATEGORIES;

  const [detailId, setDetailId] = useState<number | null>(null);

  return (
    <div>
      {paying && (
        <PayDialog
          {...paying}
          onPaid={() => {
            setPaying(null);
            invalidate();
            qc.invalidateQueries({ queryKey: ["/tools/subscriptions"] });
            toast({ title: "支付成功，订阅已生效", description: "已添加到「订阅与账单」" });
          }}
          onClose={() => setPaying(null)}
        />
      )}
      {detailId != null && (
        <AgentDetailDialog
          agentId={detailId}
          onClose={() => setDetailId(null)}
          onSubscribe={(id) => subscribeMut.mutate(id)}
          onFavorite={(id) => favMut.mutate(id)}
          subscribing={subscribeMut.isPending}
        />
      )}
      {/* Hero */}
      <div className="rounded-3xl bg-gradient-to-br from-indigo-50 via-purple-50 to-blue-50 px-8 py-12 mb-6 text-center">
        <h1 className="text-3xl font-extrabold text-primary font-display mb-2">智能体市场</h1>
        <p className="text-sm text-slate-500 mb-6">发现优质 Agent 与工作流，一键订阅到你的工作区</p>
        <div className="relative max-w-xl mx-auto">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索智能体名称、作者或描述"
            className="w-full rounded-2xl border border-white bg-white/90 shadow-sm pl-11 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Filters row 1: app type */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-xs text-slate-400 font-semibold mr-1">应用类型</span>
        {([["", "全部"], ["agent", "Agent"], ["workflow", "工作流"]] as const).map(([v, l]) => (
          <GhostButton key={v} active={appType === v} onClick={() => setAppType(v)}>{l}</GhostButton>
        ))}
      </div>

      {/* Filters row 2: category + actions */}
      <div className="flex flex-wrap items-center gap-1.5 mb-6">
        <span className="text-xs text-slate-400 font-semibold mr-1">标签类型</span>
        <GhostButton active={category === ""} onClick={() => setCategory("")}>全部</GhostButton>
        {categories.map((c) => (
          <GhostButton key={c} active={category === c} onClick={() => setCategory(c)}>{c}</GhostButton>
        ))}
        <span className="w-px h-6 bg-border/60 mx-1" />
        <GhostButton active={onlyFavorites} onClick={() => setOnlyFavorites((v) => !v)}><Heart size={14} />我的收藏</GhostButton>
        <GhostButton active={onlyMine} onClick={() => setOnlyMine((v) => !v)}>我的发布</GhostButton>
        <button
          onClick={() => navigate("/tools/agents")}
          className="ml-auto inline-flex items-center gap-2 bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-primary/90 transition-colors"
        >
          <Upload size={15} />上架智能体
        </button>
      </div>

      {isLoading ? <Loading /> :
       isError ? <ErrorBanner message={(error as Error).message} /> :
       agents.length === 0 ? <EmptyState text="没有符合条件的智能体" icon={<Store size={26} className="text-primary/40" />} /> : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <div
              key={a.id}
              onClick={() => setDetailId(a.id)}
              className="bg-white rounded-2xl p-5 border border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all relative flex flex-col cursor-pointer"
            >
              {/* price corner */}
              <span className={`absolute top-4 right-4 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                !a.priceFenPerMonth ? "bg-green-50 text-green-600" : "bg-primary/8 text-primary"
              }`}>
                {formatPrice(a.priceFenPerMonth)}
              </span>

              <div className="flex items-start gap-3 mb-3 pr-20">
                <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {a.iconUrl
                    ? <img src={a.iconUrl} alt={a.name} className="w-full h-full object-cover" />
                    : a.appType === "agent" ? <Bot size={20} className="text-primary" /> : <Workflow size={20} className="text-primary" />}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 truncate">{a.name}</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">@{a.authorName ?? "匿名"} · ID {a.id}</p>
                </div>
              </div>

              <p className="text-sm text-slate-500 line-clamp-2 min-h-[2.5rem] mb-3">{a.description || "暂无描述"}</p>

              {a.tags && a.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {a.tags.slice(0, 4).map((t) => (
                    <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{t}</span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-slate-400 mb-4 mt-auto">
                <span className="inline-flex items-center gap-1"><Star size={13} className="text-amber-400 fill-amber-400" />{(a.rating ?? 0).toFixed(1)}</span>
                <span className="inline-flex items-center gap-1"><Heart size={13} />{a.favoriteCount ?? 0}</span>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-border/40">
                <button
                  onClick={(e) => { e.stopPropagation(); subscribeMut.mutate(a.id); }}
                  disabled={subscribeMut.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary text-white rounded-xl px-3 py-2 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  立即订阅 <ArrowRight size={15} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); favMut.mutate(a.id); }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
                    a.favorited ? "bg-red-50 border-red-100 text-red-500" : "bg-white border-border/60 text-slate-400 hover:text-red-500 hover:border-red-200"
                  }`}
                  aria-label="收藏"
                >
                  <Heart size={16} className={a.favorited ? "fill-red-500" : ""} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentDetailDialog({ agentId, onClose, onSubscribe, onFavorite, subscribing }: {
  agentId: number;
  onClose: () => void;
  onSubscribe: (id: number) => void;
  onFavorite: (id: number) => void;
  subscribing: boolean;
}) {
  const [, navigate] = useLocation();
  const { data: a, isLoading, isError, error } = useQuery({
    queryKey: ["/tools/market/detail", agentId],
    queryFn: () => tGet<MarketAgentDetail>(`/tools/market/${agentId}`),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 sm:p-8 relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50" aria-label="关闭">
          <X size={18} />
        </button>

        {isLoading ? (
          <div className="py-16 flex justify-center"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : isError || !a ? (
          <p className="py-12 text-center text-sm text-red-500">{(error as Error)?.message ?? "加载失败"}</p>
        ) : (
          <>
            <div className="flex items-start gap-4 mb-5 pr-10">
              <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {a.iconUrl
                  ? <img src={a.iconUrl} alt={a.name} className="w-full h-full object-cover" />
                  : a.appType === "agent" ? <Bot size={26} className="text-primary" /> : <Workflow size={26} className="text-primary" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-extrabold text-slate-800">{a.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">@{a.authorName ?? "匿名"} · {a.appType === "agent" ? "Agent" : "工作流"} · {a.category ?? "通用"}</p>
                <span className={`inline-block mt-2 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  !a.priceFenPerMonth ? "bg-green-50 text-green-600" : "bg-primary/8 text-primary"
                }`}>{formatPrice(a.priceFenPerMonth)}</span>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed mb-4 whitespace-pre-wrap">{a.description || "暂无描述"}</p>

            {a.tags && a.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {a.tags.map((t) => (
                  <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{t}</span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-slate-400 mb-6">
              <span className="inline-flex items-center gap-1"><Star size={13} className="text-amber-400 fill-amber-400" />{(a.rating ?? 0).toFixed(1)}</span>
              <span className="inline-flex items-center gap-1"><Heart size={13} />{a.favoriteCount ?? 0} 收藏</span>
              <span className="inline-flex items-center gap-1"><Users size={13} />{a.subscriberCount ?? 0} 人订阅</span>
              {a.publishedAt && <span>发布于 {formatDate(a.publishedAt)}</span>}
            </div>

            <div className="flex items-center gap-2">
              {a.usable ? (
                <button
                  onClick={() => navigate(`/tools/use/${a.id}`)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-primary/90"
                >
                  <Play size={15} />立即使用
                </button>
              ) : (
                <button
                  onClick={() => onSubscribe(a.id)}
                  disabled={subscribing}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-primary text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-primary/90 disabled:opacity-50"
                >
                  订阅后使用 <ArrowRight size={15} />
                </button>
              )}
              <button
                onClick={() => onFavorite(a.id)}
                className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-colors ${
                  a.favorited ? "bg-red-50 border-red-100 text-red-500" : "bg-white border-border/60 text-slate-400 hover:text-red-500 hover:border-red-200"
                }`}
                aria-label="收藏"
              >
                <Heart size={16} className={a.favorited ? "fill-red-500" : ""} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
