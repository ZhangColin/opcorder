import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight, AlertTriangle } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";

interface PaymentPlan {
  id: number;
  clientDemandId: number | null;
  demandTitle?: string | null;
  demandNo?: string | null;
  title: string;
  itemNo?: number | null;
  amount: number;
  dueDate: string | null;
  status: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:         { label: "待付款",  color: "bg-slate-100 text-slate-500" },
  awaiting_review: { label: "待审核",  color: "bg-amber-100 text-amber-700" },
  paid:            { label: "已支付",  color: "bg-green-100 text-green-700" },
  overdue:         { label: "已逾期",  color: "bg-red-100 text-red-600" },
};

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "awaiting_review", label: "待审核" },
  { value: "pending", label: "待付款" },
  { value: "overdue", label: "已逾期" },
  { value: "paid", label: "已支付" },
];

function isOverdue(item: PaymentPlan) {
  if (item.status !== "pending" || !item.dueDate) return false;
  return new Date(item.dueDate) < new Date();
}

function isDueSoon(item: PaymentPlan) {
  if (item.status !== "pending" || !item.dueDate) return false;
  const diff = new Date(item.dueDate).getTime() - Date.now();
  return diff > 0 && diff < 3 * 86400_000;
}

export default function AdminV2PaymentAList() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const [items, setItems] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", channel: "a" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await v2Get<PaymentPlan[]>(`/payment-plans?${params}`);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const needsAttention = items.filter(i => i.status === "awaiting_review" || isOverdue(i) || isDueSoon(i));

  return (
    <AdminV2Layout title="收款管理 (A)">
      <div className="mt-6 space-y-5">
        {needsAttention.length > 0 && !statusFilter && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 mb-2">⚡ 需关注（{needsAttention.length} 件）</p>
            <div className="flex flex-wrap gap-2">
              {needsAttention.slice(0, 6).map(i => (
                <button key={i.id} onClick={() => inlineNav ? inlineNav.push(`/admin/v2/payments-a/${i.id}`) : navigate(`/admin/v2/payments-a/${i.id}`)}
                  className="text-xs bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-amber-800 hover:bg-amber-100">
                  {i.title} · ¥{i.amount.toLocaleString()}
                  {isOverdue(i) && <span className="ml-1 text-red-500 font-bold">逾期</span>}
                  {i.status === "awaiting_review" && <span className="ml-1 text-amber-600 font-bold">待审核</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                statusFilter === tab.value ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-primary/30"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">暂无收款项</div>
        ) : (
          <div className="space-y-2">
            {items.map(item => {
              const overdue = isOverdue(item);
              const soon = isDueSoon(item);
              const needAttn = item.status === "awaiting_review" || overdue;
              const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: "bg-slate-100 text-slate-500" };
              const badgeColor = overdue ? "bg-red-100 text-red-600" : cfg.color;
              const badgeLabel = overdue ? "已逾期" : cfg.label;
              const go = () => inlineNav ? inlineNav.push(`/admin/v2/payments-a/${item.id}`) : navigate(`/admin/v2/payments-a/${item.id}`);
              return (
                <button key={item.id} onClick={go}
                  className={`w-full text-left rounded-2xl border shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group ${
                    needAttn ? "bg-amber-50/40 border-amber-200" : soon ? "bg-orange-50/30 border-orange-100" : "bg-white border-slate-100"
                  }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[15px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                      第 {item.itemNo ?? 1} 期 · {item.title}
                      {soon && !overdue && <AlertTriangle size={13} className="text-orange-500 shrink-0" />}
                    </span>
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${badgeColor}`}>{badgeLabel}</span>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                      {item.demandTitle && (
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">关联需求</p>
                          <p className="text-sm text-slate-600 truncate max-w-[12rem]">{item.demandTitle}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">金额</p>
                        <p className={`text-xl font-black leading-tight ${overdue ? "text-red-600" : item.status === "paid" ? "text-emerald-600" : "text-slate-800"}`}>
                          ¥{item.amount.toLocaleString()}
                        </p>
                      </div>
                      {item.dueDate && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">应收日期</p>
                          <p className="text-sm text-slate-600">{new Date(item.dueDate).toLocaleDateString("zh-CN")}</p>
                        </div>
                      )}
                      {item.paidAt && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">支付时间</p>
                          <p className="text-sm text-slate-600">{new Date(item.paidAt).toLocaleDateString("zh-CN")}</p>
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-primary shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AdminV2Layout>
  );
}
