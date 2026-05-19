import { useState } from "react";
import { Link } from "wouter";
import { useListDemands } from "@workspace/api-client-react";
import { stripMarkdown } from "@/components/MarkdownContent";
import { ChevronLeft, ChevronRight, Clock, LayoutGrid, List } from "lucide-react";
import type { ListDemandsParams, ListDemandsStatus, Demand } from "@workspace/api-client-react";
import { formatBudget } from "@/lib/utils";
import { DEMAND_TYPES, OPC_LEVELS } from "@/lib/constants";

const DEADLINE_OPTIONS = [
  { value: "", label: "不限" },
  { value: "24h", label: "24小时内" },
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
];

function daysRemaining(dateStr?: string | null): string {
  if (!dateStr) return "长期有效";
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0) return "已截止";
  if (diff === 0) return "今天截止";
  return `${diff} 天后截止`;
}

function isUrgentDeadline(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return diff >= 0 && diff <= 3;
}

function ApplicantAvatars({ count, demandId }: { count: number; demandId: number }) {
  const seeds = ["ZMY", "LX", "WQ", "CJ", "ZH"];
  const show = Math.min(count || 0, 3);
  const extra = Math.max((count || 0) - 3, 0);
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {Array.from({ length: show }).map((_, i) => (
          <img
            key={i}
            src={`https://api.dicebear.com/7.x/initials/svg?seed=${seeds[(demandId + i) % seeds.length]}&backgroundColor=00327d&fontFamily=Inter&fontSize=40`}
            className="w-6 h-6 rounded-full border-2 border-white object-cover bg-primary"
            alt=""
          />
        ))}
        {extra > 0 && (
          <div className="w-6 h-6 rounded-full border-2 border-white bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground">
            +{extra}
          </div>
        )}
      </div>
      <span className="text-xs font-semibold text-muted-foreground">{count || 0} 人申请</span>
    </div>
  );
}

function MarketplaceCard({ demand }: { demand: Demand }) {
  const isNew = (() => {
    if (!demand.createdAt) return false;
    const diff = (Date.now() - new Date(demand.createdAt).getTime()) / 86400000;
    return diff <= 2;
  })();
  const urgent = demand.isUrgent || isUrgentDeadline(demand.bidDeadline);
  const typeLabel = DEMAND_TYPES[demand.type] || demand.type;

  return (
    <div className="group bg-white rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_20px_40px_-15px_rgba(0,50,125,0.12)] hover:-translate-y-1 flex flex-col justify-between border border-border/50 shadow-sm">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-2 flex-wrap">
            {urgent && (
              <span className="bg-destructive text-white text-[10px] font-extrabold uppercase px-2 py-1 rounded-md tracking-wider">
                紧急
              </span>
            )}
            {isNew && !urgent && (
              <span className="bg-[#4dffb2] text-[#002112] text-[10px] font-extrabold uppercase px-2 py-1 rounded-md tracking-wider">
                最新
              </span>
            )}
            <span className="bg-secondary/15 text-secondary text-[10px] font-extrabold uppercase px-2 py-1 rounded-md tracking-wider">
              {typeLabel}
            </span>
          </div>
          <div className="text-right shrink-0 ml-2">
            <span className="block text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">预算</span>
            <span className="block text-base font-extrabold text-primary tracking-tight leading-none">
              {formatBudget(demand.budgetMin, demand.budgetMax, demand.budget)}
            </span>
          </div>
        </div>

        <h3 className="text-lg font-bold mb-2 text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2 font-display">
          {demand.title}
        </h3>
        <p className="text-muted-foreground text-sm line-clamp-2 mb-4 leading-relaxed">
          {stripMarkdown(demand.description)}
        </p>

        <div className="flex flex-wrap gap-2 mb-5">
          {demand.requiredLevel && demand.requiredLevel !== "any" && (
            <span className="bg-primary/8 text-primary px-3 py-1 rounded-full text-[11px] font-bold border border-primary/20">
              {OPC_LEVELS[demand.requiredLevel]?.label ?? demand.requiredLevel} 等级
            </span>
          )}
          {demand.skillTags?.slice(0, 3).map((tag, i) => (
            <span key={i} className="bg-muted px-3 py-1 rounded-full text-[11px] font-bold text-muted-foreground">
              {tag}
            </span>
          ))}
          {(demand.skillTags?.length || 0) > 3 && (
            <span className="bg-muted/50 text-muted-foreground px-2 py-1 rounded-full text-[11px] font-medium">
              +{(demand.skillTags?.length || 0) - 3}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-5 border-t border-border/40">
        <div className="flex items-center gap-4">
          <ApplicantAvatars count={demand.bidCount || 0} demandId={demand.id} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
            <Clock size={13} />
            {daysRemaining(demand.bidDeadline)}
          </span>
          <Link
            href={`/demands/${demand.id}`}
            className="bg-primary text-white hover:bg-primary/90 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm hover:shadow-md hover:shadow-primary/20 active:scale-95"
          >
            查看详情
          </Link>
        </div>
      </div>
    </div>
  );
}

function MarketplaceListRow({ demand }: { demand: Demand }) {
  const isNew = (() => {
    if (!demand.createdAt) return false;
    const diff = (Date.now() - new Date(demand.createdAt).getTime()) / 86400000;
    return diff <= 2;
  })();
  const urgent = demand.isUrgent || isUrgentDeadline(demand.bidDeadline);
  const typeLabel = DEMAND_TYPES[demand.type] || demand.type;

  return (
    <div className="group bg-white rounded-xl px-6 py-4 flex items-center gap-6 border border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200">
      <div className="flex gap-1.5 shrink-0">
        {urgent && <span className="bg-destructive text-white text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wide">紧急</span>}
        {isNew && !urgent && <span className="bg-[#4dffb2] text-[#002112] text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wide">最新</span>}
        <span className="bg-secondary/15 text-secondary text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wide">{typeLabel}</span>
      </div>
      <h3 className="flex-1 font-bold text-foreground group-hover:text-primary transition-colors truncate">
        {demand.title}
      </h3>
      <div className="hidden md:flex flex-wrap gap-1.5 shrink-0 max-w-[220px]">
        {demand.skillTags?.slice(0, 2).map((tag, i) => (
          <span key={i} className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-[10px] font-medium">{tag}</span>
        ))}
      </div>
      <div className="shrink-0 text-right">
        <span className="block text-sm font-extrabold text-primary leading-none">{formatBudget(demand.budgetMin, demand.budgetMax, demand.budget)}</span>
      </div>
      <span className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground font-medium shrink-0 whitespace-nowrap">
        <Clock size={12} className="shrink-0" /> {daysRemaining(demand.bidDeadline)}
      </span>
      <Link
        href={`/demands/${demand.id}`}
        className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0"
      >
        查看
      </Link>
    </div>
  );
}

export default function OrderHall() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [deadline, setDeadline] = useState("");
  const [page, setPage] = useState(1);
  const [appliedFilters, setAppliedFilters] = useState<ListDemandsParams>({
    page: 1,
    limit: 8,
    status: "published" as ListDemandsStatus,
    sortBy: "newest",
  });

  const { data, isLoading } = useListDemands(appliedFilters);

  const totalPages = data ? Math.ceil((data.total || 0) / 8) : 1;

  const applyFilters = () => {
    const newPage = 1;
    setPage(newPage);
    setAppliedFilters({
      page: newPage,
      limit: 8,
      status: "published" as ListDemandsStatus,
      sortBy: "newest",
      type: selectedTypes.length === 1 ? selectedTypes[0] : undefined,
      opcLevel: selectedLevel || undefined,
      minBudget: budgetMin ? Number(budgetMin) : undefined,
      maxBudget: budgetMax ? Number(budgetMax) : undefined,
      deadlineFilter: (deadline || undefined) as ListDemandsParams["deadlineFilter"],
    } as ListDemandsParams);
  };

  const goToPage = (p: number) => {
    setPage(p);
    setAppliedFilters(prev => ({ ...prev, page: p }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleType = (key: string) => {
    setSelectedTypes(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <div className="flex gap-8 min-h-[80vh]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 hidden lg:block">
        <div className="sticky top-28 space-y-8 bg-white rounded-2xl border border-border/50 shadow-sm p-6">
          <h2 className="text-base font-extrabold tracking-tight text-primary">高级筛选</h2>

          {/* Category */}
          <div className="space-y-3">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              需求类型
            </label>
            <div className="space-y-1.5">
              {Object.entries(DEMAND_TYPES).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                >
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(key)}
                    onChange={() => toggleType(key)}
                    className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                  />
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Grade */}
          <div className="space-y-3">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              OPC 等级要求
            </label>
            <div className="flex gap-2">
              {[{ key: "", label: "不限" }, { key: "C", label: "新手" }, { key: "B", label: "进阶" }, { key: "A", label: "专家" }].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSelectedLevel(opt.key === selectedLevel ? "" : opt.key)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                    selectedLevel === opt.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Budget Range */}
          <div className="space-y-3">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              预算范围 (¥)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={budgetMin}
                onChange={e => setBudgetMin(e.target.value)}
                placeholder="最低"
                className="bg-muted/50 border border-border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
              />
              <input
                type="number"
                value={budgetMax}
                onChange={e => setBudgetMax(e.target.value)}
                placeholder="最高"
                className="bg-muted/50 border border-border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
              />
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Deadline */}
          <div className="space-y-3">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              截止时间
            </label>
            <select
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none appearance-none transition-all"
            >
              {DEADLINE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={applyFilters}
            className="w-full bg-gradient-to-br from-primary to-[#0047ab] text-white font-bold py-3 rounded-xl shadow-md hover:shadow-primary/30 active:scale-[0.98] transition-all text-sm"
          >
            应用筛选
          </button>
        </div>
      </aside>

      {/* Main */}
      <section className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-primary font-display">订单大厅</h1>
            <p className="text-muted-foreground mt-2 font-medium text-sm">
              共 <span className="text-foreground font-bold">{data?.total ?? "—"}</span> 个活跃匹配机会
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

        {/* Cards */}
        {isLoading ? (
          <div className={viewMode === "grid" ? "grid grid-cols-1 xl:grid-cols-2 gap-6" : "space-y-3"}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 bg-muted/50 rounded-2xl animate-pulse border border-border/30" />
            ))}
          </div>
        ) : !data?.items?.length ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mb-4 text-2xl">📭</div>
            <h3 className="text-lg font-bold text-foreground mb-2">暂无匹配需求</h3>
            <p className="text-muted-foreground text-sm mb-6">请尝试调整筛选条件</p>
            <button
              onClick={() => {
                setSelectedTypes([]);
                setSelectedLevel("");
                setBudgetMin("");
                setBudgetMax("");
                setDeadline("");
                setAppliedFilters({ page: 1, limit: 8, status: "published" as ListDemandsStatus, sortBy: "newest" });
              }}
              className="px-5 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary hover:text-white transition-colors text-sm"
            >
              清除筛选
            </button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {data.items.map(demand => (
              <MarketplaceCard key={demand.id} demand={demand} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map(demand => (
              <MarketplaceListRow key={demand.id} demand={demand} />
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
