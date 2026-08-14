import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, Users } from "lucide-react";
import { EarningsResponse, tGet, formatDate } from "./api";
import { PageHeader, EmptyState, Loading, ErrorBanner } from "./shared";

function yuan(fen: number) { return `¥${(fen / 100).toFixed(2)}`; }

export default function EarningsModule() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/tools/earnings"],
    queryFn: () => tGet<EarningsResponse>("/tools/earnings"),
  });

  if (isLoading) return <div><PageHeader title="我的收益" /><Loading /></div>;
  if (isError) return <div><PageHeader title="我的收益" /><ErrorBanner message={(error as Error).message} /></div>;

  const d = data!;
  const items = d.items ?? [];

  // 本月收益：按 createdAt 当月过滤求和；订阅人次：明细条数
  const now = new Date();
  const monthFen = items.reduce((sum, r) => {
    const c = new Date(r.createdAt);
    return !isNaN(c.getTime()) && c.getFullYear() === now.getFullYear() && c.getMonth() === now.getMonth()
      ? sum + (r.amountFen ?? 0)
      : sum;
  }, 0);
  const subscriberCount = items.length;

  const cards = [
    { label: "累计收益", value: yuan(d.totalFen), icon: <Wallet size={20} />, cls: "from-indigo-50 to-purple-50" },
    { label: "本月收益", value: yuan(monthFen), icon: <TrendingUp size={20} />, cls: "from-blue-50 to-cyan-50" },
    { label: "订阅人次", value: String(subscriberCount), icon: <Users size={20} />, cls: "from-emerald-50 to-teal-50" },
  ];

  return (
    <div>
      <PageHeader title="我的收益" desc="来自你发布智能体的订阅收益" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl p-5 border border-border/50 shadow-sm bg-gradient-to-br ${c.cls}`}>
            <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center text-primary mb-3">{c.icon}</div>
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="text-2xl font-extrabold text-primary font-display mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <h2 className="text-base font-bold text-slate-700 mb-3">收益明细</h2>
      {items.length === 0 ? <EmptyState text="还没有收益记录" icon={<Wallet size={26} className="text-primary/40" />} /> : (
        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 bg-slate-50/60">
                <th className="px-5 py-3 font-semibold">智能体</th>
                <th className="px-5 py-3 font-semibold">订阅人</th>
                <th className="px-5 py-3 font-semibold">金额</th>
                <th className="px-5 py-3 font-semibold">时间</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-border/40 hover:bg-slate-50/50">
                  <td className="px-5 py-3 font-semibold text-slate-800">{r.agentName}</td>
                  <td className="px-5 py-3 text-slate-500">{r.subscriberName ?? "匿名用户"}</td>
                  <td className="px-5 py-3 font-bold text-green-600">+{yuan(r.amountFen)}</td>
                  <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
