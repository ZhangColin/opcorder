import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { CreditCard, Loader2, AlertCircle, ChevronRight, Clock } from "lucide-react";
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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:        { label: "待付款",   color: "bg-orange-100 text-orange-700" },
  awaiting_review:{ label: "审核中",   color: "bg-amber-100 text-amber-700" },
  paid:           { label: "已付款",   color: "bg-green-100 text-green-700" },
};

const TABS = [
  { value: "", label: "全部" },
  { value: "pending", label: "待付款" },
  { value: "awaiting_review", label: "审核中" },
  { value: "paid", label: "已付款" },
];

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

  return (
    <PubLayout title="付款管理">
      <div className="mt-6 space-y-5">
        {overdueCount > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-800 font-medium">
              您有 <strong>{overdueCount}</strong> 项付款已逾期，请尽快处理
            </p>
          </div>
        )}

        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === tab.value
                  ? "bg-primary text-white"
                  : "bg-white border border-slate-200 text-slate-500 hover:border-primary hover:text-primary"
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
          <div className="flex flex-col items-center py-20 text-slate-400">
            <CreditCard size={36} className="mb-3 text-slate-300" />
            <p className="text-base font-medium">暂无付款记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {plans.map(plan => {
              const cfg = STATUS_CONFIG[plan.status] ?? { label: plan.status, color: "bg-slate-100 text-slate-500" };
              const overdue = plan.isOverdue;
              return (
                <div
                  key={plan.id}
                  onClick={() => navigate(`/pub/payments/${plan.id}`)}
                  className={`bg-white rounded-2xl border p-5 flex items-center gap-4 cursor-pointer transition-all group hover:shadow-sm ${
                    overdue ? "border-red-300 bg-red-50/30" : "border-slate-200 hover:border-primary/30"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${overdue ? "bg-red-100" : "bg-primary/10"}`}>
                    <CreditCard size={18} className={overdue ? "text-red-600" : "text-primary"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    {plan.demandTitle && (
                      <p className="text-xs text-slate-500 truncate mb-0.5">{plan.demandTitle}</p>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      {overdue && (
                        <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">已逾期</span>
                      )}
                      <span className="text-xs text-slate-400">第 {plan.itemNo} 期</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-base font-black text-slate-800">¥{plan.amount.toLocaleString()}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock size={11} />
                        应付日期：{new Date(plan.dueDate).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                    {plan.description && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{plan.description}</p>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PubLayout>
  );
}
