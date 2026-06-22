import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Wrench, Loader2, ChevronRight, Clock, CheckCircle2 } from "lucide-react";
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
  demandNo: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  open:   { label: "处理中", cls: "bg-emerald-100 text-emerald-700" },
  closed: { label: "已关闭", cls: "bg-slate-100 text-slate-500" },
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
    } catch { setTickets([]); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCount = tickets.filter(t => t.status === "open").length;
  const sorted = [...tickets].sort((a, b) =>
    (hasUnread("ticket_a", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("ticket_a", a.id, a.updatedAt) ? 1 : 0)
  );

  return (
    <PubLayout title="质保工单">
      <div className="mt-5 space-y-4">
        {openCount > 0 && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <Wrench size={16} className="text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">
              <strong>{openCount}</strong> 个工单正在处理中，有更新会通知您
            </p>
          </div>
        )}

        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => (
            <button key={t.value} onClick={() => setStatusFilter(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === t.value
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-100">
            <Wrench size={36} className="text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-500">暂无质保工单</p>
            <p className="text-xs text-slate-400 mt-1">质保期内可在需求详情中发起工单</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map(t => {
              const cfg = STATUS_CONFIG[t.status] ?? { label: t.status, cls: "bg-slate-100 text-slate-500" };
              const isOpen = t.status === "open";
              const unread = hasUnread("ticket_a", t.id, t.updatedAt);

              return (
                <div key={t.id}
                  onClick={() => navigate(`/pub/demands/${t.clientDemandId}?tab=ticket&id=${t.id}`)}
                  className={`bg-white rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group px-5 py-4 ${
                    !isOpen ? "opacity-70 border-slate-100" : "border-slate-100"
                  }`}>

                  {/* Row 1: 工单标题（主体）+ 状态（同合同管理） */}
                  <div className="flex items-start justify-between gap-4 mb-2.5">
                    <p className="text-[15px] font-bold text-slate-800 group-hover:text-emerald-700 transition-colors leading-snug flex-1 min-w-0 truncate">
                      {t.title}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {unread && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                    </div>
                  </div>

                  {/* 描述摘要（处理中时）/ 关闭备注（已关闭时）*/}
                  {isOpen && t.description && (
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-1 mb-2.5">{t.description}</p>
                  )}
                  {!isOpen && t.closedNote && (
                    <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 mb-2.5">
                      <span className="font-medium text-slate-500">关闭备注：</span>{t.closedNote}
                    </p>
                  )}

                  {/* Row 2: 2-line label-value 块横排（同合同管理） */}
                  <div className="flex items-end gap-6 text-xs flex-wrap">
                    {t.demandTitle && (
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">关联需求</p>
                        <p className="text-slate-600 truncate max-w-[12rem]">
                          {t.demandTitle}
                          {t.demandNo && <span className="text-slate-400"> · {t.demandNo}</span>}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">创建时间</p>
                      <p className="text-slate-500 flex items-center gap-1">
                        <Clock size={10} /> {new Date(t.createdAt).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                    {t.closedAt && (
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">关闭时间</p>
                        <p className="text-slate-500 flex items-center gap-1">
                          <CheckCircle2 size={10} /> {new Date(t.closedAt).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                    )}
                    <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-emerald-500 transition-colors" />
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
