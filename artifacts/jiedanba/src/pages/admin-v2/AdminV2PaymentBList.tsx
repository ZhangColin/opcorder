import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight, Wallet, Clock, AlertTriangle } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";

interface SettlementPlan {
  id: number;
  outsourceOrderId: number;
  itemNo: number | null;
  description: string | null;
  amount: number;
  dueDate: string | null;
  status: string;
  paidAt: string | null;
  isOverdue?: boolean;
  createdAt: string;
  orderNo?: string | null;
  demandTitle?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "待付款",   color: "bg-slate-100 text-slate-500" },
  paid:    { label: "已支付",   color: "bg-green-100 text-green-700" },
};

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "pending", label: "待付款" },
  { value: "paid", label: "已支付" },
];

function isOverdue(item: SettlementPlan) {
  return item.status === "pending" && !!item.dueDate && new Date(item.dueDate) < new Date();
}

function isDueSoon(item: SettlementPlan) {
  if (item.status !== "pending" || !item.dueDate) return false;
  const diff = new Date(item.dueDate).getTime() - Date.now();
  return diff > 0 && diff < 3 * 86400_000;
}

export default function AdminV2PaymentBList() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const [items, setItems] = useState<SettlementPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await v2Get<SettlementPlan[]>(`/settlement-plans?${params}`);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const alerts = items.filter(i => isOverdue(i) || isDueSoon(i));

  return (
    <AdminV2Layout title="结算付款 (B)">
      <div className="mt-6 space-y-5">
        {alerts.length > 0 && !statusFilter && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 mb-2">⚡ 需关注（{alerts.length} 件）</p>
            <div className="flex flex-wrap gap-2">
              {alerts.slice(0, 6).map(i => (
                <button key={i.id} onClick={() => inlineNav ? inlineNav.push(`/admin/v2/payments-b/${i.id}`) : navigate(`/admin/v2/payments-b/${i.id}`)}
                  className="text-xs bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-amber-800 hover:bg-amber-100">
                  {i.description ?? `第${i.itemNo ?? 1}期`} · ¥{i.amount.toLocaleString()}
                  {isOverdue(i) && <span className="ml-1 text-red-500 font-bold">逾期</span>}
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
          <div className="text-center py-16 text-slate-400 text-sm">暂无结算付款项</div>
        ) : (
          <div className="space-y-2">
            {items.map(item => {
              const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: "bg-slate-100 text-slate-500" };
              const overdue = isOverdue(item);
              const soon = isDueSoon(item);
              return (
                <button key={item.id} onClick={() => inlineNav ? inlineNav.push(`/admin/v2/payments-b/${item.id}`) : navigate(`/admin/v2/payments-b/${item.id}`)}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md group ${
                    overdue ? "bg-red-50/40 border-red-200" : soon ? "bg-amber-50/40 border-amber-100" : "bg-white border-slate-100 hover:border-primary/20"
                  }`}>
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <Wallet size={18} className="text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.demandTitle && (
                      <p className="text-xs text-slate-500 truncate mb-0.5">{item.demandTitle}</p>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${overdue ? "bg-red-100 text-red-600" : cfg.color}`}>
                        {overdue ? "已逾期" : cfg.label}
                      </span>
                      {soon && !overdue && <span className="text-xs text-orange-500 flex items-center gap-0.5 font-bold"><AlertTriangle size={10} />即将到期</span>}
                      {item.orderNo && <span className="text-xs text-slate-400 font-mono">{item.orderNo}</span>}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.description ?? `第${item.itemNo ?? 1}期结算款`}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="font-bold text-slate-700 text-base">¥{item.amount.toLocaleString()}</span>
                      {item.dueDate && <span className="flex items-center gap-1"><Clock size={11} />应付 {new Date(item.dueDate).toLocaleDateString("zh-CN")}</span>}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-primary shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AdminV2Layout>
  );
}
