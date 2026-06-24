import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Package, Loader2, AlertCircle, ChevronRight,
  FileSignature, Wrench, Clock, CheckCircle2,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { hasUnreadSinceCreation } from "@/lib/demandRead";
import { OpcV2Layout } from "./OpcV2Layout";
import { Pagination } from "@/components/pub/Pagination";

const PAGE_SIZE = 10;

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
  contractOpcConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TenderItem { id: number; totalPrice: number | null; }
interface SettlementItem { id: number; outsourceOrderId: number; amount: number; status: string; }
interface PagedResponse { total: number; items: OrderItem[]; }

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_contract: { label: "待签约", color: "bg-amber-100 text-amber-700",   icon: FileSignature },
  executing:        { label: "执行中", color: "bg-blue-100 text-blue-700",     icon: Wrench },
  warranty:         { label: "质保期", color: "bg-violet-100 text-violet-700", icon: Clock },
  completed:        { label: "已完成", color: "bg-green-100 text-green-700",   icon: CheckCircle2 },
  cancelled:        { label: "已取消", color: "bg-slate-100 text-slate-500",   icon: Package },
};

const FILTER_TABS = [
  { key: "pending_contract", label: "待签约" },
  { key: "executing",        label: "执行中" },
  { key: "warranty",         label: "质保期" },
  { key: "completed",        label: "已完成" },
  { key: "all",              label: "全部" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

export default function OpcV2OrderList() {
  const [filter, setFilter] = useState<FilterKey>("pending_contract");
  const [page, setPage] = useState(1);
  const [, navigate] = useLocation();

  useEffect(() => { setPage(1); }, [filter]);

  const { data, isLoading, isError, refetch } = useQuery<PagedResponse>({
    queryKey: ["v2-opc-orders"],
    queryFn: () => v2Get("/outsource-orders?limit=200"),
  });
  const { data: tenders = [] } = useQuery<TenderItem[]>({
    queryKey: ["v2-opc-tenders-orderlist"],
    queryFn: () => v2Get("/tenders?limit=200"),
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

  const sorted = [...filtered].sort((a, b) =>
    (hasUnreadSinceCreation("order", b.id, b.updatedAt, b.createdAt) ? 1 : 0) -
    (hasUnreadSinceCreation("order", a.id, a.updatedAt, a.createdAt) ? 1 : 0)
  );

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <OpcV2Layout title="我的订单">
      <div className="py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-emerald-900 mb-1">我的订单</h2>
          <p className="text-sm text-slate-500">管理接单后的合同签署与交付进度</p>
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
            <Package size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">
              {filter === "all" ? "暂无订单，中标后订单将在此显示" : "暂无此状态的订单"}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paged.map(order => {
                const cfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-slate-100 text-slate-500", icon: Package };
                const tender = tenderMap[order.tenderId];
                const totalPrice = tender?.totalPrice;
                const orderSettlements = settlementsByOrder[order.id] ?? [];
                const paidAmount = orderSettlements.filter(s => s.status === "paid").reduce((sum, s) => sum + s.amount, 0);
                const totalSettled = orderSettlements.reduce((sum, s) => sum + s.amount, 0);
                const displayPrice = totalPrice ?? (totalSettled > 0 ? totalSettled : null);
                const hasNew = hasUnreadSinceCreation("order", order.id, order.updatedAt, order.createdAt);
                return (
                  <button key={order.id} onClick={() => navigate(`/opc/orders/${order.id}`)}
                    className={`w-full text-left rounded-2xl border shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group ${
                      order.status === "pending_contract" ? "bg-amber-50/40 border-amber-200" : "bg-white border-slate-100"
                    }`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[15px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                        {order.demandTitle ?? `订单 #${order.id}`}
                        {hasNew && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                      </span>
                      <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <div className="flex items-end gap-4">
                      <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">订单号</p>
                          <p className="text-sm text-slate-500 font-mono">{order.orderNo}</p>
                        </div>
                        {displayPrice != null && (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">合同金额</p>
                            <p className="text-xl font-black text-slate-800">¥{displayPrice.toLocaleString()}</p>
                          </div>
                        )}
                        {paidAmount > 0 && (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">已到账</p>
                            <p className="text-xl font-black text-emerald-600">¥{paidAmount.toLocaleString()}</p>
                          </div>
                        )}
                        {order.warrantyEndDate ? (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">质保至</p>
                            <p className="text-sm text-slate-600">{new Date(order.warrantyEndDate).toLocaleDateString("zh-CN")}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">创建</p>
                            <p className="text-sm text-slate-600">{new Date(order.createdAt).toLocaleDateString("zh-CN")}</p>
                          </div>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-600 shrink-0" />
                    </div>
                    {order.status === "pending_contract" && (
                      order.contractOpcConfirmedAt
                        ? <p className="mt-2 text-xs font-bold text-blue-600">✓ 已确认合同，等待运营上传已签文件</p>
                        : <p className="mt-2 text-xs font-bold text-amber-700">⚠️ 请查阅合同内容并确认签约</p>
                    )}
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
