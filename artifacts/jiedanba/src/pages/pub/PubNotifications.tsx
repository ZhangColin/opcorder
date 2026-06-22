import { useState } from "react";
import { useLocation } from "wouter";
import {
  BellOff, CheckCheck, ArrowRight, Clock,
  FileCheck, AlertCircle, MessageSquare, Info,
  Bell, FileText, Banknote, ShieldCheck, Package,
} from "lucide-react";
import {
  useListNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@workspace/api-client-react";
import type { Notification as NotificationItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PubLayout } from "@/components/pub/PubLayout";

const FILTER_TABS = [
  { key: "all",      label: "全部" },
  { key: "unread",   label: "未读" },
  { key: "demand",   label: "需求动态" },
  { key: "delivery", label: "交付质保" },
  { key: "system",   label: "系统通知" },
];

type NotifCfg = { icon: React.ElementType; color: string; category: string; label: string };

const NOTIF_TYPE_MAP: Record<string, NotifCfg> = {
  bid_received:       { icon: MessageSquare, color: "bg-blue-100 text-blue-600",       category: "demand",   label: "收到接单申请" },
  bid_accepted:       { icon: CheckCheck,    color: "bg-green-100 text-green-600",     category: "demand",   label: "申请已通过" },
  bid_rejected:       { icon: AlertCircle,   color: "bg-red-100 text-red-500",         category: "demand",   label: "申请未通过" },
  directed_invite:    { icon: MessageSquare, color: "bg-primary/10 text-primary",      category: "demand",   label: "定向邀请" },
  order_created:      { icon: Package,       color: "bg-purple-100 text-purple-600",   category: "demand",   label: "合同已建立" },
  contract_signed:    { icon: FileText,      color: "bg-cyan-100 text-cyan-600",       category: "demand",   label: "合同已签署" },
  delivery_submitted: { icon: FileCheck,     color: "bg-amber-100 text-amber-600",     category: "delivery", label: "交付物已提交" },
  delivery_accepted:  { icon: CheckCheck,    color: "bg-emerald-100 text-emerald-600", category: "delivery", label: "交付已验收" },
  delivery_rejected:  { icon: AlertCircle,   color: "bg-red-100 text-red-500",         category: "delivery", label: "交付未通过" },
  payment_released:   { icon: Banknote,      color: "bg-green-100 text-green-600",     category: "delivery", label: "付款已释放" },
  warranty_alert:     { icon: ShieldCheck,   color: "bg-violet-100 text-violet-600",   category: "delivery", label: "质保提醒" },
  warranty_expired:   { icon: ShieldCheck,   color: "bg-slate-100 text-slate-500",     category: "delivery", label: "质保已到期" },
  system:             { icon: Info,          color: "bg-slate-100 text-slate-500",     category: "system",   label: "系统通知" },
};

const DEFAULT_CFG: NotifCfg = { icon: Info, color: "bg-slate-100 text-slate-500", category: "system", label: "通知" };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours   = Math.floor(diff / 3600000);
  const days    = Math.floor(diff / 86400000);
  if (minutes < 1)  return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24)   return `${hours}小时前`;
  if (days < 30)    return `${days}天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

function resolveLink(n: NotificationItem): string | null {
  if (!n.relatedId) return null;
  if (n.relatedType === "demand")   return `/pub/demands/${n.relatedId}`;
  if (n.relatedType === "contract") return `/pub/demands/${n.relatedId}`;
  if (n.relatedType === "delivery") return `/pub/demands/${n.relatedId}`;
  if (n.relatedType === "order")    return `/pub/demands/${n.relatedId}`;
  return null;
}

export default function PubNotifications() {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("all");
  const qc = useQueryClient();

  const { data, isLoading } = useListNotifications({ page: 1, limit: 100 });
  const markRead    = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications: NotificationItem[] = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const filtered = notifications.filter((n) => {
    if (activeTab === "all")    return true;
    if (activeTab === "unread") return !n.isRead;
    const cfg = NOTIF_TYPE_MAP[n.type] ?? DEFAULT_CFG;
    return cfg.category === activeTab;
  });

  const handleClickNotif = async (n: NotificationItem) => {
    if (!n.isRead) {
      await markRead.mutateAsync({ notificationId: n.id });
      qc.invalidateQueries({ queryKey: ["/api/notifications"] });
    }
    const link = resolveLink(n);
    if (link) navigate(link);
  };

  const handleMarkAllRead = async () => {
    await markAllRead.mutateAsync();
    qc.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  return (
    <PubLayout title="消息中心">
      <div className="max-w-[860px] mx-auto">
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
            <p className="text-slate-500 text-sm mt-1">需求动态、交付验收、质保提醒等业务通知</p>
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

        <div className="flex items-center gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
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

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 h-64 text-slate-400">
            <BellOff size={44} className="mb-4 text-slate-200" />
            <p className="font-medium">暂无{activeTab !== "all" ? "此类" : ""}消息</p>
            <p className="text-xs mt-1">当有业务状态变更或重要提醒时，将在此显示</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
            {filtered.map((n) => {
              const cfg = NOTIF_TYPE_MAP[n.type] ?? DEFAULT_CFG;
              const Icon = cfg.icon;
              const link = resolveLink(n);
              return (
                <div
                  key={n.id}
                  onClick={() => handleClickNotif(n)}
                  className={`flex items-start gap-4 px-6 py-5 transition-colors group ${
                    !n.isRead ? "bg-blue-50/50 hover:bg-blue-50" : "hover:bg-slate-50"
                  } ${link ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <Icon size={18} />
                  </div>
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
                      {link && (
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
    </PubLayout>
  );
}
