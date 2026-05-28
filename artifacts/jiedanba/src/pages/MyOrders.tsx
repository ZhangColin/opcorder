import { useState } from "react";
import { Link } from "wouter";
import {
  useListOrders,
} from "@workspace/api-client-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Loader2,
  ChevronRight,
  CalendarDays,
  Banknote,
  Flag,
} from "lucide-react";

type TabStatus = "all" | "in_progress" | "pending_acceptance" | "completed";

const TABS: { label: string; value: TabStatus }[] = [
  { label: "全部", value: "all" },
  { label: "执行中", value: "in_progress" },
  { label: "待验收", value: "pending_acceptance" },
  { label: "已完成", value: "completed" },
];

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  in_progress:        { label: "执行中", cls: "bg-primary/10 text-primary" },
  pending_acceptance: { label: "待验收", cls: "bg-orange-100 text-orange-700" },
  completed:          { label: "已完成", cls: "bg-secondary/10 text-secondary" },
  disputed:           { label: "争议中", cls: "bg-red-100 text-red-700" },
  closed:             { label: "已关闭", cls: "bg-muted text-muted-foreground" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function MyOrders() {
  const [tab, setTab] = useState<TabStatus>("all");
  const { userId } = useCurrentUser();

  const { data: ordersData, isLoading } = useListOrders({
    status: tab === "all" ? undefined : (tab as any),
    opcId: userId || undefined,
    page: 1,
    limit: 50,
  });

  const orders = ordersData?.items ?? [];

  return (
    <div>
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="font-display font-extrabold text-4xl text-primary tracking-tight mb-2">
          我的订单
        </h1>
        <p className="text-muted-foreground font-medium">
          查看和管理您接手的所有订单。
        </p>
      </header>

      {/* Tab Bar */}
      <div className="flex items-center gap-6 border-b border-border mb-8">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-1 py-4 font-bold text-sm font-display transition-all ${
              tab === t.value
                ? "text-primary border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
          <Loader2 size={20} className="animate-spin" /> 加载中…
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mb-4 text-2xl">
            📭
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">暂无相关订单</h3>
          <p className="text-muted-foreground text-sm">
            切换其他状态，或前往{" "}
            <Link href="/order-hall" className="text-primary font-bold hover:underline">
              订单大厅
            </Link>{" "}
            接新单
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const cfg = STATUS_CFG[order.status] ?? STATUS_CFG.in_progress;
            const milestones: any[] = (order as any).milestones ?? [];
            const deliverables: any[] = (order as any).deliverables ?? [];
            const msTotal = milestones.length;
            const msCompleted = milestones.filter((_, i) => {
              return deliverables.some(
                (d: any) => d.milestoneId === i + 1 && d.status === "approved"
              );
            }).length;
            const msSubmitted = milestones.filter((_, i) => {
              const msDelivs = deliverables.filter((d: any) => d.milestoneId === i + 1);
              return (
                !msDelivs.some((d: any) => d.status === "approved") &&
                msDelivs.some((d: any) => d.status === "submitted")
              );
            }).length;

            return (
              <Link key={order.id} href={`/orders/${order.id}`}>
                <div className="bg-white rounded-2xl border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer group p-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left: title + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                          #{order.orderNo}
                        </span>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-lg text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-3">
                        {order.demandTitle}
                      </h3>

                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {order.deadline && (
                          <span className="flex items-center gap-1.5">
                            <CalendarDays size={13} />
                            截止 {formatDate(order.deadline)}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <Banknote size={13} />
                          我的分成{" "}
                          <span className="text-secondary font-black">
                            ¥{(order.opcShare ?? Math.round(order.amount * 0.9)).toLocaleString()}
                          </span>
                        </span>
                        {msTotal > 0 && (
                          <span className="flex items-center gap-1.5">
                            <Flag size={13} />
                            里程碑 {msCompleted}/{msTotal}
                          </span>
                        )}
                      </div>

                      {/* Milestone progress bar */}
                      {msTotal > 0 && (
                        <div className="mt-4 flex gap-1 h-1.5">
                          {milestones.map((_, i) => {
                            const msDelivs = deliverables.filter(
                              (d: any) => d.milestoneId === i + 1
                            );
                            const s = msDelivs.some((d: any) => d.status === "approved")
                              ? "approved"
                              : msDelivs.some((d: any) => d.status === "submitted")
                              ? "submitted"
                              : "pending";
                            const bg =
                              s === "approved"
                                ? "bg-secondary"
                                : s === "submitted"
                                ? "bg-primary/40"
                                : "bg-muted";
                            return (
                              <div
                                key={i}
                                className={`flex-1 rounded-full ${bg} transition-all`}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right: arrow */}
                    <div className="shrink-0 flex items-center self-center">
                      <ChevronRight
                        size={20}
                        className="text-muted-foreground group-hover:text-primary transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
