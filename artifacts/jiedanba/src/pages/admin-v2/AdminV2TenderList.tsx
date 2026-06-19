import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight, Gavel, Clock, DollarSign } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";

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
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: "待报价", color: "bg-slate-100 text-slate-500" },
  quoted:    { label: "已报价", color: "bg-blue-100 text-blue-700" },
  selected:  { label: "已中标", color: "bg-green-100 text-green-700" },
  cancelled: { label: "已取消", color: "bg-red-100 text-red-500" },
};

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "quoted", label: "已报价" },
  { value: "pending", label: "待报价" },
  { value: "selected", label: "已中标" },
  { value: "cancelled", label: "已取消" },
];

export default function AdminV2TenderList() {
  const [, navigate] = useLocation();
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
    <AdminV2Layout title="投标管理">
      <div className="mt-6 space-y-5">
        {highlighted.length > 0 && !statusFilter && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-700 mb-2">📋 有新报价（{highlighted.length} 件）</p>
            <div className="flex flex-wrap gap-2">
              {highlighted.slice(0, 6).map(t => (
                <button key={t.id} onClick={() => navigate(`/admin/v2/tenders/${t.id}`)}
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
              return (
                <button key={t.id} onClick={() => navigate(`/admin/v2/tenders/${t.id}`)}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md group ${
                    highlight ? "bg-blue-50/60 border-blue-200" : "bg-white border-slate-100 hover:border-primary/20"
                  }`}>
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <Gavel size={18} className="text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {t.opcNickname ?? "OPC"} — {t.demandTitle ?? `外包需求 #${t.outsourceDemandId}`}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      {t.totalPrice != null && <span className="flex items-center gap-1 font-bold text-slate-700"><DollarSign size={11} />¥{t.totalPrice.toLocaleString()}</span>}
                      {t.quotedAt && <span className="flex items-center gap-1"><Clock size={11} />报价 {new Date(t.quotedAt).toLocaleDateString("zh-CN")}</span>}
                    </div>
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
