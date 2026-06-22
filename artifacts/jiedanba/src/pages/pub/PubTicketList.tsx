import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Wrench, Loader2, ChevronRight, Clock,
  CheckCircle2, AlertCircle, MessageSquare,
} from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { v2Get } from "@/lib/v2api";
import { hasUnread } from "@/lib/demandRead";

interface Ticket {
  id: number;
  clientDemandId: number;
  title: string;
  description: string | null;
  status: string;
  createdByNickname: string | null;
  closedAt: string | null;
  closedNote: string | null;
  createdAt: string;
  updatedAt: string;
  demandTitle: string | null;
}

const STATUS_CONFIG: Record<string, {
  label: string; badge: string; accent: string;
  cardBg: string; icon: React.ElementType;
}> = {
  open: {
    label: "处理中", badge: "bg-emerald-100 text-emerald-700",
    accent: "border-l-emerald-500", cardBg: "bg-white",
    icon: Wrench,
  },
  closed: {
    label: "已关闭", badge: "bg-slate-100 text-slate-500",
    accent: "border-l-slate-200", cardBg: "bg-white",
    icon: CheckCircle2,
  },
};

const TABS = [
  { value: "", label: "全部" },
  { value: "open", label: "处理中" },
  { value: "closed", label: "已关闭" },
];

export default function PubTicketList() {
  const [, navigate] = useLocation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const data = await v2Get<Ticket[]>(`/tickets-a?${params}`);
      setTickets(data);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCount = tickets.filter(t => t.status === "open").length;

  const sorted = [...tickets].sort((a, b) =>
    (hasUnread("ticket_a", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("ticket_a", a.id, a.updatedAt) ? 1 : 0)
  );

  return (
    <PubLayout title="质保工单">
      <div className="mt-5 space-y-4">
        {/* Open tickets alert */}
        {openCount > 0 && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <Wrench size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-800">{openCount} 个工单处理中</p>
              <p className="text-xs text-emerald-600 mt-0.5">OPC 正在跟进，有更新会通知您</p>
            </div>
            <button
              onClick={() => setStatusFilter("open")}
              className="ml-auto text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors px-3 py-1.5 rounded-lg shrink-0"
            >
              查看
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === tab.value
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600"
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
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
              <Wrench size={28} className="text-emerald-300" />
            </div>
            <p className="text-base font-semibold text-slate-500">暂无质保工单</p>
            <p className="text-xs text-slate-400 mt-1">质保期内可在需求详情中发起工单</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sorted.map(t => {
              const cfg = STATUS_CONFIG[t.status] ?? {
                label: t.status, badge: "bg-slate-100 text-slate-500",
                accent: "border-l-slate-300", cardBg: "bg-white", icon: Wrench,
              };
              const StatusIcon = cfg.icon;
              const isOpen = t.status === "open";
              const unread = hasUnread("ticket_a", t.id, t.updatedAt);

              return (
                <div
                  key={t.id}
                  onClick={() => navigate(`/pub/demands/${t.clientDemandId}?tab=ticket&id=${t.id}`)}
                  className={`rounded-2xl border border-slate-100 border-l-4 ${cfg.accent} ${cfg.cardBg}
                    p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group
                    ${!isOpen ? "opacity-65" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isOpen ? "bg-emerald-100" : "bg-slate-100"
                    }`}>
                      <StatusIcon size={18} className={isOpen ? "text-emerald-600" : "text-slate-400"} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Demand breadcrumb */}
                      {t.demandTitle && (
                        <p className="text-xs text-slate-400 truncate mb-1.5">{t.demandTitle}</p>
                      )}

                      {/* Status + unread */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                          <StatusIcon size={10} /> {cfg.label}
                        </span>
                        {unread && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> 新动态
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <p className="text-[15px] font-bold text-slate-800 leading-snug mb-2 group-hover:text-emerald-700 transition-colors truncate">
                        {t.title}
                      </p>

                      {/* Description snippet */}
                      {t.description && isOpen && (
                        <p className="text-xs text-slate-500 line-clamp-2 mb-2 leading-relaxed">
                          {t.description}
                        </p>
                      )}

                      {/* Closed note */}
                      {!isOpen && t.closedNote && (
                        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-2.5 py-1.5 mb-2 truncate">
                          关闭备注：{t.closedNote}
                        </p>
                      )}

                      {/* Footer */}
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(t.createdAt).toLocaleDateString("zh-CN")} 创建
                        </span>
                        {t.closedAt && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <CheckCircle2 size={10} />
                            关闭 {new Date(t.closedAt).toLocaleDateString("zh-CN")}
                          </span>
                        )}
                        {t.createdByNickname && (
                          <span className="flex items-center gap-1">
                            <MessageSquare size={10} /> {t.createdByNickname}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-500 shrink-0 mt-1 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PubLayout>
  );
}
