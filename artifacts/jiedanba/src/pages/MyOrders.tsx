import { useState } from "react";
import { Link } from "wouter";
import {
  useListOrders,
  useGetOrderById,
  useListNotifications,
  useSubmitDeliverable,
} from "@workspace/api-client-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  CheckCircle2,
  Clock,
  Banknote,
  Loader2,
  Upload,
  FileText,
  ExternalLink,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type TabStatus = "all" | "in_progress" | "pending_acceptance" | "completed";

const TABS: { label: string; value: TabStatus }[] = [
  { label: "全部", value: "all" },
  { label: "执行中", value: "in_progress" },
  { label: "待验收", value: "pending_acceptance" },
  { label: "已完成", value: "completed" },
];

const STEPS = ["已启动", "工作推进", "核心交付", "结算到账"];

function getStepState(status: string, i: number): "done" | "active" | "pending" {
  const doneCount = status === "in_progress" ? 2 : status === "pending_acceptance" ? 3 : status === "completed" ? 4 : 0;
  if (i < doneCount) return "done";
  if (i === doneCount) return "active";
  return "pending";
}

function progressPct(status: string): number {
  if (status === "in_progress") return 50;
  if (status === "pending_acceptance") return 75;
  if (status === "completed") return 100;
  return 0;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function timeAgo(d: string) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
  if (h < 1) return "刚刚";
  if (h < 24) return `${h} 小时前`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} 天前`;
  return formatDate(d);
}

export default function MyOrders() {
  const [tab, setTab] = useState<TabStatus>("all");
  const [codeUrl, setCodeUrl] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const { toast } = useToast();
  const { userId } = useCurrentUser();

  const { data: ordersData, isLoading } = useListOrders({
    status: tab === "all" ? undefined : (tab as any),
    opcId: userId || undefined,
    page: 1,
    limit: 20,
  });

  const firstOrder = ordersData?.items?.[0];
  const { data: order, refetch: refetchOrder } = useGetOrderById(firstOrder?.id ?? 0, {
    query: { enabled: !!firstOrder?.id },
  });

  const { data: notifData } = useListNotifications({ page: 1, limit: 5 });
  const submitMutation = useSubmitDeliverable();

  const handleSubmit = async () => {
    if (!order || (!codeUrl && !docUrl)) {
      toast({ title: "请至少填写一个文件链接", variant: "destructive" });
      return;
    }
    try {
      await submitMutation.mutateAsync({
        orderId: order.id,
        data: {
          title: order.milestones?.[0]?.name ?? "交付物",
          description: `代码包: ${codeUrl || "—"}  |  文档: ${docUrl || "—"}`,
          fileUrl: codeUrl || docUrl,
          fileName: "交付文件",
        },
      });
      setCodeUrl("");
      setDocUrl("");
      refetchOrder();
      toast({ title: "交付物已提交", description: "发单方将在 48 小时内完成验收" });
    } catch {
      toast({ title: "提交失败，请稍后重试", variant: "destructive" });
    }
  };

  return (
    <div>
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="font-display font-extrabold text-4xl text-primary tracking-tight mb-2">
          我的订单工作台
        </h1>
        <p className="text-muted-foreground font-medium">
          实时管理交付进度，追踪结算状态。
        </p>
      </header>

      {/* Tab Bar */}
      <div className="flex items-center gap-6 border-b border-border mb-8">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-1 py-4 font-bold text-sm font-display transition-all ${
              tab === t.value
                ? "text-primary border-b-2 border-primary -mb-px"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground gap-2">
          <Loader2 size={20} className="animate-spin" /> 加载中…
        </div>
      ) : !ordersData?.items?.length ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center mb-4 text-2xl">📭</div>
          <h3 className="text-lg font-bold text-foreground mb-2">暂无相关订单</h3>
          <p className="text-muted-foreground text-sm">
            切换其他状态，或前往{" "}
            <Link href="/order-hall" className="text-primary font-bold hover:underline">
              订单大厅
            </Link>{" "}
            接新单
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* ──────────── LEFT 8-col ──────────── */}
          <div className="lg:col-span-8 space-y-8">

            {/* Active Order Card */}
            {order && (
              <section className="bg-white rounded-2xl p-8 shadow-sm border border-border/50">
                {/* Card header */}
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <span className="inline-block px-3 py-1 bg-secondary/15 text-secondary text-[10px] font-bold uppercase tracking-wider rounded-full mb-3">
                      优先交付
                    </span>
                    <h2 className="font-display font-extrabold text-2xl text-foreground leading-tight">
                      {order.demandTitle}
                    </h2>
                    <p className="text-muted-foreground font-medium mt-1 text-sm">
                      订单编号{" "}
                      <span className="text-primary font-bold font-mono">#{order.orderNo}</span>
                      {order.deadline && (
                        <>
                          <span className="mx-2 opacity-40">·</span>
                          截止 {formatDate(order.deadline)}
                        </>
                      )}
                    </p>
                  </div>
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/70 transition-colors rounded-lg text-sm font-bold text-primary shrink-0"
                  >
                    <ExternalLink size={14} /> 查看详情
                  </Link>
                </div>

                {/* Progress Stepper */}
                <div className="relative py-10">
                  {/* Track */}
                  <div className="absolute top-1/2 left-0 w-full h-1.5 bg-muted -translate-y-1/2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary transition-all duration-700 rounded-full"
                      style={{ width: `${progressPct(order.status)}%` }}
                    />
                  </div>
                  {/* Nodes */}
                  <div className="relative flex justify-between">
                    {STEPS.map((label, i) => {
                      const state = getStepState(order.status, i);
                      return (
                        <div key={i} className="flex flex-col items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center z-10 shadow-md transition-all ${
                              state === "done"
                                ? "bg-secondary text-white"
                                : state === "active"
                                ? "bg-white border-4 border-secondary text-secondary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {state === "done" ? (
                              <CheckCircle2 size={20} strokeWidth={2.5} />
                            ) : state === "active" ? (
                              <div className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                            )}
                          </div>
                          <span
                            className={`font-display font-bold text-xs ${
                              state === "done" || state === "active" ? "text-secondary" : "text-muted-foreground"
                            }`}
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Current Milestone Info */}
                {order.milestones?.[0] && (
                  <div className="mt-4 p-5 bg-muted/50 rounded-xl flex items-start gap-4 border border-border/40">
                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                      <Clock size={18} />
                    </div>
                    <div>
                      <p className="font-display font-bold text-foreground">
                        当前里程碑：{order.milestones[0].name}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                        {order.milestones[0].deliverableDesc}
                        {order.milestones[0].deadline && (
                          <span className="ml-2 font-bold text-primary">
                            · 截止 {formatDate(order.milestones[0].deadline)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Deliverable Submission */}
            {order && order.status === "in_progress" && (
              <section className="bg-white rounded-2xl p-8 shadow-sm border border-border/50">
                <h3 className="font-display font-extrabold text-xl text-foreground mb-6">
                  提交交付物
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Code Package */}
                  <div className="group border-2 border-dashed border-border hover:border-primary transition-all rounded-xl p-8 flex flex-col items-center text-center bg-background hover:bg-primary/5 cursor-pointer">
                    <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <Upload size={24} />
                    </div>
                    <h4 className="font-display font-bold text-foreground mb-1">代码 / 文件包</h4>
                    <p className="text-xs text-muted-foreground mb-4">ZIP、网盘链接均可</p>
                    <input
                      type="url"
                      value={codeUrl}
                      onChange={e => setCodeUrl(e.target.value)}
                      placeholder="粘贴文件下载链接…"
                      onClick={e => e.stopPropagation()}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all bg-white"
                    />
                  </div>
                  {/* Tech Docs */}
                  <div className="group border-2 border-dashed border-border hover:border-secondary transition-all rounded-xl p-8 flex flex-col items-center text-center bg-background hover:bg-secondary/5 cursor-pointer">
                    <div className="w-14 h-14 rounded-full bg-secondary/10 text-secondary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <FileText size={24} />
                    </div>
                    <h4 className="font-display font-bold text-foreground mb-1">技术文档</h4>
                    <p className="text-xs text-muted-foreground mb-4">PDF、DOCX、在线文档链接</p>
                    <input
                      type="url"
                      value={docUrl}
                      onChange={e => setDocUrl(e.target.value)}
                      placeholder="粘贴文档链接…"
                      onClick={e => e.stopPropagation()}
                      className="w-full text-xs border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-secondary/30 focus:border-secondary outline-none transition-all bg-white"
                    />
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={submitMutation.isPending || (!codeUrl && !docUrl)}
                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary to-[#0047ab] text-white font-display font-bold rounded-xl shadow-lg hover:brightness-110 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                    提交最终交付物
                  </button>
                </div>

                {/* Previous deliverables */}
                {order.deliverables && order.deliverables.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                      已提交记录
                    </p>
                    <div className="space-y-2">
                      {order.deliverables.map((d: any, i: number) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 bg-muted/40 px-4 py-3 rounded-lg border border-border/40"
                        >
                          <FileText size={14} className="text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-foreground flex-1 truncate">
                            {d.title}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              d.status === "approved"
                                ? "bg-secondary/10 text-secondary"
                                : d.status === "rejected"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {d.status === "approved" ? "已通过" : d.status === "rejected" ? "已驳回" : "审核中"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Completed banner */}
            {order && order.status === "completed" && (
              <section className="bg-secondary/10 border border-secondary/20 rounded-2xl p-8 flex items-center gap-6">
                <CheckCircle2 size={40} className="text-secondary shrink-0" />
                <div>
                  <h3 className="font-display font-bold text-xl text-foreground">订单已完成 🎉</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    结算金额{" "}
                    <span className="text-secondary font-black">¥{order.opcShare?.toLocaleString()}</span>{" "}
                    已打入账户，感谢您的优质交付！
                  </p>
                </div>
              </section>
            )}
          </div>

          {/* ──────────── RIGHT 4-col ──────────── */}
          <div className="lg:col-span-4 space-y-6">

            {/* Payout Calculator */}
            {order && (
              <section className="bg-primary text-white rounded-2xl p-8 shadow-xl relative overflow-hidden">
                {/* Decorative blobs */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 blur-2xl pointer-events-none" />

                <div className="relative z-10">
                  <h3 className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-6 flex items-center gap-1.5">
                    <Banknote size={13} /> 预计收益
                  </h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-xl font-bold text-white/80">¥</span>
                    <span className="text-5xl font-extrabold tracking-tighter">
                      {order.opcShare?.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-white/50 text-sm mb-8 font-medium">OPC 税前到账估算</p>

                  <div className="space-y-3 pt-6 border-t border-white/10">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">订单总额</span>
                      <span className="font-bold">¥{order.amount?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">平台服务费 (10%)</span>
                      <span className="font-bold text-red-300">
                        - ¥{order.platformFee?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">OPC 分成比例</span>
                      <span className="font-bold text-[#4dffb2]">× 60%</span>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-white/10 rounded-xl flex items-start gap-3">
                    <Sparkles size={16} className="text-[#4dffb2] shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed text-white/80">
                      按时高质量交付可获得{" "}
                      <span className="text-[#4dffb2] font-bold">信用分 +5</span>
                      ，提升未来接单优先级。
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Recent Activities */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-border/50">
              <h3 className="font-display font-bold text-foreground mb-6 flex items-center justify-between text-base">
                最近动态
                <Link
                  href="/notifications"
                  className="text-xs text-primary font-bold flex items-center gap-1 hover:underline"
                >
                  全部 <ChevronRight size={12} />
                </Link>
              </h3>
              <div className="space-y-5">
                {notifData?.items?.slice(0, 4).map((n, i) => {
                  const barColors = [
                    "bg-secondary",
                    "bg-primary/50",
                    "bg-primary/25",
                    "bg-muted-foreground/20",
                  ];
                  return (
                    <div key={n.id} className="flex gap-4">
                      <div
                        className={`w-1 rounded-full shrink-0 ${barColors[i % barColors.length]}`}
                        style={{ minHeight: 40 }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground line-clamp-1">{n.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                          {n.content}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1 font-bold uppercase tracking-wider">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* All Orders Quick Nav */}
            {(ordersData?.items?.length ?? 0) > 1 && (
              <section className="bg-white rounded-2xl p-6 shadow-sm border border-border/50">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
                  全部订单
                </h3>
                <div className="space-y-1">
                  {ordersData!.items.map(o => (
                    <Link
                      key={o.id}
                      href={`/orders/${o.id}`}
                      className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {o.demandTitle}
                        </p>
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                          {o.orderNo}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                            o.status === "completed"
                              ? "bg-secondary/10 text-secondary"
                              : o.status === "pending_acceptance"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {o.status === "completed"
                            ? "已完成"
                            : o.status === "pending_acceptance"
                            ? "待验收"
                            : "执行中"}
                        </span>
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
