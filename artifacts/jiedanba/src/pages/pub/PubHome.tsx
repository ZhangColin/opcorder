import { useLocation } from "wouter";
import {
  FileText, FileSignature, CreditCard, PackageCheck,
  Wrench, Bell, ArrowRight, PlusCircle, ChevronRight,
  Clock, AlertCircle, CheckCircle2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useListDemands, useListNotifications } from "@workspace/api-client-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { v2Get } from "@/lib/v2api";
import { PubLayout } from "@/components/pub/PubLayout";

/* ─── helpers ─── */
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟前`;
  if (h < 24) return `${h}小时前`;
  if (d < 30) return `${d}天前`;
  return new Date(dateStr).toLocaleDateString("zh-CN");
}

/* ─── stage map: demand status → current pipeline stage ─── */
const STAGE_MAP: Record<string, { label: string; step: number; cls: string }> = {
  pending_review:     { label: "待审核",   step: 0, cls: "bg-amber-50 text-amber-700" },
  published:          { label: "待匹配",   step: 0, cls: "bg-amber-50 text-amber-700" },
  open:               { label: "待匹配",   step: 0, cls: "bg-amber-50 text-amber-700" },
  matched:            { label: "合同阶段", step: 1, cls: "bg-cyan-50 text-cyan-700" },
  in_progress:        { label: "执行中",   step: 2, cls: "bg-blue-50 text-blue-700" },
  pending_acceptance: { label: "待验收",   step: 3, cls: "bg-purple-50 text-purple-700" },
  completed:          { label: "已完成",   step: 5, cls: "bg-green-50 text-green-700" },
  closed:             { label: "已关闭",   step: -1, cls: "bg-slate-100 text-slate-500" },
};

/* ─── pipeline steps (visual only) ─── */
const PIPELINE = [
  { label: "需求",   href: "/pub/demands" },
  { label: "合同",   href: "/pub/contracts" },
  { label: "付款",   href: "/pub/payments" },
  { label: "交付",   href: "/pub/deliveries" },
  { label: "质保",   href: "/pub/tickets" },
];

/* ─── module shortcuts ─── */
const SHORTCUTS = [
  { icon: FileText,      label: "需求管理",  href: "/pub/demands" },
  { icon: FileSignature, label: "合同管理",  href: "/pub/contracts" },
  { icon: CreditCard,    label: "付款管理",  href: "/pub/payments" },
  { icon: PackageCheck,  label: "交付确认",  href: "/pub/deliveries" },
  { icon: Wrench,        label: "质保工单",  href: "/pub/tickets" },
  { icon: Bell,          label: "消息中心",  href: "/pub/notifications" },
];

interface BadgeCounts { pendingA: number; pendingB: number; }

export default function PubHome() {
  const [, navigate] = useLocation();
  const { userId, nickname } = useCurrentUser();

  const { data: demandsData } = useListDemands({
    publisherId: userId || undefined,
    limit: 20,
  });
  const { data: notifData } = useListNotifications({ page: 1, limit: 6 });
  const { data: badges }    = useQuery<BadgeCounts>({
    queryKey: ["delivery-badge-counts"],
    queryFn:  () => v2Get("/delivery-badge-counts"),
    staleTime: 20_000,
  });

  const demands     = demandsData?.items ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;
  const pendingDelivery = badges?.pendingA ?? 0;
  const recentNotifs = notifData?.items?.slice(0, 5) ?? [];

  /* active = anything not completed/closed/draft */
  const active = demands.filter(d =>
    !["completed", "closed", "draft"].includes(d.status)
  );
  const pendingAcceptance = demands.filter(d => d.status === "pending_acceptance");

  const today = new Date().toLocaleDateString("zh-CN", {
    month: "long", day: "numeric", weekday: "short",
  });

  return (
    <PubLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Top bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">{today}</p>
            <h1 className="text-xl font-extrabold text-blue-900">
              你好，{nickname || "发单方"}
            </h1>
          </div>
          <button
            onClick={() => navigate("/pub/demands/new")}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-sm hover:bg-primary/90 transition-all active:scale-95 shrink-0"
          >
            <PlusCircle size={15} /> 发布新需求
          </button>
        </div>

        {/* ── Attention banner (only when there are items) ── */}
        {(pendingDelivery > 0 || unreadCount > 0 || pendingAcceptance.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {pendingAcceptance.length > 0 && (
              <button
                onClick={() => navigate("/pub/deliveries")}
                className="flex items-center gap-2 bg-purple-50 border border-purple-200 text-purple-700 text-sm font-bold px-4 py-2 rounded-xl hover:bg-purple-100 transition-colors"
              >
                <AlertCircle size={14} />
                {pendingAcceptance.length} 个交付待验收
                <ArrowRight size={13} />
              </button>
            )}
            {pendingDelivery > 0 && (
              <button
                onClick={() => navigate("/pub/deliveries")}
                className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold px-4 py-2 rounded-xl hover:bg-amber-100 transition-colors"
              >
                <PackageCheck size={14} />
                {pendingDelivery} 份交付物待确认
                <ArrowRight size={13} />
              </button>
            )}
            {unreadCount > 0 && (
              <button
                onClick={() => navigate("/pub/notifications")}
                className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm font-bold px-4 py-2 rounded-xl hover:bg-red-100 transition-colors"
              >
                <Bell size={14} />
                {unreadCount} 条未读消息
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        )}

        {/* ── Main two-column ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Left: Active Projects */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                <h2 className="font-bold text-blue-900">进行中的项目</h2>
                <button
                  onClick={() => navigate("/pub/demands")}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  全部需求 <ChevronRight size={13} />
                </button>
              </div>

              {active.length === 0 ? (
                <div className="py-14 flex flex-col items-center gap-3 text-slate-400">
                  <FileText size={32} className="text-slate-200" />
                  <p className="text-sm">暂无进行中的项目</p>
                  <button
                    onClick={() => navigate("/pub/demands/new")}
                    className="text-primary text-sm font-bold hover:underline"
                  >
                    立即发布第一个需求 →
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {active.slice(0, 8).map(d => {
                    const stage = STAGE_MAP[d.status] ?? { label: d.status, step: 0, cls: "bg-slate-100 text-slate-500" };
                    return (
                      <div
                        key={d.id}
                        className="px-5 py-4 hover:bg-slate-50/70 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/pub/demands/${d.id}`)}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-blue-900 group-hover:text-primary transition-colors truncate leading-snug">
                              {d.title}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {(d as any).demandNo ?? `JDB-${String(d.id).padStart(4, "0")}`}
                            </p>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0 ${stage.cls}`}>
                            {stage.label}
                          </span>
                        </div>

                        {/* mini pipeline indicator */}
                        <div className="flex items-center gap-1 mt-2">
                          {PIPELINE.map((p, i) => (
                            <div key={p.label} className="flex items-center gap-1">
                              <div className={`h-1.5 rounded-full transition-all ${
                                i < stage.step
                                  ? "bg-primary w-8"
                                  : i === stage.step
                                    ? "bg-primary/50 w-6"
                                    : "bg-slate-100 w-4"
                              }`} />
                              {i < PIPELINE.length - 1 && (
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-200 shrink-0" />
                              )}
                            </div>
                          ))}
                          <span className="text-[10px] text-slate-400 ml-2">{stage.label}</span>
                        </div>

                        {d.deadline && (
                          <p className="flex items-center gap-1 text-[10px] text-slate-400 mt-1.5">
                            <Clock size={9} /> 截止 {String(d.deadline).slice(0, 10)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-4 flex flex-col gap-4">

            {/* Module shortcuts */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <h2 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">快捷入口</h2>
              <div className="grid grid-cols-2 gap-2">
                {SHORTCUTS.map(s => {
                  const Icon = s.icon;
                  const isDelivery = s.href === "/pub/deliveries";
                  const isBell    = s.href === "/pub/notifications";
                  const dot = (isDelivery && pendingDelivery > 0) || (isBell && unreadCount > 0);
                  return (
                    <button
                      key={s.href}
                      onClick={() => navigate(s.href)}
                      className="relative flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-primary/5 hover:text-primary text-slate-600 text-xs font-bold transition-colors text-left"
                    >
                      <Icon size={14} className="shrink-0" />
                      <span className="truncate">{s.label}</span>
                      {dot && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recent notifications */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex-1">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-50">
                <h2 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                  最近消息
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-red-400 text-white font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {unreadCount}
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => navigate("/pub/notifications")}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  全部
                </button>
              </div>

              <div className="divide-y divide-slate-50">
                {recentNotifs.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    <CheckCircle2 size={24} className="mx-auto mb-2 text-slate-200" />
                    暂无消息
                  </div>
                ) : (
                  recentNotifs.map(n => (
                    <div
                      key={n.id}
                      onClick={() => navigate("/pub/notifications")}
                      className={`flex items-start gap-2.5 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50/80 ${
                        !n.isRead ? "bg-blue-50/30" : ""
                      }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${!n.isRead ? "bg-primary" : "bg-transparent"}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-semibold leading-snug truncate ${!n.isRead ? "text-blue-900" : "text-slate-600"}`}>
                          {n.title}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </div>

      </div>
    </PubLayout>
  );
}
