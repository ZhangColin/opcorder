import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  FileSignature, Loader2, ChevronRight, Clock,
  AlertTriangle, CheckCircle2, XCircle, FilePen,
} from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { v2Get } from "@/lib/v2api";
import { hasUnread } from "@/lib/demandRead";

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

const CONTRACT_STATUS: Record<string, {
  label: string; badge: string; accent: string;
  icon: React.ElementType; cardBg: string;
}> = {
  draft: {
    label: "草稿", badge: "bg-slate-100 text-slate-500",
    accent: "border-l-slate-300", icon: FilePen, cardBg: "",
  },
  pending_publisher_confirm: {
    label: "待我确认", badge: "bg-amber-100 text-amber-700",
    accent: "border-l-amber-400", icon: AlertTriangle, cardBg: "bg-amber-50/50",
  },
  publisher_rejected: {
    label: "已退回", badge: "bg-red-100 text-red-600",
    accent: "border-l-red-400", icon: XCircle, cardBg: "bg-red-50/30",
  },
  pending_sign: {
    label: "待签约", badge: "bg-orange-100 text-orange-700",
    accent: "border-l-orange-400", icon: FilePen, cardBg: "",
  },
  signed: {
    label: "已签约", badge: "bg-green-100 text-green-700",
    accent: "border-l-green-400", icon: CheckCircle2, cardBg: "",
  },
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

  const sorted = [...contracts].sort((a, b) =>
    (hasUnread("contract", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("contract", a.id, a.updatedAt) ? 1 : 0)
  );

  return (
    <PubLayout title="合同管理">
      <div className="mt-5 space-y-4">
        {/* Urgent banner */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 font-black text-sm shrink-0">
              {pendingCount}
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">有合同待您确认</p>
              <p className="text-xs text-amber-600 mt-0.5">请及时查阅并回复，避免影响项目进度</p>
            </div>
            <button
              onClick={() => setStatusFilter("pending_publisher_confirm")}
              className="ml-auto text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors px-3 py-1.5 rounded-lg shrink-0"
            >
              查看
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === tab.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600"
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
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <FileSignature size={28} className="text-blue-300" />
            </div>
            <p className="text-base font-semibold text-slate-500">暂无合同</p>
            <p className="text-xs text-slate-400 mt-1">合同由平台在需求撮合后生成</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sorted.map(c => {
              const cfg = CONTRACT_STATUS[c.status] ?? {
                label: c.status, badge: "bg-slate-100 text-slate-500",
                accent: "border-l-slate-300", icon: FileSignature, cardBg: "",
              };
              const StatusIcon = cfg.icon;
              const isPending = c.status === "pending_publisher_confirm";
              const isSigned = c.status === "signed";
              const unread = hasUnread("contract", c.id, c.updatedAt);

              return (
                <div
                  key={c.id}
                  onClick={() => c.clientDemandId
                    ? navigate(`/pub/demands/${c.clientDemandId}?tab=contract`)
                    : navigate(`/pub/contracts/${c.id}`)
                  }
                  className={`rounded-2xl border border-slate-100 border-l-4 ${cfg.accent} ${cfg.cardBg || "bg-white"}
                    p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isPending ? "bg-amber-100" : isSigned ? "bg-green-100" : "bg-blue-50"
                    }`}>
                      <StatusIcon size={18} className={
                        isPending ? "text-amber-600" : isSigned ? "text-green-600" : "text-blue-500"
                      } />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Top: status + unread */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        {unread && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> 新动态
                          </span>
                        )}
                        {isPending && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full animate-pulse">
                            需要您处理
                          </span>
                        )}
                      </div>

                      {/* Contract number + demand */}
                      <p className="text-xs font-mono text-slate-400 mb-1">{c.contractNo}</p>
                      {c.demandTitle && (
                        <p className="text-[15px] font-bold text-slate-800 group-hover:text-blue-700 transition-colors truncate mb-2">
                          {c.demandTitle}
                        </p>
                      )}

                      {/* Footer */}
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> 更新 {new Date(c.updatedAt).toLocaleDateString("zh-CN")}
                        </span>
                        {c.signedAt && (
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle2 size={10} /> 签约 {new Date(c.signedAt).toLocaleDateString("zh-CN")}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 shrink-0 mt-1 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PubLayout>
  );
}
