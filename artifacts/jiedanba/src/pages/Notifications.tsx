import { useState } from "react";
import { useLocation } from "wouter";
import { getAccessToken } from "@/lib/auth";
import {
  Bell, Check, CheckCheck, Package, Zap, FileCheck, AlertCircle,
  MessageSquare, Info, ArrowRight, Clock,
} from "lucide-react";
import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@workspace/api-client-react";
import type { Notification as NotificationItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const NOTIF_TYPE_CFG: Record<
  string,
  { label: string; category: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  directed_invite:    { label: "定向邀约",   category: "invite",  icon: Zap },
  bid_accepted:       { label: "抢单已确认", category: "bid",     icon: CheckCheck },
  bid_rejected:       { label: "抢单未通过", category: "bid",     icon: AlertCircle },
  bid_received:       { label: "收到抢单",   category: "bid",     icon: MessageSquare },
  order_created:      { label: "订单已创建", category: "order",   icon: Package },
  delivery_submitted: { label: "交付物提交", category: "order",   icon: FileCheck },
  delivery_accepted:  { label: "交付已通过", category: "order",   icon: CheckCheck },
  delivery_rejected:  { label: "交付被打回", category: "order",   icon: AlertCircle },
  system:             { label: "系统通知",   category: "system",  icon: Info },
};

const TABS = [
  { key: "all",    label: "全部" },
  { key: "invite", label: "定向邀约" },
  { key: "bid",    label: "抢单结果" },
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

function NotifCard({ n, onRead, onNavigate, onAcceptInvite, onRejectInvite, isActing }: {
  n: NotificationItem;
  onRead: (id: number) => void;
  onNavigate: (n: NotificationItem) => void;
  onAcceptInvite: (n: NotificationItem) => void;
  onRejectInvite: (n: NotificationItem) => void;
  isActing: boolean;
}) {
  const cfg = NOTIF_TYPE_CFG[n.type] ?? NOTIF_TYPE_CFG.system;
  const Icon = cfg.icon;
  const isDirectedInvite = n.type === "directed_invite";

  const iconBg: Record<string, string> = {
    directed_invite:    "bg-amber-100   text-amber-600",
    bid_accepted:       "bg-green-100   text-green-600",
    bid_rejected:       "bg-red-100     text-red-500",
    bid_received:       "bg-blue-100    text-blue-600",
    order_created:      "bg-purple-100  text-purple-600",
    delivery_submitted: "bg-sky-100     text-sky-600",
    delivery_accepted:  "bg-green-100   text-green-600",
    delivery_rejected:  "bg-red-100     text-red-500",
    system:             "bg-slate-100   text-slate-500",
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

          {/* Directed invite — Accept / Reject CTAs */}
          {isDirectedInvite && n.relatedId && (
            n.respondedAction ? (
              <p className={`mt-3 text-sm font-bold ${
                n.respondedAction === "accepted" ? "text-green-600" : "text-muted-foreground"
              }`}>
                {n.respondedAction === "accepted" ? "您已接受此邀约" : "您已婉拒此邀约"}
              </p>
            ) : (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onAcceptInvite(n)}
                  disabled={isActing}
                  className="flex-1 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isActing ? "处理中…" : "接受邀约"}
                </button>
                <button
                  onClick={() => onRejectInvite(n)}
                  disabled={isActing}
                  className="flex-1 py-2 border-2 border-border text-sm font-bold rounded-xl hover:border-red-300 hover:text-red-600 disabled:opacity-50 transition-colors"
                >
                  婉拒邀约
                </button>
              </div>
            )
          )}

          {/* Jump link for non-invite notifications */}
          {!isDirectedInvite && n.relatedId && n.relatedType && (
            <button
              onClick={() => onNavigate(n)}
              className="mt-2 flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
            >
              {n.relatedType === "order" ? "查看订单" : n.relatedType === "portfolio" ? "前往修改作品" : "查看需求"}
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
  const [actingId, setActingId] = useState<number | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { userId } = useCurrentUser();

  const { data, refetch } = useListNotifications({ limit: 100 });
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

  const inviteCount = notifications.filter((n) => n.type === "directed_invite" && !n.isRead).length;

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
    if (n.relatedType === "order" && n.relatedId) navigate(`/orders/${n.relatedId}`);
    else if (n.relatedType === "demand" && n.relatedId) navigate(`/order-hall`);
    else if (n.relatedType === "bid" && n.relatedId) navigate(`/order-hall`);
    else if (n.relatedType === "portfolio" && n.relatedId) navigate(`/profile?portfolio=${n.relatedId}`);
  };

  const respondInvite = async (n: NotificationItem, action: "accept" | "reject") => {
    if (!n.relatedId || !userId) return;
    setActingId(n.id);
    try {
      const res = await fetch(
        `${API_BASE}/api/demands/${n.relatedId}/invite/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken() ?? ""}`,
          },
          body: JSON.stringify({ opcId: userId, action, notificationId: n.id }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "操作失败");

      if (action === "accept") {
        toast({ title: "已接受邀约", description: "订单已创建，请及时跟进。" });
        qc.invalidateQueries({ queryKey: ["/api/orders"] });
      } else {
        toast({ title: "已婉拒邀约" });
      }
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
      refetch();
    } catch (err: any) {
      toast({ title: "操作失败", description: err?.message ?? "请稍后重试", variant: "destructive" });
    } finally {
      setActingId(null);
    }
  };

  const handleAcceptInvite = (n: NotificationItem) => respondInvite(n, "accept");
  const handleRejectInvite = (n: NotificationItem) => respondInvite(n, "reject");

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
            接收抢单结果、定向邀约、订单状态等关键通知
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
          const badge =
            t.key === "unread" ? unreadCount :
            t.key === "invite" ? inviteCount : 0;
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
              onAcceptInvite={handleAcceptInvite}
              onRejectInvite={handleRejectInvite}
              isActing={actingId === n.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
