import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  CreditCard, Loader2, ChevronRight, Clock,
  AlertTriangle, CheckCircle2, Hourglass, ArrowUpRight,
} from "lucide-react";
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

const STATUS_CONFIG: Record<string, {
  label: string; badge: string; accent: string;
  amountColor: string; icon: React.ElementType;
}> = {
  pending: {
    label: "待付款", badge: "bg-sky-100 text-sky-700",
    accent: "border-l-sky-400", amountColor: "text-slate-800",
    icon: CreditCard,
  },
  awaiting_review: {
    label: "审核中", badge: "bg-amber-100 text-amber-700",
    accent: "border-l-amber-400", amountColor: "text-amber-700",
    icon: Hourglass,
  },
  paid: {
    label: "已付款", badge: "bg-green-100 text-green-700",
    accent: "border-l-green-400", amountColor: "text-green-700",
    icon: CheckCircle2,
  },
};

const TABS = [
  { value: "", label: "全部" },
  { value: "pending", label: "待付款" },
  { value: "awaiting_review", label: "审核中" },
  { value: "paid", label: "已付款" },
];

function fmtAmount(n: number) {
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
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const overdueCount = plans.filter(p => p.isOverdue).length;
  const totalPending = plans
    .filter(p => p.status === "pending")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <PubLayout title="付款管理">
      <div className="mt-5 space-y-4">
        {/* Overdue alert */}
        {overdueCount > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">{overdueCount} 项付款已逾期</p>
              <p className="text-xs text-red-500 mt-0.5">请尽快处理，避免影响合作关系</p>
            </div>
            <button
              onClick={() => setStatusFilter("pending")}
              className="ml-auto text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 transition-colors px-3 py-1.5 rounded-lg shrink-0"
            >
              查看
            </button>
          </div>
        )}

        {/* Summary bar */}
        {totalPending > 0 && overdueCount === 0 && (
          <div className="bg-sky-50 border border-sky-100 rounded-2xl px-5 py-3 flex items-center gap-3">
            <CreditCard size={16} className="text-sky-500 shrink-0" />
            <p className="text-sm text-sky-700">
              待付款合计 <span className="font-black text-sky-800">¥{totalPending.toLocaleString()}</span>
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === tab.value
                  ? "bg-sky-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-500 hover:border-sky-300 hover:text-sky-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center mb-4">
              <CreditCard size={28} className="text-sky-300" />
            </div>
            <p className="text-base font-semibold text-slate-500">暂无付款记录</p>
            <p className="text-xs text-slate-400 mt-1">签约后由平台生成付款计划</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {plans.map(plan => {
              const cfg = STATUS_CONFIG[plan.status] ?? {
                label: plan.status, badge: "bg-slate-100 text-slate-500",
                accent: "border-l-slate-300", amountColor: "text-slate-800", icon: CreditCard,
              };
              const StatusIcon = cfg.icon;
              const overdue = plan.isOverdue;
              const isPaid = plan.status === "paid";

              return (
                <div
                  key={plan.id}
                  onClick={() => navigate(`/pub/payments/${plan.id}`)}
                  className={`rounded-2xl border border-l-4 p-5 cursor-pointer
                    hover:shadow-md hover:-translate-y-0.5 transition-all group
                    ${overdue
                      ? "bg-red-50/60 border-slate-100 border-l-red-500"
                      : isPaid
                        ? "bg-white border-slate-100 border-l-green-400 opacity-75"
                        : `bg-white border-slate-100 ${cfg.accent}`
                    }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Left: info */}
                    <div className="flex-1 min-w-0">
                      {plan.demandTitle && (
                        <p className="text-xs text-slate-400 truncate mb-1.5">{plan.demandTitle}</p>
                      )}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          overdue ? "bg-red-100 text-red-700" : cfg.badge
                        }`}>
                          <StatusIcon size={10} />
                          {overdue ? "已逾期" : cfg.label}
                        </span>
                        <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                          第 {plan.itemNo} 期
                        </span>
                      </div>
                      {plan.description && (
                        <p className="text-xs text-slate-500 truncate mb-1.5">{plan.description}</p>
                      )}
                      <p className={`text-xs flex items-center gap-1 ${overdue ? "text-red-600 font-bold" : "text-slate-400"}`}>
                        <Clock size={10} />
                        {overdue ? "逾期！应付" : "应付"} {new Date(plan.dueDate).toLocaleDateString("zh-CN")}
                      </p>
                    </div>

                    {/* Right: amount (hero) */}
                    <div className="text-right shrink-0">
                      <p className={`text-2xl font-black leading-none ${
                        overdue ? "text-red-600" : isPaid ? "text-green-600" : "text-slate-800"
                      }`}>
                        ¥{fmtAmount(plan.amount)}
                      </p>
                      {isPaid && (
                        <p className="text-[10px] text-green-500 mt-1 font-bold flex items-center gap-0.5 justify-end">
                          <CheckCircle2 size={9} /> 已完成
                        </p>
                      )}
                      {!isPaid && !overdue && plan.status === "pending" && (
                        <p className="text-[10px] text-sky-500 mt-1 font-bold flex items-center gap-0.5 justify-end">
                          <ArrowUpRight size={9} /> 去付款
                        </p>
                      )}
                    </div>

                    <ChevronRight size={16} className="text-slate-300 group-hover:text-sky-500 shrink-0 transition-colors" />
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
