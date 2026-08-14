import { useQuery } from "@tanstack/react-query";
import { Bot, Receipt } from "lucide-react";
import { SubscriptionsResponse, tGet, formatPrice, formatDate } from "./api";
import { PageHeader, EmptyState, Loading, ErrorBanner } from "./shared";

function yuan(fen: number) { return `¥${(fen / 100).toFixed(2)}`; }

export default function SubscriptionsModule() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/tools/subscriptions"],
    queryFn: () => tGet<SubscriptionsResponse>("/tools/subscriptions"),
  });

  const rows = data?.items ?? [];
  const totalSpentFen = data?.totalSpentFen ?? 0;

  return (
    <div>
      <PageHeader
        title="订阅与账单"
        desc={`你已订阅的智能体与扣费记录 · 累计支出 ${yuan(totalSpentFen)}`}
      />

      {isLoading ? <Loading /> :
       isError ? <ErrorBanner message={(error as Error).message} /> :
       rows.length === 0 ? <EmptyState text="你还没有订阅任何智能体" icon={<Receipt size={26} className="text-primary/40" />} /> : (
        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 bg-slate-50/60">
                <th className="px-5 py-3 font-semibold">智能体</th>
                <th className="px-5 py-3 font-semibold">作者</th>
                <th className="px-5 py-3 font-semibold">价格</th>
                <th className="px-5 py-3 font-semibold">订阅时间</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t border-border/40 hover:bg-slate-50/50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0"><Bot size={16} className="text-primary" /></div>
                      <span className="font-semibold text-slate-800">{s.agentName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-500">@{s.authorName ?? "匿名"}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${!s.amountFen ? "bg-green-50 text-green-600" : "bg-primary/8 text-primary"}`}>
                      {formatPrice(s.amountFen)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
