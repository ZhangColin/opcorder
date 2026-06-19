import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Search, Loader2, AlertCircle, Clock, ChevronRight, Tag,
  Zap, Plus, CheckCircle2,
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
  updatedAt: string;
}

interface PagedResponse {
  total: number;
  page: number;
  limit: number;
  items: DemandItem[];
}

const DEMAND_TYPE_LABELS: Record<string, string> = {
  education: "教育培训",
  software: "软件开发",
  marketing: "营销",
  content: "内容设计",
  other: "其他",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  negotiating: { label: "洽谈中", color: "bg-blue-100 text-blue-700" },
  executing:   { label: "执行中", color: "bg-amber-100 text-amber-700" },
  completed:   { label: "已完成", color: "bg-green-100 text-green-700" },
  closed:      { label: "已关闭", color: "bg-slate-100 text-slate-500" },
};

function formatBudgetRange(min: number | null, max: number | null) {
  if (!min && !max) return "面议";
  if (min && max) return `¥${min.toLocaleString()} - ¥${max.toLocaleString()}`;
  if (min) return `¥${min.toLocaleString()} 起`;
  if (max) return `最高 ¥${max.toLocaleString()}`;
  return "面议";
}

export default function OpcV2DemandHall() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [applying, setApplying] = useState<number | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const { data, isLoading, isError, refetch } = useQuery<PagedResponse>({
    queryKey: ["v2-opc-demand-hall", search, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: "20", status: "negotiating" });
      if (search) params.set("search", search);
      return v2Get(`/outsource-demands?${params}`);
    },
  });

  const demands = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  async function handleApply(demandId: number, title: string) {
    setApplying(demandId);
    try {
      await v2Post(`/outsource-demands/${demandId}/apply`);
      setApplied(prev => new Set([...prev, demandId]));
      toast({ title: "报名成功", description: `已报名「${title}」，等待平台安排洽谈` });
      qc.invalidateQueries({ queryKey: ["v2-opc-tenders-home"] });
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
              const statusCfg = STATUS_CONFIG[demand.status] ?? { label: demand.status, color: "bg-slate-100 text-slate-500" };
              const alreadyApplied = applied.has(demand.id);
              return (
                <div
                  key={demand.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all overflow-hidden"
                >
                  <div className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
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
                        <h3 className="font-bold text-base text-slate-800 mb-1 leading-snug">
                          {demand.title}
                        </h3>
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-1">
                          <span>预算 {formatBudgetRange(demand.expectedPriceMin, demand.expectedPriceMax)}</span>
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {new Date(demand.createdAt).toLocaleDateString("zh-CN")} 发布
                          </span>
                          <span>{demand.tenderCount} 人报名</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        {alreadyApplied ? (
                          <span className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                            <CheckCircle2 size={13} /> 已报名
                          </span>
                        ) : demand.mode === "public" && demand.status === "negotiating" ? (
                          <button
                            onClick={() => handleApply(demand.id, demand.title)}
                            disabled={applying === demand.id}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800 transition-colors disabled:opacity-60"
                          >
                            {applying === demand.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Plus size={13} />
                            )}
                            立即报名
                          </button>
                        ) : demand.mode === "invited" ? (
                          <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold">
                            邀请制
                          </span>
                        ) : null}
                        <button
                          onClick={() => navigate(`/opc/tenders`)}
                          className="flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-emerald-700 transition-colors"
                        >
                          查看我的投标 <ChevronRight size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
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
    </OpcV2Layout>
  );
}
