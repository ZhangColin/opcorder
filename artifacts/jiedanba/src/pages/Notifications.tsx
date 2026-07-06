import { useState } from "react";
import { useLocation } from "wouter";
import {
  Bell, Check, CheckCheck, FileCheck, AlertCircle,
  Info, ArrowRight, Clock, FileText, Banknote, ShieldCheck, Trophy,
} from "lucide-react";
import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@workspace/api-client-react";
import type { Notification as NotificationItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
const NOTIF_TYPE_CFG: Record<
  string,
  { label: string; category: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  system:                         { label: "系统通知",       category: "system",  icon: Info },
  v2_tender_won:                  { label: "恭喜中标",       category: "order",  icon: Trophy },
  v2_tender_lost:                 { label: "未入选",         category: "order",  icon: AlertCircle },
  v2_tender_cancelled:            { label: "投标已取消",     category: "order",  icon: AlertCircle },
  v2_contract_finalized:          { label: "合同待确认",     category: "order",  icon: FileText },
  v2_contract_officially_signed:  { label: "合同正式签约",   category: "order",  icon: FileCheck },
  v2_opc_confirmed_contract:      { label: "OPC已确认合同",  category: "order",  icon: CheckCheck },
  v2_warranty_started:            { label: "进入质保期",     category: "order",  icon: ShieldCheck },
  v2_warranty_started_b:          { label: "外包进入质保期", category: "order",  icon: ShieldCheck },
  v2_delivery_b_approved:         { label: "交付物已通过",   category: "order",  icon: CheckCheck },
  v2_delivery_b_rejected:         { label: "交付物被驳回",   category: "order",  icon: AlertCircle },
  v2_ticket_b_created:            { label: "质保工单",       category: "order",  icon: ShieldCheck },
  v2_ticket_b_closed:             { label: "工单已关闭",     category: "order",  icon: ShieldCheck },
  v2_settlement_paid:             { label: "结算款已打款",   category: "order",  icon: Banknote },
  v2_demand_invited:              { label: "外包需求邀请",   category: "invite", icon: Info },
  v2_outsource_detail_updated:    { label: "需求详情已更新", category: "order",  icon: Info },
  contest_test_graded:            { label: "测试题评级结果", category: "system", icon: Trophy },
  contest_assignment_graded:      { label: "测试单评级结果", category: "system", icon: Trophy },
};

const TABS = [
  { key: "all",    label: "全部" },
  { key: "invite", label: "邀约通知" },
  { key: "order",  label: "订单动态" },
  { key: "system", label: "系统通知" },
  { key: "unread", label: "未读" },
];

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

function NotifCard({ n, onRead, onNavigate }: {
  n: NotificationItem;
  onRead: (id: number) => void;
  onNavigate: (n: NotificationItem) => void;
}) {
  const cfg = NOTIF_TYPE_CFG[n.type] ?? NOTIF_TYPE_CFG.system;
  const Icon = cfg.icon;

  const iconBg: Record<string, string> = {
    system: "bg-slate-100 text-slate-500",
  };

  return (
    <div
      className={`group rounded-2xl border p-5 transition-all ${
        n.isRead
          ? "bg-background border-border opacity-80"
          : "bg-card border-primary/25 shadow-sm"
      }`}
    >
      <div className="flex gap-4">
        <div
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            iconBg[n.type] ?? iconBg.system
          }`}
        >
          <Icon size={18} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={`font-bold text-sm ${n.isRead ? "text-foreground" : "text-primary"}`}>
                {n.title}
              </h4>
              {!n.isRead && (
                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock size={11} /> {timeAgo(n.createdAt)}
              </span>
              {!n.isRead && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRead(n.id); }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                  title="标为已读"
                >
                  <Check size={14} />
                </button>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{n.content}</p>

          {/* Jump link */}
          {n.relatedId && n.relatedType && (
            <button
              onClick={() => onNavigate(n)}
              className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              {(n.relatedType as string) === "v2_outsource_order" ? "查看订单"
                : (n.relatedType as string) === "portfolio" ? "前往修改作品"
                : (n.relatedType as string) === "v2_outsource_demand" ? "查看外包需求"
                : "查看详情"}
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Notifications() {
  const [activeTab, setActiveTab] = useState("all");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useListNotifications({ limit: 100 });
  const markRead = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  const notifications: NotificationItem[] = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const filtered = notifications.filter((n) => {
    if (activeTab === "unread") return !n.isRead;
    if (activeTab === "all") return true;
    const cfg = NOTIF_TYPE_CFG[n.type];
    return cfg?.category === activeTab;
  });

  const handleRead = async (id: number) => {
    await markRead.mutateAsync({ notificationId: id });
    qc.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  const handleMarkAll = () => {
    markAllRead(undefined, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/notifications"] });
        toast({ title: "已全部标为已读" });
      },
    });
  };

  const handleNavigate = (n: NotificationItem) => {
    if (!n.isRead) handleRead(n.id);
    if ((n.relatedType as string) === "v2_outsource_order" && n.relatedId) navigate(`/opc/orders/${n.relatedId}`);
    else if ((n.relatedType as string) === "v2_outsource_demand" && n.relatedId) navigate(`/opc/demand-hall`);
    else if ((n.relatedType as string) === "contest_registration" && n.relatedId) navigate(`/profile/contests/${n.relatedId}`);
    else if (n.relatedType === "portfolio" && n.relatedId) navigate(`/profile?portfolio=${n.relatedId}`);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-black font-display text-foreground flex items-center gap-3">
            <Bell className="text-primary" size={24} /> 消息中心
            {unreadCount > 0 && (
              <span className="bg-primary text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            接收邀约通知、合同动态、结算款等关键通知
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
          >
            <CheckCheck size={16} /> 全部已读
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/60 rounded-xl p-1 overflow-x-auto">
        {TABS.map((t) => {
          const badge = t.key === "unread" ? unreadCount : 0;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                activeTab === t.key
                  ? "bg-white text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {badge > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  activeTab === t.key ? "bg-primary text-white" : "bg-primary/15 text-primary"
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-card border border-border rounded-2xl text-muted-foreground flex flex-col items-center gap-3">
            <Bell size={36} className="opacity-20" />
            <p className="font-bold">暂无{activeTab !== "all" ? TABS.find(t=>t.key===activeTab)?.label : ""}通知</p>
          </div>
        ) : (
          filtered.map((n) => (
            <NotifCard
              key={n.id}
              n={n}
              onRead={handleRead}
              onNavigate={handleNavigate}
            />
          ))
        )}
      </div>
    </div>
  );
}
