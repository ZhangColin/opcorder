import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Wallet, Loader2, AlertCircle, Clock, CheckCircle2,
  ChevronRight, TrendingUp, Lock,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { OpcV2Layout } from "./OpcV2Layout";

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
  pending: { label: "待付款", color: "bg-amber-100 text-amber-700", icon: <Clock size={12} /> },
  paid:    { label: "已付款", color: "bg-green-100 text-green-700", icon: <CheckCircle2 size={12} /> },
};

export default function OpcV2IncomeList() {
  const [, navigate] = useLocation();

  const { data: settlements = [], isLoading: loadingS, isError: errorS, refetch } = useQuery<SettlementItem[]>({
    queryKey: ["v2-opc-income"],
    queryFn: () => v2Get("/settlement-plans"),
  });

  const { data: orderData } = useQuery<{ items: OrderItem[] }>({
    queryKey: ["v2-opc-orders-income"],
    queryFn: () => v2Get("/outsource-orders?limit=100"),
  });

  const orders = orderData?.items ?? [];
  const orderMap = orders.reduce((acc, o) => { acc[o.id] = o; return acc; }, {} as Record<number, OrderItem>);

  const totalPaid = settlements.filter(s => s.status === "paid").reduce((sum, s) => sum + s.amount, 0);
  const totalPending = settlements.filter(s => s.status === "pending").reduce((sum, s) => sum + s.amount, 0);
  const overdueCount = settlements.filter(s => s.status === "pending" && s.isOverdue).length;

  const grouped = settlements.reduce((acc, s) => {
    if (!acc[s.outsourceOrderId]) acc[s.outsourceOrderId] = [];
    acc[s.outsourceOrderId].push(s);
    return acc;
  }, {} as Record<number, SettlementItem[]>);

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

        {loadingS ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : errorS ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
            <p className="text-sm text-red-500 font-medium">加载失败</p>
            <button onClick={() => refetch()} className="mt-3 text-xs text-primary underline">重试</button>
          </div>
        ) : settlements.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <Wallet size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">暂无结算计划，完成订单后将在此显示</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([ordIdStr, plans]) => {
              const ordId = parseInt(ordIdStr);
              const ord = orderMap[ordId];
              return (
                <div key={ordId} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => navigate(`/opc/orders/${ordId}`)}
                    className="w-full flex items-center gap-3 px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors group text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-800 group-hover:text-emerald-800 transition-colors truncate">
                        {ord?.demandTitle ?? `订单 #${ordId}`}
                      </p>
                      {ord?.orderNo && (
                        <p className="text-xs font-mono text-slate-400">{ord.orderNo}</p>
                      )}
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-600 shrink-0 transition-colors" />
                  </button>
                  <div className="divide-y divide-slate-50">
                    {plans.map(s => {
                      const sc = SETTLEMENT_STATUS[s.status] ?? SETTLEMENT_STATUS.pending;
                      return (
                        <div key={s.id} className="flex items-center justify-between px-5 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-700">{s.title}</p>
                              {s.isLastItem && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">尾款</span>
                              )}
                              {s.isBlockingPayment && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded flex items-center gap-0.5">
                                  <Lock size={9} /> 阻款
                                </span>
                              )}
                            </div>
                            <p className={`text-xs mt-0.5 ${s.isOverdue ? "text-red-500 font-bold" : "text-slate-400"}`}>
                              到期 {new Date(s.dueDate).toLocaleDateString("zh-CN")}
                              {s.isOverdue && " · 已逾期"}
                            </p>
                            {s.paidAt && (
                              <p className="text-xs text-green-600 mt-0.5">
                                收款于 {new Date(s.paidAt).toLocaleDateString("zh-CN")}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className={`text-base font-black ${s.status === "paid" ? "text-green-700" : s.isOverdue ? "text-red-600" : "text-slate-800"}`}>
                              ¥{s.amount.toLocaleString()}
                            </p>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${sc.color} flex items-center gap-0.5 justify-end`}>
                              {sc.icon} {sc.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </OpcV2Layout>
  );
}
