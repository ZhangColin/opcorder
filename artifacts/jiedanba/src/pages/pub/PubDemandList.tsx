import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Plus, Search, Loader2, AlertCircle, Zap, Clock, ChevronRight } from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { v2Get } from "@/lib/v2api";

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

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:            { label: "草稿",   color: "bg-slate-100 text-slate-500" },
  negotiating:      { label: "沟通中", color: "bg-blue-100 text-blue-700" },
  quoting:          { label: "报价中", color: "bg-amber-100 text-amber-700" },
  pending_contract: { label: "待签约", color: "bg-orange-100 text-orange-700" },
  executing:        { label: "执行中", color: "bg-green-100 text-green-700" },
  warranty:         { label: "质保中", color: "bg-teal-100 text-teal-700" },
  completed:        { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
  closed:           { label: "已关闭", color: "bg-red-100 text-red-500" },
};

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "draft", label: "草稿" },
  { value: "negotiating", label: "沟通中" },
  { value: "quoting", label: "报价中" },
  { value: "pending_contract", label: "待签约" },
  { value: "executing", label: "执行中" },
  { value: "warranty", label: "质保中" },
  { value: "completed", label: "已完成" },
];

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

  return (
    <PubLayout
      title="需求管理"
      actions={
        <button
          onClick={() => navigate("/pub/demands/new")}
          className="flex items-center gap-1.5 bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
        >
          <Plus size={15} /> 发布新需求
        </button>
      }
    >
      <div className="mt-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  statusFilter === tab.value
                    ? "bg-primary text-white"
                    : "bg-white border border-slate-200 text-slate-500 hover:border-primary hover:text-primary"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <form onSubmit={handleSearch} className="flex gap-2 ml-auto">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="搜索需求标题…"
                className="bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-48"
              />
            </div>
            <button type="submit" className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:border-primary hover:text-primary transition-colors font-medium">搜索</button>
          </form>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : demands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <AlertCircle size={36} className="mb-3 text-slate-300" />
            <p className="text-base font-medium">暂无需求</p>
            <button
              onClick={() => navigate("/pub/demands/new")}
              className="mt-4 flex items-center gap-1.5 bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              <Plus size={14} /> 立即发布
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {demands.map(d => {
              const cfg = STATUS_CONFIG[d.status] ?? { label: d.status, color: "bg-slate-100 text-slate-500" };
              return (
                <div
                  key={d.id}
                  onClick={() => navigate(`/pub/demands/${d.id}`)}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4 hover:border-primary/30 hover:shadow-sm cursor-pointer transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      {d.isUrgent && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
                          <Zap size={10} /> 紧急
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{d.demandNo}</span>
                    </div>
                    <h3 className="font-bold text-slate-800 truncate">{d.title}</h3>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                      {(d.budgetMin || d.budgetMax) && (
                        <span>预算：¥{d.budgetMin?.toLocaleString()} – ¥{d.budgetMax?.toLocaleString()}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {new Date(d.updatedAt).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PubLayout>
  );
}
