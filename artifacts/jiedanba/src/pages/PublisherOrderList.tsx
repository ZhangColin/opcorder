import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Search, Bell, Settings, ClipboardList, ChevronRight,
  AlertCircle, Clock, CheckCircle2, XCircle, Zap,
} from "lucide-react";
import { useListOrders } from "@workspace/api-client-react";
import { PublisherSidebar } from "@/components/publisher/PublisherSidebar";

const STATUS_TABS = [
  { key: "all",                label: "全部" },
  { key: "in_progress",        label: "进行中" },
  { key: "pending_acceptance", label: "待验收" },
  { key: "completed",          label: "已完成" },
  { key: "disputed",           label: "争议中" },
  { key: "closed",             label: "已关闭" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  in_progress:        { label: "进行中", color: "bg-green-100 text-green-700" },
  pending_acceptance: { label: "待验收", color: "bg-orange-100 text-orange-700" },
  completed:          { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
  disputed:           { label: "争议中", color: "bg-red-100 text-red-600" },
  closed:             { label: "已关闭", color: "bg-slate-100 text-slate-500" },
};

export default function PublisherOrderList() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListOrders({
    ...(activeTab !== "all" ? { status: activeTab as any } : {}),
    role: "publisher",
    page,
    limit: 10,
  });

  const orders = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const logout = () => {
    localStorage.removeItem("jdb_role");
    navigate("/login");
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setPage(1);
  };

  return (
    <div className="flex min-h-screen bg-[#f9f9fc] text-[#1a1c1e]">
      <PublisherSidebar onLogout={logout} />

      <main className="flex-1 ml-64 min-h-screen">
        {/* Top bar */}
        <header className="fixed top-0 right-0 left-64 z-40 bg-white/80 backdrop-blur-md shadow-sm flex justify-between items-center px-8 py-3">
          <div className="relative w-full max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索订单编号、OPC 名称…"
              className="w-full bg-slate-100 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-4 ml-6">
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Settings size={20} />
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-blue-900">海创元运营团队</p>
                <p className="text-[10px] text-slate-500 font-medium">项目经理</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                海
              </div>
            </div>
          </div>
        </header>

        <div className="pt-20 pb-16 px-8 max-w-[1280px] mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-extrabold text-primary font-display flex items-center gap-3">
              <ClipboardList size={26} /> 订单管理
            </h1>
            <p className="text-slate-500 text-sm mt-1">跟踪进行中的项目、审查里程碑交付物、确认最终验收</p>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === tab.key
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 h-64 text-slate-400">
              <AlertCircle size={44} className="mb-4 text-slate-200" />
              <p className="font-medium">暂无{activeTab !== "all" ? STATUS_CONFIG[activeTab]?.label : ""}订单</p>
              <p className="text-xs mt-1">需求被 OPC 接单后，订单将自动生成</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const statusCfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-slate-100 text-slate-500" };
                return (
                  <Link key={order.id} href={`/publisher/orders/${order.id}`}>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer group p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-mono text-xs text-slate-400">{order.orderNo}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                              {statusCfg.label}
                            </span>
                            {order.status === "pending_acceptance" && (
                              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Zap size={10} /> 需要您的操作
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
                            {order.demandTitle}
                          </h3>
                          <div className="flex items-center gap-3 text-sm text-slate-500">
                            <span>OPC：{order.opcNickname ?? `#${order.opcId}`}</span>
                            {order.deadline && (
                              <span className="flex items-center gap-1">
                                <Clock size={12} /> 截止 {new Date(order.deadline).toLocaleDateString("zh-CN")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-2">
                          <p className="text-xl font-extrabold text-primary">¥{order.amount.toLocaleString()}</p>
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span>创建于 {new Date(order.createdAt).toLocaleDateString("zh-CN")}</span>
                            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform text-primary" />
                          </div>
                        </div>
                      </div>

                      {/* Progress indicator for in_progress */}
                      {order.status === "in_progress" && order.milestones && order.milestones.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-slate-500 font-medium">里程碑进度</span>
                            <span className="text-xs font-bold text-primary">
                              {order.milestones.filter((m) => m.status === "approved").length} / {order.milestones.length} 已完成
                            </span>
                          </div>
                          <div className="flex gap-1">
                            {order.milestones.map((m, i) => (
                              <div
                                key={i}
                                className={`h-1.5 flex-1 rounded-full ${
                                  m.status === "approved"
                                    ? "bg-green-400"
                                    : m.status === "submitted"
                                    ? "bg-amber-400"
                                    : "bg-slate-200"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Status actions hint */}
                      {order.status === "completed" && (
                        <div className="mt-3 flex items-center gap-1 text-emerald-600 text-xs font-medium">
                          <CheckCircle2 size={12} /> 订单已完成，结算已触发
                        </div>
                      )}
                      {order.status === "closed" && (
                        <div className="mt-3 flex items-center gap-1 text-slate-400 text-xs font-medium">
                          <XCircle size={12} /> 订单已关闭
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                上一页
              </button>
              <span className="text-sm text-slate-500 font-medium">
                第 {page} / {totalPages} 页 · 共 {total} 条
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
