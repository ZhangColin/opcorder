import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Loader2, ChevronRight, AlertTriangle, Wallet,
  CheckCircle2, Clock,
} from "lucide-react";
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

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  pending: { label: "待付款", cls: "bg-sky-100 text-sky-700" },
  paid:    { label: "已支付", cls: "bg-green-100 text-green-700" },
};

const STATUS_TABS = [
  { value: "today",   label: "今日付款" },
  { value: "pending", label: "待付款" },
  { value: "paid",    label: "已支付" },
  { value: "",        label: "全部" },
];

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function isDueToday(item: SettlementPlan) {
  return item.status === "pending" && !!item.dueDate && new Date(item.dueDate) <= endOfToday();
}

function isOverdue(item: SettlementPlan) {
  return item.status === "pending" && !!item.dueDate && new Date(item.dueDate) < new Date();
}

function isDueSoon(item: SettlementPlan) {
  if (item.status !== "pending" || !item.dueDate) return false;
  const diff = new Date(item.dueDate).getTime() - Date.now();
  return diff > 0 && diff < 3 * 86400_000;
}

function fmtAmt(n: number) {
  if (n >= 10000) return `¥${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万`;
  return `¥${n.toLocaleString()}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", { year: "numeric", month: "numeric", day: "numeric" });
}

export default function AdminV2PaymentBList() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const [items, setItems] = useState<SettlementPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("today");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await v2Get<SettlementPlan[]>(`/settlement-plans?limit=200`);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = statusFilter === "today"
    ? items.filter(isDueToday)
    : statusFilter === ""
      ? items
      : items.filter(p => p.status === statusFilter);
  const counts: Record<string, number> = {};
  STATUS_TABS.forEach(tab => {
    if (tab.value === "today") counts[tab.value] = items.filter(isDueToday).length;
    else if (tab.value === "") counts[tab.value] = items.length;
    else counts[tab.value] = items.filter(p => p.status === tab.value).length;
  });
  const overdueItems = items.filter(i => isOverdue(i));
  const pendingTotal = items.filter(p => p.status === "pending").reduce((s, p) => s + p.amount, 0);

  return (
    <AdminV2Layout>
      <div className="mt-5 space-y-4">
        {overdueItems.length > 0 && statusFilter !== "paid" && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-800 font-medium">
              <strong>{overdueItems.length}</strong> 项结算款已逾期，请尽快处理
            </p>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_TABS.map(tab => (
              <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                  statusFilter === tab.value
                    ? "bg-primary text-white"
                    : "bg-white border border-slate-200 text-slate-500 hover:border-primary/30 hover:text-primary"
                }`}>
                {tab.label}
                {counts[tab.value] > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    statusFilter === tab.value ? "bg-white/20" : "bg-slate-100 text-slate-500"
                  }`}>{counts[tab.value]}</span>
                )}
              </button>
            ))}
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
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-200">
            <Wallet size={36} className="text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-500">暂无结算付款项</p>
            <p className="text-xs text-slate-400 mt-1">OPC 完成交付后将生成结算计划</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(item => {
              const overdue = isOverdue(item);
              const soon = isDueSoon(item);
              const isPaid = item.status === "paid";
              const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, cls: "bg-slate-100 text-slate-500" };
              const go = () => inlineNav ? inlineNav.push(`/admin/v2/payments-b/${item.id}`) : navigate(`/admin/v2/payments-b/${item.id}`);
              return (
                <div key={item.id} onClick={go}
                  className={`bg-white rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group px-5 py-4 ${
                    overdue ? "border-red-200 bg-red-50/30" : soon ? "border-amber-100 bg-amber-50/20" : "border-slate-100"
                  }`}>
                  <div className="flex items-start justify-between gap-4 mb-2.5">
                    <p className="text-[15px] font-bold text-slate-800 group-hover:text-primary transition-colors leading-snug flex-1 min-w-0 truncate">
                      {item.demandTitle ?? `订单 ${item.orderNo ?? `#${item.outsourceOrderId}`}`}
                    </p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${overdue ? "bg-red-100 text-red-700" : cfg.cls}`}>
                      {overdue ? "已逾期" : cfg.label}
                    </span>
                  </div>
                  <div className="flex items-end gap-6 text-xs flex-wrap">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">期数</p>
                      <p className="text-slate-600">
                        第 {item.itemNo ?? 1} 期{item.description ? `  · ${item.description}` : ""}
                      </p>
                    </div>
                    {item.orderNo && (
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">订单号</p>
                        <p className="text-slate-500 font-mono">{item.orderNo}</p>
                      </div>
                    )}
                    {item.dueDate && (
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">应付日期</p>
                        <p className={`flex items-center gap-1 ${overdue ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                          {overdue
                            ? <AlertTriangle size={10} />
                            : isPaid
                              ? <CheckCircle2 size={10} className="text-green-500" />
                              : <Clock size={10} />
                          }
                          {fmtDate(item.dueDate)}
                        </p>
                      </div>
                    )}
                    <div className="ml-auto">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">付款金额</p>
                      <p className={`text-xl font-black leading-none ${overdue ? "text-red-600" : isPaid ? "text-green-600" : "text-slate-800"}`}>
                        {fmtAmt(item.amount)}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-primary transition-colors mb-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminV2Layout>
  );
}
