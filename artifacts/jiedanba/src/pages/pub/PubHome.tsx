import { useLocation } from "wouter";
import {
  FileText, FileSignature, Banknote, ShieldCheck,
  Bell, Building2, ChevronRight, CheckCircle2,
  Clock, ArrowUpRight,
} from "lucide-react";
import { useListDemands, useListNotifications } from "@workspace/api-client-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PubLayout } from "@/components/pub/PubLayout";

export default function PubHome() {
  const [, navigate] = useLocation();
  const { userId, nickname } = useCurrentUser();

  const { data: demandsAll } = useListDemands({ publisherId: userId || undefined, limit: 200 });
  const { data: notifData }  = useListNotifications({ page: 1, limit: 1 });

  const demands     = demandsAll?.items ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;

  const count = (statuses: string[]) => demands.filter(d => statuses.includes(d.status)).length;

  const activeCount   = count(["in_progress", "matched"]);
  const recruitCount  = count(["published", "open", "pending_review"]);
  const pendingCount  = count(["pending_acceptance"]);

  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  const MODULES = [
    {
      id:    "demands",
      icon:  FileText,
      title: "需求管理",
      desc:  "发布需求、管理招募进度、指派 OPC 承接",
      href:  "/pub/demands",
      color: "bg-blue-500",
      light: "bg-blue-50",
      text:  "text-blue-600",
      border:"border-blue-100",
      badge: activeCount + recruitCount > 0
        ? `${activeCount} 进行中${recruitCount > 0 ? "  ·  " + recruitCount + " 招募中" : ""}`
        : "暂无活跃需求",
      badgeUrgent: false,
    },
    {
      id:    "contracts",
      icon:  FileSignature,
      title: "合同管理",
      desc:  "查看与 OPC 的合同条款、签署状态、履约记录",
      href:  "/pub/demands",
      color: "bg-cyan-500",
      light: "bg-cyan-50",
      text:  "text-cyan-600",
      border:"border-cyan-100",
      badge: activeCount > 0 ? `${activeCount} 份合同执行中` : "暂无执行合同",
      badgeUrgent: false,
    },
    {
      id:    "payment",
      icon:  Banknote,
      title: "付款与交付",
      desc:  "收款计划付款、审核 OPC 提交的交付物",
      href:  "/pub/demands",
      color: "bg-emerald-500",
      light: "bg-emerald-50",
      text:  "text-emerald-600",
      border:"border-emerald-100",
      badge: pendingCount > 0 ? `${pendingCount} 个待验收` : "暂无待处理",
      badgeUrgent: pendingCount > 0,
    },
    {
      id:    "warranty",
      icon:  ShieldCheck,
      title: "质保管理",
      desc:  "跟进交付后质保期、问题反馈与修复记录",
      href:  "/pub/demands",
      color: "bg-violet-500",
      light: "bg-violet-50",
      text:  "text-violet-600",
      border:"border-violet-100",
      badge: "查看质保详情",
      badgeUrgent: false,
    },
    {
      id:    "notifications",
      icon:  Bell,
      title: "消息中心",
      desc:  "需求动态、交付提醒、质保到期等业务通知",
      href:  "/pub/notifications",
      color: "bg-rose-500",
      light: "bg-rose-50",
      text:  "text-rose-600",
      border:"border-rose-100",
      badge: unreadCount > 0 ? `${unreadCount} 条未读` : "暂无未读消息",
      badgeUrgent: unreadCount > 0,
    },
    {
      id:    "profile",
      icon:  Building2,
      title: "企业信息",
      desc:  "完善企业资料、上传 Logo、管理联系方式",
      href:  "/pub/profile",
      color: "bg-slate-500",
      light: "bg-slate-50",
      text:  "text-slate-600",
      border:"border-slate-100",
      badge: "编辑企业信息",
      badgeUrgent: false,
    },
  ];

  return (
    <PubLayout>
      <div className="max-w-4xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pt-2">
          <div>
            <p className="text-xs text-slate-400 font-medium mb-1">{today}</p>
            <h1 className="text-2xl font-extrabold text-blue-900 tracking-tight">
              欢迎回来，{nickname || "发单方"}
            </h1>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {activeCount > 0 && (
              <span className="flex items-center gap-1 bg-blue-50 text-blue-700 font-bold px-2.5 py-1 rounded-full">
                <Clock size={11} /> {activeCount} 个需求进行中
              </span>
            )}
            {pendingCount > 0 && (
              <span className="flex items-center gap-1 bg-purple-50 text-purple-700 font-bold px-2.5 py-1 rounded-full animate-pulse">
                <CheckCircle2 size={11} /> {pendingCount} 个待验收
              </span>
            )}
            {unreadCount > 0 && (
              <span className="flex items-center gap-1 bg-rose-50 text-rose-600 font-bold px-2.5 py-1 rounded-full">
                <Bell size={11} /> {unreadCount} 条未读
              </span>
            )}
          </div>
        </div>

        {/* ── Module Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map(mod => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.id}
                onClick={() => navigate(mod.href)}
                className={`group relative bg-white rounded-2xl border ${mod.border} p-6 text-left shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-2xl ${mod.light} flex items-center justify-center mb-4`}>
                  <Icon size={22} className={mod.text} />
                </div>

                {/* Title + arrow */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="text-base font-extrabold text-blue-900">{mod.title}</h2>
                  <ArrowUpRight
                    size={16}
                    className={`shrink-0 mt-0.5 text-slate-300 group-hover:${mod.text} transition-colors`}
                  />
                </div>

                {/* Description */}
                <p className="text-xs text-slate-500 leading-relaxed mb-4">{mod.desc}</p>

                {/* Status badge */}
                <div className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                  mod.badgeUrgent
                    ? `${mod.light} ${mod.text}`
                    : "bg-slate-50 text-slate-500"
                }`}>
                  {mod.badgeUrgent && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                  {mod.badge}
                </div>

                {/* Color bar at bottom */}
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl ${mod.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </button>
            );
          })}
        </div>

        {/* ── Quick Entry Footer ── */}
        <div className="flex items-center justify-between pt-2 pb-4 border-t border-slate-100">
          <p className="text-xs text-slate-400">选择模块进入详细管理页面</p>
          <button
            onClick={() => navigate("/pub/demands")}
            className="flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
          >
            需求总览 <ChevronRight size={14} />
          </button>
        </div>

      </div>
    </PubLayout>
  );
}
