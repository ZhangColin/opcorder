import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bot, Play, Sparkles, Store } from "lucide-react";
import { SubscriptionsResponse, ListResponse, Agent, tGet, formatPrice, formatDate } from "./api";
import { PageHeader, EmptyState, Loading, ErrorBanner } from "./shared";

/** 我的智能体：订阅中的智能体 + 我自己发布的智能体,一键进入使用 */
export default function MyAgentsModule() {
  const [, navigate] = useLocation();

  const subsQ = useQuery({
    queryKey: ["/tools/subscriptions"],
    queryFn: () => tGet<SubscriptionsResponse>("/tools/subscriptions"),
  });
  const mineQ = useQuery({
    queryKey: ["/tools/agents"],
    queryFn: () => tGet<ListResponse<Agent>>("/tools/agents"),
  });

  if (subsQ.isLoading || mineQ.isLoading) return <div><PageHeader title="我的智能体" desc="订阅的和自己创建的智能体，都在这里使用" /><Loading /></div>;
  if (subsQ.isError) return <div><PageHeader title="我的智能体" desc="" /><ErrorBanner message={(subsQ.error as Error).message} /></div>;

  const now = Date.now();
  const subscribed = (subsQ.data?.items ?? []).filter(
    (s) => s.status === "active" && s.agentId != null && (!s.expiresAt || new Date(s.expiresAt).getTime() > now),
  );
  const mine = mineQ.data?.items ?? [];
  const subscribedIds = new Set(subscribed.map((s) => s.agentId));
  const myOwn = mine.filter((a) => !subscribedIds.has(a.id));

  const empty = subscribed.length === 0 && myOwn.length === 0;

  return (
    <div>
      <PageHeader title="我的智能体" desc="订阅的和自己创建的智能体，都在这里使用" />

      {empty ? (
        <div className="text-center">
          <EmptyState text="你还没有可使用的智能体" icon={<Sparkles size={26} className="text-primary/40" />} />
          <button
            onClick={() => navigate("/tools/market")}
            className="mt-4 inline-flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-primary/90"
          >
            <Store size={15} />去市场逛逛
          </button>
        </div>
      ) : (
        <>
          {subscribed.length > 0 && (
            <>
              <h3 className="text-sm font-bold text-slate-500 mb-3">已订阅（{subscribed.length}）</h3>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 mb-8">
                {subscribed.map((s) => (
                  <div key={s.id} className="bg-white rounded-2xl p-5 border border-border/50 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {s.agentIcon
                          ? <img src={s.agentIcon} alt={s.agentName} className="w-full h-full object-cover" />
                          : <Bot size={20} className="text-primary" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 truncate">{s.agentName}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">@{s.authorName ?? "匿名"}</p>
                      </div>
                      <span className={`ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${!s.amountFen ? "bg-green-50 text-green-600" : "bg-primary/8 text-primary"}`}>
                        {formatPrice(s.amountFen)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4 mt-auto">
                      {s.expiresAt ? `有效期至 ${formatDate(s.expiresAt)}` : "长期有效"}
                    </p>
                    <button
                      onClick={() => navigate(`/tools/use/${s.agentId}`)}
                      className="inline-flex items-center justify-center gap-1.5 bg-primary text-white rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-primary/90"
                    >
                      <Play size={15} />立即使用
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {myOwn.length > 0 && (
            <>
              <h3 className="text-sm font-bold text-slate-500 mb-3">我创建的（{myOwn.length}）</h3>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                {myOwn.map((a) => (
                  <div key={a.id} className="bg-white rounded-2xl p-5 border border-border/50 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {a.iconUrl
                          ? <img src={a.iconUrl} alt={a.name} className="w-full h-full object-cover" />
                          : <Bot size={20} className="text-primary" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 truncate">{a.name}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {a.shareStatus === "published" ? "已发布" : a.shareStatus === "template" ? "模板" : "私有"} · {a.category ?? "通用"}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 min-h-[2.5rem] mb-4 mt-auto">{a.description || "暂无描述"}</p>
                    <button
                      onClick={() => navigate(`/tools/use/${a.id}`)}
                      className="inline-flex items-center justify-center gap-1.5 bg-primary text-white rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-primary/90"
                    >
                      <Play size={15} />立即使用
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
