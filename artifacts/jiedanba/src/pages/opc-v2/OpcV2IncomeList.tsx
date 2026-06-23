import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Wallet, Loader2, AlertCircle, Clock, CheckCircle2,
  ChevronRight, TrendingUp, Lock,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { OpcV2Layout } from "./OpcV2Layout";
import { Pagination } from "@/components/pub/Pagination";

const PAGE_SIZE = 10;

interface SettlementItem {
  id: number;
  outsourceOrderId: number;
  title: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  paymentVoucherUrl: string | null;
  status: string;
  isLastItem: boolean;
  isBlockingPayment: boolean;
  isOverdue: boolean;
}

interface OrderItem {
  id: number;
  orderNo: string;
  demandTitle: string | null;
  status: string;
}

const SETTLEMENT_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "待收款", color: "bg-amber-100 text-amber-700", icon: <Clock size={12} /> },
  paid:    { label: "已收款", color: "bg-green-100 text-green-700", icon: <CheckCircle2 size={12} /> },
};

const FILTER_TABS = [
  { key: "pending", label: "待收款" },
  { key: "paid",    label: "已收款" },
  { key: "all",     label: "全部" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

export default function OpcV2IncomeList() {
  const [filter, setFilter] = useState<FilterKey>("pending");
  const [page, setPage] = useState(1);
  const [, navigate] = useLocation();

  useEffect(() => { setPage(1); }, [filter]);

  const { data: settlements = [], isLoading, isError, refetch } = useQuery<SettlementItem[]>({
    queryKey: ["v2-opc-income"],
    queryFn: () => v2Get("/settlement-plans"),
  });

  const { data: orderData } = useQuery<{ items: OrderItem[] }>({
    queryKey: ["v2-opc-orders-income"],
    queryFn: () => v2Get("/outsource-orders?limit=200"),
  });

  const orders = orderData?.items ?? [];
  const orderMap = orders.reduce((acc, o) => { acc[o.id] = o; return acc; }, {} as Record<number, OrderItem>);

  const totalPaid    = settlements.filter(s => s.status === "paid").reduce((sum, s) => sum + s.amount, 0);
  const totalPending = settlements.filter(s => s.status === "pending").reduce((sum, s) => sum + s.amount, 0);
  const overdueCount = settlements.filter(s => s.status === "pending" && s.isOverdue).length;

  const counts = FILTER_TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key === "all" ? settlements.length : settlements.filter(s => s.status === tab.key).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = filter === "all" ? settlements : settlements.filter(s => s.status === filter);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <OpcV2Layout title="我的收款">
      <div className="py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-emerald-900 mb-1">我的收款</h2>
          <p className="text-sm text-slate-500">查看各订单的结算计划与收款记录</p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">
              <CheckCircle2 size={14} className="text-green-500" /> 已到账
            </div>
            <p className="text-2xl font-black text-green-700">¥{totalPaid.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">
              <Clock size={14} className="text-amber-500" /> 待收
            </div>
            <p className="text-2xl font-black text-amber-600">¥{totalPending.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">
              <TrendingUp size={14} className="text-primary" /> 逾期项
            </div>
            <p className={`text-2xl font-black ${overdueCount > 0 ? "text-red-600" : "text-slate-400"}`}>
              {overdueCount}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5 ${
                filter === tab.key ? "bg-emerald-700 text-white shadow-sm" : "bg-white text-slate-500 border border-slate-200 hover:border-emerald-400"
              }`}>
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  filter === tab.key ? "bg-white/20" : "bg-slate-100 text-slate-400"
                }`}>{counts[tab.key]}</span>
              )}
            </button>
          ))}
          <button onClick={() => refetch()}
            className="ml-auto text-xs text-slate-400 hover:text-emerald-700 px-3 py-2 hover:bg-slate-50 rounded-xl transition-colors">
            刷新
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : isError ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
            <p className="text-sm text-red-500 font-medium">加载失败</p>
            <button onClick={() => refetch()} className="mt-3 text-xs text-primary underline">重试</button>
          </div>
        ) : paged.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <Wallet size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">
              {filter === "all" ? "暂无结算计划，完成订单后将在此显示" : `暂无${filter === "pending" ? "待收款" : "已收款"}记录`}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paged.map(s => {
                const sc = SETTLEMENT_STATUS[s.status] ?? SETTLEMENT_STATUS.pending;
                const ord = orderMap[s.outsourceOrderId];
                return (
                  <button key={s.id}
                    onClick={() => navigate(`/opc/orders/${s.outsourceOrderId}`)}
                    className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-[15px] font-bold text-slate-800 truncate">{s.title}</p>
                          {s.isLastItem && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded shrink-0">尾款</span>
                          )}
                          {s.isBlockingPayment && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded flex items-center gap-0.5 shrink-0">
                              <Lock size={9} /> 阻款
                            </span>
                          )}
                        </div>
                        {ord && (
                          <p className="text-xs text-slate-400 truncate mb-2">
                            {ord.demandTitle ?? `订单 #${ord.id}`}
                            {ord.orderNo && <span className="font-mono ml-1.5">{ord.orderNo}</span>}
                          </p>
                        )}
                        <div className="flex gap-4 flex-wrap">
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">金额</p>
                            <p className={`text-xl font-black ${s.status === "paid" ? "text-green-700" : s.isOverdue ? "text-red-600" : "text-slate-800"}`}>
                              ¥{s.amount.toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">到期日</p>
                            <p className={`text-sm ${s.isOverdue ? "text-red-500 font-bold" : "text-slate-600"}`}>
                              {new Date(s.dueDate).toLocaleDateString("zh-CN")}
                              {s.isOverdue && " · 已逾期"}
                            </p>
                          </div>
                          {s.paidAt && (
                            <div>
                              <p className="text-[10px] text-slate-400 uppercase tracking-wider">收款时间</p>
                              <p className="text-sm text-green-600">{new Date(s.paidAt).toLocaleDateString("zh-CN")}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${sc.color} flex items-center gap-1`}>
                          {sc.icon} {sc.label}
                        </span>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-600 transition-colors" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </div>
    </OpcV2Layout>
  );
}
