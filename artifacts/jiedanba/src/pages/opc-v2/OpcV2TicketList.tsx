import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Wrench, Loader2, AlertCircle, ChevronRight, Clock,
  CheckCircle2, Lock,
} from "lucide-react";
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open:   { label: "处理中", color: "bg-amber-100 text-amber-700", icon: <Clock size={12} /> },
  closed: { label: "已关闭", color: "bg-green-100 text-green-700", icon: <CheckCircle2 size={12} /> },
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
              <span className="ml-2 font-bold text-red-600">
                · {blockingCount} 个阻款工单待回复
              </span>
            )}
          </p>
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
            <Wrench size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">
              {filter === "all" ? "暂无工单" : "暂无此状态的工单"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...filtered].sort((a, b) =>
              (hasUnread("ticket_b", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("ticket_b", a.id, a.updatedAt) ? 1 : 0)
            ).map(ticket => {
              const cfg = STATUS_CONFIG[ticket.status] ?? { label: ticket.status, color: "bg-slate-100 text-slate-500", icon: null };
              return (
                <button
                  key={ticket.id}
                  onClick={() => navigate(`/opc/tickets/${ticket.id}`)}
                  className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all p-5 text-left group"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.color}`}>
                          {cfg.icon}
                          {cfg.label}
                        </span>
                        {ticket.isBlockingPayment && ticket.status === "open" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-600">
                            <Lock size={10} /> 阻款
                          </span>
                        )}
                      </div>
                      {hasUnread("ticket_b", ticket.id, ticket.updatedAt) && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      )}
                      <h3 className="font-bold text-slate-800 group-hover:text-emerald-800 transition-colors mb-1">
                        {ticket.title}
                      </h3>
                      {ticket.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-1">
                          {ticket.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {new Date(ticket.createdAt).toLocaleDateString("zh-CN")} 创建
                        </span>
                        {ticket.createdByNickname && (
                          <span>发起方：{ticket.createdByNickname}</span>
                        )}
                        {ticket.demandTitle
                          ? <span className="truncate max-w-[160px]">{ticket.demandTitle}</span>
                          : <span>订单 #{ticket.outsourceOrderId}</span>
                        }
                        {ticket.orderNo && <span className="font-mono">{ticket.orderNo}</span>}
                      </div>
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
