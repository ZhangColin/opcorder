import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Wrench, Loader2, AlertCircle, ChevronRight, Clock } from "lucide-react";
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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:   { label: "处理中", color: "bg-blue-100 text-blue-700" },
  closed: { label: "已关闭", color: "bg-slate-100 text-slate-500" },
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

  return (
    <PubLayout title="质保工单">
      <div className="mt-6 space-y-5">
        {openCount > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-black text-sm shrink-0">
              {openCount}
            </div>
            <p className="text-sm text-blue-800 font-medium">
              您有 <strong>{openCount}</strong> 个工单正在处理中
            </p>
          </div>
        )}

        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === tab.value
                  ? "bg-primary text-white"
                  : "bg-white border border-slate-200 text-slate-500 hover:border-primary hover:text-primary"
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
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-slate-400">
            <Wrench size={36} className="mb-3 text-slate-300" />
            <p className="text-base font-medium">暂无工单</p>
            <p className="text-xs mt-1">质保期内可在需求详情中发起工单</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...tickets].sort((a, b) =>
              (hasUnread("ticket_a", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("ticket_a", a.id, a.updatedAt) ? 1 : 0)
            ).map(t => {
              const cfg = STATUS_CONFIG[t.status] ?? { label: t.status, color: "bg-slate-100 text-slate-500" };
              return (
                <div
                  key={t.id}
                  onClick={() => navigate(`/pub/demands/${t.clientDemandId}?tab=ticket&id=${t.id}`)}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 hover:border-primary/30 hover:shadow-sm cursor-pointer transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Wrench size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {t.demandTitle && (
                      <p className="text-xs text-slate-500 truncate mb-0.5">{t.demandTitle}</p>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      {hasUnread("ticket_a", t.id, t.updatedAt) && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </div>
                    <p className="font-bold text-slate-800 truncate">{t.title}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock size={11} />
                      {new Date(t.createdAt).toLocaleDateString("zh-CN")}
                      {t.closedAt && ` · 关闭于 ${new Date(t.closedAt).toLocaleDateString("zh-CN")}`}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PubLayout>
  );
}
