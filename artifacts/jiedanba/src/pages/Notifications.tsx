import { Bell, Check, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useListNotifications, useMarkAllNotificationsRead } from "@workspace/api-client-react";

export default function Notifications() {
  const { data, refetch } = useListNotifications({ limit: 50 });
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  const handleMarkAll = () => {
    markAllRead(undefined, { onSuccess: () => refetch() });
  };

  const getIcon = (type: string) => {
    if (type.includes('accepted')) return <CheckCircle2 className="text-secondary" size={24} />;
    if (type.includes('rejected')) return <AlertCircle className="text-destructive" size={24} />;
    return <Info className="text-primary" size={24} />;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between bg-card p-6 rounded-2xl border border-border shadow-sm">
        <h1 className="text-2xl font-black font-display text-foreground flex items-center gap-3">
          <Bell className="text-primary" /> 消息中心
        </h1>
        {data?.unreadCount ? (
          <button onClick={handleMarkAll} className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors flex items-center">
            <Check size={16} className="mr-1" /> 全部标为已读
          </button>
        ) : null}
      </div>

      <div className="space-y-4">
        {data?.items?.length ? data.items.map(notif => (
          <div key={notif.id} className={`p-6 rounded-2xl border transition-all ${notif.isRead ? 'bg-background border-border opacity-70' : 'bg-card border-primary/20 shadow-sm'}`}>
            <div className="flex gap-4">
              <div className="shrink-0 mt-1">{getIcon(notif.type)}</div>
              <div className="flex-1">
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`font-bold ${notif.isRead ? 'text-foreground' : 'text-primary'}`}>{notif.title}</h4>
                  <span className="text-xs text-muted-foreground">{new Date(notif.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{notif.content}</p>
              </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 bg-card rounded-2xl border border-border shadow-sm text-muted-foreground">
            暂无消息通知
          </div>
        )}
      </div>
    </div>
  );
}
