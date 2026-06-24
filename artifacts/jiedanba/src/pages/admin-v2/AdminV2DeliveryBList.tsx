import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight, PackageCheck } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import { hasUnread } from "@/lib/demandRead";

interface DeliveryB {
  id: number;
  outsourceOrderId: number;
  title: string;
  status: string;
  submittedByNickname: string | null;
  orderNo: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:  { label: "待审核", color: "bg-orange-100 text-orange-700" },
  approved: { label: "已通过", color: "bg-green-100 text-green-700" },
  revision: { label: "已驳回", color: "bg-red-100 text-red-700" },
};

const STATUS_TABS = [
  { value: "pending",  label: "待审核" },
  { value: "approved", label: "已通过" },
  { value: "revision", label: "已驳回" },
  { value: "",         label: "全部" },
];

export default function AdminV2DeliveryBList() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const [items, setItems] = useState<DeliveryB[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("pending");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await v2Get<DeliveryB[]>(`/deliverables-b?limit=200`);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = (statusFilter === "" ? items : items.filter(d => d.status === statusFilter))
    .slice()
    .sort((a, b) =>
      (hasUnread("delivery_b", b.id, b.updatedAt) ? 1 : 0) -
      (hasUnread("delivery_b", a.id, a.updatedAt) ? 1 : 0)
    );
  const counts: Record<string, number> = {};
  STATUS_TABS.forEach(tab => {
    counts[tab.value] = tab.value === "" ? items.length : items.filter(d => d.status === tab.value).length;
  });

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
            <p className="text-xs text-slate-400 mt-1">OPC 上传交付物后将在此显示</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayed.map(item => {
              const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: "bg-slate-100 text-slate-500" };
              const go = () => inlineNav ? inlineNav.push(`/admin/v2/deliveries-b/${item.id}`) : navigate(`/admin/v2/deliveries-b/${item.id}`);
              return (
                <button key={item.id} onClick={go}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {hasUnread("delivery_b", item.id, item.updatedAt) && (
                        <span className="shrink-0 w-2 h-2 rounded-full bg-red-500" />
                      )}
                      <span className="text-[15px] font-bold text-slate-800 truncate">{item.title}</span>
                    </div>
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                      {item.orderNo && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">订单号</p>
                          <p className="text-sm text-slate-500 font-mono">{item.orderNo}</p>
                        </div>
                      )}
                      {item.submittedByNickname && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">提交人</p>
                          <p className="text-sm text-slate-600">{item.submittedByNickname}</p>
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
