import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, Users, Package, ShoppingCart, CreditCard, Wallet, ChevronRight, Clock } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get } from "@/lib/v2api";

interface AdminOverview {
  channelA: { total: number; negotiating: number; quoting: number; pendingContract: number; executing: number; warranty: number; completed: number };
  channelB: { total: number; negotiating: number; executing: number; warranty: number; completed: number };
  orders:   { total: number; pendingContract: number; executing: number; warranty: number; completed: number };
  paymentStats:    { pendingReview: number; overdue: number };
  settlementStats: { pendingPay: number };
  recentDemands: Array<{ id: number; demandNo: string; title: string; status: string; publisherNickname: string | null; createdAt: string }>;
}

const CD_STATUS: Record<string, { label: string; color: string }> = {
  draft:           { label: "草稿",    color: "bg-slate-100 text-slate-500" },
  negotiating:     { label: "沟通中",  color: "bg-blue-100 text-blue-700" },
  quoting:         { label: "报价中",  color: "bg-amber-100 text-amber-700" },
  pending_contract:{ label: "待签约",  color: "bg-orange-100 text-orange-700" },
  executing:       { label: "执行中",  color: "bg-green-100 text-green-700" },
  warranty:        { label: "质保中",  color: "bg-teal-100 text-teal-700" },
  completed:       { label: "已完成",  color: "bg-emerald-100 text-emerald-700" },
  closed:          { label: "已关闭",  color: "bg-red-100 text-red-500" },
};

function StatCard({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <p className="text-xs text-slate-400 font-medium mb-1">{label}</p>
      <p className={`text-2xl font-extrabold ${accent ?? "text-blue-900"}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminV2Overview() {
  const [, navigate] = useLocation();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    v2Get<AdminOverview>("/overview/admin")
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminV2Layout title="运营概览">
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>
      ) : !data ? (
        <div className="text-center py-16 text-slate-400 text-sm">数据加载失败</div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* 通道A */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users size={15} className="text-blue-500" />
              <h2 className="text-sm font-bold text-slate-700">通道 A — 客户需求</h2>
              <span className="text-xs text-slate-400">共 {data.channelA.total} 个</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <StatCard label="沟通中" value={data.channelA.negotiating} />
              <StatCard label="报价中" value={data.channelA.quoting} />
              <StatCard label="待签约" value={data.channelA.pendingContract} accent="text-orange-600" />
              <StatCard label="执行中" value={data.channelA.executing} accent="text-green-600" />
              <StatCard label="质保中" value={data.channelA.warranty} accent="text-teal-600" />
              <StatCard label="已完成" value={data.channelA.completed} accent="text-emerald-600" />
            </div>
          </div>

          {/* 通道B */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package size={15} className="text-violet-500" />
              <h2 className="text-sm font-bold text-slate-700">通道 B — 外包需求</h2>
              <span className="text-xs text-slate-400">共 {data.channelB.total} 个</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard label="沟通中" value={data.channelB.negotiating} />
              <StatCard label="执行中" value={data.channelB.executing} accent="text-green-600" />
              <StatCard label="质保中" value={data.channelB.warranty} accent="text-teal-600" />
              <StatCard label="已完成" value={data.channelB.completed} accent="text-emerald-600" />
            </div>
          </div>

          {/* 外包订单 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart size={15} className="text-indigo-500" />
              <h2 className="text-sm font-bold text-slate-700">外包订单</h2>
              <span className="text-xs text-slate-400">共 {data.orders.total} 单</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard label="待签约" value={data.orders.pendingContract} accent="text-orange-600" />
              <StatCard label="执行中" value={data.orders.executing} accent="text-green-600" />
              <StatCard label="质保中" value={data.orders.warranty} accent="text-teal-600" />
              <StatCard label="已完成" value={data.orders.completed} accent="text-emerald-600" />
            </div>
          </div>

          {/* 财务提醒 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button onClick={() => navigate("/admin/v2/payments-a")}
              className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 p-4 text-left hover:border-primary/20 hover:shadow-sm transition-all group">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                <CreditCard size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400">收款待审核</p>
                <p className={`text-xl font-extrabold ${data.paymentStats.pendingReview > 0 ? "text-amber-600" : "text-blue-900"}`}>{data.paymentStats.pendingReview}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-primary ml-auto" />
            </button>
            <button onClick={() => navigate("/admin/v2/payments-a")}
              className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 p-4 text-left hover:border-primary/20 hover:shadow-sm transition-all group">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <CreditCard size={18} className="text-red-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400">收款已逾期</p>
                <p className={`text-xl font-extrabold ${data.paymentStats.overdue > 0 ? "text-red-600" : "text-blue-900"}`}>{data.paymentStats.overdue}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-primary ml-auto" />
            </button>
            <button onClick={() => navigate("/admin/v2/payments-b")}
              className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 p-4 text-left hover:border-primary/20 hover:shadow-sm transition-all group">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Wallet size={18} className="text-violet-500" />
              </div>
              <div>
                <p className="text-xs text-slate-400">结算待打款</p>
                <p className={`text-xl font-extrabold ${data.settlementStats.pendingPay > 0 ? "text-violet-600" : "text-blue-900"}`}>{data.settlementStats.pendingPay}</p>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:text-primary ml-auto" />
            </button>
          </div>

          {/* 最近客户需求 */}
          {data.recentDemands.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700">最近客户需求</h3>
                <button onClick={() => navigate("/admin/v2/client-demands")}
                  className="text-xs text-primary font-bold hover:text-primary/80 transition-colors">
                  查看全部
                </button>
              </div>
              <div className="space-y-2">
                {data.recentDemands.map(d => {
                  const cfg = CD_STATUS[d.status] ?? { label: d.status, color: "bg-slate-100 text-slate-500" };
                  return (
                    <button key={d.id} onClick={() => navigate(`/admin/v2/client-demands/${d.id}`)}
                      className="w-full flex items-center gap-3 py-2 border-b border-slate-50 last:border-0 text-left hover:bg-slate-50 rounded-lg px-1 -mx-1 transition-colors group">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-sm text-slate-800 flex-1 truncate font-medium">{d.title}</span>
                      <span className="text-xs text-slate-400 shrink-0 font-mono">{d.demandNo}</span>
                      <span className="text-xs text-slate-400 shrink-0 flex items-center gap-1">
                        <Clock size={10} />{new Date(d.createdAt).toLocaleDateString("zh-CN")}
                      </span>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-primary shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </AdminV2Layout>
  );
}
