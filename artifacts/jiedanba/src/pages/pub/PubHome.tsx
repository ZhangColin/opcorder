import { useLocation } from "wouter";
import {
  FileText, ShieldCheck, Bell, UserCircle,
  CheckCircle2, Clock, ChevronsRight, ArrowRight,
  ClipboardList, Banknote,
} from "lucide-react";
import {
  useListDemands,
  useListNotifications,
} from "@workspace/api-client-react";
import type { Notification as NotificationItem } from "@workspace/api-client-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PubLayout } from "@/components/pub/PubLayout";

const DEMAND_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:              { label: "草稿",   cls: "bg-slate-100 text-slate-500" },
  pending_review:     { label: "待审核", cls: "bg-amber-50 text-amber-700" },
  published:          { label: "招募中", cls: "bg-amber-50 text-amber-700" },
  open:               { label: "招募中", cls: "bg-amber-50 text-amber-700" },
  matched:            { label: "已匹配", cls: "bg-cyan-50 text-cyan-700" },
  in_progress:        { label: "进行中", cls: "bg-blue-50 text-blue-700" },
  pending_acceptance: { label: "待验收", cls: "bg-purple-50 text-purple-700" },
  completed:          { label: "已完成", cls: "bg-green-50 text-green-700" },
  closed:             { label: "已关闭", cls: "bg-slate-100 text-slate-500" },
};

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

export default function PubHome() {
  const [, navigate] = useLocation();
  const { userId, nickname } = useCurrentUser();

  const { data: allDemands }   = useListDemands({ publisherId: userId || undefined, limit: 100 });
  const { data: tableData }    = useListDemands({ publisherId: userId || undefined, limit: 8 });
  const { data: notifData }    = useListNotifications({ page: 1, limit: 5 });

  const demands     = allDemands?.items ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;
  const recentNotifs: NotificationItem[] = notifData?.items?.slice(0, 4) ?? [];

  const countByStatus = (status: string | string[]) => {
    const statuses = Array.isArray(status) ? status : [status];
    return demands.filter(d => statuses.includes(d.status)).length;
  };

  const inProgressCount   = countByStatus("in_progress");
  const pendingAcceptCount = countByStatus("pending_acceptance");
  const recruitingCount   = countByStatus(["published", "open"]);
  const completedCount    = countByStatus("completed");

  const STAT_CARDS = [
    {
      label:    "进行中需求",
      value:    inProgressCount,
      sub:      "合同执行阶段",
      icon:     ClipboardList,
      iconBg:   "bg-blue-50",
      iconClr:  "text-blue-600",
      accent:   "border-l-blue-400",
      href:     "/pub/demands",
    },
    {
      label:    "待验收交付",
      value:    pendingAcceptCount,
      sub:      "等待您确认验收",
      icon:     CheckCircle2,
      iconBg:   "bg-purple-50",
      iconClr:  "text-purple-600",
      accent:   "border-l-purple-400",
      href:     "/pub/demands",
      urgent:   pendingAcceptCount > 0,
    },
    {
      label:    "招募中",
      value:    recruitingCount,
      sub:      "等待 OPC 申请",
      icon:     FileText,
      iconBg:   "bg-amber-50",
      iconClr:  "text-amber-600",
      accent:   "border-l-amber-400",
      href:     "/pub/demands",
    },
    {
      label:    "已完成项目",
      value:    completedCount,
      sub:      "累计完成需求",
      icon:     Banknote,
      iconBg:   "bg-green-50",
      iconClr:  "text-green-600",
      accent:   "border-l-green-400",
      href:     "/pub/demands",
    },
    {
      label:    "未读消息",
      value:    unreadCount,
      sub:      "业务通知",
      icon:     Bell,
      iconBg:   "bg-red-50",
      iconClr:  "text-red-500",
      accent:   "border-l-red-400",
      href:     "/pub/notifications",
      urgent:   unreadCount > 0,
    },
    {
      label:    "质保管理",
      value:    null,
      sub:      "查看质保详情",
      icon:     ShieldCheck,
      iconBg:   "bg-violet-50",
      iconClr:  "text-violet-600",
      accent:   "border-l-violet-400",
      href:     "/pub/demands",
    },
  ];

  return (
    <PubLayout>
      <div className="space-y-8">

        {/* ── Welcome Card ── */}
        <div className="bg-gradient-to-br from-primary to-blue-700 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="relative z-10">
            <p className="text-blue-200 text-sm font-medium mb-1">欢迎回来</p>
            <h1 className="text-2xl font-extrabold tracking-tight mb-4">
              {nickname || "发单方"}
            </h1>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => navigate("/pub/demands")}
                className="bg-white text-primary px-4 py-2 rounded-xl font-bold text-sm shadow hover:bg-blue-50 transition-all active:scale-95"
              >
                需求管理
              </button>
              <button
                onClick={() => navigate("/pub/notifications")}
                className="bg-white/15 text-white border border-white/30 px-4 py-2 rounded-xl font-bold text-sm hover:bg-white/25 transition-all"
              >
                消息中心
                {unreadCount > 0 && (
                  <span className="ml-1.5 bg-red-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => navigate("/pub/profile")}
                className="bg-white/15 text-white border border-white/30 px-4 py-2 rounded-xl font-bold text-sm hover:bg-white/25 transition-all"
              >
                企业信息
              </button>
            </div>
          </div>
          <UserCircle size={120} className="absolute -bottom-6 -right-6 text-white/10" />
        </div>

        {/* ── Business KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {STAT_CARDS.map(card => {
            const Icon = card.icon;
            return (
              <button
                key={card.label}
                onClick={() => navigate(card.href)}
                className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${card.accent} text-left hover:shadow-md transition-all group relative`}
              >
                {card.urgent && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                )}
                <div className={`w-9 h-9 rounded-xl ${card.iconBg} flex items-center justify-center mb-3`}>
                  <Icon size={18} className={card.iconClr} />
                </div>
                <p className="text-[22px] font-extrabold text-blue-900 leading-none mb-1">
                  {card.value !== null ? card.value : "—"}
                </p>
                <p className="text-[11px] font-bold text-slate-700 leading-snug">{card.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{card.sub}</p>
              </button>
            );
          })}
        </div>

        {/* ── Bottom Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Demand Table */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-blue-900">需求进度追踪</h3>
                <button
                  onClick={() => navigate("/pub/demands")}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  查看全部 <ChevronsRight size={14} />
                </button>
              </div>
              <div className="divide-y divide-slate-50/80">
                {tableData?.items?.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-sm">暂无需求，前往发布第一个需求</div>
                )}
                {tableData?.items?.slice(0, 6).map((d) => {
                  const statusInfo = DEMAND_STATUS_LABELS[d.status] ?? { label: d.status, cls: "bg-slate-100 text-slate-500" };
                  return (
                    <div
                      key={d.id}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/60 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/pub/demands/${d.id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 font-mono mb-0.5">
                          {(d as any).demandNo ?? `#JDB-${String(d.id).padStart(4, "0")}`}
                        </p>
                        <p className="text-sm font-bold text-blue-900 group-hover:text-primary transition-colors truncate">
                          {d.title}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap ${statusInfo.cls}`}>
                          {statusInfo.label}
                        </span>
                        {d.deadline && (
                          <span className="hidden sm:flex items-center gap-1 text-[10px] text-slate-400">
                            <Clock size={10} /> {String(d.deadline).slice(0, 10)}
                          </span>
                        )}
                        <ArrowRight size={14} className="text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Notifications */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden h-full">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-blue-900 flex items-center gap-2">
                  最近消息
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-red-400 text-white font-bold px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => navigate("/pub/notifications")}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  查看全部
                </button>
              </div>
              <div className="divide-y divide-slate-50/80">
                {recentNotifs.length === 0 && (
                  <div className="py-10 text-center text-slate-400 text-sm">暂无消息</div>
                )}
                {recentNotifs.map(n => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-5 py-3.5 cursor-pointer hover:bg-slate-50/60 transition-colors ${
                      !n.isRead ? "bg-blue-50/40" : ""
                    }`}
                    onClick={() => navigate("/pub/notifications")}
                  >
                    <div className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${!n.isRead ? "bg-primary" : "bg-transparent"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold leading-snug truncate ${!n.isRead ? "text-blue-900" : "text-slate-600"}`}>
                        {n.title}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock size={9} /> {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </PubLayout>
  );
}
