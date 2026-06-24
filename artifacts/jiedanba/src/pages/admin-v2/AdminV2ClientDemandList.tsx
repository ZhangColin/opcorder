import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, Loader2, ChevronRight, Zap } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import { hasUnread } from "@/lib/demandRead";

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
  { value: "negotiating",      label: "沟通中" },
  { value: "quoting",          label: "报价中" },
  { value: "pending_contract", label: "待签约" },
  { value: "executing",        label: "执行中" },
  { value: "warranty",         label: "质保中" },
  { value: "completed",        label: "已完成" },
  { value: "closed",           label: "已关闭" },
  { value: "",                 label: "全部" },
];

const HIGHLIGHT_STATUSES = ["negotiating", "quoting"];

export default function AdminV2ClientDemandList() {
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const [items, setItems] = useState<ClientDemand[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("negotiating");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (search) params.set("search", search);
      const data = await v2Get<{ items: ClientDemand[]; total: number }>(`/client-demands?${params}`);
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const highlighted = items.filter(d => HIGHLIGHT_STATUSES.includes(d.status));
  const counts = STATUS_TABS.reduce((acc, tab) => {
    acc[tab.value] = tab.value === "" ? items.length : items.filter(d => d.status === tab.value).length;
    return acc;
  }, {} as Record<string, number>);
  const displayed = statusFilter === "" ? items : items.filter(d => d.status === statusFilter);

  return (
    <AdminV2Layout title="客户需求">
      <div className="mt-6 space-y-5">
        {highlighted.length > 0 && !statusFilter && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 mb-2">⚡ 待处理（{highlighted.length} 件）</p>
            <div className="flex flex-wrap gap-2">
              {highlighted.map(d => (
                <button key={d.id} onClick={() => inlineNav ? inlineNav.push(`/admin/v2/client-demands/${d.id}`) : navigate(`/admin/v2/client-demands/${d.id}`)}
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
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5 ${
                statusFilter === tab.value ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-500 hover:border-primary/30"
              }`}>
              {tab.label}
              {counts[tab.value] > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  statusFilter === tab.value ? "bg-white/20" : "bg-slate-100 text-slate-500"
                }`}>{counts[tab.value]}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-primary" /></div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">暂无需求</div>
        ) : (
          <div className="space-y-2">
            {[...displayed].sort((a, b) =>
              (hasUnread("client", b.id, b.updatedAt) ? 1 : 0) - (hasUnread("client", a.id, a.updatedAt) ? 1 : 0)
            ).map(d => {
              const cfg = STATUS_CONFIG[d.status] ?? { label: d.status, color: "bg-slate-100 text-slate-500" };
              const needsAttention = HIGHLIGHT_STATUSES.includes(d.status);
              const go = () => inlineNav ? inlineNav.push(`/admin/v2/client-demands/${d.id}`) : navigate(`/admin/v2/client-demands/${d.id}`);
              return (
                <button key={d.id} onClick={go}
                  className={`w-full text-left rounded-2xl border shadow-sm p-4 transition-all hover:-translate-y-0.5 hover:shadow-md group ${
                    needsAttention ? "bg-amber-50/40 border-amber-200" : "bg-white border-slate-100"
                  }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[15px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                      {d.title}
                      {d.isUrgent && <Zap size={13} className="text-red-500 shrink-0" />}
                      {hasUnread("client", d.id, d.updatedAt) && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                    </span>
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex gap-4 flex-1 min-w-0 flex-wrap">
                      {d.publisherNickname && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">发单方</p>
                          <p className="text-sm text-slate-600">{d.publisherNickname}</p>
                        </div>
                      )}
                      {d.budgetMin != null && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">预算</p>
                          <p className="text-sm text-slate-600">¥{d.budgetMin.toLocaleString()}{d.budgetMax ? `~${d.budgetMax.toLocaleString()}` : "+"}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">编号</p>
                        <p className="text-sm text-slate-500 font-mono">{d.demandNo}</p>
                      </div>
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
