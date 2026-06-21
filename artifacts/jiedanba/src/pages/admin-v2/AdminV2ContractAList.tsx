import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight, FileSignature, Clock } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";
import { hasUnread } from "@/lib/demandRead";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";

interface Contract {
  id: number;
  contractNo: string;
  clientDemandId: number | null;
  demandTitle?: string | null;
  status: string;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:                      { label: "草稿",       color: "bg-slate-100 text-slate-500" },
  pending_publisher_confirm:  { label: "待发单方确认", color: "bg-amber-100 text-amber-700" },
  publisher_rejected:         { label: "已退回",      color: "bg-red-100 text-red-600" },
  pending_sign:               { label: "待签约",      color: "bg-orange-100 text-orange-700" },
  signed:                     { label: "已签约",      color: "bg-green-100 text-green-700" },
};

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "draft", label: "草稿" },
  { value: "pending_publisher_confirm", label: "待确认" },
  { value: "publisher_rejected", label: "已退回" },
  { value: "pending_sign", label: "待签约" },
  { value: "signed", label: "已签约" },
];

const HIGHLIGHT = ["pending_publisher_confirm", "publisher_rejected"];

export default function AdminV2ContractAList() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const [items, setItems] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50", channel: "a" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await v2Get<Contract[]>(`/contracts?${params}`);
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const highlighted = items.filter(c => HIGHLIGHT.includes(c.status));

  return (
    <AdminV2Layout title="合同 (A)">
      <div className="mt-6 space-y-5">
        {highlighted.length > 0 && !statusFilter && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 mb-2">⚡ 待处理（{highlighted.length} 件）</p>
            <div className="flex flex-wrap gap-2">
              {highlighted.map(c => (
                <button key={c.id} onClick={() => inlineNav ? inlineNav.push(`/admin/v2/contracts-a/${c.id}`) : navigate(`/admin/v2/contracts-a/${c.id}`)}
                  className="text-xs bg-white border border-amber-200 rounded-xl px-3 py-1.5 text-amber-800 hover:bg-amber-100">
                  {c.contractNo}
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${STATUS_CONFIG[c.status]?.color}`}>
                    {STATUS_CONFIG[c.status]?.label}
                  </span>
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
          <div className="text-center py-16 text-slate-400 text-sm">暂无合同</div>
        ) : (
          <div className="space-y-2">
            {[...items].sort((a, b) =>
              (hasUnread("contract", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("contract", a.id, a.updatedAt) ? 1 : 0)
            ).map(c => {
              const cfg = STATUS_CONFIG[c.status] ?? { label: c.status, color: "bg-slate-100 text-slate-500" };
              const highlight = HIGHLIGHT.includes(c.status);
              return (
                <button key={c.id} onClick={() => inlineNav ? inlineNav.push(`/admin/v2/contracts-a/${c.id}`) : navigate(`/admin/v2/contracts-a/${c.id}`)}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md group ${
                    highlight ? "bg-amber-50/60 border-amber-200" : "bg-white border-slate-100 hover:border-primary/20"
                  }`}>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileSignature size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-slate-400 font-mono">{c.contractNo}</span>
                      {hasUnread("contract", c.id, c.updatedAt) && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </div>
                    {c.demandTitle && <p className="text-sm font-semibold text-slate-800 truncate mb-0.5">{c.demandTitle}</p>}
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><Clock size={11} />{new Date(c.updatedAt).toLocaleDateString("zh-CN")}</span>
                      {c.signedAt && <span>签约：{new Date(c.signedAt).toLocaleDateString("zh-CN")}</span>}
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
