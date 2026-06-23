import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Plus, Search, Loader2, Zap, ChevronRight, FileText } from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { Pagination } from "@/components/pub/Pagination";
import { v2Get } from "@/lib/v2api";
import { hasUnread } from "@/lib/demandRead";

interface ClientDemand {
  id: number;
  demandNo: string;
  title: string;
  demandType: string | null;
  isUrgent: boolean;
  budgetMin: number | null;
  budgetMax: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  draft:            { label: "草稿",   cls: "bg-slate-100 text-slate-500" },
  negotiating:      { label: "沟通中", cls: "bg-blue-100 text-blue-700" },
  quoting:          { label: "报价中", cls: "bg-amber-100 text-amber-700" },
  pending_contract: { label: "待签约", cls: "bg-orange-100 text-orange-700" },
  executing:        { label: "执行中", cls: "bg-indigo-100 text-indigo-700" },
  warranty:         { label: "质保中", cls: "bg-teal-100 text-teal-700" },
  completed:        { label: "已完成", cls: "bg-emerald-100 text-emerald-700" },
  closed:           { label: "已关闭", cls: "bg-slate-100 text-slate-400" },
};

const DEMAND_TYPE_LABELS: Record<string, string> = {
  CG: "内容生成", SA: "软件系统与智能体", TK: "培训与知识产品", BO: "商业运营", OTHER: "其他",
  education: "教育培训", software: "软件开发", marketing: "市场营销", content: "内容设计", other: "其他",
  ai_education: "AI 教育", gov_training: "政务培训", ai_research: "AI 研究",
  party_building: "党建", livestream_media: "直播媒体", ai_tool_dev: "AI 工具",
};

const TABS = [
  { value: "negotiating",      label: "沟通中" },
  { value: "quoting",          label: "报价中" },
  { value: "pending_contract", label: "待签约" },
  { value: "executing",        label: "执行中" },
  { value: "warranty",         label: "质保中" },
  { value: "completed",        label: "已完成" },
  { value: "draft",            label: "草稿" },
  { value: "",                 label: "全部" },
];

const PAGE_SIZE = 10;

function fmtBudget(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const f = (n: number) => n >= 10000 ? `¥${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万` : `¥${n.toLocaleString()}`;
  if (min && max) return `${f(min)} – ${f(max)}`;
  if (min) return `${f(min)} 起`;
  return null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export default function PubDemandList() {
  const [, navigate] = useLocation();
  const [demands, setDemands] = useState<ClientDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("negotiating");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (search) params.set("search", search);
      const data = await v2Get<{ items: ClientDemand[] }>(`/client-demands?${params}`);
      setDemands(data.items);
    } catch { setDemands([]); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [statusFilter, search]);

  const counts: Record<string, number> = { "": demands.length };
  for (const t of TABS) {
    if (t.value) counts[t.value] = demands.filter(d => d.status === t.value).length;
  }

  const filtered = statusFilter ? demands.filter(d => d.status === statusFilter) : demands;
  const sorted = [...filtered].sort((a, b) =>
    (hasUnread("client", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("client", a.id, a.updatedAt) ? 1 : 0)
  );
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PubLayout
      title="需求管理"
      actions={
        <button
          onClick={() => navigate("/pub/demands/new")}
          className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-indigo-700 transition-colors"
        >
          <Plus size={15} /> 发布新需求
        </button>
      }
    >
      <div className="mt-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex gap-1.5 flex-wrap">
            {TABS.map(t => {
              const cnt = counts[t.value] ?? 0;
              const active = statusFilter === t.value;
              return (
                <button key={t.value} onClick={() => setStatusFilter(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                    active
                      ? "bg-indigo-600 text-white"
                      : "bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
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
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }} className="flex gap-2 sm:ml-auto">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="搜索需求标题…"
                className="bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 w-44" />
            </div>
            <button type="submit" className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:border-indigo-300 hover:text-indigo-600 font-medium">搜索</button>
          </form>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : paged.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-100">
            <FileText size={36} className="text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-500">暂无需求</p>
            <button onClick={() => navigate("/pub/demands/new")}
              className="mt-4 flex items-center gap-1.5 bg-indigo-600 text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-indigo-700 transition-colors">
              <Plus size={14} /> 立即发布
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paged.map(d => {
                const cfg = STATUS_CONFIG[d.status] ?? { label: d.status, cls: "bg-slate-100 text-slate-500" };
                const budget = fmtBudget(d.budgetMin, d.budgetMax);
                const typeLabel = d.demandType ? (DEMAND_TYPE_LABELS[d.demandType] ?? d.demandType) : null;
                const unread = hasUnread("client", d.id, d.updatedAt);

                return (
                  <div key={d.id} onClick={() => navigate(`/pub/demands/${d.id}`)}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group px-5 py-4">
                    <div className="flex items-start justify-between gap-4 mb-2.5">
                      <p className="text-[15px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors leading-snug flex-1 min-w-0 truncate">
                        {d.title}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {unread && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                        {d.isUrgent && (
                          <span className="flex items-center gap-0.5 text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full">
                            <Zap size={9} fill="currentColor" /> 紧急
                          </span>
                        )}
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                      </div>
                    </div>
                    <div className="flex items-end gap-6 text-xs flex-wrap">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">需求编号</p>
                        <p className="font-mono text-slate-600">{d.demandNo}</p>
                      </div>
                      {typeLabel && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">需求类型</p>
                          <p className="text-slate-600">{typeLabel}</p>
                        </div>
                      )}
                      {budget ? (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">预算范围</p>
                          <p className="font-semibold text-slate-700">{budget}</p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">预算范围</p>
                          <p className="text-slate-400">面议</p>
                        </div>
                      )}
                      <div className="ml-auto">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">最近更新</p>
                        <p className="text-slate-500">{fmtDate(d.updatedAt)}</p>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
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
