import { Link } from "wouter";
import {
  ArrowLeft, Banknote, Clock, CheckCircle2, TrendingUp,
  FileText, AlertCircle,
} from "lucide-react";
import { useListOrders, useGetCurrentUser, useGetOpcProfile } from "@workspace/api-client-react";

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  in_progress:        { label: "执行中·待结算",  color: "bg-amber-100 text-amber-700" },
  pending_acceptance: { label: "待验收",          color: "bg-blue-100  text-blue-700"  },
  completed:          { label: "已结算",          color: "bg-green-100 text-green-700" },
  closed:             { label: "已关闭",          color: "bg-slate-100 text-slate-600" },
  disputed:           { label: "争议中",          color: "bg-red-100   text-red-600"   },
};

const DEMAND_TYPES: Record<string, string> = {
  ai_education:     "AI教育",
  gov_training:     "政企培训",
  ai_research:      "AI研学",
  party_building:   "党建AI",
  livestream_media: "直播媒体",
  ai_tool_dev:      "AI工具开发",
  other:            "其他",
};

export default function OpcIncome() {
  const { data: user } = useGetCurrentUser();
  const { data: profile } = useGetOpcProfile(user?.id ?? 1, {
    query: { enabled: !!user?.id },
  });
  const { data: allOrders } = useListOrders({ role: "opc", limit: 200 });
  const { data: completedOrders } = useListOrders({ role: "opc", status: "completed", limit: 200 });
  const { data: activeOrders } = useListOrders({ role: "opc", status: "in_progress", limit: 200 });
  const { data: pendingOrders } = useListOrders({ role: "opc", status: "pending_acceptance", limit: 200 });

  const totalEarned = (completedOrders?.items ?? []).reduce(
    (sum, o) => sum + (o.opcShare ?? o.amount * 0.6), 0
  );
  const pendingEarnings = [
    ...(activeOrders?.items ?? []),
    ...(pendingOrders?.items ?? []),
  ].reduce((sum, o) => sum + (o.opcShare ?? o.amount * 0.6), 0);

  const completedCount = completedOrders?.total ?? 0;
  const totalCount = allOrders?.total ?? 0;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const orders = allOrders?.items ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Link href="/profile" className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold text-sm transition-colors">
          <ArrowLeft size={16} /> 返回个人中心
        </Link>
      </div>

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-black font-display text-foreground flex items-center gap-3">
          <Banknote className="text-secondary" /> 收入结算
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          查看历史结算记录与待结算金额 · {profile?.nickname ?? user?.nickname ?? "OPC"} {profile?.level ?? "B"}级账户
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest mb-3">
            <CheckCircle2 size={14} className="text-secondary" /> 累计已结算
          </div>
          <p className="text-3xl font-black text-secondary">¥{totalEarned.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">{completedCount} 单已完成</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest mb-3">
            <Clock size={14} className="text-amber-500" /> 待结算金额
          </div>
          <p className="text-3xl font-black text-amber-600">¥{pendingEarnings.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {(activeOrders?.total ?? 0) + (pendingOrders?.total ?? 0)} 单进行中
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest mb-3">
            <TrendingUp size={14} className="text-primary" /> 完成率
          </div>
          <p className="text-3xl font-black text-primary">{completionRate}%</p>
          <p className="text-xs text-muted-foreground mt-2">
            共接 {totalCount} 单
          </p>
        </div>
      </div>

      {/* Settlement notice */}
      <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          结算规则：验收通过后 3 个工作日内到账，OPC分成比例约为订单金额的
          <strong> 50%–70%</strong>（C级50%，B级60%，A级70%）。平台服务费10%，发单方保留余额。
        </p>
      </div>

      {/* Order table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
          <FileText size={16} className="text-primary" />
          <h2 className="font-bold text-foreground">结算明细</h2>
          <span className="ml-auto text-sm text-muted-foreground">{orders.length} 条记录</span>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Banknote size={32} className="mx-auto mb-3 opacity-20" />
            <p>暂无结算记录</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {orders.map((o) => {
              const myShare = o.opcShare ?? o.amount * 0.6;
              const sc = STATUS_CFG[o.status] ?? STATUS_CFG.in_progress;
              const typeLabel = DEMAND_TYPES[o.demandType ?? ""] ?? "其他";
              return (
                <Link
                  key={o.id}
                  href={`/orders/${o.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-muted/40 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{o.orderNo}</span>
                      <span className="text-xs font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {typeLabel}
                      </span>
                    </div>
                    <p className="font-bold text-foreground text-sm truncate">{o.demandTitle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      发单方：{o.publisherName}
                      {o.deadline && <> · 截止 {o.deadline}</>}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={`text-lg font-black ${o.status === "completed" ? "text-secondary" : "text-amber-600"}`}>
                      ¥{myShare.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      订单 ¥{o.amount.toLocaleString()}
                    </p>
                  </div>

                  <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${sc.color}`}>
                    {sc.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
