import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ChevronLeft, ChevronRight, Clock, LayoutGrid, List,
  Loader2, AlertCircle, CheckCircle2, Lock, Tag, Zap,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { useDemandTypeLabel } from "@/lib/catCategories";

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

function DemandCard({ demand, onClick }: { demand: DemandItem; onClick: () => void }) {
  const { resolveDemandType } = useDemandTypeLabel();
  const isNew = (Date.now() - new Date(demand.createdAt).getTime()) / 86400000 <= 2;

  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_20px_40px_-15px_rgba(0,50,125,0.12)] hover:-translate-y-1 flex flex-col justify-between border border-border/50 shadow-sm text-left w-full"
    >
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

        <h3 className="text-lg font-bold mb-1 text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2 font-display">
          {demand.title}
        </h3>
        {demand.demandNo && (
          <p className="text-muted-foreground text-xs font-mono mb-3">{demand.demandNo}</p>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/40">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="font-semibold">{demand.tenderCount} 人报名</span>
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {new Date(demand.createdAt).toLocaleDateString("zh-CN")}
          </span>
        </div>
        <span className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 active:scale-95 ${
          demand.mode === "invited"
            ? "bg-amber-50 text-amber-700 border border-amber-200 group-hover:bg-amber-100"
            : "bg-primary text-white shadow-sm group-hover:shadow-md group-hover:shadow-primary/20"
        }`}>
          {demand.mode === "invited" ? "查看详情" : "立即报价"}
        </span>
      </div>
    </button>
  );
}

function DemandListRow({ demand, onClick }: { demand: DemandItem; onClick: () => void }) {
  const { resolveDemandType } = useDemandTypeLabel();

  return (
    <button
      onClick={onClick}
      className="group bg-white rounded-xl px-6 py-4 flex items-center gap-6 border border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200 w-full text-left"
    >
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
      <span className="shrink-0 text-sm font-extrabold text-primary">
        {formatBudgetRange(demand.expectedPriceMin, demand.expectedPriceMax)}
      </span>
      <span className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground font-medium shrink-0 whitespace-nowrap">
        <Clock size={12} className="shrink-0" />
        {new Date(demand.createdAt).toLocaleDateString("zh-CN")}
      </span>
      <span className={`px-4 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
        demand.mode === "invited"
          ? "bg-amber-50 text-amber-700 border border-amber-200"
          : "bg-primary text-white"
      }`}>
        {demand.mode === "invited" ? "查看" : "报价"}
      </span>
    </button>
  );
}

export default function OrderHall() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedType, setSelectedType] = useState("");
  const [page, setPage] = useState(1);
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
              <DemandCard key={d.id} demand={d} onClick={() => navigate(`/order-hall/${d.id}`)} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map(d => (
              <DemandListRow key={d.id} demand={d} onClick={() => navigate(`/order-hall/${d.id}`)} />
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
    </div>
  );
}
