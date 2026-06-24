import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Plus, Search, Loader2, ChevronRight, Zap, Package } from "lucide-react";
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
  clientDemandTitle: string | null;
  clientDemandNo: string | null;
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
      actions={
        <button onClick={() => inlineNav ? inlineNav.push("/admin/v2/outsource-demands/new") : navigate("/admin/v2/outsource-demands/new")}
          className="flex items-center gap-1.5 bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20">
          <Plus size={15} /> 新建 OPC 需求
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
                placeholder="搜索 OPC 需求标题…"
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
          <div className="flex flex-col items-center py-20 bg-white rounded-2xl border border-slate-200">
            <Package size={36} className="text-slate-300 mb-3" />
            <p className="text-base font-semibold text-slate-500">暂无 OPC 需求</p>
            <p className="text-xs text-slate-400 mt-1 mb-5">点击右上角「新建」发布外包需求</p>
            <button onClick={() => inlineNav ? inlineNav.push("/admin/v2/outsource-demands/new") : navigate("/admin/v2/outsource-demands/new")}
              className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20">
              <Plus size={14} /> 新建 OPC 需求
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {[...items].sort((a, b) =>
              (hasUnread("outsource", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("outsource", a.id, a.updatedAt) ? 1 : 0)
            ).map(d => {
              const cfg = STATUS_CONFIG[d.status] ?? { label: d.status, color: "bg-slate-100 text-slate-500" };
              const go = () => inlineNav ? inlineNav.push(`/admin/v2/outsource-demands/${d.id}`) : navigate(`/admin/v2/outsource-demands/${d.id}`);
              return (
                <button key={d.id} onClick={go}
                  className="w-full text-left bg-white rounded-2xl border border-slate-200 shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[15px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                      {d.title}
                      {d.isUrgent && <Zap size={13} className="text-red-500 shrink-0" />}
                      {hasUnread("outsource", d.id, d.updatedAt) && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </span>
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">编号</p>
                        <p className="text-sm text-slate-500 font-mono">{d.demandNo}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">模式</p>
                        <p className="text-sm text-slate-600">{d.mode === "public" ? "公开抢单" : "指定邀请"}</p>
                      </div>
                      {d.clientDemandTitle && (
                        <div className="min-w-0">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">关联客需</p>
                          <p className="text-sm text-slate-600 truncate max-w-[12rem]">
                            {d.clientDemandTitle}
                            {d.clientDemandNo && <span className="text-slate-400"> · {d.clientDemandNo}</span>}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">更新</p>
                        <p className="text-sm text-slate-600">{new Date(d.updatedAt).toLocaleDateString("zh-CN")}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-primary shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AdminV2Layout>
  );
}
