import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Package, Loader2, AlertCircle, ChevronRight, Clock,
  CheckCircle2, FileSignature, Wrench, Wallet, TrendingUp,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { OpcV2Layout } from "./OpcV2Layout";

interface OrderItem {
  id: number;
  orderNo: string;
  outsourceDemandId: number;
  demandTitle: string | null;
  tenderId: number;
  opcId: number;
  opcNickname: string | null;
  status: string;
  warrantyEndDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TenderItem {
  id: number;
  totalPrice: number | null;
}

interface SettlementItem {
  id: number;
  outsourceOrderId: number;
  amount: number;
  status: string;
}

interface PagedResponse {
  total: number;
  items: OrderItem[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_contract: { label: "待签约",  color: "bg-amber-100 text-amber-700",  icon: <FileSignature size={12} /> },
  executing:        { label: "执行中",  color: "bg-blue-100 text-blue-700",    icon: <Wrench size={12} /> },
  warranty:         { label: "质保期",  color: "bg-violet-100 text-violet-700", icon: <Clock size={12} /> },
  completed:        { label: "已完成",  color: "bg-green-100 text-green-700",  icon: <CheckCircle2 size={12} /> },
  cancelled:        { label: "已取消",  color: "bg-slate-100 text-slate-500",  icon: null },
};

const FILTER_TABS = [
  { key: "all",             label: "全部" },
  { key: "pending_contract", label: "待签约" },
  { key: "executing",       label: "执行中" },
  { key: "warranty",        label: "质保期" },
  { key: "completed",       label: "已完成" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

export default function OpcV2OrderList() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [, navigate] = useLocation();

  const { data, isLoading, isError, refetch } = useQuery<PagedResponse>({
    queryKey: ["v2-opc-orders"],
    queryFn: () => v2Get("/outsource-orders?limit=100"),
  });

  const { data: tenders = [] } = useQuery<TenderItem[]>({
    queryKey: ["v2-opc-tenders-orderlist"],
    queryFn: () => v2Get("/tenders?limit=100"),
  });

  const { data: settlements = [] } = useQuery<SettlementItem[]>({
    queryKey: ["v2-opc-settlements-orderlist"],
    queryFn: () => v2Get("/settlement-plans"),
  });

  const orders = data?.items ?? [];
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  const counts = FILTER_TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key === "all" ? orders.length : orders.filter(o => o.status === tab.key).length;
    return acc;
  }, {} as Record<string, number>);

  const tenderMap = tenders.reduce((acc, t) => { acc[t.id] = t; return acc; }, {} as Record<number, TenderItem>);

  const settlementsByOrder = settlements.reduce((acc, s) => {
    if (!acc[s.outsourceOrderId]) acc[s.outsourceOrderId] = [];
    acc[s.outsourceOrderId].push(s);
    return acc;
  }, {} as Record<number, SettlementItem[]>);

  return (
    <OpcV2Layout title="我的订单">
      <div className="py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-emerald-900 mb-1">我的订单</h2>
          <p className="text-sm text-slate-500">管理接单后的合同签署与交付进度</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                filter === tab.key
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-emerald-400"
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`ml-1.5 text-[11px] font-bold ${filter === tab.key ? "opacity-75" : "text-slate-400"}`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => refetch()}
            className="ml-auto text-xs text-slate-400 hover:text-emerald-700 px-3 py-2 hover:bg-slate-50 rounded-xl transition-colors"
          >
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
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <Package size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">
              {filter === "all" ? "暂无订单，中标后订单将在此显示" : "暂无此状态的订单"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(order => {
              const cfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-slate-100 text-slate-500", icon: null };
              const tender = tenderMap[order.tenderId];
              const totalPrice = tender?.totalPrice;
              const orderSettlements = settlementsByOrder[order.id] ?? [];
              const paidAmount = orderSettlements
                .filter(s => s.status === "paid")
                .reduce((sum, s) => sum + s.amount, 0);
              const totalSettled = orderSettlements.reduce((sum, s) => sum + s.amount, 0);

              return (
                <button
                  key={order.id}
                  onClick={() => navigate(`/opc/orders/${order.id}`)}
                  className={`w-full bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-5 text-left group ${
                    order.status === "pending_contract"
                      ? "border-amber-200 hover:border-amber-400"
                      : "border-slate-100 hover:border-emerald-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.color}`}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{order.orderNo}</span>
                      </div>
                      <h3 className="font-bold text-slate-800 group-hover:text-emerald-800 transition-colors mb-2">
                        {order.demandTitle ?? `订单 #${order.id}`}
                      </h3>

                      <div className="flex flex-wrap gap-3 text-xs">
                        {(totalPrice || totalSettled > 0) && (
                          <span className="flex items-center gap-1 text-slate-700 font-bold">
                            <Wallet size={11} className="text-emerald-600" />
                            总金额 ¥{(totalPrice ?? totalSettled).toLocaleString()}
                          </span>
                        )}
                        {paidAmount > 0 && (
                          <span className="flex items-center gap-1 text-green-700 font-bold">
                            <TrendingUp size={11} /> 已到账 ¥{paidAmount.toLocaleString()}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock size={11} />
                          {new Date(order.createdAt).toLocaleDateString("zh-CN")} 创建
                        </span>
                        {order.warrantyEndDate && (
                          <span className="text-slate-400">质保至 {new Date(order.warrantyEndDate).toLocaleDateString("zh-CN")}</span>
                        )}
                      </div>

                      {order.status === "pending_contract" && (
                        <p className="mt-2 text-xs font-bold text-amber-700">
                          ⚠️ 请尽快查阅合同并上传已签PDF确认
                        </p>
                      )}
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-600 transition-colors mt-1 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </OpcV2Layout>
  );
}
