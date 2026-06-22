import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight, PackageCheck, Clock, CheckCircle2, XCircle } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";

interface DeliveryA {
  id: number;
  clientDemandId: number;
  title: string;
  status: string;
  createdByNickname: string | null;
  demandTitle: string | null;
  demandNo: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "待确认", color: "bg-orange-100 text-orange-700", icon: Clock },
  confirmed: { label: "已确认", color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  rejected:  { label: "已驳回", color: "bg-red-100 text-red-700",      icon: XCircle },
};

const STATUS_TABS = [
  { value: "",          label: "全部" },
  { value: "pending",   label: "待确认" },
  { value: "confirmed", label: "已确认" },
  { value: "rejected",  label: "已驳回" },
];

export default function AdminV2DeliveryAList() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const [items, setItems] = useState<DeliveryA[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await v2Get<DeliveryA[]>(`/deliverables-a?${params}`);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminV2Layout title="交付管理 (A)">
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
          <div className="text-center py-16 text-slate-400 text-sm">暂无交付记录</div>
        ) : (
          <div className="space-y-2">
            {items.map(item => {
              const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: "bg-slate-100 text-slate-500", icon: Clock };
              const StatusIcon = cfg.icon;
              const go = () => inlineNav ? inlineNav.push(`/admin/v2/client-demands/${item.clientDemandId}?tab=delivery&id=${item.id}`) : navigate(`/admin/v2/client-demands/${item.clientDemandId}?tab=delivery&id=${item.id}`);
              return (
                <button key={item.id} onClick={go}
                  className="w-full text-left flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white transition-all hover:shadow-md hover:border-primary/20 group">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                    <PackageCheck size={18} className="text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {item.demandTitle && (
                      <p className="text-xs text-slate-500 truncate mb-0.5">{item.demandTitle}{item.demandNo && ` · ${item.demandNo}`}</p>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                        <StatusIcon size={11} /> {cfg.label}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1"><Clock size={11} /> {new Date(item.createdAt).toLocaleDateString("zh-CN")}</span>
                      {item.createdByNickname && <span>{item.createdByNickname}</span>}
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
