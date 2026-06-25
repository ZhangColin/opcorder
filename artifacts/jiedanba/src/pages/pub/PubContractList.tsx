import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { FileSignature, Loader2, ChevronRight, Clock, CheckCircle2 } from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { Pagination } from "@/components/pub/Pagination";
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

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:                     { label: "草稿",     cls: "bg-slate-100 text-slate-500" },
  pending_publisher_confirm: { label: "待我确认", cls: "bg-amber-100 text-amber-700" },
  publisher_rejected:        { label: "已退回",   cls: "bg-red-100 text-red-600" },
  pending_sign:              { label: "待签约",   cls: "bg-orange-100 text-orange-700" },
  signed:                    { label: "已签约",   cls: "bg-green-100 text-green-700" },
};

const TABS = [
  { value: "pending_publisher_confirm", label: "待我确认" },
  { value: "pending_sign",              label: "待签约" },
  { value: "signed",                    label: "已签约" },
  { value: "",                          label: "全部" },
];

const PAGE_SIZE = 10;

export default function PubContractList() {
  const [, navigate] = useLocation();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(() =>
    new URLSearchParams(window.location.search).get("filter") === "all" ? "" : "pending_publisher_confirm"
  );
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await v2Get<Contract[]>(`/contracts?channel=a`);
      setContracts(data);
    } catch { setContracts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const counts: Record<string, number> = { "": contracts.length };
  for (const t of TABS) {
    if (t.value) counts[t.value] = contracts.filter(c => c.status === t.value).length;
  }

  const pendingCount = counts["pending_publisher_confirm"] ?? 0;
  const filtered = statusFilter ? contracts.filter(c => c.status === statusFilter) : contracts;
  const sorted = [...filtered].sort((a, b) =>
    (hasUnread("contract", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("contract", a.id, a.updatedAt) ? 1 : 0)
  );
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PubLayout title="合同管理">
      <div className="mt-5 space-y-4">
        {pendingCount > 0 && statusFilter !== "pending_publisher_confirm" && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-700 font-black text-sm shrink-0">{pendingCount}</div>
            <p className="text-sm text-amber-800 font-medium">有 <strong>{pendingCount}</strong> 份合同待您确认，请及时查阅</p>
            <button onClick={() => setStatusFilter("pending_publisher_confirm")}
              className="ml-auto text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg shrink-0 transition-colors">
              查看
            </button>
          </div>
        )}

        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => {
            const cnt = counts[t.value] ?? 0;
            const active = statusFilter === t.value;
            return (
              <button key={t.value} onClick={() => setStatusFilter(t.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                  active
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-slate-200 text-slate-500 hover:border-blue-300 hover:text-blue-600"
                }`}>
                {t.label}
                {cnt > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}>{cnt}</span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-100">
            <FileSignature size={36} className="text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-500">暂无合同</p>
            <p className="text-xs text-slate-400 mt-1">合同由平台在需求撮合后生成</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paged.map(c => {
                const cfg = STATUS_CONFIG[c.status] ?? { label: c.status, cls: "bg-slate-100 text-slate-500" };
                const isPending = c.status === "pending_publisher_confirm";
                const isSigned = c.status === "signed";
                const unread = hasUnread("contract", c.id, c.updatedAt);

                return (
                  <div key={c.id}
                    onClick={() => c.clientDemandId
                      ? navigate(`/pub/demands/${c.clientDemandId}?tab=contract`)
                      : navigate(`/pub/contracts/${c.id}`)
                    }
                    className={`bg-white rounded-2xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group px-5 py-4 ${
                      isPending ? "border-amber-200 bg-amber-50/40" : "border-slate-100"
                    }`}>
                    <div className="flex items-start justify-between gap-4 mb-2.5">
                      <p className="text-[15px] font-bold text-slate-800 group-hover:text-blue-700 transition-colors leading-snug flex-1 min-w-0 truncate">
                        {c.demandTitle ?? "（无关联需求）"}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {unread && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-xs flex-wrap">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">合同编号</p>
                        <p className="font-mono text-slate-600">{c.contractNo}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">最近更新</p>
                        <p className="text-slate-600 flex items-center gap-1">
                          <Clock size={10} /> {new Date(c.updatedAt).toLocaleDateString("zh-CN")}
                        </p>
                      </div>
                      {c.signedAt && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">签约日期</p>
                          <p className="text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle2 size={10} /> {new Date(c.signedAt).toLocaleDateString("zh-CN")}
                          </p>
                        </div>
                      )}
                      {isPending && (
                        <p className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">
                          · 需要您审阅确认
                        </p>
                      )}
                      <ChevronRight size={16} className="ml-auto text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
            <Pagination page={page} totalPages={totalPages} total={sorted.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </div>
    </PubLayout>
  );
}
