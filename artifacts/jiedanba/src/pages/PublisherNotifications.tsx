import { useState } from "react";
import { useLocation } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Search, Bell, BellOff, CheckCheck,
  ArrowRight, Clock, Zap, Package, FileCheck, AlertCircle,
  MessageSquare, Info,
} from "lucide-react";
import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@workspace/api-client-react";
import type { Notification as NotificationItem } from "@workspace/api-client-react";
import { PublisherSidebar } from "@/components/publisher/PublisherSidebar";
import { PublisherHeaderUser } from '@/components/publisher/PublisherHeaderUser';
import { useQueryClient } from "@tanstack/react-query";

const FILTER_TABS = [
  { key: "all",      label: "全部" },
  { key: "unread",   label: "未读" },
  { key: "bid",      label: "抢单通知" },
  { key: "order",    label: "订单动态" },
  { key: "system",   label: "系统通知" },
];

const NOTIF_TYPE_MAP: Record<string, { icon: React.ElementType; color: string; category: string }> = {
  bid_received:       { icon: Zap,          color: "bg-blue-100 text-blue-600",     category: "bid" },
  bid_accepted:       { icon: CheckCheck,    color: "bg-green-100 text-green-600",   category: "bid" },
  bid_rejected:       { icon: AlertCircle,   color: "bg-red-100 text-red-500",       category: "bid" },
  order_created:      { icon: Package,       color: "bg-purple-100 text-purple-600", category: "order" },
  delivery_submitted: { icon: FileCheck,     color: "bg-amber-100 text-amber-600",   category: "order" },
  delivery_accepted:  { icon: CheckCheck,    color: "bg-emerald-100 text-emerald-600", category: "order" },
  delivery_rejected:  { icon: AlertCircle,   color: "bg-red-100 text-red-500",       category: "order" },
  directed_invite:    { icon: MessageSquare, color: "bg-primary/10 text-primary",    category: "order" },
  system:             { icon: Info,          color: "bg-slate-100 text-slate-500",   category: "system" },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 30) return `${days}天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

export default function PublisherNotifications() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("all");
  const qc = useQueryClient();
  // useCurrentUser() destructure removed

  const { data, isLoading } = useListNotifications(
    { page: 1, limit: 50 },
  );

  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const logout = () => {
    localStorage.removeItem("jdb_role");
    navigate("/login");
  };

  const notifications: NotificationItem[] = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const filtered = notifications.filter((n) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !n.isRead;
    const cfg = NOTIF_TYPE_MAP[n.type];
    return cfg?.category === activeTab;
  });

  const handleClickNotif = async (n: NotificationItem) => {
    if (!n.isRead) {
      await markRead.mutateAsync({ notificationId: n.id });
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
    }
    if (n.relatedType === "demand" && n.relatedId) {
      navigate(`/publisher/demand/${n.relatedId}`);
    } else if (n.relatedType === "order" && n.relatedId) {
      navigate(`/publisher/orders/${n.relatedId}`);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllRead.mutateAsync();
    qc.invalidateQueries({ queryKey: ["/api/notifications"] });
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
              placeholder="搜索消息…"
              className="w-full bg-slate-100 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-4 ml-6">
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
              )}
            </button>
            <PublisherHeaderUser onLogout={logout} />
          </div>
        </header>

        <div className="pt-20 pb-16 px-8 max-w-[860px] mx-auto">
          {/* Page Header */}
          <div className="mb-8 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-primary font-display flex items-center gap-3">
                <Bell size={26} /> 消息中心
                {unreadCount > 0 && (
                  <span className="bg-destructive text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h1>
              <p className="text-slate-500 text-sm mt-1">接收抢单申请、订单状态变更等关键事件通知</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markAllRead.isPending}
                className="flex items-center gap-2 text-sm text-primary font-bold hover:underline disabled:opacity-50"
              >
                <CheckCheck size={16} /> 全部标为已读
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  activeTab === tab.key
                    ? "bg-white text-primary shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
                {tab.key === "unread" && unreadCount > 0 && (
                  <span className="ml-1.5 text-xs bg-destructive text-white px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 h-64 text-slate-400">
              <BellOff size={44} className="mb-4 text-slate-200" />
              <p className="font-medium">暂无{activeTab !== "all" ? "此类" : ""}消息</p>
              <p className="text-xs mt-1">当有 OPC 抢单或订单状态变更时，将在此显示</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
              {filtered.map((n) => {
                const cfg = NOTIF_TYPE_MAP[n.type] ?? NOTIF_TYPE_MAP.system;
                const Icon = cfg.icon;
                const hasLink = n.relatedId && (n.relatedType === "demand" || n.relatedType === "order");
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClickNotif(n)}
                    className={`flex items-start gap-4 px-6 py-5 transition-colors group ${
                      !n.isRead ? "bg-blue-50/50 hover:bg-blue-50" : "hover:bg-slate-50"
                    } ${hasLink ? "cursor-pointer" : "cursor-default"}`}
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>
                      <Icon size={18} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-bold leading-snug ${!n.isRead ? "text-foreground" : "text-slate-600"}`}>
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.content}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock size={11} /> {timeAgo(n.createdAt)}
                        </span>
                        {hasLink && (
                          <span className="flex items-center gap-1 text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                            查看详情 <ArrowRight size={11} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
