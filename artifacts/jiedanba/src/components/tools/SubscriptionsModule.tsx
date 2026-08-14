import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SubscriptionsResponse, tGet, tPost, formatPrice, formatDate } from "./api";
import { PageHeader, EmptyState, Loading, ErrorBanner } from "./shared";

function yuan(fen: number) { return `¥${(fen / 100).toFixed(2)}`; }

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  active:          { text: "生效中",  cls: "bg-green-50 text-green-600" },
  pending_payment: { text: "待支付",  cls: "bg-amber-50 text-amber-600" },
  cancelled:       { text: "已退订",  cls: "bg-slate-100 text-slate-500" },
  expired:         { text: "已到期",  cls: "bg-slate-100 text-slate-500" },
};

export default function SubscriptionsModule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/tools/subscriptions"],
    queryFn: () => tGet<SubscriptionsResponse>("/tools/subscriptions"),
  });

  const unsubMut = useMutation({
    mutationFn: (agentId: number) => tPost(`/tools/market/${agentId}/unsubscribe`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/tools/subscriptions"] });
      toast({ title: "已退订", description: "该智能体订阅已取消（本期费用不退）" });
    },
    onError: (e: any) => toast({ title: "退订失败", description: e.message, variant: "destructive" }),
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
                <th className="px-5 py-3 font-semibold">状态</th>
                <th className="px-5 py-3 font-semibold">到期时间</th>
                <th className="px-5 py-3 font-semibold">订阅时间</th>
                <th className="px-5 py-3 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const st = STATUS_LABEL[s.status ?? ""] ?? { text: s.status ?? "—", cls: "bg-slate-100 text-slate-500" };
                return (
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
                    <td className="px-5 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{s.expiresAt ? formatDate(s.expiresAt) : (s.status === "active" ? "长期有效" : "—")}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDate(s.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      {s.status === "active" && s.agentId != null && (
                        <button
                          onClick={() => {
                            if (window.confirm(`确定退订「${s.agentName}」吗？本期已支付费用不退还。`)) unsubMut.mutate(s.agentId!);
                          }}
                          disabled={unsubMut.isPending}
                          className="text-xs font-bold text-red-500 hover:text-red-600 disabled:opacity-50"
                        >
                          退订
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
