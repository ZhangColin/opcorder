import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Loader2, ChevronRight, Gavel } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import { hasUnreadSinceCreation, markRead } from "@/lib/demandRead";
import { Pagination } from "@/components/pub/Pagination";

const PAGE_SIZE = 10;

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
  lastOpcActivityAt: string | null;
  lastAdminActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  negotiating: { label: "待报价", color: "bg-slate-100 text-slate-500" },
  quoted:      { label: "已报价", color: "bg-blue-100 text-blue-700" },
  won:         { label: "已中标", color: "bg-green-100 text-green-700" },
  lost:        { label: "已取消", color: "bg-red-100 text-red-500" },
};

const STATUS_TABS = [
  { value: "negotiating", label: "待报价" },
  { value: "quoted",      label: "已报价" },
  { value: "won",         label: "已中标" },
  { value: "",            label: "全部" },
  { value: "lost",        label: "已取消" },
];

export default function AdminV2TenderList() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const [all, setAll] = useState<Tender[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("negotiating");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await v2Get<Tender[]>("/tenders?limit=500");
      setAll(Array.isArray(data) ? data : []);
    } catch {
      setAll([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(1); }, [statusFilter]);

  const counts: Record<string, number> = { "": all.length };
  for (const t of all) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }

  const filtered = statusFilter === "" ? all : all.filter(t => t.status === statusFilter);

  const sorted = [...filtered].sort((a, b) => {
    const aUnread = hasUnreadSinceCreation("tender", a.id, a.lastOpcActivityAt, a.createdAt) ? 1 : 0;
    const bUnread = hasUnreadSinceCreation("tender", b.id, b.lastOpcActivityAt, b.createdAt) ? 1 : 0;
    return bUnread - aUnread;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const highlighted = all.filter(t => t.status === "quoted");

  return (
    <AdminV2Layout>
      <div className="mt-6 space-y-5">
        {highlighted.length > 0 && statusFilter !== "quoted" && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-blue-700 mb-2">📋 有新报价（{highlighted.length} 件）</p>
            <div className="flex flex-wrap gap-2">
              {highlighted.slice(0, 6).map(t => (
                <button key={t.id} onClick={() => {
                  const target = `/admin/v2/outsource-demands/${t.outsourceDemandId}?tab=tenders&tenderId=${t.id}`;
                  inlineNav ? inlineNav.push(target) : navigate(target);
                }}
                  className="text-xs bg-white border border-blue-200 rounded-xl px-3 py-1.5 text-blue-800 hover:bg-blue-100">
                  {t.opcNickname ?? "OPC"} — {t.demandTitle ?? "外包需求"}
                  {t.totalPrice != null && <span className="ml-1 font-bold">¥{t.totalPrice.toLocaleString()}</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map(tab => {
            const count = counts[tab.value] ?? 0;
            const active = statusFilter === tab.value;
            return (
              <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  active ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-primary/30"
                }`}>
                {tab.label}
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-200">
            <Gavel size={36} className="text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-500">暂无投标记录</p>
            <p className="text-xs text-slate-400 mt-1">OPC 提交报价后将在此显示</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paged.map(t => {
                const cfg = STATUS_CONFIG[t.status] ?? { label: t.status, color: "bg-slate-100 text-slate-500" };
                const highlight = t.status === "quoted";
                const unread = hasUnreadSinceCreation("tender", t.id, t.lastOpcActivityAt, t.createdAt);
                const go = () => {
                  markRead("tender", t.id);
                  const target = `/admin/v2/outsource-demands/${t.outsourceDemandId}?tab=tenders&tenderId=${t.id}`;
                  inlineNav ? inlineNav.push(target) : navigate(target);
                };
                return (
                  <button key={t.id} onClick={go}
                    className={`w-full text-left rounded-2xl border shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group ${
                      unread ? "bg-amber-50/40 border-amber-200" : highlight ? "bg-blue-50/40 border-blue-200" : "bg-white border-slate-100"
                    }`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[15px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                        {unread && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                        {t.demandTitle ?? `外包需求 #${t.outsourceDemandId}`}
                      </span>
                      <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                    </div>
                    <div className="flex items-end gap-4">
                      <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                        {t.opcNickname && (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">OPC</p>
                            <p className="text-sm text-slate-600">{t.opcNickname}</p>
                          </div>
                        )}
                        {t.totalPrice != null && (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">报价金额</p>
                            <p className="text-xl font-black text-slate-800">¥{t.totalPrice.toLocaleString()}</p>
                          </div>
                        )}
                        {t.quotedAt && (
                          <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider">报价时间</p>
                            <p className="text-sm text-slate-600">{new Date(t.quotedAt).toLocaleDateString("zh-CN")}</p>
                          </div>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-primary shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
            {totalPages > 1 && (
              <Pagination page={page} totalPages={totalPages} total={sorted.length} pageSize={PAGE_SIZE} onChange={setPage} />
            )}
          </>
        )}
      </div>
    </AdminV2Layout>
  );
}
