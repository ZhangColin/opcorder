import { useState } from "react";
import { clearSession } from "@/lib/auth";
import { useLocation } from "wouter";
import {
  ArrowLeft, TrendingUp, CreditCard, Clock, CheckCircle2,
  BarChart2, DollarSign, FileText, AlertCircle,
  Menu,
} from "lucide-react";
import { useListOrders, useGetCurrentUser } from "@workspace/api-client-react";
import { PublisherSidebar } from "@/components/publisher/PublisherSidebar";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-primary",
  bg = "bg-primary/8",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
  bg?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
        <Icon size={22} className={color} />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wide mb-1">{label}</p>
        <p className="text-2xl font-black text-foreground">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

const STATUS_MAP: Record<string, string> = {
  in_progress:        "进行中",
  pending_acceptance: "待验收",
  completed:          "已完成",
  disputed:           "争议中",
  closed:             "已关闭",
};

const STATUS_COLOR: Record<string, string> = {
  in_progress:        "bg-green-100 text-green-700",
  pending_acceptance: "bg-orange-100 text-orange-700",
  completed:          "bg-emerald-100 text-emerald-700",
  disputed:           "bg-red-100 text-red-600",
  closed:             "bg-slate-100 text-slate-500",
};

export default function PublisherFinance() {
  const [, navigate] = useLocation();
  const { data: currentUser } = useGetCurrentUser();
  const publisherId = currentUser?.id || undefined;
  const { data, isLoading } = useListOrders({ publisherId, limit: 200 });
  const orders = data?.items ?? [];
  const myOrders = orders;

  const totalSpend        = myOrders.reduce((s, o) => s + (o.amount ?? 0), 0);
  const completedOrders   = myOrders.filter(o => o.status === "completed");
  const inProgressOrders  = myOrders.filter(o => o.status === "in_progress" || o.status === "pending_acceptance");
  const disputedOrders    = myOrders.filter(o => o.status === "disputed");
  const completedSpend    = completedOrders.reduce((s, o) => s + (o.amount ?? 0), 0);
  const pendingSpend      = inProgressOrders.reduce((s, o) => s + (o.amount ?? 0), 0);

  const avgRating = completedOrders.length > 0
    ? completedOrders.filter(o => o.rating).reduce((s, o) => s + (o.rating ?? 0), 0) / completedOrders.filter(o => o.rating).length
    : 0;

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-[#f9f9fc] text-[#1a1c1e] overflow-x-hidden">
      <PublisherSidebar onLogout={logout} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      <main className="flex-1 lg:ml-64 min-h-screen">
        <header className="fixed top-0 right-0 lg:left-64 left-0 z-40 bg-white/80 backdrop-blur-md shadow-sm flex items-center px-4 lg:px-8 py-3 gap-2">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden shrink-0 p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/publisher")}
              className="flex items-center gap-2 text-slate-500 hover:text-primary text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} /> 返回工作台
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <h1 className="text-base font-extrabold text-blue-900 font-display flex items-center gap-2">
              <BarChart2 size={18} className="text-primary" /> 财务中心
            </h1>
          </div>
        </header>

        <div className="pt-16 pb-16 px-4 lg:px-8 max-w-[1280px] mx-auto space-y-8">

          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={DollarSign}
                  label="累计发单总额"
                  value={`¥${totalSpend.toLocaleString()}`}
                  sub={`共 ${myOrders.length} 笔订单`}
                  color="text-primary"
                  bg="bg-primary/8"
                />
                <StatCard
                  icon={CheckCircle2}
                  label="已完成金额"
                  value={`¥${completedSpend.toLocaleString()}`}
                  sub={`${completedOrders.length} 笔已结算`}
                  color="text-emerald-600"
                  bg="bg-emerald-50"
                />
                <StatCard
                  icon={Clock}
                  label="进行中金额"
                  value={`¥${pendingSpend.toLocaleString()}`}
                  sub={`${inProgressOrders.length} 笔执行中`}
                  color="text-amber-600"
                  bg="bg-amber-50"
                />
                <StatCard
                  icon={TrendingUp}
                  label="OPC 平均评分"
                  value={avgRating > 0 ? avgRating.toFixed(1) + " 分" : "暂无"}
                  sub={completedOrders.filter(o => o.rating).length > 0 ? `基于 ${completedOrders.filter(o => o.rating).length} 次评价` : "完成订单后可评分"}
                  color="text-amber-500"
                  bg="bg-amber-50"
                />
              </div>

              {/* Dispute alert */}
              {disputedOrders.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-3">
                  <AlertCircle size={20} className="text-red-500 shrink-0" />
                  <div>
                    <p className="font-bold text-red-800">有 {disputedOrders.length} 笔订单处于争议状态</p>
                    <p className="text-xs text-red-600 mt-0.5">平台将在 48 小时内介入调解，请保持联系方式畅通。</p>
                  </div>
                  <button
                    onClick={() => navigate("/publisher/orders")}
                    className="ml-auto text-xs font-bold text-red-600 hover:underline shrink-0"
                  >
                    查看订单 →
                  </button>
                </div>
              )}

              {/* Order breakdown table */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                  <h2 className="font-extrabold text-primary font-display flex items-center gap-2">
                    <FileText size={16} /> 订单明细
                  </h2>
                  <span className="text-xs text-slate-400">{myOrders.length} 条记录</span>
                </div>

                {myOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <CreditCard size={40} className="mb-3 text-slate-300" />
                    <p className="font-medium">暂无订单记录</p>
                    <button onClick={() => navigate("/publisher/demands/new")} className="mt-3 text-primary text-sm font-bold hover:underline">
                      发布需求开始合作 →
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">订单编号</th>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">需求名称</th>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">OPC</th>
                          <th className="text-right px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">金额</th>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">状态</th>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">创建时间</th>
                          <th className="text-center px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">OPC评分</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {myOrders.map(o => (
                          <tr
                            key={o.id}
                            onClick={() => navigate(`/publisher/orders/${o.id}`)}
                            className="hover:bg-primary/3 transition-colors cursor-pointer"
                          >
                            <td className="px-6 py-4">
                              <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{o.orderNo}</span>
                            </td>
                            <td className="px-6 py-4 font-medium text-foreground max-w-[220px] truncate">{o.demandTitle}</td>
                            <td className="px-6 py-4 text-slate-500">{o.opcNickname ?? "—"}</td>
                            <td className="px-6 py-4 text-right font-bold text-foreground">¥{(o.amount ?? 0).toLocaleString()}</td>
                            <td className="px-6 py-4">
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLOR[o.status] ?? "bg-slate-100 text-slate-500"}`}>
                                {STATUS_MAP[o.status] ?? o.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-400 text-xs">
                              {new Date(o.createdAt).toLocaleDateString("zh-CN")}
                            </td>
                            <td className="px-6 py-4 text-center">
                              {o.rating ? (
                                <span className="text-amber-500 font-bold">{"★".repeat(o.rating)}{"☆".repeat(5 - o.rating)}</span>
                              ) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Platform fee note */}
              <p className="text-xs text-slate-400 text-center">
                平台服务费按订单金额 10% 计算。OPC 分成 90% · 平台 10%。
                结算周期：订单完成后 3 个工作日内到账。
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
