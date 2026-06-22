import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  FileSignature, CreditCard, PackageCheck, Wrench,
  Bell, ChevronRight, AlertCircle, ArrowRight,
  CheckCircle2, Clock, PlusCircle, Building2,
  LayoutDashboard, FileText,
} from "lucide-react";
import { useListNotifications } from "@workspace/api-client-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePublisherCompanyLogo } from "@/hooks/use-publisher-profile";
import { v2Get } from "@/lib/v2api";
import { PubLayout } from "@/components/pub/PubLayout";

/* ── types ── */
interface ClientDemand {
  id: number; title: string; status: string; createdAt: string;
}
interface Contract {
  id: number; contractNo: string; status: string;
  demandTitle: string | null; createdAt: string;
}
interface PaymentPlan {
  id: number; clientDemandId: number; itemNo: number;
  description: string | null; amount: number;
  dueDate: string; status: string; isOverdue: boolean;
  demandTitle: string | null;
}
interface DeliveryItem {
  id: number; title: string; status: string;
  createdByNickname: string | null; demandTitle: string | null; createdAt: string;
}
interface Ticket {
  id: number; title: string; status: string;
  demandTitle: string | null; createdAt: string;
}

function fmtAmount(n: number) {
  if (n >= 10000) return `¥${(n / 10000).toFixed(1)}万`;
  return `¥${n.toLocaleString()}`;
}

/* ── single action row ── */
function ActionRow({ label, sub, urgent, href, navigate }: {
  label: string; sub?: string; urgent?: boolean; href: string;
  navigate: (h: string) => void;
}) {
  return (
    <div
      onClick={() => navigate(href)}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all group hover:translate-x-0.5 ${
        urgent
          ? "bg-red-50 border border-red-100 hover:bg-red-100/80"
          : "bg-slate-50 border border-slate-100 hover:bg-slate-100/80"
      }`}
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${urgent ? "bg-red-400 animate-pulse" : "bg-slate-300"}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold leading-tight truncate ${urgent ? "text-red-800" : "text-slate-700"}`}>{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
      <ArrowRight size={13} className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${urgent ? "text-red-400" : "text-slate-400"}`} />
    </div>
  );
}

/* ── module status card (right column) ── */
function ModuleCard({ icon: Icon, title, href, navigate, segments, cta, ctaUrgent }: {
  icon: React.ElementType; title: string; href: string;
  navigate: (h: string) => void;
  segments: { label: string; count: number; color: string }[];
  cta?: string; ctaUrgent?: boolean;
}) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center">
            <Icon size={15} className="text-slate-500" />
          </div>
          <span className="text-sm font-bold text-blue-900">{title}</span>
        </div>
        <button
          onClick={() => navigate(href)}
          className="text-xs text-primary font-bold hover:underline flex items-center gap-0.5"
        >
          全部 <ChevronRight size={12} />
        </button>
      </div>

      {/* Progress bar breakdown */}
      {total > 0 ? (
        <>
          <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
            {segments.filter(s => s.count > 0).map(s => (
              <div
                key={s.label}
                className={`${s.color} transition-all`}
                style={{ width: `${(s.count / total) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {segments.map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${s.color}`} />
                <span className="text-[11px] text-slate-500">{s.label}</span>
                <span className="text-[11px] font-bold text-slate-700">{s.count}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-400 italic">暂无记录</p>
      )}

      {cta && (
        <button
          onClick={() => navigate(href)}
          className={`w-full text-xs font-bold py-2 rounded-lg transition-colors ${
            ctaUrgent
              ? "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
              : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
          }`}
        >
          {cta}
        </button>
      )}
    </div>
  );
}

export default function PubHome() {
  const [, navigate] = useLocation();
  const { userId, nickname } = useCurrentUser();
  const companyLogo = usePublisherCompanyLogo(userId);

  /* v2 data */
  const { data: demands = [] } = useQuery<ClientDemand[]>({
    queryKey: ["pub-home-demands-list"],
    queryFn:  () => v2Get<{ items: ClientDemand[] }>("/client-demands?limit=200").then(r => Array.isArray(r) ? r : (r.items ?? [])),
    staleTime: 30_000,
  });
  const { data: contracts = [] } = useQuery<Contract[]>({
    queryKey: ["pub-home-contracts"],
    queryFn:  () => v2Get("/contracts?channel=a"),
    staleTime: 30_000,
  });
  const { data: payments = [] } = useQuery<PaymentPlan[]>({
    queryKey: ["pub-home-payments"],
    queryFn:  () => v2Get("/payment-plans"),
    staleTime: 30_000,
  });
  const { data: deliveries = [] } = useQuery<DeliveryItem[]>({
    queryKey: ["pub-home-deliveries"],
    queryFn:  () => v2Get("/deliverables-a"),
    staleTime: 30_000,
  });
  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ["pub-home-tickets"],
    queryFn:  () => v2Get("/tickets-a"),
    staleTime: 30_000,
  });
  const { data: notifData } = useListNotifications({ page: 1, limit: 1 });

  /* computed */
  const demandsActive     = demands.filter(d => !["completed", "closed"].includes(d.status));
  const demandsPending    = demands.filter(d => d.status === "pending_review");
  const contractsPending  = contracts.filter(c => c.status === "pending_publisher_confirm");
  const contractsSigning  = contracts.filter(c => c.status === "pending_sign");
  const contractsSigned   = contracts.filter(c => c.status === "signed");
  const paymentsOverdue   = payments.filter(p => p.isOverdue);
  const paymentsPending   = payments.filter(p => p.status === "pending");
  const paymentsReview    = payments.filter(p => p.status === "awaiting_review");
  const paymentsPaid      = payments.filter(p => p.status === "paid");
  const pendingAmount     = paymentsPending.reduce((s, p) => s + p.amount, 0);
  const deliveriesPending = deliveries.filter(d => d.status === "pending");
  const deliveriesOk      = deliveries.filter(d => d.status === "confirmed");
  const ticketsOpen       = tickets.filter(t => t.status === "open");
  const ticketsClosed     = tickets.filter(t => t.status === "closed");
  const unreadCount       = notifData?.unreadCount ?? 0;

  const hasActions =
    contractsPending.length > 0 || contractsSigning.length > 0 ||
    paymentsOverdue.length > 0  || paymentsPending.length > 0 ||
    deliveriesPending.length > 0 || ticketsOpen.length > 0 || unreadCount > 0;

  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });
  const avatarChar = (nickname ?? "?").slice(0, 1).toUpperCase();

  return (
    <PubLayout>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── Identity Banner ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-700 via-primary to-blue-900 text-white p-6 shadow-lg shadow-primary/20">
          {/* Decorative blobs */}
          <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/5 rounded-full" />
          <div className="absolute -bottom-8 right-32 w-28 h-28 bg-white/5 rounded-full" />
          <div className="absolute top-4 right-60 w-10 h-10 bg-white/5 rounded-full" />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            {/* Left: identity */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-2xl font-extrabold shadow-lg overflow-hidden shrink-0">
                {companyLogo
                  ? <img src={companyLogo} alt="" className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  : avatarChar}
              </div>
              <div>
                <p className="text-blue-200 text-[11px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1">
                  <Building2 size={10} /> 发单方 · 机构账户
                </p>
                <h1 className="text-2xl font-extrabold tracking-tight leading-tight">{nickname || "我的企业"}</h1>
                <p className="text-blue-200 text-xs mt-1.5 flex items-center gap-1.5">
                  <LayoutDashboard size={10} /> {today}
                </p>
              </div>
            </div>

            {/* Right: urgent badges + new demand */}
            <div className="flex flex-col items-end gap-3">
              <div className="flex flex-wrap gap-2 justify-end">
                {contractsPending.length > 0 && (
                  <button onClick={() => navigate("/pub/contracts")}
                    className="flex items-center gap-1.5 bg-amber-400/25 border border-amber-300/30 text-amber-100 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-amber-400/40 transition-colors">
                    <AlertCircle size={11} /> {contractsPending.length} 合同待确认
                  </button>
                )}
                {paymentsOverdue.length > 0 && (
                  <button onClick={() => navigate("/pub/payments")}
                    className="flex items-center gap-1.5 bg-red-400/25 border border-red-300/30 text-red-100 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-red-400/40 transition-colors">
                    <AlertCircle size={11} /> {paymentsOverdue.length} 付款逾期
                  </button>
                )}
                {deliveriesPending.length > 0 && (
                  <button onClick={() => navigate("/pub/deliveries")}
                    className="flex items-center gap-1.5 bg-white/15 border border-white/20 text-white/90 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-white/25 transition-colors">
                    <PackageCheck size={11} /> {deliveriesPending.length} 交付待确认
                  </button>
                )}
                {unreadCount > 0 && (
                  <button onClick={() => navigate("/pub/notifications")}
                    className="flex items-center gap-1.5 bg-white/15 border border-white/20 text-white/90 text-xs font-bold px-3 py-1.5 rounded-full hover:bg-white/25 transition-colors">
                    <Bell size={11} /> {unreadCount} 未读
                  </button>
                )}
              </div>
              <button
                onClick={() => navigate("/pub/demands/new")}
                className="flex items-center gap-2 bg-white text-primary px-4 py-2.5 rounded-xl font-extrabold text-sm shadow-sm hover:bg-blue-50 transition-all active:scale-95"
              >
                <PlusCircle size={15} /> 发布新需求
              </button>
            </div>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 需求 */}
          <button onClick={() => navigate("/pub/demands")}
            className="group text-left bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-2xl p-5 shadow-sm shadow-orange-200 hover:shadow-md hover:shadow-orange-200 transition-all hover:-translate-y-0.5 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
            <div className="absolute bottom-2 right-6 w-8 h-8 bg-white/10 rounded-full" />
            <div className="relative">
              <FileText size={22} className="mb-3 text-white/80" />
              <p className="text-3xl font-extrabold leading-none">{demandsActive.length}</p>
              <p className="text-orange-100 text-xs font-bold mt-1 uppercase tracking-wider">进行中需求</p>
              {demandsPending.length > 0
                ? <p className="text-[11px] font-bold text-yellow-200 mt-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse" />{demandsPending.length} 待审核</p>
                : <p className="text-[11px] text-white/50 mt-2">共 {demands.length} 个需求</p>
              }
            </div>
          </button>

          {/* 合同 */}
          <button onClick={() => navigate("/pub/contracts")}
            className="group text-left bg-gradient-to-br from-cyan-500 to-cyan-600 text-white rounded-2xl p-5 shadow-sm shadow-cyan-200 hover:shadow-md hover:shadow-cyan-200 transition-all hover:-translate-y-0.5 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
            <div className="absolute bottom-2 right-6 w-8 h-8 bg-white/10 rounded-full" />
            <div className="relative">
              <FileSignature size={22} className="mb-3 text-white/80" />
              <p className="text-3xl font-extrabold leading-none">{contracts.length}</p>
              <p className="text-cyan-100 text-xs font-bold mt-1 uppercase tracking-wider">合同</p>
              {contractsPending.length > 0
                ? <p className="text-[11px] font-bold text-amber-200 mt-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />{contractsPending.length} 待确认</p>
                : <p className="text-[11px] text-white/50 mt-2">全部正常</p>
              }
            </div>
          </button>

          {/* 付款 */}
          <button onClick={() => navigate("/pub/payments")}
            className="group text-left bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl p-5 shadow-sm shadow-emerald-200 hover:shadow-md hover:shadow-emerald-200 transition-all hover:-translate-y-0.5 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
            <div className="absolute bottom-2 right-6 w-8 h-8 bg-white/10 rounded-full" />
            <div className="relative">
              <CreditCard size={22} className="mb-3 text-white/80" />
              <p className="text-3xl font-extrabold leading-none">
                {pendingAmount > 0 ? fmtAmount(pendingAmount) : paymentsPaid.length > 0 ? "—" : "—"}
              </p>
              <p className="text-emerald-100 text-xs font-bold mt-1 uppercase tracking-wider">待付款</p>
              {paymentsOverdue.length > 0
                ? <p className="text-[11px] font-bold text-red-200 mt-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-300 animate-pulse" />{paymentsOverdue.length} 项已逾期</p>
                : paymentsPaid.length > 0
                  ? <p className="text-[11px] text-white/50 mt-2">已付 {paymentsPaid.length} 笔</p>
                  : <p className="text-[11px] text-white/50 mt-2">暂无付款计划</p>
              }
            </div>
          </button>

          {/* 交付 */}
          <button onClick={() => navigate("/pub/deliveries")}
            className="group text-left bg-gradient-to-br from-violet-500 to-violet-600 text-white rounded-2xl p-5 shadow-sm shadow-violet-200 hover:shadow-md hover:shadow-violet-200 transition-all hover:-translate-y-0.5 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
            <div className="absolute bottom-2 right-6 w-8 h-8 bg-white/10 rounded-full" />
            <div className="relative">
              <PackageCheck size={22} className="mb-3 text-white/80" />
              <p className="text-3xl font-extrabold leading-none">{deliveries.length}</p>
              <p className="text-violet-100 text-xs font-bold mt-1 uppercase tracking-wider">交付件</p>
              {deliveriesPending.length > 0
                ? <p className="text-[11px] font-bold text-yellow-200 mt-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse" />{deliveriesPending.length} 待确认</p>
                : <p className="text-[11px] text-white/50 mt-2">已确认 {deliveriesOk.length} 件</p>
              }
            </div>
          </button>

          {/* 质保 */}
          <button onClick={() => navigate("/pub/tickets")}
            className="group text-left bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-5 shadow-sm shadow-blue-200 hover:shadow-md hover:shadow-blue-200 transition-all hover:-translate-y-0.5 relative overflow-hidden">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full" />
            <div className="absolute bottom-2 right-6 w-8 h-8 bg-white/10 rounded-full" />
            <div className="relative">
              <Wrench size={22} className="mb-3 text-white/80" />
              <p className="text-3xl font-extrabold leading-none">{tickets.length}</p>
              <p className="text-blue-100 text-xs font-bold mt-1 uppercase tracking-wider">质保工单</p>
              {ticketsOpen.length > 0
                ? <p className="text-[11px] font-bold text-yellow-200 mt-2 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-300 animate-pulse" />{ticketsOpen.length} 处理中</p>
                : <p className="text-[11px] text-white/50 mt-2">已关闭 {ticketsClosed.length} 个</p>
              }
            </div>
          </button>
        </div>

        {/* ── Two columns ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Left: Action items */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-full">
              <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                    <Clock size={13} className="text-primary" />
                  </div>
                  <h2 className="font-bold text-blue-900 text-sm">待处理事务</h2>
                </div>
                {hasActions && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 font-extrabold px-2 py-0.5 rounded-full">
                    需要处理
                  </span>
                )}
              </div>

              <div className="p-4">
                {!hasActions ? (
                  <div className="py-10 flex flex-col items-center gap-3 text-slate-400">
                    <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                      <CheckCircle2 size={28} className="text-green-400" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-600">一切就绪</p>
                      <p className="text-xs text-slate-400 mt-1">暂无待处理事务</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Contracts */}
                    {(contractsPending.length > 0 || contractsSigning.length > 0) && (
                      <div>
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                          <FileSignature size={10} /> 合同
                        </p>
                        <div className="space-y-1.5">
                          {contractsPending.map(c => (
                            <ActionRow key={c.id} label={`合同 ${c.contractNo} 待您确认`} sub={c.demandTitle ?? undefined} urgent href={`/pub/contracts/${c.id}`} navigate={navigate} />
                          ))}
                          {contractsSigning.map(c => (
                            <ActionRow key={c.id} label={`合同 ${c.contractNo} 待签约`} sub={c.demandTitle ?? undefined} href={`/pub/contracts/${c.id}`} navigate={navigate} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Payments */}
                    {(paymentsOverdue.length > 0 || paymentsPending.length > 0) && (
                      <div>
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                          <CreditCard size={10} /> 付款
                        </p>
                        <div className="space-y-1.5">
                          {paymentsOverdue.map(p => (
                            <ActionRow key={`ov-${p.id}`} label={`${fmtAmount(p.amount)} 付款已逾期`} sub={`${p.demandTitle ?? ""} · 截止 ${p.dueDate.slice(0, 10)}`} urgent href={`/pub/payments/${p.id}`} navigate={navigate} />
                          ))}
                          {paymentsPending.filter(p => !p.isOverdue).slice(0, 3).map(p => (
                            <ActionRow key={p.id} label={`${fmtAmount(p.amount)} 待付款`} sub={`${p.demandTitle ?? ""} · 截止 ${p.dueDate.slice(0, 10)}`} href={`/pub/payments/${p.id}`} navigate={navigate} />
                          ))}
                          {paymentsPending.filter(p => !p.isOverdue).length > 3 && (
                            <button onClick={() => navigate("/pub/payments")} className="w-full text-xs font-bold text-primary text-center py-1 hover:underline">
                              查看全部 {paymentsPending.length} 项待付款 →
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Deliveries */}
                    {deliveriesPending.length > 0 && (
                      <div>
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                          <PackageCheck size={10} /> 交付确认
                        </p>
                        <div className="space-y-1.5">
                          {deliveriesPending.slice(0, 3).map(d => (
                            <ActionRow key={d.id} label={d.title || "交付物待确认"} sub={d.demandTitle ?? undefined} href={`/pub/deliveries/${d.id}`} navigate={navigate} />
                          ))}
                          {deliveriesPending.length > 3 && (
                            <button onClick={() => navigate("/pub/deliveries")} className="w-full text-xs font-bold text-primary text-center py-1 hover:underline">
                              查看全部 {deliveriesPending.length} 件待确认 →
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tickets */}
                    {ticketsOpen.length > 0 && (
                      <div>
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                          <Wrench size={10} /> 质保工单
                        </p>
                        <div className="space-y-1.5">
                          {ticketsOpen.slice(0, 2).map(t => (
                            <ActionRow key={t.id} label={t.title} sub={t.demandTitle ?? undefined} href={`/pub/tickets/${t.id}`} navigate={navigate} />
                          ))}
                          {ticketsOpen.length > 2 && (
                            <button onClick={() => navigate("/pub/tickets")} className="w-full text-xs font-bold text-primary text-center py-1 hover:underline">
                              查看全部 {ticketsOpen.length} 个处理中工单 →
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Messages */}
                    {unreadCount > 0 && (
                      <div>
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2 px-1 flex items-center gap-1.5">
                          <Bell size={10} /> 消息
                        </p>
                        <ActionRow label={`${unreadCount} 条未读消息`} href="/pub/notifications" navigate={navigate} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: module status overview */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <ModuleCard
              icon={FileSignature}
              title="合同管理"
              href="/pub/contracts"
              navigate={navigate}
              segments={[
                { label: "待确认", count: contractsPending.length, color: "bg-amber-400" },
                { label: "待签约", count: contractsSigning.length, color: "bg-orange-300" },
                { label: "已签约", count: contractsSigned.length, color: "bg-green-400" },
              ]}
              cta={contractsPending.length > 0 ? `${contractsPending.length} 份待您确认，请处理` : undefined}
              ctaUrgent={contractsPending.length > 0}
            />

            <ModuleCard
              icon={CreditCard}
              title="付款管理"
              href="/pub/payments"
              navigate={navigate}
              segments={[
                { label: "逾期", count: paymentsOverdue.length, color: "bg-red-400" },
                { label: "待付款", count: paymentsPending.filter(p => !p.isOverdue).length, color: "bg-orange-300" },
                { label: "审核中", count: paymentsReview.length, color: "bg-amber-300" },
                { label: "已付款", count: paymentsPaid.length, color: "bg-green-400" },
              ]}
              cta={paymentsOverdue.length > 0 ? `${paymentsOverdue.length} 项已逾期，请尽快处理` : pendingAmount > 0 ? `待付总额 ${fmtAmount(pendingAmount)}` : undefined}
              ctaUrgent={paymentsOverdue.length > 0}
            />

            <ModuleCard
              icon={PackageCheck}
              title="交付确认"
              href="/pub/deliveries"
              navigate={navigate}
              segments={[
                { label: "待确认", count: deliveriesPending.length, color: "bg-violet-400" },
                { label: "已确认", count: deliveriesOk.length, color: "bg-green-400" },
              ]}
              cta={deliveriesPending.length > 0 ? `${deliveriesPending.length} 件交付物等待您确认` : undefined}
              ctaUrgent={false}
            />

            <ModuleCard
              icon={Wrench}
              title="质保工单"
              href="/pub/tickets"
              navigate={navigate}
              segments={[
                { label: "处理中", count: ticketsOpen.length, color: "bg-blue-400" },
                { label: "已关闭", count: ticketsClosed.length, color: "bg-slate-300" },
              ]}
              cta={ticketsOpen.length > 0 ? `${ticketsOpen.length} 个工单处理中` : undefined}
              ctaUrgent={false}
            />
          </div>

        </div>
      </div>
    </PubLayout>
  );
}
