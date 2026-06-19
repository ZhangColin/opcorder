import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Plus, Search, Loader2, ChevronRight, Zap, Clock, AlertCircle, Users2 } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";

interface ClientDemand {
  id: number;
  demandNo: string;
  publisherId: number;
  publisherNickname: string | null;
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
  { value: "negotiating", label: "沟通中" },
  { value: "quoting", label: "报价中" },
  { value: "pending_contract", label: "待签约" },
  { value: "executing", label: "执行中" },
  { value: "warranty", label: "质保中" },
  { value: "completed", label: "已完成" },
  { value: "closed", label: "已关闭" },
];

const HIGHLIGHT_STATUSES = ["negotiating", "quoting"];

export default function AdminV2ClientDemandList() {
  const [, navigate] = useLocation();
  const [items, setItems] = useState<ClientDemand[]>([]);
  const [total, setTotal] = useState(0);
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
      const data = await v2Get<{ items: ClientDemand[]; total: number }>(`/client-demands?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const highlighted = items.filter(d => HIGHLIGHT_STATUSES.includes(d.status));

  return (
    <AdminV2Layout title="客户需求">
      <div className="mt-6 space-y-5">
        {highlighted.length > 0 && !statusFilter && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 mb-2">⚡ 待处理（{highlighted.length} 件）</p>
            <div className="flex flex-wrap gap-2">
              {highlighted.map(d => (
                <button key={d.id} onClick={() => navigate(`/admin/v2/client-demands/${d.id}`)}
                  className="text-xs bg-white border border-amber-200 rounded-xl px-3 py-1.5 font-medium text-amber-800 hover:bg-amber-100 transition-colors">
                  {d.title}
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${STATUS_CONFIG[d.status]?.color}`}>
                    {STATUS_CONFIG[d.status]?.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }}
            className="flex gap-2 flex-1 max-w-sm">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="搜索需求标题…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
            </div>
            <button type="submit" className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90">搜索</button>
          </form>
          <span className="text-xs text-slate-400">共 {total} 条</span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                statusFilter === tab.value ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-primary/30"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">暂无需求</div>
        ) : (
          <div className="space-y-2">
            {items.map(d => {
              const cfg = STATUS_CONFIG[d.status] ?? { label: d.status, color: "bg-slate-100 text-slate-500" };
              const needsAttention = HIGHLIGHT_STATUSES.includes(d.status);
              return (
                <button key={d.id} onClick={() => navigate(`/admin/v2/client-demands/${d.id}`)}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md group ${
                    needsAttention ? "bg-amber-50/60 border-amber-200" : "bg-white border-slate-100 hover:border-primary/20"
                  }`}>
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileTextIcon size={18} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      {d.isUrgent && <span className="text-xs font-bold text-red-500 flex items-center gap-0.5"><Zap size={10} />紧急</span>}
                      <span className="text-xs text-slate-400 font-mono">{d.demandNo}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">{d.title}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      <span className="flex items-center gap-1"><Users2 size={11} />{d.publisherNickname ?? "—"}</span>
                      {d.budgetMin != null && <span>预算 ¥{d.budgetMin.toLocaleString()}{d.budgetMax ? `~${d.budgetMax.toLocaleString()}` : "+"}</span>}
                      <span className="flex items-center gap-1"><Clock size={11} />{new Date(d.updatedAt).toLocaleDateString("zh-CN")}</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-primary transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AdminV2Layout>
  );
}

function FileTextIcon({ size, className }: { size: number; className?: string }) {
  return <AlertCircle size={size} className={className} />;
}
