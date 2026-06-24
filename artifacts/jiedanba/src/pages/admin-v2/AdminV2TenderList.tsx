import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import { hasUnread, markRead } from "@/lib/demandRead";

interface Tender {
  id: number;
  outsourceDemandId: number;
  demandTitle: string | null;
  opcId: number;
  opcNickname: string | null;
  status: string;
  totalPrice: number | null;
  quotedAt: string | null;
  selectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  negotiating: { label: "待报价", color: "bg-slate-100 text-slate-500" },
  quoted:      { label: "已报价", color: "bg-blue-100 text-blue-700" },
  won:         { label: "已中标", color: "bg-green-100 text-green-700" },
  lost:        { label: "已取消", color: "bg-red-100 text-red-500" },
};

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "quoted", label: "已报价" },
  { value: "negotiating", label: "待报价" },
  { value: "won", label: "已中标" },
  { value: "lost", label: "已取消" },
];

export default function AdminV2TenderList() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const [items, setItems] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await v2Get<Tender[]>(`/tenders?${params}`);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const highlighted = items.filter(t => t.status === "quoted");

  return (
    <AdminV2Layout>
      <div className="mt-6 space-y-5">
        {highlighted.length > 0 && !statusFilter && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-700 mb-2">📋 有新报价（{highlighted.length} 件）</p>
            <div className="flex flex-wrap gap-2">
              {highlighted.slice(0, 6).map(t => (
                <button key={t.id} onClick={() => { const target = `/admin/v2/outsource-demands/${t.outsourceDemandId}?tab=tenders&tenderId=${t.id}`; inlineNav ? inlineNav.push(target) : navigate(target); }}
                  className="text-xs bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-blue-800 hover:bg-blue-100">
                  {t.opcNickname ?? "OPC"} — {t.demandTitle ?? "外包需求"}
                  {t.totalPrice != null && <span className="ml-1 font-bold">¥{t.totalPrice.toLocaleString()}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

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
          <div className="text-center py-16 text-slate-400 text-sm">暂无投标</div>
        ) : (
          <div className="space-y-2">
            {items.map(t => {
              const cfg = STATUS_CONFIG[t.status] ?? { label: t.status, color: "bg-slate-100 text-slate-500" };
              const highlight = t.status === "quoted";
              const unread = hasUnread("tender", t.id, t.updatedAt);
              const go = () => {
                markRead("tender", t.id);
                const target = `/admin/v2/outsource-demands/${t.outsourceDemandId}?tab=tenders&tenderId=${t.id}`;
                inlineNav ? inlineNav.push(target) : navigate(target);
              };
              return (
                <button key={t.id} onClick={go}
                  className={`w-full text-left rounded-2xl border shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group ${
                    unread ? "bg-amber-50/40 border-amber-200" : highlight ? "bg-blue-50/40 border-blue-200" : "bg-white border-slate-100"
                  }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[15px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                      {unread && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                      {t.demandTitle ?? `外包需求 #${t.outsourceDemandId}`}
                    </span>
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                      {t.opcNickname && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">OPC</p>
                          <p className="text-sm text-slate-600">{t.opcNickname}</p>
                        </div>
                      )}
                      {t.totalPrice != null && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">报价金额</p>
                          <p className="text-xl font-black text-slate-800">¥{t.totalPrice.toLocaleString()}</p>
                        </div>
                      )}
                      {t.quotedAt && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">报价时间</p>
                          <p className="text-sm text-slate-600">{new Date(t.quotedAt).toLocaleDateString("zh-CN")}</p>
                        </div>
                      )}
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
