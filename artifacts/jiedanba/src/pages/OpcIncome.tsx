import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Banknote, Clock, CheckCircle2, TrendingUp,
  FileText, Lock,
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
  education: "教育培训",
  software:  "软件开发",
  marketing: "营销",
  content:   "内容设计",
  other:     "其他",
};

interface OpcSubOrder {
  id: number;
  order_no: string;
  sub_order_no: string;
  amount: string;
  role: string;
  sub_role: string | null;
  releasable_at: string | null;
  settled_at: string | null;
}

export default function OpcIncome() {
  const { data: user } = useGetCurrentUser();
  const opcId = user?.id || undefined;
  const { data: profile } = useGetOpcProfile(user?.id ?? 1, {
    query: { enabled: !!user?.id },
  });
  const { data: allOrders } = useListOrders({ opcId, limit: 200 });
  const { data: completedOrders } = useListOrders({ opcId, status: "completed", limit: 200 });
  const { data: activeOrders } = useListOrders({ opcId, status: "in_progress", limit: 200 });
  const { data: pendingOrders } = useListOrders({ opcId, status: "pending_acceptance", limit: 200 });

  const { data: subOrdersRaw } = useQuery<OpcSubOrder[]>({
    queryKey: ["opc-sub-orders", user?.id],
    queryFn: async () => {
      const token = localStorage.getItem("token") ?? "";
      const res = await fetch("/api/opc/sub-orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id,
  });

  const subOrdersByOrderNo = (subOrdersRaw ?? []).reduce<Record<string, OpcSubOrder[]>>((acc, s) => {
    const key = s.order_no;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const totalEarned = (completedOrders?.items ?? []).reduce(
    (sum, o) => sum + (o.opcShare ?? Math.round(o.amount * 0.9)), 0
  );
  const pendingEarnings = [
    ...(activeOrders?.items ?? []),
    ...(pendingOrders?.items ?? []),
  ].reduce((sum, o) => sum + (o.opcShare ?? Math.round(o.amount * 0.9)), 0);

  const completedCount = completedOrders?.total ?? 0;
  const totalCount = allOrders?.total ?? 0;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const holdbackLocked = (subOrdersRaw ?? [])
    .filter(s => s.sub_role === "opc_holdback" && !s.settled_at && s.releasable_at)
    .reduce((sum, s) => sum + Number(s.amount), 0);

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
          查看历史结算记录与待结算金额 · {profile?.nickname ?? user?.nickname ?? "OPC"} {profile?.level === "newbie" ? "（新手·待认证）" : `${profile?.level ?? ""}级`}账户
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest mb-3">
            <CheckCircle2 size={14} className="text-secondary" /> 累计已结算
          </div>
          <p className="text-2xl font-black text-secondary">¥{totalEarned.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">{completedCount} 单已完成</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest mb-3">
            <Clock size={14} className="text-amber-500" /> 待结算金额
          </div>
          <p className="text-2xl font-black text-amber-600">¥{pendingEarnings.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {(activeOrders?.total ?? 0) + (pendingOrders?.total ?? 0)} 单进行中
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest mb-3">
            <Lock size={14} className="text-orange-500" /> 保证金锁定中
          </div>
          <p className="text-2xl font-black text-orange-600">¥{holdbackLocked.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-2">完成后 3 个月解锁</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest mb-3">
            <TrendingUp size={14} className="text-primary" /> 完成率
          </div>
          <p className="text-2xl font-black text-primary">{completionRate}%</p>
          <p className="text-xs text-muted-foreground mt-2">共接 {totalCount} 单</p>
        </div>
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
              const myShare = o.opcShare ?? Math.round(o.amount * 0.9);
              const sc = STATUS_CFG[o.status] ?? STATUS_CFG.in_progress;
              const typeLabel = DEMAND_TYPES[o.demandType ?? ""] ?? "其他";
              const subs = subOrdersByOrderNo[o.orderNo ?? ""] ?? [];
              const primary = subs.find(s => s.sub_role === "opc_primary");
              const holdback = subs.find(s => s.sub_role === "opc_holdback");
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
                    {primary && holdback ? (
                      <div className="text-xs mt-0.5 space-y-0.5">
                        <div className={`font-medium ${primary.settled_at ? "text-green-600" : "text-slate-500"}`}>
                          即付 ¥{Number(primary.amount).toLocaleString()}{primary.settled_at ? " ✓" : ""}
                        </div>
                        <div className={`${holdback.settled_at ? "text-green-600" : holdback.releasable_at ? "text-orange-500" : "text-slate-400"}`}>
                          {holdback.settled_at
                            ? `保证金 ¥${Number(holdback.amount).toLocaleString()} ✓`
                            : holdback.releasable_at
                              ? `保证金 ${new Date(holdback.releasable_at) <= new Date() ? "已解锁" : holdback.releasable_at.slice(0, 10) + "解锁"}`
                              : `保证金 ¥${Number(holdback.amount).toLocaleString()}`
                          }
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        订单 ¥{o.amount.toLocaleString()}
                      </p>
                    )}
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
