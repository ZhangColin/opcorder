import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { CreditCard, Loader2, ChevronRight, AlertTriangle, CheckCircle2, Hourglass } from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { v2Get } from "@/lib/v2api";

interface PaymentPlan {
  id: number;
  clientDemandId: number;
  itemNo: number;
  description: string | null;
  amount: number;
  dueDate: string;
  status: string;
  voucherUrl: string | null;
  isOverdue: boolean;
  createdAt: string;
  demandTitle: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  pending:         { label: "待付款", cls: "bg-sky-100 text-sky-700",    icon: CreditCard },
  awaiting_review: { label: "审核中", cls: "bg-amber-100 text-amber-700", icon: Hourglass },
  paid:            { label: "已付款", cls: "bg-green-100 text-green-700", icon: CheckCircle2 },
};

const TABS = [
  { value: "", label: "全部" },
  { value: "pending", label: "待付款" },
  { value: "awaiting_review", label: "审核中" },
  { value: "paid", label: "已付款" },
];

function fmtAmt(n: number) {
  if (n >= 10000) return `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万`;
  return n.toLocaleString();
}

export default function PubPaymentList() {
  const [, navigate] = useLocation();
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const data = await v2Get<PaymentPlan[]>(`/payment-plans?${params}`);
      setPlans(data);
    } catch { setPlans([]); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const overdueCount = plans.filter(p => p.isOverdue).length;
  const pendingTotal = plans.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);

  return (
    <PubLayout title="付款管理">
      <div className="mt-5 space-y-4">
        {overdueCount > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-800 font-medium">
              <strong>{overdueCount}</strong> 项付款已逾期，请尽快处理
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {TABS.map(t => (
              <button key={t.value} onClick={() => setStatusFilter(t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  statusFilter === t.value
                    ? "bg-sky-600 text-white"
                    : "bg-white border border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-600"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          {pendingTotal > 0 && (
            <p className="ml-auto text-xs text-slate-500">
              待付合计 <span className="font-black text-slate-700">¥{pendingTotal.toLocaleString()}</span>
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-100">
            <CreditCard size={36} className="text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-500">暂无付款记录</p>
            <p className="text-xs text-slate-400 mt-1">签约后由平台生成付款计划</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Column header */}
            <div className="hidden sm:grid grid-cols-[3rem_1fr_9rem_9rem_1.5rem] gap-4 px-5 pb-1">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider text-center">期数</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">需求 / 说明</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">应付日期</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider text-right">金额</p>
              <span />
            </div>

            {plans.map(plan => {
              const cfg = STATUS_CONFIG[plan.status] ?? { label: plan.status, cls: "bg-slate-100 text-slate-500", icon: CreditCard };
              const StatusIcon = cfg.icon;
              const overdue = plan.isOverdue;
              const isPaid = plan.status === "paid";

              return (
                <div key={plan.id} onClick={() => navigate(`/pub/payments/${plan.id}`)}
                  className={`bg-white rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group ${
                    overdue ? "border-red-200 bg-red-50/40" : "border-slate-100"
                  }`}>

                  {/* Mobile layout */}
                  <div className="sm:hidden px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        {plan.demandTitle && <p className="text-xs text-slate-400 mb-0.5 truncate">{plan.demandTitle}</p>}
                        <p className="text-sm font-bold text-slate-700">第 {plan.itemNo} 期{plan.description ? `  · ${plan.description}` : ""}</p>
                      </div>
                      <p className={`text-xl font-black shrink-0 ${overdue ? "text-red-600" : isPaid ? "text-green-600" : "text-slate-800"}`}>
                        ¥{fmtAmt(plan.amount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${overdue ? "bg-red-100 text-red-700" : cfg.cls}`}>
                        <StatusIcon size={10} /> {overdue ? "已逾期" : cfg.label}
                      </span>
                      <span className={`text-xs ${overdue ? "text-red-600 font-bold" : "text-slate-400"}`}>
                        应付 {new Date(plan.dueDate).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                  </div>

                  {/* Desktop layout: grid columns */}
                  <div className="hidden sm:grid grid-cols-[3rem_1fr_9rem_9rem_1.5rem] gap-4 items-center px-5 py-4">
                    {/* 期数 */}
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 mb-0.5">期</p>
                      <p className="text-lg font-black text-slate-600 leading-none">{plan.itemNo}</p>
                    </div>

                    {/* 需求 / 说明 */}
                    <div className="min-w-0">
                      {plan.demandTitle && (
                        <p className="text-[13px] font-bold text-slate-800 truncate group-hover:text-sky-700 transition-colors">{plan.demandTitle}</p>
                      )}
                      {plan.description && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{plan.description}</p>
                      )}
                      {!plan.demandTitle && !plan.description && (
                        <p className="text-sm text-slate-400">—</p>
                      )}
                    </div>

                    {/* 应付日期 */}
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">应付日期</p>
                      <p className={`text-sm font-semibold ${overdue ? "text-red-600" : "text-slate-700"}`}>
                        {new Date(plan.dueDate).toLocaleDateString("zh-CN")}
                      </p>
                      {overdue && <p className="text-[10px] text-red-500 font-bold mt-0.5">已逾期</p>}
                    </div>

                    {/* 金额 + 状态 */}
                    <div className="text-right">
                      <p className={`text-xl font-black leading-none mb-1 ${overdue ? "text-red-600" : isPaid ? "text-green-600" : "text-slate-800"}`}>
                        ¥{fmtAmt(plan.amount)}
                      </p>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${overdue ? "bg-red-100 text-red-700" : cfg.cls}`}>
                        <StatusIcon size={10} /> {cfg.label}
                      </span>
                    </div>

                    <ChevronRight size={15} className="text-slate-300 group-hover:text-sky-500 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PubLayout>
  );
}
