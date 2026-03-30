import { useState, type ReactNode } from "react";
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
  Plus,
  X,
  Link2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

/* ─── Reusable delivery section card ─── */
interface DeliverySectionProps {
  icon: ReactNode;
  accent: "primary" | "secondary";
  title: string;
  subtitle: string;
  links: string[];
  inputValue: string;
  uploading: boolean;
  onInputChange: (v: string) => void;
  onAddLink: () => void;
  onRemoveLink: (i: number) => void;
  onFileChange: (file: File) => void;
}

function DeliverySection({
  icon, accent, title, subtitle,
  links, inputValue, uploading,
  onInputChange, onAddLink, onRemoveLink, onFileChange,
}: DeliverySectionProps) {
  const accentCls = accent === "primary"
    ? { ring: "hover:border-primary", bg: "bg-primary/10 text-primary", focus: "focus:ring-primary/30 focus:border-primary", btn: "text-primary hover:bg-primary/10" }
    : { ring: "hover:border-secondary", bg: "bg-secondary/10 text-secondary", focus: "focus:ring-secondary/30 focus:border-secondary", btn: "text-secondary hover:bg-secondary/10" };

  return (
    <div className={`border-2 border-dashed border-border ${accentCls.ring} transition-all rounded-xl p-6 flex flex-col bg-background`}>
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-4">
        <div className={`w-12 h-12 rounded-full ${accentCls.bg} flex items-center justify-center mb-3`}>
          {icon}
        </div>
        <h4 className="font-display font-bold text-foreground mb-0.5">{title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
      </div>

      {/* Added links list */}
      {links.length > 0 && (
        <ul className="space-y-1.5 mb-3">
          {links.map((url, i) => (
            <li key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5 group">
              <Link2 size={12} className="text-muted-foreground shrink-0" />
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-muted-foreground truncate flex-1 hover:underline">{url}</a>
              <button onClick={() => onRemoveLink(i)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Input row */}
      <div className="flex gap-2 mt-auto">
        <input
          type="url"
          value={inputValue}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); onAddLink(); } }}
          placeholder="粘贴链接后按 Enter 或点击 +"
          className={`flex-1 text-xs border border-border rounded-lg px-3 py-2 ${accentCls.focus} outline-none transition-all bg-white`}
        />
        <button
          onClick={onAddLink}
          disabled={!inputValue.trim()}
          title="添加链接"
          className={`p-2 rounded-lg border border-border ${accentCls.btn} transition-colors disabled:opacity-40`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* File upload button */}
      <label className={`mt-2 flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-border cursor-pointer text-xs font-medium ${accentCls.btn} transition-colors ${uploading ? "opacity-60 cursor-not-allowed" : "hover:bg-muted/50"}`}>
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {uploading ? "上传中…" : "上传文件"}
        <input type="file" className="hidden" disabled={uploading}
          onChange={e => { const f = e.target.files?.[0]; if (f) onFileChange(f); e.target.value = ""; }} />
      </label>
    </div>
  );
}

export default function MyOrders() {
  const [tab, setTab] = useState<TabStatus>("all");
  // multi-link state: code/file section
  const [codeLinks, setCodeLinks] = useState<string[]>([]);
  const [codeInput, setCodeInput] = useState("");
  const [uploadingCode, setUploadingCode] = useState(false);
  // multi-link state: doc section
  const [docLinks, setDocLinks] = useState<string[]>([]);
  const [docInput, setDocInput] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
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

  // add pending input value to list before submitting
  const allCodeLinks = [...codeLinks, ...(codeInput.trim() ? [codeInput.trim()] : [])];
  const allDocLinks  = [...docLinks,  ...(docInput.trim()  ? [docInput.trim()]  : [])];

  async function uploadFile(
    file: File,
    section: "code" | "doc",
    setUploading: (v: boolean) => void,
    addLink: (url: string) => void,
  ) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const objectPath = `/deliverables/${section}_${Date.now()}.${ext}`;
      const res = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userId}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ objectPath, contentType: file.type || "application/octet-stream" }),
      });
      const { uploadUrl, publicUrl } = await res.json();
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      addLink(publicUrl);
      toast({ title: "文件上传成功" });
    } catch {
      toast({ title: "上传失败，请稍后重试", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const handleSubmit = async () => {
    if (!order || (allCodeLinks.length === 0 && allDocLinks.length === 0)) {
      toast({ title: "请至少添加一个文件链接或上传文件", variant: "destructive" });
      return;
    }
    const allLinks = [...allCodeLinks, ...allDocLinks];
    const description = allLinks.join("\n");
    try {
      await submitMutation.mutateAsync({
        orderId: order.id,
        data: {
          title: order.milestones?.[0]?.name ?? "交付物",
          description,
          fileUrl: allLinks[0],
          fileName: "交付文件",
        },
      });
      setCodeLinks([]);
      setCodeInput("");
      setDocLinks([]);
      setDocInput("");
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
                  {/* Code / File Package */}
                  <DeliverySection
                    icon={<Upload size={22} />}
                    accent="primary"
                    title="代码 / 文件包"
                    subtitle="ZIP、网盘链接均可"
                    links={codeLinks}
                    inputValue={codeInput}
                    uploading={uploadingCode}
                    onInputChange={setCodeInput}
                    onAddLink={() => {
                      const v = codeInput.trim();
                      if (v) { setCodeLinks(l => [...l, v]); setCodeInput(""); }
                    }}
                    onRemoveLink={i => setCodeLinks(l => l.filter((_, idx) => idx !== i))}
                    onFileChange={file => uploadFile(file, "code", setUploadingCode, url => setCodeLinks(l => [...l, url]))}
                  />
                  {/* Delivery Docs */}
                  <DeliverySection
                    icon={<FileText size={22} />}
                    accent="secondary"
                    title="交付文档"
                    subtitle="交付有关的所有文档，不限格式，亦可打包一并提供"
                    links={docLinks}
                    inputValue={docInput}
                    uploading={uploadingDoc}
                    onInputChange={setDocInput}
                    onAddLink={() => {
                      const v = docInput.trim();
                      if (v) { setDocLinks(l => [...l, v]); setDocInput(""); }
                    }}
                    onRemoveLink={i => setDocLinks(l => l.filter((_, idx) => idx !== i))}
                    onFileChange={file => uploadFile(file, "doc", setUploadingDoc, url => setDocLinks(l => [...l, url]))}
                  />
                </div>

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={submitMutation.isPending || (allCodeLinks.length === 0 && allDocLinks.length === 0)}
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
