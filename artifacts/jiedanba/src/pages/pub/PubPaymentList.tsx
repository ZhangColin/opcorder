import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { CreditCard, Loader2, ChevronRight, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { Pagination } from "@/components/pub/Pagination";
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

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending:         { label: "待付款", cls: "bg-sky-100 text-sky-700" },
  awaiting_review: { label: "审核中", cls: "bg-amber-100 text-amber-700" },
  paid:            { label: "已付款", cls: "bg-green-100 text-green-700" },
};

const TABS = [
  { value: "pending",         label: "待付款" },
  { value: "awaiting_review", label: "审核中" },
  { value: "paid",            label: "已付款" },
  { value: "",                label: "全部" },
];

const PAGE_SIZE = 10;

function fmtAmt(n: number) {
  if (n >= 10000) return `¥${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万`;
  return `¥${n.toLocaleString()}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "numeric", day: "numeric" });
}

export default function PubPaymentList() {
  const [, navigate] = useLocation();
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(() =>
    new URLSearchParams(window.location.search).get("filter") === "all" ? "" : "pending"
  );
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await v2Get<PaymentPlan[]>(`/payment-plans`);
      setPlans(data);
    } catch { setPlans([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const counts: Record<string, number> = { "": plans.length };
  for (const t of TABS) {
    if (t.value) counts[t.value] = plans.filter(p => p.status === t.value).length;
  }

  const overdueCount = plans.filter(p => p.isOverdue).length;
  const pendingTotal = plans.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);

  const filtered = statusFilter ? plans.filter(p => p.status === statusFilter) : plans;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PubLayout title="付款管理">
      <div className="mt-5 space-y-4">
        {overdueCount > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-800 font-medium">
              <strong>{overdueCount}</strong> 项付款已逾期，请尽快处理
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {TABS.map(t => {
              const cnt = counts[t.value] ?? 0;
              const active = statusFilter === t.value;
              return (
                <button key={t.value} onClick={() => setStatusFilter(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                    active
                      ? "bg-sky-600 text-white"
                      : "bg-white border border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-600"
                  }`}>
                  {t.label}
                  {cnt > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                    }`}>{cnt}</span>
                  )}
                </button>
              );
            })}
          </div>
          {pendingTotal > 0 && (
            <p className="ml-auto text-xs text-slate-500">
              待付合计 <span className="font-black text-slate-700">{fmtAmt(pendingTotal)}</span>
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-100">
            <CreditCard size={36} className="text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-500">暂无付款记录</p>
            <p className="text-xs text-slate-400 mt-1">签约后由平台生成付款计划</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paged.map(plan => {
                const cfg = STATUS_CONFIG[plan.status] ?? { label: plan.status, cls: "bg-slate-100 text-slate-500" };
                const overdue = plan.isOverdue;
                const isPaid = plan.status === "paid";

                return (
                  <div key={plan.id}
                    onClick={() => navigate(`/pub/payments/${plan.id}`)}
                    className={`bg-white rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group px-5 py-4 ${
                      overdue ? "border-red-200 bg-red-50/30" : "border-slate-100"
                    }`}>
                    <div className="flex items-start justify-between gap-4 mb-2.5">
                      <p className="text-[15px] font-bold text-slate-800 group-hover:text-sky-700 transition-colors leading-snug flex-1 min-w-0 truncate">
                        {plan.demandTitle ?? "（无关联需求）"}
                      </p>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${overdue ? "bg-red-100 text-red-700" : cfg.cls}`}>
                        {overdue ? "已逾期" : cfg.label}
                      </span>
                    </div>
                    <div className="flex items-end gap-6 text-xs flex-wrap">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">期数</p>
                        <p className="text-slate-600">第 {plan.itemNo} 期{plan.description ? `  · ${plan.description}` : ""}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">应付日期</p>
                        <p className={`flex items-center gap-1 ${overdue ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                          {overdue ? <AlertTriangle size={10} /> : isPaid ? <CheckCircle2 size={10} className="text-green-500" /> : <Clock size={10} />}
                          {fmtDate(plan.dueDate)}
                        </p>
                      </div>
                      <div className="ml-auto">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">付款金额</p>
                        <p className={`text-xl font-black leading-none ${overdue ? "text-red-600" : isPaid ? "text-green-600" : "text-slate-800"}`}>
                          {fmtAmt(plan.amount)}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-sky-500 transition-colors mb-0.5" />
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </div>
    </PubLayout>
  );
}
