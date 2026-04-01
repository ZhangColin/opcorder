import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Search, Bell,
  Star, TrendingUp, ChevronsRight, Banknote, CircleDollarSign,
  User, BarChart2,
  Menu,
} from "lucide-react";
import { PublisherSidebar } from "@/components/publisher/PublisherSidebar";
import { PublisherHeaderUser } from '@/components/publisher/PublisherHeaderUser';
import {
  useListDemands,
  useGetOpcLeaderboard,
  useGetOverviewStats,
} from "@workspace/api-client-react";
import { useCurrentUser } from "@/hooks/use-current-user";

/* ─── Constants ───────────────────────────────── */

const DEMAND_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:             { label: "草稿",   cls: "bg-slate-100 text-slate-500" },
  pending_review:    { label: "待审核", cls: "bg-amber-50 text-amber-700" },
  published:         { label: "招募中", cls: "bg-amber-50 text-amber-700" },
  open:              { label: "招募中", cls: "bg-amber-50 text-amber-700" },
  matched:           { label: "已匹配", cls: "bg-cyan-50 text-cyan-700" },
  in_progress:       { label: "进行中", cls: "bg-blue-50 text-blue-700" },
  pending_acceptance:{ label: "待验收", cls: "bg-purple-50 text-purple-700" },
  completed:         { label: "已完成", cls: "bg-green-50 text-green-700" },
  closed:            { label: "已关闭", cls: "bg-slate-100 text-slate-500" },
};

function statusProgress(status: string, idx: number): number {
  if (status === "completed" || status === "pending_acceptance") return 100;
  if (status === "in_progress") return [65, 42, 78, 55, 30][idx % 5];
  return 0;
}

type DemandFilter = "all" | "open" | "in_progress";

/* ─── Page ────────────────────────────────────── */

export default function PublisherHome() {
  const [, navigate] = useLocation();
  const [demandFilter, setDemandFilter] = useState<DemandFilter>("all");

  const { userId, nickname } = useCurrentUser();

  const { data: stats }        = useGetOverviewStats();
  const { data: demandsData }  = useListDemands({
    status: demandFilter === "all" ? undefined : demandFilter === "open" ? "published" as any : (demandFilter as any),
    publisherId: userId || undefined,
    page: 1, limit: 6,
  });
  const { data: leaderboard }  = useGetOpcLeaderboard({ limit: 5 });

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logout = () => {
    localStorage.removeItem("jdb_role");
    localStorage.removeItem("jdb_user_id");
    localStorage.removeItem("jdb_nickname");
    navigate("/login");
  };

  // Pre-map leaderboard users for demand table OPC assignment
  const opcList = leaderboard ?? [];

  return (
    <div className="flex min-h-screen bg-[#f9f9fc] text-[#1a1c1e]">

      <PublisherSidebar onLogout={logout} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      {/* ══════════════════ MAIN ══════════════════ */}
      <main className="flex-1 md:ml-64 min-h-screen">

        {/* Top bar */}
        <header className="fixed top-0 right-0 md:left-64 left-0 z-40 bg-white/80 backdrop-blur-md shadow-sm flex items-center px-4 md:px-8 py-3 gap-2">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden shrink-0 p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Menu size={20} />
          </button>

          <div className="relative w-full max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索需求 ID、人才、结算记录…"
              className="w-full bg-slate-100 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-4 ml-6">
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors" onClick={() => navigate("/publisher/notifications")}>
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
            </button>
            <PublisherHeaderUser onLogout={logout} />
          </div>
        </header>

        {/* Body */}
        <div className="pt-16 px-4 md:px-8 pb-12 space-y-10">

          {/* ── Welcome + Stats ── */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-7 bg-white p-8 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="relative z-10">
                <h1 className="font-display text-3xl font-extrabold text-primary mb-2 tracking-tight">
                  欢迎回来，{nickname || "发单方"}
                </h1>
                <p className="text-slate-500 max-w-md mb-8 leading-relaxed">
                  您的项目生态运转高效。今日有{" "}
                  <span className="text-primary font-bold">3 个</span>{" "}
                  质检审核待处理。
                </p>
                <div className="flex gap-3 flex-wrap">
                  <button onClick={() => navigate("/publisher/demands")} className="bg-primary text-white px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95">
                    查看进行中的项目
                  </button>
                  <button onClick={() => navigate("/publisher/cockpit")} className="bg-slate-100 text-primary px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all">
                    审计日志
                  </button>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-blue-50 to-transparent pointer-events-none" />
              <BarChart2 size={120} className="absolute -bottom-6 -right-6 text-slate-100/60 rotate-12 group-hover:rotate-0 transition-transform duration-700" />
            </div>

            <div className="col-span-12 lg:col-span-5 grid grid-cols-2 gap-4">
              <div className="col-span-2 bg-primary/5 p-6 rounded-2xl border-l-4 border-primary">
                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">资金托管余额</p>
                <div className="flex items-end gap-2">
                  <span className="text-3xl font-extrabold text-blue-900">
                    ¥{((stats?.totalSettlements ?? 107000) + 1141500).toLocaleString()}
                  </span>
                  <span className="text-secondary text-xs font-bold mb-1 flex items-center gap-0.5">
                    <TrendingUp size={12} /> +12%
                  </span>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">活跃需求</p>
                <p className="text-2xl font-extrabold text-blue-900">
                  {stats?.activeDemands ?? demandsData?.total ?? 42}
                </p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">累计支出</p>
                <p className="text-2xl font-extrabold text-blue-900">
                  ¥{((stats?.totalSettlements ?? 107000) / 1000).toFixed(1)}万
                </p>
              </div>
            </div>
          </div>

          {/* ── AI Talent Recommendations ── */}
          <section>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-bold text-blue-900 font-display flex items-center gap-2">
                  <Star size={18} className="text-secondary fill-secondary" />
                  AI 智能 OPC 推荐
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">根据您当前的需求自动匹配最优人才</p>
              </div>
              <span className="text-sm font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer">
                查看全部匹配 <ChevronsRight size={16} />
              </span>
            </div>

            <div className="flex gap-5 overflow-x-auto pb-3 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
              {opcList.slice(0, 5).map((u, i) => {
                const matchPct = [98, 94, 91, 87, 85][i] ?? 85;
                const skills = [
                  ["AI 教育", "课程设计", "提示词工程"],
                  ["系统架构", "政企合规", "大模型"],
                  ["Web 开发", "Vibe Coding", "AI 工具"],
                  ["数据分析", "Python", "可视化"],
                  ["云原生", "Docker", "安全合规"],
                ][i] ?? ["AI 开发"];
                const initials = (u.nickname ?? "OC").slice(0, 2);
                const levelLabel = (u as any).level === "A" ? "Lv.A" : (u as any).level === "B" ? "Lv.B" : (u as any).level === "C" ? "Lv.C" : "新手";
                return (
                  <div
                    key={u.id}
                    className="min-w-[300px] bg-white p-5 rounded-2xl shadow-sm border border-transparent hover:border-secondary/30 transition-all group cursor-pointer shrink-0"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-slate-50 shadow-sm flex items-center justify-center font-bold text-primary text-sm">
                          {initials}
                        </div>
                        <div>
                          <h4 className="font-bold text-blue-900 text-sm">{u.nickname}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="bg-[#4dffb2] text-[#002112] text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide">
                              {levelLabel}
                            </span>
                            <div className="flex items-center gap-0.5">
                              <Star size={10} className="text-amber-400 fill-amber-400" />
                              <span className="text-xs font-bold text-slate-600">
                                {(u as any).avgRating ?? "4.9"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <span className="bg-secondary/10 text-secondary text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap">
                        {matchPct}% 匹配
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {skills.map(s => (
                        <span key={s} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {s}
                        </span>
                      ))}
                    </div>
                    <button className="w-full bg-slate-50 text-primary group-hover:bg-primary group-hover:text-white py-2.5 rounded-xl text-xs font-bold transition-colors">
                      邀请接单
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Bottom Grid ── */}
          <div className="grid grid-cols-12 gap-6">

            {/* Active Demands Table — matches reference design columns */}
            <div className="col-span-12 xl:col-span-8">
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-blue-900">需求进度追踪</h3>
                  <div className="flex gap-2">
                    {(["all", "open", "in_progress"] as DemandFilter[]).map(f => (
                      <button
                        key={f}
                        onClick={() => setDemandFilter(f)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                          demandFilter === f
                            ? "bg-primary text-white"
                            : "bg-slate-50 text-slate-500 hover:text-primary"
                        }`}
                      >
                        {f === "all" ? "全部" : f === "open" ? "招募中" : "进行中"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-50">
                        <th className="px-4 py-3">ID / 需求标题</th>
                        <th className="px-4 py-3">负责 OPC</th>
                        <th className="px-4 py-3">进度</th>
                        <th className="px-4 py-3 text-right">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50/50">
                      {demandsData?.items?.slice(0, 5).map((d, idx) => {
                        const statusInfo = DEMAND_STATUS_LABELS[d.status] ?? { label: d.status, cls: "bg-slate-100 text-slate-500" };
                        const pct = statusProgress(d.status, idx);
                        const hasOpc = d.status === "in_progress" || d.status === "pending_acceptance" || d.status === "completed";
                        const assignedOpc = hasOpc ? opcList[idx % Math.max(opcList.length, 1)] : null;
                        const opcInitials = assignedOpc ? (assignedOpc.nickname ?? "OC").slice(0, 2) : null;

                        return (
                          <tr key={d.id} className="group hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => navigate(`/publisher/demand/${d.id}`)}>
                            {/* ID / Title */}
                            <td className="px-4 py-4">
                              <p className="text-[10px] font-bold text-slate-400 font-mono">
                                {d.demandNo ?? `#JDB-${String(d.id).padStart(4, "0")}`}
                              </p>
                              <p className="text-sm font-bold text-blue-900 group-hover:text-primary transition-colors line-clamp-1">
                                {d.title}
                              </p>
                            </td>

                            {/* Assigned OPC */}
                            <td className="px-4 py-4">
                              {assignedOpc ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-900 shrink-0">
                                    {opcInitials}
                                  </div>
                                  <span className="text-sm font-medium text-slate-700 truncate max-w-[80px]">
                                    {assignedOpc.nickname}
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                                    <User size={12} className="text-slate-400" />
                                  </div>
                                  <span className="text-sm text-slate-400 italic">未分配</span>
                                </div>
                              )}
                            </td>

                            {/* Progress */}
                            <td className="px-4 py-4">
                              <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="bg-secondary h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-slate-400 font-bold mt-1 inline-block">
                                {pct}% 已完成
                              </span>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-4 text-right">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${statusInfo.cls}`}>
                                {statusInfo.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {!demandsData?.items?.length && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">
                            暂无需求数据
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right: Metrics + Activity */}
            <div className="col-span-12 xl:col-span-4 flex flex-col gap-5">

              {/* Operational Efficiency */}
              <div className="bg-white p-6 rounded-2xl shadow-sm">
                <h3 className="font-display text-sm font-extrabold text-blue-900 mb-6 uppercase tracking-wider">
                  运营效率
                </h3>
                <div className="space-y-5">
                  {[
                    { label: "项目完成率",   value: "98.2%", pct: 98,  color: "bg-secondary" },
                    { label: "平均匹配时长",  value: "4.2 小时", pct: 40, color: "bg-primary" },
                  ].map(m => (
                    <div key={m.label}>
                      <div className="flex justify-between items-end mb-2">
                        <p className="text-xs font-bold text-slate-500">{m.label}</p>
                        <p className={`text-lg font-extrabold ${m.color === "bg-secondary" ? "text-secondary" : "text-blue-900"}`}>
                          {m.value}
                        </p>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`${m.color} h-full rounded-full`} style={{ width: `${m.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white p-6 rounded-2xl shadow-sm flex-1">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display text-sm font-extrabold text-blue-900 uppercase tracking-wider">
                    最近动态
                  </h3>
                  <button className="text-[10px] font-bold text-primary hover:underline">查看全部</button>
                </div>
                <div className="space-y-3">
                  {[
                    { icon: Banknote,         label: "向张明远付款",  sub: "需求 #HKY-0001", amount: "¥ 12,500",  time: "2 小时前", positive: false },
                    { icon: CircleDollarSign, label: "资金托管充值",  sub: "机构转账",        amount: "+ ¥ 50万",   time: "昨天",     positive: true  },
                    { icon: Banknote,         label: "向李思齐付款",  sub: "需求 #HKY-0012", amount: "¥ 8,400",   time: "2 天前",   positive: false },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                        <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                          <Icon size={16} className="text-secondary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-blue-900 truncate">{item.label}</p>
                          <p className="text-[10px] text-slate-400">{item.sub}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-extrabold ${item.positive ? "text-secondary" : "text-blue-900"}`}>
                            {item.amount}
                          </p>
                          <p className="text-[10px] text-slate-400">{item.time}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
