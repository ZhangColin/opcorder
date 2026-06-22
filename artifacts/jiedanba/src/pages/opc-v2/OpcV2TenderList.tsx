import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  FileText, Loader2, AlertCircle, ChevronRight, CheckCircle2,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { OpcV2Layout } from "./OpcV2Layout";
import { hasUnread } from "@/lib/demandRead";

interface TenderItem {
  id: number;
  outsourceDemandId: number;
  demandTitle: string | null;
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

const FILTER_TABS = [
  { key: "all",         label: "全部" },
  { key: "negotiating", label: "洽谈中" },
  { key: "quoted",      label: "已报价" },
  { key: "won",         label: "已中标" },
  { key: "lost",        label: "未中标" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

export default function OpcV2TenderList() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [, navigate] = useLocation();

  const { data, isLoading, isError, refetch } = useQuery<TenderItem[]>({
    queryKey: ["v2-opc-tenders"],
    queryFn: () => v2Get("/tenders?limit=100"),
  });

  const tenders = data ?? [];
  const filtered = filter === "all" ? tenders : tenders.filter(t => t.status === filter);

  const counts = FILTER_TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key === "all" ? tenders.length : tenders.filter(t => t.status === tab.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <OpcV2Layout title="我的投标">
      <div className="py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-emerald-900 mb-1">我的投标</h2>
          <p className="text-sm text-slate-500">跟进报名及报价进度</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                filter === tab.key ? "bg-emerald-700 text-white shadow-sm" : "bg-white text-slate-500 border border-slate-200 hover:border-emerald-400"
              }`}>
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`ml-1.5 text-[11px] font-bold ${filter === tab.key ? "opacity-75" : "text-slate-400"}`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
          <button onClick={() => refetch()}
            className="ml-auto text-xs text-slate-400 hover:text-emerald-700 px-3 py-2 hover:bg-slate-50 rounded-xl transition-colors">
            刷新
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : isError ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
            <p className="text-sm text-red-500 font-medium">加载失败</p>
            <button onClick={() => refetch()} className="mt-3 text-xs text-primary underline">重试</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <FileText size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">
              {filter === "all" ? "暂无投标记录，前往需求大厅报名" : "暂无此状态的投标记录"}
            </p>
            {filter === "all" && (
              <button onClick={() => navigate("/opc/demand-hall")}
                className="mt-4 px-4 py-2 bg-emerald-700 text-white text-xs font-bold rounded-xl hover:bg-emerald-800 transition-colors">
                前往需求大厅
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {[...filtered].sort((a, b) =>
              (hasUnread("outsource", b.outsourceDemandId, b.demandUpdatedAt) ? 1 : 0) - (hasUnread("outsource", a.outsourceDemandId, a.demandUpdatedAt) ? 1 : 0)
            ).map(tender => {
              const cfg = STATUS_CONFIG[tender.status] ?? { label: tender.status, color: "bg-slate-100 text-slate-500" };
              return (
                <button key={tender.id} onClick={() => navigate(`/opc/tenders/${tender.id}`)}
                  className="w-full text-left bg-white rounded-2xl border border-slate-100 shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[15px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                      {tender.demandTitle ?? `需求 #${tender.outsourceDemandId}`}
                      {hasUnread("outsource", tender.outsourceDemandId, tender.demandUpdatedAt) && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                      )}
                    </span>
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                      {tender.totalPrice != null ? (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">我的报价</p>
                          <p className="text-xl font-black text-slate-800">¥{tender.totalPrice.toLocaleString()}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">报价</p>
                          <p className="text-sm text-amber-600 font-bold">尚未提交</p>
                        </div>
                      )}
                      {tender.quotedAt && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">报价时间</p>
                          <p className="text-sm text-slate-600">{new Date(tender.quotedAt).toLocaleDateString("zh-CN")}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">最近更新</p>
                        <p className="text-sm text-slate-600">{new Date(tender.updatedAt).toLocaleDateString("zh-CN")}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-600 shrink-0" />
                  </div>
                  {tender.status === "won" && (
                    <p className="mt-2 text-xs font-bold text-green-700 flex items-center gap-1">
                      <CheckCircle2 size={12} /> 已中标！请前往「我的订单」确认合同并签署
                    </p>
                  )}
                  {tender.cancelledReason && (
                    <p className="mt-2 text-xs text-slate-400">原因：{tender.cancelledReason}</p>
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
