import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Wrench, Loader2, AlertCircle, ChevronRight, Lock } from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { hasUnread } from "@/lib/demandRead";
import { OpcV2Layout } from "./OpcV2Layout";

interface TicketItem {
  id: number;
  outsourceOrderId: number;
  title: string;
  description: string | null;
  status: string;
  isBlockingPayment: boolean;
  createdByNickname: string | null;
  closedAt: string | null;
  closedNote: string | null;
  createdAt: string;
  updatedAt: string;
  orderNo: string | null;
  demandTitle: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:   { label: "处理中", color: "bg-amber-100 text-amber-700" },
  closed: { label: "已关闭", color: "bg-green-100 text-green-700" },
};

const FILTER_TABS = [
  { key: "all",    label: "全部" },
  { key: "open",   label: "处理中" },
  { key: "closed", label: "已关闭" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

export default function OpcV2TicketList() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [, navigate] = useLocation();

  const { data = [], isLoading, isError, refetch } = useQuery<TicketItem[]>({
    queryKey: ["v2-opc-tickets"],
    queryFn: () => v2Get("/tickets-b"),
  });

  const filtered = filter === "all" ? data : data.filter(t => t.status === filter);
  const counts = FILTER_TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key === "all" ? data.length : data.filter(t => t.status === tab.key).length;
    return acc;
  }, {} as Record<string, number>);

  const blockingCount = data.filter(t => t.status === "open" && t.isBlockingPayment).length;

  return (
    <OpcV2Layout title="工单">
      <div className="py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-emerald-900 mb-1">工单</h2>
          <p className="text-sm text-slate-500">
            与平台的问题工单
            {blockingCount > 0 && (
              <span className="ml-2 font-bold text-red-600">· {blockingCount} 个阻款工单待回复</span>
            )}
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                filter === tab.key ? "bg-emerald-700 text-white shadow-sm" : "bg-white text-slate-500 border border-slate-200 hover:border-emerald-400"
              }`}>
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`ml-1.5 text-[11px] font-bold ${filter === tab.key ? "opacity-75" : "text-slate-400"}`}>
                  {counts[tab.key]}
                </span>
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
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <Wrench size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">
              {filter === "all" ? "暂无工单" : "暂无此状态的工单"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...filtered].sort((a, b) =>
              (hasUnread("ticket_b", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("ticket_b", a.id, a.updatedAt) ? 1 : 0)
            ).map(ticket => {
              const cfg = STATUS_CONFIG[ticket.status] ?? { label: ticket.status, color: "bg-slate-100 text-slate-500" };
              return (
                <button key={ticket.id} onClick={() => navigate(`/opc/tickets/${ticket.id}`)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[15px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                      {ticket.title}
                      {ticket.isBlockingPayment && ticket.status === "open" && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 shrink-0">
                          <Lock size={9} /> 阻款
                        </span>
                      )}
                      {hasUnread("ticket_b", ticket.id, ticket.updatedAt) && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      )}
                    </span>
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                      {(ticket.demandTitle || ticket.orderNo) && (
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                            {ticket.demandTitle ? "关联需求" : "订单号"}
                          </p>
                          <p className="text-sm text-slate-600 truncate max-w-[12rem]">
                            {ticket.demandTitle ?? ticket.orderNo}
                          </p>
                        </div>
                      )}
                      {ticket.createdByNickname && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">发起方</p>
                          <p className="text-sm text-slate-600">{ticket.createdByNickname}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">创建时间</p>
                        <p className="text-sm text-slate-600">{new Date(ticket.createdAt).toLocaleDateString("zh-CN")}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-600 shrink-0" />
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
