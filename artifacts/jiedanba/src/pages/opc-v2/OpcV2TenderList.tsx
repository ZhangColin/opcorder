import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  FileText, Loader2, AlertCircle, ChevronRight, CheckCircle2, Mail, Globe,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { OpcV2Layout } from "./OpcV2Layout";
import { hasUnread } from "@/lib/demandRead";

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
  { key: "all",         label: "全部" },
  { key: "negotiating", label: "洽谈中" },
  { key: "quoted",      label: "已报价" },
  { key: "won",         label: "已中标" },
  { key: "lost",        label: "未中标" },
] as const;

const SOURCE_TABS = [
  { key: "all",     label: "全部来源" },
  { key: "invited", label: "邀请我的" },
  { key: "public",  label: "我申请的" },
] as const;

type StatusKey = (typeof STATUS_TABS)[number]["key"];
type SourceKey = (typeof SOURCE_TABS)[number]["key"];

export default function OpcV2TenderList() {
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceKey>("all");
  const [, navigate] = useLocation();

  const { data, isLoading, isError, refetch } = useQuery<TenderItem[]>({
    queryKey: ["v2-opc-tenders"],
    queryFn: () => v2Get("/tenders?limit=100"),
  });

  const tenders = data ?? [];

  const filtered = tenders.filter(t => {
    const statusOk = statusFilter === "all" || t.status === statusFilter;
    const sourceOk = sourceFilter === "all" || t.demandMode === sourceFilter;
    return statusOk && sourceOk;
  });

  const sourceCounts = {
    all: tenders.length,
    invited: tenders.filter(t => t.demandMode === "invited").length,
    public: tenders.filter(t => t.demandMode === "public").length,
  };

  const statusCounts = STATUS_TABS.reduce((acc, tab) => {
    const base = sourceFilter === "all" ? tenders : tenders.filter(t => t.demandMode === sourceFilter);
    acc[tab.key] = tab.key === "all" ? base.length : base.filter(t => t.status === tab.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <OpcV2Layout>
      <div className="py-6 space-y-5">
        <div>
          <h2 className="text-2xl font-black text-foreground mb-1">我的投标</h2>
          <p className="text-sm text-muted-foreground">跟进报名及报价进度</p>
        </div>

        {/* 来源 Tab */}
        <div className="flex gap-2 flex-wrap">
          {SOURCE_TABS.map(tab => (
            <button key={tab.key} onClick={() => { setSourceFilter(tab.key); setStatusFilter("all"); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                sourceFilter === tab.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-card text-muted-foreground border border-border hover:border-primary/40"
              }`}>
              {tab.key === "invited" && <Mail size={13} />}
              {tab.key === "public"  && <Globe size={13} />}
              {tab.label}
              {sourceCounts[tab.key] > 0 && (
                <span className={`text-[11px] font-bold ${sourceFilter === tab.key ? "opacity-75" : "text-muted-foreground"}`}>
                  {sourceCounts[tab.key]}
                </span>
              )}
            </button>
          ))}
          <button onClick={() => refetch()}
            className="ml-auto text-xs text-muted-foreground hover:text-primary px-3 py-2 hover:bg-muted rounded-xl transition-colors">
            刷新
          </button>
        </div>

        {/* 状态 Tab */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === tab.key
                  ? "bg-slate-800 text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}>
              {tab.label}
              {statusCounts[tab.key] > 0 && (
                <span className={`ml-1 ${statusFilter === tab.key ? "opacity-70" : "text-muted-foreground"}`}>
                  {statusCounts[tab.key]}
                </span>
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
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-2xl p-12 text-center border border-border">
            <FileText size={32} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground font-medium">
              {sourceFilter === "invited" ? "暂无邀请记录" : sourceFilter === "public" ? "暂无大厅申请记录" : "暂无投标记录"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...filtered].sort((a, b) =>
              (hasUnread("outsource", b.outsourceDemandId, b.demandUpdatedAt) ? 1 : 0) -
              (hasUnread("outsource", a.outsourceDemandId, a.demandUpdatedAt) ? 1 : 0)
            ).map(tender => {
              const cfg = STATUS_CONFIG[tender.status] ?? { label: tender.status, color: "bg-slate-100 text-slate-500" };
              const isInvited = tender.demandMode === "invited";
              return (
                <button key={tender.id} onClick={() => navigate(`/opc/tenders/${tender.id}`)}
                  className="w-full text-left bg-card rounded-2xl border border-border shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[15px] font-bold text-foreground truncate flex items-center gap-1.5">
                      {tender.demandTitle ?? `需求 #${tender.outsourceDemandId}`}
                      {hasUnread("outsource", tender.outsourceDemandId, tender.demandUpdatedAt) && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      )}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* 来源标签 */}
                      <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isInvited
                          ? "bg-violet-100 text-violet-700"
                          : "bg-sky-100 text-sky-700"
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
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">最近更新</p>
                        <p className="text-sm text-muted-foreground">{new Date(tender.updatedAt).toLocaleDateString("zh-CN")}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground/40 group-hover:text-primary shrink-0" />
                  </div>
                  {tender.status === "won" && (
                    <p className="mt-2 text-xs font-bold text-green-700 flex items-center gap-1">
                      <CheckCircle2 size={12} /> 已中标！请前往「我的订单」确认合同并签署
                    </p>
                  )}
                  {tender.cancelledReason && (
                    <p className="mt-2 text-xs text-muted-foreground">原因：{tender.cancelledReason}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </OpcV2Layout>
  );
}
