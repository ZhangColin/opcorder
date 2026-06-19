import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight, Boxes, Clock, Users2 } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";

interface OutsourceOrder {
  id: number;
  orderNo: string;
  outsourceDemandId: number;
  demandTitle: string | null;
  opcId: number;
  opcNickname: string | null;
  status: string;
  contractId: number | null;
  warrantyEndDate: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_sign:  { label: "待签约", color: "bg-orange-100 text-orange-700" },
  executing:     { label: "执行中", color: "bg-green-100 text-green-700" },
  warranty:      { label: "质保中", color: "bg-teal-100 text-teal-700" },
  completed:     { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
  cancelled:     { label: "已取消", color: "bg-red-100 text-red-500" },
};

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "pending_sign", label: "待签约" },
  { value: "executing", label: "执行中" },
  { value: "warranty", label: "质保中" },
  { value: "completed", label: "已完成" },
];

const HIGHLIGHT = ["pending_sign"];

export default function AdminV2OutsourceOrderList() {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<OutsourceOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await v2Get<{ items: OutsourceOrder[]; total: number }>(`/outsource-orders?${params}`);
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const highlighted = items.filter(o => HIGHLIGHT.includes(o.status));

  return (
    <AdminV2Layout title="接单订单">
      <div className="mt-6 space-y-5">
        {highlighted.length > 0 && !statusFilter && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-orange-700 mb-2">⚡ 待签约（{highlighted.length} 件）</p>
            <div className="flex flex-wrap gap-2">
              {highlighted.map(o => (
                <button key={o.id} onClick={() => navigate(`/admin/v2/outsource-orders/${o.id}`)}
                  className="text-xs bg-white border border-orange-200 rounded-xl px-3 py-1.5 text-orange-800 hover:bg-orange-100">
                  {o.orderNo} — {o.opcNickname ?? "OPC"}
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
          <div className="text-center py-16 text-slate-400 text-sm">暂无订单</div>
        ) : (
          <div className="space-y-2">
            {items.map(o => {
              const cfg = STATUS_CONFIG[o.status] ?? { label: o.status, color: "bg-slate-100 text-slate-500" };
              const highlight = HIGHLIGHT.includes(o.status);
              return (
                <button key={o.id} onClick={() => navigate(`/admin/v2/outsource-orders/${o.id}`)}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md group ${
                    highlight ? "bg-orange-50/60 border-orange-200" : "bg-white border-slate-100 hover:border-primary/20"
                  }`}>
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <Boxes size={18} className="text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-slate-400 font-mono">{o.orderNo}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {o.demandTitle ?? `外包需求 #${o.outsourceDemandId}`}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1"><Users2 size={11} />{o.opcNickname ?? "—"}</span>
                      <span className="flex items-center gap-1"><Clock size={11} />{new Date(o.updatedAt).toLocaleDateString("zh-CN")}</span>
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
