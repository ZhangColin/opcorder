import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ChevronLeft, ChevronRight, Clock, LayoutGrid, List,
  Loader2, AlertCircle, CheckCircle2, Lock, Tag, Zap, X, FileText,
} from "lucide-react";
import { v2Get, v2Post } from "@/lib/v2api";
import { useDemandTypeLabel } from "@/lib/catCategories";
import { useToast } from "@/hooks/use-toast";

const DEMAND_TYPE_OPTIONS = [
  { key: "", label: "全部类型" },
  { key: "SA", label: "软件开发" },
  { key: "CG", label: "内容设计" },
  { key: "TK", label: "教育培训" },
  { key: "BO", label: "营销推广" },
  { key: "OTHER", label: "其他" },
];

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

function formatBudgetRange(min: number | null, max: number | null) {
  if (!min && !max) return "面议";
  if (min && max) return `¥${min.toLocaleString()} - ¥${max.toLocaleString()}`;
  if (min) return `¥${min.toLocaleString()} 起`;
  if (max) return `最高 ¥${max.toLocaleString()}`;
  return "面议";
}

function DemandPreviewPanel({
  demandId,
  onApply,
  applying,
  applied,
  onClose,
}: {
  demandId: number;
  onApply: (id: number, title: string) => void;
  applying: number | null;
  applied: Set<number>;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useQuery<DemandDetail>({
    queryKey: ["v2-demand-detail-hall", demandId],
    queryFn: () => v2Get(`/outsource-demands/${demandId}`),
    enabled: !!demandId,
  });
  const { resolveDemandType } = useDemandTypeLabel();

  const myTender = data?.tenders?.[0];
  const alreadyApplied =
    applied.has(demandId) ||
    (myTender && ["negotiating", "quoted", "won"].includes(myTender.status));

  const canBid = data && data.mode === "public" && data.status === "negotiating";

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
                  {resolveDemandType(data.demandType)}
                </span>
                {data.isUrgent && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full flex items-center gap-0.5">
                    <Zap size={10} /> 紧急
                  </span>
                )}
                {data.mode === "invited" && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full flex items-center gap-0.5">
                    <Lock size={10} /> 邀请制
                  </span>
                )}
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-mono rounded-full">
                  {data.demandNo}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 mb-1">平台预期价格区间</p>
                  <p className="text-lg font-black text-primary">
                    {formatBudgetRange(data.expectedPriceMin, data.expectedPriceMax)}
                  </p>
                  <p className="text-[10px] text-primary/60 mt-0.5">请参考此区间制定报价</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 mb-1">已报名人数</p>
                  <p className="text-lg font-black text-primary">{data.tenderCount} 人</p>
                </div>
              </div>

              {(data.latestVersion?.detail || data.detail) && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">需求详情</p>
                  <div className="prose prose-sm max-w-none text-slate-600 bg-muted/30 rounded-xl p-4 border border-border whitespace-pre-wrap text-sm leading-relaxed">
                    {data.latestVersion?.detail ?? data.detail}
                  </div>
                </div>
              )}

              {data.latestVersion?.attachments && data.latestVersion.attachments.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">附件</p>
                  <div className="flex flex-wrap gap-2">
                    {data.latestVersion.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-slate-700 text-xs font-medium rounded-lg hover:bg-muted/80 transition-colors"
                      >
                        <FileText size={12} /> {att.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {data.mode === "invited" && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                  <Lock size={13} className="shrink-0 mt-0.5" />
                  <span>此需求为邀请制，您已被邀请查看，但无法在此处主动报价。请等待平台联系。</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-muted text-slate-600 text-sm font-bold rounded-xl hover:bg-muted/80 transition-colors"
          >
            关闭
          </button>
          {alreadyApplied ? (
            <span className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-50 text-emerald-700 text-sm font-bold rounded-xl border border-emerald-200">
              <CheckCircle2 size={15} /> 已报名
            </span>
          ) : canBid ? (
            <button
              onClick={() => data && onApply(data.id, data.title)}
              disabled={applying === data?.id}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
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

function DemandCard({ demand, onPreview, applied }: { demand: DemandItem; onPreview: (id: number) => void; applied: Set<number> }) {
  const { resolveDemandType } = useDemandTypeLabel();
  const isNew = (Date.now() - new Date(demand.createdAt).getTime()) / 86400000 <= 2;
  const alreadyApplied = applied.has(demand.id);

  return (
    <div className="group bg-white rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_20px_40px_-15px_rgba(0,50,125,0.12)] hover:-translate-y-1 flex flex-col justify-between border border-border/50 shadow-sm">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-2 flex-wrap">
            {demand.isUrgent && (
              <span className="bg-destructive text-white text-[10px] font-extrabold uppercase px-2 py-1 rounded-md tracking-wider flex items-center gap-0.5">
                <Zap size={9} /> 紧急
              </span>
            )}
            {!demand.isUrgent && isNew && (
              <span className="bg-[#4dffb2] text-[#002112] text-[10px] font-extrabold uppercase px-2 py-1 rounded-md tracking-wider">
                最新
              </span>
            )}
            {demand.mode === "invited" && (
              <span className="bg-amber-100 text-amber-700 text-[10px] font-extrabold uppercase px-2 py-1 rounded-md tracking-wider flex items-center gap-0.5">
                <Lock size={9} /> 邀请
              </span>
            )}
            <span className="bg-secondary/15 text-secondary text-[10px] font-extrabold uppercase px-2 py-1 rounded-md tracking-wider flex items-center gap-0.5">
              <Tag size={9} /> {resolveDemandType(demand.demandType)}
            </span>
          </div>
          <div className="text-right shrink-0 ml-2">
            <span className="block text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">预算</span>
            <span className="block text-base font-extrabold text-primary tracking-tight leading-none">
              {formatBudgetRange(demand.expectedPriceMin, demand.expectedPriceMax)}
            </span>
          </div>
        </div>

        <h3 className="text-lg font-bold mb-2 text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2 font-display">
          {demand.title}
        </h3>
        <p className="text-muted-foreground text-xs font-mono mb-4">{demand.demandNo}</p>
      </div>

      <div className="flex items-center justify-between pt-5 border-t border-border/40">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-semibold">{demand.tenderCount} 人报名</span>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {new Date(demand.createdAt).toLocaleDateString("zh-CN")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {alreadyApplied ? (
            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200">
              <CheckCircle2 size={11} /> 已报名
            </span>
          ) : demand.mode === "invited" ? (
            <button
              onClick={() => onPreview(demand.id)}
              className="bg-amber-50 text-amber-700 border border-amber-200 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors"
            >
              查看详情
            </button>
          ) : (
            <button
              onClick={() => onPreview(demand.id)}
              className="bg-primary text-white hover:bg-primary/90 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-primary/20 active:scale-95"
            >
              立即报价
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DemandListRow({ demand, onPreview, applied }: { demand: DemandItem; onPreview: (id: number) => void; applied: Set<number> }) {
  const { resolveDemandType } = useDemandTypeLabel();
  const alreadyApplied = applied.has(demand.id);

  return (
    <div className="group bg-white rounded-xl px-6 py-4 flex items-center gap-6 border border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200">
      <div className="flex gap-1.5 shrink-0">
        {demand.isUrgent && (
          <span className="bg-destructive text-white text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wide">紧急</span>
        )}
        {demand.mode === "invited" && (
          <span className="bg-amber-100 text-amber-700 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wide">邀请</span>
        )}
        <span className="bg-secondary/15 text-secondary text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wide">
          {resolveDemandType(demand.demandType)}
        </span>
      </div>
      <h3 className="flex-1 font-bold text-foreground group-hover:text-primary transition-colors truncate">
        {demand.title}
      </h3>
      <span className="hidden md:block text-xs text-muted-foreground font-mono shrink-0">{demand.demandNo}</span>
      <div className="shrink-0 text-right">
        <span className="block text-sm font-extrabold text-primary leading-none">
          {formatBudgetRange(demand.expectedPriceMin, demand.expectedPriceMax)}
        </span>
      </div>
      <span className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground font-medium shrink-0 whitespace-nowrap">
        <Clock size={12} className="shrink-0" />
        {new Date(demand.createdAt).toLocaleDateString("zh-CN")}
      </span>
      {alreadyApplied ? (
        <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200 shrink-0">
          <CheckCircle2 size={11} /> 已报名
        </span>
      ) : demand.mode === "invited" ? (
        <button
          onClick={() => onPreview(demand.id)}
          className="bg-amber-50 text-amber-700 border border-amber-200 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors shrink-0"
        >
          查看详情
        </button>
      ) : (
        <button
          onClick={() => onPreview(demand.id)}
          className="bg-primary text-white hover:bg-primary/90 px-4 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
        >
          立即报价
        </button>
      )}
    </div>
  );
}

export default function OrderHall() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedType, setSelectedType] = useState("");
  const [page, setPage] = useState(1);
  const [applying, setApplying] = useState<number | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [previewId, setPreviewId] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const { data, isLoading, isError, refetch } = useQuery<PagedResponse>({
    queryKey: ["v2-opc-demand-hall-main", selectedType, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "12", status: "negotiating" });
      if (selectedType) params.set("demandType", selectedType);
      return v2Get(`/outsource-demands?${params}`);
    },
  });

  const totalPages = data ? Math.ceil((data.total || 0) / 12) : 1;

  async function handleApply(demandId: number, title: string) {
    setApplying(demandId);
    try {
      const created = await v2Post<{ id: number }>(`/outsource-demands/${demandId}/apply`);
      setApplied(prev => new Set([...prev, demandId]));
      toast({ title: "报名成功", description: `已报名「${title}」，正在跳转到投标详情…` });
      qc.invalidateQueries({ queryKey: ["v2-opc-demand-hall-main"] });
      setPreviewId(null);
      navigate(`/opc/tenders/${created.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "请稍后重试";
      toast({ title: "报名失败", description: msg, variant: "destructive" });
    } finally {
      setApplying(null);
    }
  }

  const goToPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex gap-8 min-h-[80vh]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 hidden lg:block">
        <div className="sticky top-28 space-y-6 bg-white rounded-2xl border border-border/50 shadow-sm p-6">
          <h2 className="text-base font-extrabold tracking-tight text-primary">需求类型</h2>
          <div className="space-y-1">
            {DEMAND_TYPE_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => { setSelectedType(opt.key); setPage(1); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedType === opt.key
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <section className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-primary font-display">需求大厅</h1>
            <p className="text-muted-foreground mt-2 font-medium text-sm">
              共 <span className="text-foreground font-bold">{data?.total ?? "—"}</span> 个外包需求
            </p>
          </div>
          <div className="flex items-center gap-2 p-1 bg-muted/60 rounded-xl border border-border/50">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === "grid" ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid size={15} /> 网格
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                viewMode === "list" ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List size={15} /> 列表
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className={viewMode === "grid" ? "grid grid-cols-1 xl:grid-cols-2 gap-6" : "space-y-3"}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-muted/50 rounded-2xl animate-pulse border border-border/30" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <AlertCircle size={32} className="mb-3 text-red-400" />
            <p className="text-sm text-red-500 font-medium mb-3">加载失败</p>
            <button onClick={() => refetch()} className="px-5 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary hover:text-white transition-colors text-sm">
              重试
            </button>
          </div>
        ) : !data?.items?.length ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mb-4 text-2xl">📭</div>
            <h3 className="text-lg font-bold text-foreground mb-2">暂无匹配需求</h3>
            <p className="text-muted-foreground text-sm mb-6">请尝试切换其他类型</p>
            <button
              onClick={() => { setSelectedType(""); setPage(1); }}
              className="px-5 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary hover:text-white transition-colors text-sm"
            >
              查看全部
            </button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {data.items.map(d => (
              <DemandCard key={d.id} demand={d} onPreview={setPreviewId} applied={applied} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map(d => (
              <DemandListRow key={d.id} demand={d} onPreview={setPreviewId} applied={applied} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-12 flex justify-center items-center gap-3">
            <button
              onClick={() => goToPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="p-2 border border-border rounded-lg hover:border-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-2">
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`w-10 h-10 rounded-lg font-bold text-sm transition-all ${
                      page === p
                        ? "bg-primary text-white shadow-md shadow-primary/20"
                        : "border border-border text-muted-foreground hover:border-primary hover:text-primary"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              {totalPages > 5 && (
                <>
                  <span className="flex items-center px-1 text-muted-foreground font-bold">···</span>
                  <button
                    onClick={() => goToPage(totalPages)}
                    className={`w-10 h-10 rounded-lg font-bold text-sm border border-border text-muted-foreground hover:border-primary hover:text-primary transition-all ${
                      page === totalPages ? "bg-primary text-white border-primary" : ""
                    }`}
                  >
                    {totalPages}
                  </button>
                </>
              )}
            </div>
            <button
              onClick={() => goToPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="p-2 border border-border rounded-lg hover:border-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </section>

      {previewId !== null && (
        <DemandPreviewPanel
          demandId={previewId}
          onApply={handleApply}
          applying={applying}
          applied={applied}
          onClose={() => setPreviewId(null)}
        />
      )}
    </div>
  );
}
