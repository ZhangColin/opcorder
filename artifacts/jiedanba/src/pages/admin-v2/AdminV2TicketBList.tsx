import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";
import { hasUnread } from "@/lib/demandRead";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";

interface TicketB {
  id: number;
  outsourceOrderId: number;
  title: string;
  status: string;
  createdByNickname: string | null;
  createdAt: string;
  updatedAt: string;
  orderNo?: string | null;
  demandTitle?: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:   { label: "开放中", color: "bg-blue-100 text-blue-700" },
  closed: { label: "已关闭", color: "bg-slate-100 text-slate-500" },
};

const STATUS_TABS = [
  { value: "open",   label: "开放中" },
  { value: "closed", label: "已关闭" },
  { value: "",       label: "全部" },
];

export default function AdminV2TicketBList() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const [items, setItems] = useState<TicketB[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await v2Get<TicketB[]>(`/tickets-b?limit=200`);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = statusFilter === "" ? items : items.filter(t => t.status === statusFilter);
  const counts: Record<string, number> = {};
  STATUS_TABS.forEach(tab => {
    counts[tab.value] = tab.value === "" ? items.length : items.filter(t => t.status === tab.value).length;
  });

  return (
    <AdminV2Layout title="工单管理 (B)">
      <div className="mt-6 space-y-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
                statusFilter === tab.value ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-primary/30"
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

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">暂无工单</div>
        ) : (
          <div className="space-y-2">
            {[...displayed].sort((a, b) =>
              (hasUnread("ticket_b", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("ticket_b", a.id, a.updatedAt) ? 1 : 0)
            ).map(t => {
              const cfg = STATUS_CONFIG[t.status] ?? { label: t.status, color: "bg-slate-100 text-slate-500" };
              const go = () => inlineNav ? inlineNav.push(`/admin/v2/tickets-b/${t.id}`) : navigate(`/admin/v2/tickets-b/${t.id}`);
              return (
                <button key={t.id} onClick={go}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[15px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                      {t.title}
                      {hasUnread("ticket_b", t.id, t.updatedAt) && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </span>
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                      {t.demandTitle && (
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">关联需求</p>
                          <p className="text-sm text-slate-600 truncate max-w-[12rem]">{t.demandTitle}</p>
                        </div>
                      )}
                      {t.orderNo && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">订单号</p>
                          <p className="text-sm text-slate-500 font-mono">{t.orderNo}</p>
                        </div>
                      )}
                      {t.createdByNickname && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">提交人</p>
                          <p className="text-sm text-slate-600">{t.createdByNickname}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">创建时间</p>
                        <p className="text-sm text-slate-600">{new Date(t.createdAt).toLocaleDateString("zh-CN")}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-primary shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AdminV2Layout>
  );
}
