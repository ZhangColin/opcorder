import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight, Package, Clock } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";

interface TicketB {
  id: number;
  outsourceOrderId: number;
  title: string;
  status: string;
  createdByNickname: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:   { label: "开放中", color: "bg-blue-100 text-blue-700" },
  closed: { label: "已关闭", color: "bg-slate-100 text-slate-500" },
};

const STATUS_TABS = [
  { value: "open", label: "开放中" },
  { value: "", label: "全部" },
  { value: "closed", label: "已关闭" },
];

export default function AdminV2TicketBList() {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<TicketB[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await v2Get<TicketB[]>(`/tickets-b?${params}`);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminV2Layout title="工单管理 (B)">
      <div className="mt-6 space-y-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                statusFilter === tab.value ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-primary/30"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">暂无工单</div>
        ) : (
          <div className="space-y-2">
            {items.map(t => {
              const cfg = STATUS_CONFIG[t.status] ?? { label: t.status, color: "bg-slate-100 text-slate-500" };
              return (
                <button key={t.id} onClick={() => navigate(`/admin/v2/tickets-b/${t.id}`)}
                  className="w-full text-left flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white transition-all hover:shadow-md hover:border-primary/20 group">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <Package size={18} className="text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-slate-400 font-mono">#{t.id}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">{t.title}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock size={11} /> 创建于 {new Date(t.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-primary shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AdminV2Layout>
  );
}
