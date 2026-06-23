import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  FileText, Loader2, AlertCircle, ChevronRight, Mail, Globe,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { hasUnreadSinceCreation } from "@/lib/demandRead";
import { OpcV2Layout } from "./OpcV2Layout";
import { Pagination } from "@/components/pub/Pagination";

const PAGE_SIZE = 10;

interface TenderItem {
  id: number;
  outsourceDemandId: number;
  demandTitle: string | null;
  demandMode: "public" | "invited" | null;
  opcId: number;
  opcNickname: string | null;
  status: string;
  totalPrice: number | null;
  priceBreakdown: Array<{ item: string; amount: number; note?: string }>;
  quotedAt: string | null;
  selectedAt: string | null;
  cancelledReason: string | null;
  demandUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  negotiating: { label: "洽谈中", color: "bg-blue-100 text-blue-700" },
  quoted:      { label: "已报价", color: "bg-amber-100 text-amber-700" },
  won:         { label: "已中标", color: "bg-green-100 text-green-700" },
  lost:        { label: "未中标", color: "bg-slate-100 text-slate-500" },
};

const STATUS_TABS = [
  { key: "negotiating", label: "洽谈中" },
  { key: "quoted",      label: "已报价" },
  { key: "won",         label: "已中标" },
  { key: "lost",        label: "未中标" },
  { key: "all",         label: "全部" },
] as const;

const SOURCE_TABS = [
  { key: "invited", label: "邀请我的", icon: Mail },
  { key: "public",  label: "我申请的", icon: Globe },
  { key: "all",     label: "全部来源", icon: null },
] as const;

type StatusKey = (typeof STATUS_TABS)[number]["key"];
type SourceKey = (typeof SOURCE_TABS)[number]["key"];

export default function OpcV2TenderList() {
  const [statusFilter, setStatusFilter] = useState<StatusKey>("negotiating");
  const [sourceFilter, setSourceFilter] = useState<SourceKey>("all");
  const [page, setPage] = useState(1);
  const [, navigate] = useLocation();

  useEffect(() => { setPage(1); }, [statusFilter, sourceFilter]);

  const { data, isLoading, isError, refetch } = useQuery<TenderItem[]>({
    queryKey: ["v2-opc-tenders"],
    queryFn: () => v2Get("/tenders?limit=200"),
  });

  const tenders = data ?? [];

  const sourceCounts = SOURCE_TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key === "all" ? tenders.length : tenders.filter(t => t.demandMode === tab.key).length;
    return acc;
  }, {} as Record<string, number>);

  const sourceFiltered = sourceFilter === "all" ? tenders : tenders.filter(t => t.demandMode === sourceFilter);

  const statusCounts = STATUS_TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key === "all" ? sourceFiltered.length : sourceFiltered.filter(t => t.status === tab.key).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = statusFilter === "all" ? sourceFiltered : sourceFiltered.filter(t => t.status === statusFilter);

  const sorted = [...filtered].sort((a, b) =>
    (hasUnreadSinceCreation("tender", b.id, b.updatedAt, b.createdAt) ? 1 : 0) -
    (hasUnreadSinceCreation("tender", a.id, a.updatedAt, a.createdAt) ? 1 : 0)
  );

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <OpcV2Layout>
      <div className="py-6 space-y-5">
        <div>
          <h2 className="text-2xl font-black text-foreground mb-1">我的投标</h2>
          <p className="text-sm text-muted-foreground">跟进报名及报价进度</p>
        </div>

        {/* 来源 Tab */}
        <div className="flex gap-2 flex-wrap">
          {SOURCE_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => { setSourceFilter(tab.key); setStatusFilter("negotiating"); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                  sourceFilter === tab.key
                    ? "bg-primary text-white shadow-sm"
                    : "bg-card text-muted-foreground border border-border hover:border-primary/40"
                }`}>
                {Icon && <Icon size={13} />}
                {tab.label}
                {sourceCounts[tab.key] > 0 && (
                  <span className={`text-[11px] font-bold ${sourceFilter === tab.key ? "opacity-75" : "text-muted-foreground"}`}>
                    {sourceCounts[tab.key]}
                  </span>
                )}
              </button>
            );
          })}
          <button onClick={() => refetch()}
            className="ml-auto text-xs text-muted-foreground hover:text-primary px-3 py-2 hover:bg-muted rounded-xl transition-colors">
            刷新
          </button>
        </div>

        {/* 状态 Tab */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                statusFilter === tab.key
                  ? "bg-slate-800 text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}>
              {tab.label}
              {statusCounts[tab.key] > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  statusFilter === tab.key ? "bg-white/20" : "bg-slate-200 text-slate-500"
                }`}>{statusCounts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : isError ? (
          <div className="bg-card rounded-2xl p-12 text-center border border-border">
            <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
            <p className="text-sm text-red-500 font-medium">加载失败</p>
            <button onClick={() => refetch()} className="mt-3 text-xs text-primary underline">重试</button>
          </div>
        ) : paged.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center border border-border">
            <FileText size={32} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground font-medium">暂无此状态的投标记录</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paged.map(tender => {
                const cfg = STATUS_CONFIG[tender.status] ?? { label: tender.status, color: "bg-slate-100 text-slate-500" };
                const isInvited = tender.demandMode === "invited";
                const hasNew = hasUnreadSinceCreation("tender", tender.id, tender.updatedAt, tender.createdAt);
                return (
                  <button key={tender.id} onClick={() => navigate(`/opc/tenders/${tender.id}`)}
                    className="w-full text-left bg-card rounded-2xl border border-border shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[15px] font-bold text-foreground truncate flex items-center gap-1.5">
                        {tender.demandTitle ?? `需求 #${tender.outsourceDemandId}`}
                        {hasNew && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          isInvited ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"
                        }`}>
                          {isInvited ? <Mail size={10} /> : <Globe size={10} />}
                          {isInvited ? "邀请" : "大厅申请"}
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      </div>
                    </div>
                    <div className="flex items-end gap-4">
                      <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                        {tender.totalPrice != null ? (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">我的报价</p>
                            <p className="text-xl font-black text-foreground">¥{tender.totalPrice.toLocaleString()}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">报价</p>
                            <p className="text-sm text-amber-600 font-bold">尚未提交</p>
                          </div>
                        )}
                        {tender.quotedAt && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">报价时间</p>
                            <p className="text-sm text-muted-foreground">{new Date(tender.quotedAt).toLocaleDateString("zh-CN")}</p>
                          </div>
                        )}
                        {tender.selectedAt && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">中标时间</p>
                            <p className="text-sm text-green-600">{new Date(tender.selectedAt).toLocaleDateString("zh-CN")}</p>
                          </div>
                        )}
                        {!tender.quotedAt && !tender.selectedAt && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">申请时间</p>
                            <p className="text-sm text-muted-foreground">{new Date(tender.createdAt).toLocaleDateString("zh-CN")}</p>
                          </div>
                        )}
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground/30 group-hover:text-primary shrink-0" />
                    </div>
                    {tender.cancelledReason && (
                      <p className="mt-2 text-xs text-muted-foreground">未中标原因：{tender.cancelledReason}</p>
                    )}
                  </button>
                );
              })}
            </div>
            <Pagination page={page} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </div>
    </OpcV2Layout>
  );
}
