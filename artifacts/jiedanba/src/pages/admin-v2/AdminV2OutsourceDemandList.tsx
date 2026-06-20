import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Plus, Search, Loader2, ChevronRight, Clock, Network, Users2 } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import { hasUnread } from "@/lib/demandRead";

interface OutsourceDemand {
  id: number;
  demandNo: string;
  title: string;
  demandType: string | null;
  isUrgent: boolean;
  mode: string;
  clientDemandId: number | null;
  status: string;
  tenderCount?: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  negotiating:  { label: "招标中", color: "bg-blue-100 text-blue-700" },
  executing:    { label: "执行中", color: "bg-green-100 text-green-700" },
  warranty:     { label: "质保中", color: "bg-teal-100 text-teal-700" },
  completed:    { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
  closed:       { label: "已关闭", color: "bg-red-100 text-red-500" },
};

const STATUS_TABS = [
  { value: "", label: "全部" },
  { value: "negotiating", label: "招标中" },
  { value: "executing", label: "执行中" },
  { value: "warranty", label: "质保中" },
  { value: "completed", label: "已完成" },
];

export default function AdminV2OutsourceDemandList() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const [items, setItems] = useState<OutsourceDemand[]>([]);
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
      const data = await v2Get<{ items: OutsourceDemand[]; total: number }>(`/outsource-demands?${params}`);
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminV2Layout
      title="外包需求"
      actions={
        <button onClick={() => navigate("/admin/v2/outsource-demands/new")}
          className="flex items-center gap-1.5 bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20">
          <Plus size={15} /> 新建外包需求
        </button>
      }
    >
      <div className="mt-6 space-y-5">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <form onSubmit={e => { e.preventDefault(); setSearch(searchInput.trim()); }}
            className="flex gap-2 flex-1 max-w-sm">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="搜索外包需求标题…"
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
          <div className="text-center py-16 text-slate-400 text-sm">
            <p>暂无外包需求</p>
            <button onClick={() => navigate("/admin/v2/outsource-demands/new")}
              className="mt-4 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
              新建外包需求
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(d => {
              const cfg = STATUS_CONFIG[d.status] ?? { label: d.status, color: "bg-slate-100 text-slate-500" };
              return (
                <button key={d.id} onClick={() => inlineNav ? inlineNav.push(`/admin/v2/outsource-demands/${d.id}`) : navigate(`/admin/v2/outsource-demands/${d.id}`)}
                  className="w-full text-left flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-white transition-all hover:shadow-md hover:border-primary/20 group">
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                    <Network size={18} className="text-violet-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-slate-400 px-2 py-0.5 rounded-full bg-slate-50">
                        {d.mode === "public" ? "公开抢单" : "指定邀请"}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">{d.demandNo}</span>
                      {hasUnread("outsource", d.id, d.updatedAt) && (
                        <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="有新动态" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate">{d.title}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                      {d.clientDemandId && <span className="flex items-center gap-1"><Users2 size={11} />关联客户需求 #{d.clientDemandId}</span>}
                      <span className="flex items-center gap-1"><Clock size={11} />{new Date(d.updatedAt).toLocaleDateString("zh-CN")}</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-primary shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AdminV2Layout>
  );
}
