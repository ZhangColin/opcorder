import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { FileSignature, Loader2, AlertCircle, ChevronRight, Clock } from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { v2Get } from "@/lib/v2api";

interface Contract {
  id: number;
  contractNo: string;
  channel: string;
  clientDemandId: number | null;
  status: string;
  content: string | null;
  signedFileUrl: string | null;
  publisherConfirmedAt: string | null;
  publisherRejectedAt: string | null;
  signedAt: string | null;
  demandTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

const CONTRACT_STATUS: Record<string, { label: string; color: string }> = {
  draft:                    { label: "草稿",     color: "bg-slate-100 text-slate-500" },
  pending_publisher_confirm:{ label: "待我确认", color: "bg-amber-100 text-amber-700" },
  publisher_rejected:       { label: "已退回",   color: "bg-red-100 text-red-600" },
  pending_sign:             { label: "待签约",   color: "bg-orange-100 text-orange-700" },
  signed:                   { label: "已签约",   color: "bg-green-100 text-green-700" },
};

const TABS = [
  { value: "", label: "全部" },
  { value: "pending_publisher_confirm", label: "待我确认" },
  { value: "pending_sign", label: "待签约" },
  { value: "signed", label: "已签约" },
];

export default function PubContractList() {
  const [, navigate] = useLocation();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ channel: "a" });
      if (statusFilter) params.set("status", statusFilter);
      const data = await v2Get<Contract[]>(`/contracts?${params}`);
      setContracts(data);
    } catch {
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const pendingCount = contracts.filter(c => c.status === "pending_publisher_confirm").length;

  return (
    <PubLayout title="合同管理">
      <div className="mt-6 space-y-5">
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-black text-sm shrink-0">
              {pendingCount}
            </div>
            <p className="text-sm text-amber-800 font-medium">
              您有 <strong>{pendingCount}</strong> 份合同待确认，请及时查阅并回复
            </p>
          </div>
        )}

        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === tab.value
                  ? "bg-primary text-white"
                  : "bg-white border border-slate-200 text-slate-500 hover:border-primary hover:text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : contracts.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-slate-400">
            <FileSignature size={36} className="mb-3 text-slate-300" />
            <p className="text-base font-medium">暂无合同</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map(c => {
              const cfg = CONTRACT_STATUS[c.status] ?? { label: c.status, color: "bg-slate-100 text-slate-500" };
              const isPending = c.status === "pending_publisher_confirm";
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/pub/contracts/${c.id}`)}
                  className={`bg-white rounded-2xl border p-5 flex items-center gap-4 hover:shadow-sm cursor-pointer transition-all group ${
                    isPending ? "border-amber-300 bg-amber-50/30" : "border-slate-200 hover:border-primary/30"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileSignature size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-slate-400 font-mono">{c.contractNo}</span>
                    </div>
                    {c.demandTitle && (
                      <p className="text-sm font-medium text-slate-700 truncate mb-1">{c.demandTitle}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> 更新于 {new Date(c.updatedAt).toLocaleDateString("zh-CN")}
                      </span>
                      {c.signedAt && (
                        <span>签约：{new Date(c.signedAt).toLocaleDateString("zh-CN")}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PubLayout>
  );
}
