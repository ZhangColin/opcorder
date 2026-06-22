import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  FileSignature, CreditCard, PackageCheck, Wrench,
  Bell, ChevronRight, AlertCircle, ArrowRight,
  CheckCircle2, Clock, TrendingUp,
} from "lucide-react";
import { useListNotifications } from "@workspace/api-client-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePublisherCompanyLogo } from "@/hooks/use-publisher-profile";
import { v2Get } from "@/lib/v2api";
import { PubLayout } from "@/components/pub/PubLayout";

/* ── types ── */
interface Contract {
  id: number;
  contractNo: string;
  status: string;
  demandTitle: string | null;
  createdAt: string;
}
interface PaymentPlan {
  id: number;
  clientDemandId: number;
  itemNo: number;
  description: string | null;
  amount: number;
  dueDate: string;
  status: string;
  isOverdue: boolean;
  demandTitle: string | null;
}
interface DeliveryItem {
  id: number;
  title: string;
  status: string;
  createdByNickname: string | null;
  demandTitle: string | null;
  createdAt: string;
}
interface Ticket {
  id: number;
  title: string;
  status: string;
  demandTitle: string | null;
  createdAt: string;
}

function fmtAmount(n: number) {
  if (n >= 10000) return `¥${(n / 10000).toFixed(1)}万`;
  return `¥${n.toLocaleString()}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m}分钟前`;
  if (h < 24) return `${h}小时前`;
  return `${d}天前`;
}

/* ── small action row item ── */
function ActionItem({ label, sub, urgent, href, navigate }: {
  label: string; sub?: string; urgent?: boolean; href: string; navigate: (h: string) => void;
}) {
  return (
    <div
      onClick={() => navigate(href)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all hover:translate-x-0.5 group ${
        urgent ? "bg-red-50 hover:bg-red-100" : "bg-slate-50 hover:bg-slate-100"
      }`}
    >
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${urgent ? "bg-red-400 animate-pulse" : "bg-slate-300"}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${urgent ? "text-red-800" : "text-slate-700"}`}>{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
      <ArrowRight size={14} className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${urgent ? "text-red-500" : "text-slate-400"}`} />
    </div>
  );
}

export default function PubHome() {
  const [, navigate] = useLocation();
  const { userId, nickname } = useCurrentUser();
  const companyLogo = usePublisherCompanyLogo(userId);

  /* ── v2 data ── */
  const { data: contracts = [] } = useQuery<Contract[]>({
    queryKey: ["pub-home-contracts"],
    queryFn: () => v2Get("/contracts?channel=a"),
    staleTime: 30_000,
  });

  const { data: payments = [] } = useQuery<PaymentPlan[]>({
    queryKey: ["pub-home-payments"],
    queryFn: () => v2Get("/payment-plans"),
    staleTime: 30_000,
  });

  const { data: deliveries = [] } = useQuery<DeliveryItem[]>({
    queryKey: ["pub-home-deliveries"],
    queryFn: () => v2Get("/deliverables-a"),
    staleTime: 30_000,
  });

  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ["pub-home-tickets"],
    queryFn: () => v2Get("/tickets-a"),
    staleTime: 30_000,
  });

  const { data: notifData } = useListNotifications({ page: 1, limit: 5 });

  /* ── computed ── */
  const contractsPending = contracts.filter(c => c.status === "pending_publisher_confirm");
  const contractsSigning  = contracts.filter(c => c.status === "pending_sign");
  const paymentsOverdue   = payments.filter(p => p.isOverdue);
  const paymentsPending   = payments.filter(p => p.status === "pending");
  const pendingAmount     = paymentsPending.reduce((s, p) => s + p.amount, 0);
  const deliveriesPending = deliveries.filter(d => d.status === "pending");
  const ticketsOpen       = tickets.filter(t => t.status === "open");
  const unreadCount       = notifData?.unreadCount ?? 0;
  const recentNotifs      = notifData?.items ?? [];

  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  const avatarChar = (nickname ?? "?").slice(0, 1).toUpperCase();

  /* ── stat cards ── */
  const STATS = [
    {
      icon: FileSignature,
      label: "合同",
      primary: contracts.length,
      unit: "份",
      alert: contractsPending.length > 0 ? `${contractsPending.length} 待确认` : null,
      alertColor: "text-amber-600",
      href: "/pub/contracts",
      color: "from-cyan-500 to-cyan-600",
    },
    {
      icon: CreditCard,
      label: "付款",
      primary: pendingAmount > 0 ? fmtAmount(pendingAmount) : "—",
      unit: pendingAmount > 0 ? "待付" : "",
      alert: paymentsOverdue.length > 0 ? `${paymentsOverdue.length} 项逾期` : null,
      alertColor: "text-red-500",
      href: "/pub/payments",
      color: "from-emerald-500 to-emerald-600",
    },
    {
      icon: PackageCheck,
      label: "交付确认",
      primary: deliveries.length,
      unit: "件",
      alert: deliveriesPending.length > 0 ? `${deliveriesPending.length} 待确认` : null,
      alertColor: "text-purple-600",
      href: "/pub/deliveries",
      color: "from-violet-500 to-violet-600",
    },
    {
      icon: Wrench,
      label: "质保工单",
      primary: tickets.length,
      unit: "个",
      alert: ticketsOpen.length > 0 ? `${ticketsOpen.length} 处理中` : null,
      alertColor: "text-blue-600",
      href: "/pub/tickets",
      color: "from-blue-500 to-blue-600",
    },
  ];

  const hasActions = contractsPending.length > 0 || paymentsOverdue.length > 0 ||
    paymentsPending.length > 0 || deliveriesPending.length > 0 ||
    ticketsOpen.length > 0 || unreadCount > 0;

  return (
    <PubLayout>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Identity Banner ── */}
        <div className="bg-gradient-to-br from-primary via-blue-700 to-blue-800 rounded-2xl p-6 text-white relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 right-20 w-32 h-32 bg-white/5 rounded-full translate-y-1/2" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              {/* Avatar / Logo */}
              <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-2xl font-extrabold text-white shadow-lg overflow-hidden shrink-0">
                {companyLogo
                  ? <img src={companyLogo} alt={nickname ?? ""} className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  : avatarChar}
              </div>
              <div>
                <p className="text-blue-200 text-xs font-medium uppercase tracking-widest mb-1">发单方 · 机构账户</p>
                <h1 className="text-2xl font-extrabold tracking-tight">{nickname || "我的企业"}</h1>
                <p className="text-blue-200 text-xs mt-1">{today}</p>
              </div>
            </div>

            {/* Right: urgent badges */}
            <div className="flex flex-wrap gap-2">
              {contractsPending.length > 0 && (
                <button
                  onClick={() => navigate("/pub/contracts")}
                  className="flex items-center gap-1.5 bg-amber-400/20 border border-amber-300/30 text-amber-100 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-amber-400/30 transition-colors"
                >
                  <AlertCircle size={12} /> {contractsPending.length} 合同待确认
                </button>
              )}
              {paymentsOverdue.length > 0 && (
                <button
                  onClick={() => navigate("/pub/payments")}
                  className="flex items-center gap-1.5 bg-red-400/20 border border-red-300/30 text-red-100 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-red-400/30 transition-colors"
                >
                  <AlertCircle size={12} /> {paymentsOverdue.length} 付款逾期
                </button>
              )}
              {deliveriesPending.length > 0 && (
                <button
                  onClick={() => navigate("/pub/deliveries")}
                  className="flex items-center gap-1.5 bg-white/15 border border-white/20 text-white/90 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-white/25 transition-colors"
                >
                  <PackageCheck size={12} /> {deliveriesPending.length} 交付待确认
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={() => navigate("/pub/notifications")}
                  className="flex items-center gap-1.5 bg-white/15 border border-white/20 text-white/90 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-white/25 transition-colors"
                >
                  <Bell size={12} /> {unreadCount} 条未读
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STATS.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                onClick={() => navigate(s.href)}
                className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-left hover:shadow-md transition-all relative overflow-hidden"
              >
                <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${s.color} rounded-l-2xl`} />
                <div className="pl-2">
                  <div className="flex items-center justify-between mb-3">
                    <Icon size={18} className="text-slate-400 group-hover:text-primary transition-colors" />
                    <ChevronRight size={14} className="text-slate-200 group-hover:text-primary transition-colors" />
                  </div>
                  <p className="text-2xl font-extrabold text-blue-900 leading-none">
                    {s.primary}
                    {s.unit && <span className="text-sm font-bold text-slate-400 ml-1">{s.unit}</span>}
                  </p>
                  <p className="text-xs font-bold text-slate-500 mt-1">{s.label}</p>
                  {s.alert && (
                    <p className={`text-[11px] font-bold mt-1.5 flex items-center gap-1 ${s.alertColor}`}>
                      <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                      {s.alert}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Main body ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Left: Action items */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center gap-2">
                <TrendingUp size={16} className="text-primary" />
                <h2 className="font-bold text-blue-900 text-sm">待处理事务</h2>
              </div>

              {!hasActions ? (
                <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
                  <CheckCircle2 size={36} className="text-green-300" />
                  <p className="text-sm font-medium">一切就绪，暂无待处理事务</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">

                  {/* Contracts */}
                  {(contractsPending.length > 0 || contractsSigning.length > 0) && (
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 px-1">合同</p>
                      <div className="space-y-1.5">
                        {contractsPending.map(c => (
                          <ActionItem
                            key={c.id}
                            label={`合同 ${c.contractNo} 待您确认`}
                            sub={c.demandTitle ?? undefined}
                            urgent
                            href="/pub/contracts"
                            navigate={navigate}
                          />
                        ))}
                        {contractsSigning.map(c => (
                          <ActionItem
                            key={c.id}
                            label={`合同 ${c.contractNo} 待签约`}
                            sub={c.demandTitle ?? undefined}
                            href="/pub/contracts"
                            navigate={navigate}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payments */}
                  {(paymentsOverdue.length > 0 || paymentsPending.length > 0) && (
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 px-1">付款</p>
                      <div className="space-y-1.5">
                        {paymentsOverdue.map(p => (
                          <ActionItem
                            key={p.id}
                            label={`${fmtAmount(p.amount)} 付款已逾期`}
                            sub={`${p.demandTitle ?? ""} · 截止 ${p.dueDate.slice(0, 10)}`}
                            urgent
                            href="/pub/payments"
                            navigate={navigate}
                          />
                        ))}
                        {paymentsPending.filter(p => !p.isOverdue).slice(0, 3).map(p => (
                          <ActionItem
                            key={p.id}
                            label={`${fmtAmount(p.amount)} 待付款`}
                            sub={`${p.demandTitle ?? ""} · 截止 ${p.dueDate.slice(0, 10)}`}
                            href="/pub/payments"
                            navigate={navigate}
                          />
                        ))}
                        {paymentsPending.filter(p => !p.isOverdue).length > 3 && (
                          <button
                            onClick={() => navigate("/pub/payments")}
                            className="w-full text-xs font-bold text-primary hover:underline text-center py-1"
                          >
                            查看全部 {paymentsPending.length} 项待付款 →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Deliveries */}
                  {deliveriesPending.length > 0 && (
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 px-1">交付确认</p>
                      <div className="space-y-1.5">
                        {deliveriesPending.slice(0, 3).map(d => (
                          <ActionItem
                            key={d.id}
                            label={d.title || `交付物待确认`}
                            sub={d.demandTitle ?? undefined}
                            href="/pub/deliveries"
                            navigate={navigate}
                          />
                        ))}
                        {deliveriesPending.length > 3 && (
                          <button
                            onClick={() => navigate("/pub/deliveries")}
                            className="w-full text-xs font-bold text-primary hover:underline text-center py-1"
                          >
                            查看全部 {deliveriesPending.length} 件待确认 →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tickets */}
                  {ticketsOpen.length > 0 && (
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 px-1">质保工单</p>
                      <div className="space-y-1.5">
                        {ticketsOpen.slice(0, 2).map(t => (
                          <ActionItem
                            key={t.id}
                            label={t.title}
                            sub={t.demandTitle ?? undefined}
                            href="/pub/tickets"
                            navigate={navigate}
                          />
                        ))}
                        {ticketsOpen.length > 2 && (
                          <button
                            onClick={() => navigate("/pub/tickets")}
                            className="w-full text-xs font-bold text-primary hover:underline text-center py-1"
                          >
                            查看全部 {ticketsOpen.length} 个处理中工单 →
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Unread messages */}
                  {unreadCount > 0 && (
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 px-1">消息</p>
                      <ActionItem
                        label={`${unreadCount} 条未读消息`}
                        href="/pub/notifications"
                        navigate={navigate}
                      />
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>

          {/* Right: Notifications + quick links */}
          <div className="lg:col-span-5 flex flex-col gap-4">

            {/* Notifications */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex-1">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                <h2 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                  <Bell size={14} className="text-slate-400" />
                  最近消息
                  {unreadCount > 0 && (
                    <span className="bg-red-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                      {unreadCount}
                    </span>
                  )}
                </h2>
                <button onClick={() => navigate("/pub/notifications")} className="text-xs font-bold text-primary hover:underline">
                  全部
                </button>
              </div>

              <div className="divide-y divide-slate-50">
                {recentNotifs.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    <CheckCircle2 size={22} className="mx-auto mb-2 text-slate-200" />
                    暂无消息
                  </div>
                ) : recentNotifs.map(n => (
                  <div
                    key={n.id}
                    onClick={() => navigate("/pub/notifications")}
                    className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-slate-50/80 transition-colors ${
                      !n.isRead ? "bg-blue-50/30" : ""
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${!n.isRead ? "bg-primary" : "bg-transparent"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-semibold leading-snug truncate ${!n.isRead ? "text-blue-900" : "text-slate-600"}`}>
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

            {/* Quick links row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: FileSignature, label: "合同",   href: "/pub/contracts",   dot: contractsPending.length > 0 },
                { icon: CreditCard,   label: "付款",   href: "/pub/payments",    dot: paymentsOverdue.length > 0 },
                { icon: PackageCheck, label: "交付",   href: "/pub/deliveries",  dot: deliveriesPending.length > 0 },
                { icon: Wrench,       label: "质保",   href: "/pub/tickets",     dot: ticketsOpen.length > 0 },
                { icon: Bell,         label: "消息",   href: "/pub/notifications", dot: unreadCount > 0 },
                { icon: AlertCircle,  label: "企业信息", href: "/pub/profile",    dot: false },
              ].map(s => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.href}
                    onClick={() => navigate(s.href)}
                    className="relative flex flex-col items-center gap-1.5 py-3 rounded-xl bg-slate-50 hover:bg-primary/5 hover:text-primary text-slate-500 transition-colors text-xs font-bold"
                  >
                    <Icon size={16} />
                    <span>{s.label}</span>
                    {s.dot && <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-400" />}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </PubLayout>
  );
}
