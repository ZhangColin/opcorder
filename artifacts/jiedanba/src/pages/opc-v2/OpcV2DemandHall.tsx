import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search, Loader2, AlertCircle, Clock, Tag,
  Zap, CheckCircle2, ChevronDown, ChevronUp, X, FileText,
} from "lucide-react";
import { v2Get, v2Post } from "@/lib/v2api";
import { useToast } from "@/hooks/use-toast";
import { OpcV2Layout } from "./OpcV2Layout";

interface DemandItem {
  id: number;
  demandNo: string;
  title: string;
  demandType: string;
  isUrgent: boolean;
  mode: "public" | "invited";
  expectedPriceMin: number | null;
  expectedPriceMax: number | null;
  status: string;
  tenderCount: number;
  createdAt: string;
}

interface DemandDetail extends DemandItem {
  detail: string | null;
  latestVersion: {
    id: number;
    versionNo: number;
    detail: string | null;
    attachments: Array<{ name: string; url: string }>;
    editComment: string | null;
    createdAt: string;
  } | null;
  tenders: Array<{ id: number; status: string; opcId: number }>;
}

interface PagedResponse {
  total: number;
  page: number;
  limit: number;
  items: DemandItem[];
}

const DEMAND_TYPE_LABELS: Record<string, string> = {
  website:     "网站建设",
  app:         "App 开发",
  miniprogram: "小程序",
  ecommerce:   "电商运营",
  design:      "设计制作",
  marketing:   "营销推广",
  other:       "其他",
};

function formatBudgetRange(min: number | null, max: number | null) {
  if (!min && !max) return "面议";
  if (min && max) return `¥${min.toLocaleString()} - ¥${max.toLocaleString()}`;
  if (min) return `¥${min.toLocaleString()} 起`;
  if (max) return `最高 ¥${max.toLocaleString()}`;
  return "面议";
}

interface DemandPreviewPanelProps {
  demandId: number;
  onApply: (demandId: number, title: string) => void;
  applying: number | null;
  applied: Set<number>;
  onClose: () => void;
}

function DemandPreviewPanel({ demandId, onApply, applying, applied, onClose }: DemandPreviewPanelProps) {
  const { data, isLoading, isError } = useQuery<DemandDetail>({
    queryKey: ["v2-demand-detail", demandId],
    queryFn: () => v2Get(`/outsource-demands/${demandId}`),
    enabled: !!demandId,
  });

  const myTender = data?.tenders?.[0];
  const alreadyApplied = applied.has(demandId) || (myTender && ["negotiating", "quoted", "won"].includes(myTender.status));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-extrabold text-slate-800 truncate flex-1 mr-3">
            {isLoading ? "加载中…" : (data?.title ?? "需求详情")}
          </h3>
          <button
            onClick={onClose}
            className="shrink-0 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
            </div>
          ) : isError || !data ? (
            <div className="py-12 text-center">
              <AlertCircle size={24} className="mx-auto mb-2 text-red-400" />
              <p className="text-sm text-red-500">加载失败</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
                  {DEMAND_TYPE_LABELS[data.demandType] ?? data.demandType}
                </span>
                {data.isUrgent && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full flex items-center gap-0.5">
                    <Zap size={10} /> 紧急
                  </span>
                )}
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-mono rounded-full">
                  {data.demandNo}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">平台预期价格区间</p>
                  <p className="text-lg font-black text-emerald-800">
                    {formatBudgetRange(data.expectedPriceMin, data.expectedPriceMax)}
                  </p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">请参考此区间制定报价</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">已报名人数</p>
                  <p className="text-lg font-black text-emerald-800">{data.tenderCount} 人</p>
                </div>
              </div>

              {(data.latestVersion?.detail || data.detail) && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">需求详情</p>
                  <div className="prose prose-sm max-w-none text-slate-600 bg-slate-50 rounded-xl p-4 border border-slate-100 whitespace-pre-wrap text-sm leading-relaxed">
                    {data.latestVersion?.detail ?? data.detail}
                  </div>
                </div>
              )}

              {data.latestVersion?.attachments && data.latestVersion.attachments.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">附件</p>
                  <div className="flex flex-wrap gap-2">
                    {data.latestVersion.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        <FileText size={12} /> {att.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {data.latestVersion && (
                <p className="text-[11px] text-slate-400">
                  版本 v{data.latestVersion.versionNo} · {new Date(data.latestVersion.createdAt).toLocaleDateString("zh-CN")}
                  {data.latestVersion.editComment && ` · ${data.latestVersion.editComment}`}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors"
          >
            关闭
          </button>
          {alreadyApplied ? (
            <span className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 text-emerald-700 text-sm font-bold rounded-xl border border-emerald-200">
              <CheckCircle2 size={15} /> 已报名
            </span>
          ) : data && data.mode === "public" && data.status === "negotiating" ? (
            <button
              onClick={() => onApply(data.id, data.title)}
              disabled={applying === data?.id}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 text-white text-sm font-bold rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60"
            >
              {applying === data?.id ? <Loader2 size={14} className="animate-spin" /> : null}
              立即报名投标
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

interface MyTender {
  id: number;
  outsourceDemandId: number;
  status: string;
}

export default function OpcV2DemandHall() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [applying, setApplying] = useState<number | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [previewId, setPreviewId] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const { data: myTenders = [] } = useQuery<MyTender[]>({
    queryKey: ["v2-opc-tenders-hall"],
    queryFn: () => v2Get("/tenders?limit=200"),
  });

  const appliedDemandIds = new Set([
    ...myTenders.map(t => t.outsourceDemandId),
    ...applied,
  ]);

  const { data, isLoading, isError, refetch } = useQuery<PagedResponse>({
    queryKey: ["v2-opc-demand-hall", search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "50", status: "negotiating", mode: "public" });
      if (search) params.set("search", search);
      return v2Get(`/outsource-demands?${params}`);
    },
  });

  const allDemands = data?.items ?? [];
  const demands = allDemands.filter(d => !appliedDemandIds.has(d.id));
  const pageLimit = 50;
  const totalPages = data ? Math.ceil(data.total / pageLimit) : 1;

  async function handleApply(demandId: number, title: string) {
    setApplying(demandId);
    try {
      const created = await v2Post<{ id: number }>(`/outsource-demands/${demandId}/apply`);
      setApplied(prev => new Set([...prev, demandId]));
      toast({ title: "报名成功", description: `已报名「${title}」，正在跳转到投标详情…` });
      qc.invalidateQueries({ queryKey: ["v2-opc-tenders-home"] });
      qc.invalidateQueries({ queryKey: ["v2-opc-tenders-hall"] });
      qc.invalidateQueries({ queryKey: ["v2-opc-demand-hall"] });
      setPreviewId(null);
      navigate(`/opc/tenders/${created.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "请稍后重试";
      toast({ title: "报名失败", description: msg, variant: "destructive" });
    } finally {
      setApplying(null);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  return (
    <OpcV2Layout title="需求大厅">
      <div className="py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-emerald-900 mb-1">需求大厅</h2>
          <p className="text-sm text-slate-500">发现并报名公开外包需求，抢占优质合作机会</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="搜索需求标题…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-emerald-700 text-white text-sm font-bold rounded-xl hover:bg-emerald-800 transition-colors"
          >
            搜索
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              清除
            </button>
          )}
        </form>

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
        ) : demands.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <Search size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">暂无可报名的公开需求</p>
          </div>
        ) : (
          <div className="space-y-3">
            {demands.map(demand => {
              const alreadyApplied = applied.has(demand.id);
              return (
                <div
                  key={demand.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all overflow-hidden"
                >
                  <button
                    onClick={() => setPreviewId(demand.id)}
                    className="w-full p-5 text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {demand.isUrgent && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-600">
                              <Zap size={10} /> 紧急
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                            <Tag size={10} />
                            {DEMAND_TYPE_LABELS[demand.demandType] ?? demand.demandType}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">{demand.demandNo}</span>
                        </div>
                        <h3 className="font-bold text-base text-slate-800 group-hover:text-emerald-800 transition-colors mb-1 leading-snug text-left">
                          {demand.title}
                        </h3>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-1">
                          <span className="font-medium text-emerald-700">
                            {formatBudgetRange(demand.expectedPriceMin, demand.expectedPriceMax)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(demand.createdAt).toLocaleDateString("zh-CN")} 发布
                          </span>
                          <span>{demand.tenderCount} 人报名</span>
                        </div>
                      </div>
                      <div className="shrink-0">
                        {alreadyApplied ? (
                          <span className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                            <CheckCircle2 size={12} /> 已报名
                          </span>
                        ) : demand.mode === "public" ? (
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold">
                            点击查看
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold">
                            邀请制
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:border-emerald-500 disabled:opacity-40 transition-colors"
            >
              上一页
            </button>
            <span className="text-sm text-slate-500 font-medium">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:border-emerald-500 disabled:opacity-40 transition-colors"
            >
              下一页
            </button>
          </div>
        )}
      </div>

      {previewId !== null && (
        <DemandPreviewPanel
          demandId={previewId}
          onApply={handleApply}
          applying={applying}
          applied={applied}
          onClose={() => setPreviewId(null)}
        />
      )}
    </OpcV2Layout>
  );
}
