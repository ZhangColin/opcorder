import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Plus, Search, Loader2, Zap, Clock, ChevronRight,
  FileText, TrendingUp, AlertCircle,
} from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
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

const STATUS_CONFIG: Record<string, { label: string; badge: string; accent: string; dot: string }> = {
  draft:            { label: "草稿",   badge: "bg-slate-100 text-slate-500",   accent: "border-l-slate-300",   dot: "bg-slate-300" },
  negotiating:      { label: "沟通中", badge: "bg-blue-100 text-blue-700",     accent: "border-l-blue-400",    dot: "bg-blue-400" },
  quoting:          { label: "报价中", badge: "bg-amber-100 text-amber-700",   accent: "border-l-amber-400",   dot: "bg-amber-400" },
  pending_contract: { label: "待签约", badge: "bg-orange-100 text-orange-700", accent: "border-l-orange-400",  dot: "bg-orange-400" },
  executing:        { label: "执行中", badge: "bg-indigo-100 text-indigo-700", accent: "border-l-indigo-500",  dot: "bg-indigo-500" },
  warranty:         { label: "质保中", badge: "bg-teal-100 text-teal-700",     accent: "border-l-teal-400",    dot: "bg-teal-400" },
  completed:        { label: "已完成", badge: "bg-emerald-100 text-emerald-700",accent: "border-l-emerald-400", dot: "bg-emerald-400" },
  closed:           { label: "已关闭", badge: "bg-slate-100 text-slate-400",   accent: "border-l-slate-200",   dot: "bg-slate-300" },
};

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "negotiating", label: "沟通中" },
  { value: "quoting", label: "报价中" },
  { value: "pending_contract", label: "待签约" },
  { value: "executing", label: "执行中" },
  { value: "warranty", label: "质保中" },
  { value: "completed", label: "已完成" },
  { value: "draft", label: "草稿" },
];

function fmtBudget(min: number | null, max: number | null) {
  if (!min && !max) return null;
  const fmt = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(n % 10000 === 0 ? 0 : 1)}万` : n.toLocaleString();
  if (min && max) return `¥${fmt(min)} – ${fmt(max)}`;
  if (min) return `¥${fmt(min)}+`;
  return null;
}

export default function PubDemandList() {
  const [, navigate] = useLocation();
  const [demands, setDemands] = useState<ClientDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const data = await v2Get<{ items: ClientDemand[] }>(`/client-demands?${params}`);
      setDemands(data.items);
    } catch {
      setDemands([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const sorted = [...demands].sort((a, b) =>
    (hasUnread("client", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("client", a.id, a.updatedAt) ? 1 : 0)
  );

  return (
    <PubLayout
      title="需求管理"
      actions={
        <button
          onClick={() => navigate("/pub/demands/new")}
          className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200"
        >
          <Plus size={15} /> 发布新需求
        </button>
      }
    >
      <div className="mt-5 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  statusFilter === tab.value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSearch} className="flex gap-2 sm:ml-auto">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="搜索需求标题…"
                className="bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 w-44"
              />
            </div>
            <button type="submit" className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors font-medium">搜索</button>
          </form>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <FileText size={28} className="text-indigo-300" />
            </div>
            <p className="text-base font-semibold text-slate-500">暂无需求</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">发布新需求，开启合作</p>
            <button
              onClick={() => navigate("/pub/demands/new")}
              className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-indigo-700 transition-colors"
            >
              <Plus size={14} /> 立即发布
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sorted.map(d => {
              const cfg = STATUS_CONFIG[d.status] ?? { label: d.status, badge: "bg-slate-100 text-slate-500", accent: "border-l-slate-300", dot: "bg-slate-300" };
              const budget = fmtBudget(d.budgetMin, d.budgetMax);
              const unread = hasUnread("client", d.id, d.updatedAt);
              const isClosed = d.status === "closed";
              return (
                <div
                  key={d.id}
                  onClick={() => navigate(`/pub/demands/${d.id}`)}
                  className={`bg-white rounded-2xl border border-slate-100 border-l-4 ${cfg.accent} p-5 cursor-pointer
                    hover:shadow-md hover:-translate-y-0.5 transition-all group
                    ${d.isUrgent ? "bg-red-50/40 border-slate-100" : ""}
                    ${isClosed ? "opacity-60" : ""}
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Top row: status + urgent + unread */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                        {d.isUrgent && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                            <Zap size={9} /> 紧急
                          </span>
                        )}
                        {unread && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> 新动态
                          </span>
                        )}
                      </div>
                      {/* Title */}
                      <h3 className="text-[15px] font-bold text-slate-800 leading-snug mb-2.5 group-hover:text-indigo-700 transition-colors">
                        {d.title}
                      </h3>
                      {/* Footer row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-[11px] text-slate-300 font-mono">{d.demandNo}</span>
                        {budget && (
                          <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <TrendingUp size={10} /> {budget}
                          </span>
                        )}
                        {d.demandType && (
                          <span className="text-[11px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{d.demandType}</span>
                        )}
                        <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto">
                          <Clock size={10} /> {new Date(d.updatedAt).toLocaleDateString("zh-CN")}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 shrink-0 mt-1 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PubLayout>
  );
}
