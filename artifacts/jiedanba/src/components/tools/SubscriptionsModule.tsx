import { Fragment, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Bot, Receipt, ChevronDown, ChevronRight, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SubscriptionsResponse, SubscribeResponse, tGet, tPost, formatPrice, formatDate } from "./api";
import { PageHeader, EmptyState, Loading, ErrorBanner, PayDialog } from "./shared";

function yuan(fen: number) { return `¥${(fen / 100).toFixed(2)}`; }

const RENEW_REMIND_MS = 3 * 24 * 60 * 60 * 1000;

/** 生效中但 3 天内到期 → 临期 */
function isExpiringSoon(s: { status?: string | null; expiresAt?: string | null }) {
  if (s.status !== "active" || !s.expiresAt) return false;
  const t = new Date(s.expiresAt).getTime();
  return t > Date.now() && t - Date.now() <= RENEW_REMIND_MS;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  active:          { text: "生效中",  cls: "bg-green-50 text-green-600" },
  pending_payment: { text: "待支付",  cls: "bg-amber-50 text-amber-600" },
  cancelled:       { text: "已退订",  cls: "bg-slate-100 text-slate-500" },
  expired:         { text: "已到期",  cls: "bg-slate-100 text-slate-500" },
};

export default function SubscriptionsModule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/tools/subscriptions"],
    queryFn: () => tGet<SubscriptionsResponse>("/tools/subscriptions"),
  });

  const [paying, setPaying] = useState<{ agentId: number; agentName: string; qrCodeUrl: string; amountFen: number } | null>(null);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggle = (id: number) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const rows = data?.items ?? [];
  const totalSpentFen = data?.totalSpentFen ?? 0;

  // 续费：复用订阅支付流程（到期/已退订等终结态可开新单）
  const renewMut = useMutation({
    mutationFn: (agentId: number) => tPost<SubscribeResponse>(`/tools/market/${agentId}/subscribe`),
    onSuccess: (r, agentId) => {
      const row = rows.find((s) => s.agentId === agentId);
      if (r?.paymentRequired && r.qrCodeUrl) {
        setPaying({ agentId, agentName: row?.agentName ?? "", qrCodeUrl: r.qrCodeUrl, amountFen: r.amountFen ?? row?.amountFen ?? 0 });
      } else {
        qc.invalidateQueries({ queryKey: ["/tools/subscriptions"] });
        toast({ title: "续订成功", description: "订阅已重新生效" });
      }
    },
    onError: (e: any) => toast({ title: "续费失败", description: e.message, variant: "destructive" }),
  });

  const unsubMut = useMutation({
    mutationFn: (agentId: number) => tPost(`/tools/market/${agentId}/unsubscribe`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/tools/subscriptions"] });
      toast({ title: "已退订", description: "该智能体订阅已取消（本期费用不退）" });
    },
    onError: (e: any) => toast({ title: "退订失败", description: e.message, variant: "destructive" }),
  });

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
                const expiringSoon = isExpiringSoon(s);
                const st = expiringSoon
                  ? { text: "即将到期", cls: "bg-amber-50 text-amber-600" }
                  : (STATUS_LABEL[s.status ?? ""] ?? { text: s.status ?? "—", cls: "bg-slate-100 text-slate-500" });
                const canRenew = (s.status === "expired" || s.status === "cancelled") && s.agentId != null;
                const payments = s.payments ?? [];
                const isOpen = expanded.has(s.id);
                return (
                  <Fragment key={s.id}>
                  <tr className="border-t border-border/40 hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        {payments.length > 0 ? (
                          <button
                            onClick={() => toggle(s.id)}
                            className="text-slate-400 hover:text-primary flex-shrink-0"
                            aria-label={isOpen ? "收起扣款记录" : "展开扣款记录"}
                          >
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        ) : <span className="w-4 flex-shrink-0" />}
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
                          onClick={() => navigate(`/tools/use/${s.agentId}`)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-lg px-2.5 py-1.5 mr-3"
                        >
                          <Play size={12} />使用
                        </button>
                      )}
                      {canRenew && (
                        <button
                          onClick={() => renewMut.mutate(s.agentId!)}
                          disabled={renewMut.isPending}
                          className="text-xs font-bold text-primary hover:text-primary/80 disabled:opacity-50 mr-3"
                        >
                          {s.status === "expired" ? "续费" : "重新订阅"}
                        </button>
                      )}
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
                  {isOpen && payments.length > 0 && (
                    <tr className="border-t border-border/40 bg-slate-50/40">
                      <td colSpan={7} className="px-5 py-3">
                        <div className="ml-6 text-xs">
                          <div className="font-semibold text-slate-500 mb-1.5">历史扣款记录（{payments.length} 笔）</div>
                          <div className="space-y-1">
                            {payments.map((p) => (
                              <div key={p.id} className="flex items-center gap-4 text-slate-600">
                                <span className="font-bold text-slate-800 w-20">{yuan(p.amountFen)}</span>
                                <span className="text-slate-400 whitespace-nowrap">{formatDate(p.paidAt)}</span>
                                {p.paymentOrderNo && <span className="text-slate-400 font-mono">单号 {p.paymentOrderNo}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {paying && (
        <PayDialog
          agentId={paying.agentId}
          agentName={paying.agentName}
          qrCodeUrl={paying.qrCodeUrl}
          amountFen={paying.amountFen}
          onPaid={() => {
            setPaying(null);
            qc.invalidateQueries({ queryKey: ["/tools/subscriptions"] });
            toast({ title: "续费成功", description: "订阅已重新生效" });
          }}
          onClose={() => setPaying(null)}
        />
      )}
    </div>
  );
}
