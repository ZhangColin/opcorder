import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";
import { hasUnread } from "@/lib/demandRead";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";

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
  pending_contract:  { label: "待签约", color: "bg-orange-100 text-orange-700" },
  executing:     { label: "执行中", color: "bg-green-100 text-green-700" },
  warranty:      { label: "质保中", color: "bg-teal-100 text-teal-700" },
  completed:     { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
  cancelled:     { label: "已取消", color: "bg-red-100 text-red-500" },
};

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "pending_contract", label: "待签约" },
  { value: "executing", label: "执行中" },
  { value: "warranty", label: "质保中" },
  { value: "completed", label: "已完成" },
];

const HIGHLIGHT = ["pending_contract"];

export default function AdminV2OutsourceOrderList() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
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
                <button key={o.id} onClick={() => inlineNav ? inlineNav.push(`/admin/v2/outsource-orders/${o.id}`) : navigate(`/admin/v2/outsource-orders/${o.id}`)}
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
            {[...items].sort((a, b) =>
              (hasUnread("order", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("order", a.id, a.updatedAt) ? 1 : 0)
            ).map(o => {
              const cfg = STATUS_CONFIG[o.status] ?? { label: o.status, color: "bg-slate-100 text-slate-500" };
              const highlight = HIGHLIGHT.includes(o.status);
              const go = () => inlineNav ? inlineNav.push(`/admin/v2/outsource-orders/${o.id}`) : navigate(`/admin/v2/outsource-orders/${o.id}`);
              return (
                <button key={o.id} onClick={go}
                  className={`w-full text-left rounded-2xl border shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group ${
                    highlight ? "bg-orange-50/40 border-orange-200" : "bg-white border-slate-100"
                  }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[15px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                      {o.demandTitle ?? `外包需求 #${o.outsourceDemandId}`}
                      {hasUnread("order", o.id, o.updatedAt) && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </span>
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">订单号</p>
                        <p className="text-sm text-slate-500 font-mono">{o.orderNo}</p>
                      </div>
                      {o.opcNickname && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">OPC</p>
                          <p className="text-sm text-slate-600">{o.opcNickname}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">更新</p>
                        <p className="text-sm text-slate-600">{new Date(o.updatedAt).toLocaleDateString("zh-CN")}</p>
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
