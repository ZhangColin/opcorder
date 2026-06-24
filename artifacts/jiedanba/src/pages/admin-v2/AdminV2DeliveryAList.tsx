import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight, PackageCheck } from "lucide-react";
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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: "待确认", color: "bg-orange-100 text-orange-700" },
  confirmed: { label: "已确认", color: "bg-green-100 text-green-700" },
  rejected:  { label: "已驳回", color: "bg-red-100 text-red-700" },
};

const STATUS_TABS = [
  { value: "pending",   label: "待确认" },
  { value: "confirmed", label: "已确认" },
  { value: "rejected",  label: "已驳回" },
  { value: "",          label: "全部" },
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
      const params = new URLSearchParams({ limit: "200" });
      const data = await v2Get<DeliveryA[]>(`/deliverables-a?${params}`);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = STATUS_TABS.reduce((acc, tab) => {
    acc[tab.value] = tab.value === "" ? items.length : items.filter(d => d.status === tab.value).length;
    return acc;
  }, {} as Record<string, number>);
  const displayed = statusFilter === "" ? items : items.filter(d => d.status === statusFilter);

  return (
    <AdminV2Layout>
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
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-200">
            <PackageCheck size={36} className="text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-500">暂无交付记录</p>
            <p className="text-xs text-slate-400 mt-1">客户提交验收后将在此显示</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(item => {
              const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: "bg-slate-100 text-slate-500" };
              const go = () => inlineNav
                ? inlineNav.push(`/admin/v2/client-demands/${item.clientDemandId}?tab=delivery&id=${item.id}`)
                : navigate(`/admin/v2/client-demands/${item.clientDemandId}?tab=delivery&id=${item.id}`);
              return (
                <button key={item.id} onClick={go}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[15px] font-bold text-slate-800 truncate">{item.title}</span>
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                      {item.demandTitle && (
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">关联需求</p>
                          <p className="text-sm text-slate-600 truncate max-w-[12rem]">
                            {item.demandTitle}{item.demandNo && <span className="text-slate-400"> · {item.demandNo}</span>}
                          </p>
                        </div>
                      )}
                      {item.createdByNickname && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">提交人</p>
                          <p className="text-sm text-slate-600">{item.createdByNickname}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">提交时间</p>
                        <p className="text-sm text-slate-600">{new Date(item.createdAt).toLocaleDateString("zh-CN")}</p>
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
