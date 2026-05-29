import { useState, useRef, useEffect } from "react";
import { clearSession, getAccessToken } from "@/lib/auth";
import { useLocation } from "wouter";
import {
  Search, Bell, ArrowLeft, CheckCircle2, Clock,
  XCircle, Star, AlertCircle, Zap, FileText, Download,
  ChevronRight, Trophy, RefreshCw, Loader2,
  Menu, CreditCard, Upload, X, Tag, Paperclip,
  MessageSquare, Calculator, CalendarDays,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  useGetOrderById,
  useAcceptOrder,
  useRejectDelivery,
} from "@workspace/api-client-react";
import { useParams } from "wouter";
import { PublisherSidebar } from "@/components/publisher/PublisherSidebar";
import { PublisherHeaderUser } from '@/components/publisher/PublisherHeaderUser';
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** 从文本中提取所有 URL，返回 { urls, textWithoutUrls } */
function extractUrls(text: string): { urls: string[]; plainText: string } {
  if (!text) return { urls: [], plainText: "" };
  const urlRegex = /https?:\/\/[^\s|,，]+/g;
  const urls: string[] = [];
  const plainText = text
    .replace(urlRegex, (match) => { urls.push(match.trim()); return ""; })
    .replace(/代码包:\s*—\s*\|?\s*/gi, "")
    .replace(/文档:\s*—\s*\|?\s*/gi, "")
    .replace(/\|/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { urls, plainText };
}

function extractDescriptionText(description: string | null | undefined): string {
  if (!description) return "";
  return description
    .split("\n")
    .filter(line => {
      const t = line.trim();
      if (!t) return false;
      if (t.startsWith("/api/") || t.startsWith("http://") || t.startsWith("https://")) return false;
      if (t.indexOf("\t") >= 0) return false;
      return true;
    })
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function friendlyUrl(url: string): string {
  if (!url) return "文件";
  if (url.includes("/api/storage/objects/uploads/") || url.includes("/storage/objects/uploads/")) return "";
  const last = url.split("?")[0].split("/").pop() || "";
  return last.length > 30 ? last.slice(0, 28) + "…" : last;
}

function parseDelivFiles(
  description: string | null | undefined,
  fileUrl?: string | null,
  fileName?: string | null,
): { url: string; label: string }[] {
  const files: { url: string; label: string }[] = [];
  if (description) {
    for (const line of description.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const tabIdx = trimmed.indexOf("\t");
      if (tabIdx >= 0) {
        const url = trimmed.slice(0, tabIdx).trim();
        const name = trimmed.slice(tabIdx + 1).trim();
        if (url) files.push({ url, label: name || friendlyUrl(url) });
      } else if (trimmed.startsWith("/api/") || trimmed.startsWith("http")) {
        files.push({ url: trimmed, label: friendlyUrl(trimmed) });
      }
    }
  }
  if (fileUrl && !files.find(f => f.url === fileUrl)) {
    const label = fileName && fileName !== "交付文件" ? fileName : friendlyUrl(fileUrl);
    files.unshift({ url: fileUrl, label });
  }
  let storageIdx = 1;
  for (const f of files) {
    if (!f.label) { f.label = `已上传文件 ${storageIdx++}`; }
  }
  return files;
}

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_payment:    { label: "待付款",  color: "bg-orange-100 text-orange-700" },
  in_progress:        { label: "进行中",  color: "bg-green-100 text-green-700" },
  pending_acceptance: { label: "待验收",  color: "bg-amber-100 text-amber-700" },
  completed:          { label: "已完成",  color: "bg-emerald-100 text-emerald-700" },
  disputed:           { label: "争议中",  color: "bg-red-100 text-red-600" },
  closed:             { label: "已关闭",  color: "bg-slate-100 text-slate-500" },
};

const MILESTONE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "待提交", color: "text-slate-400",  icon: Clock },
  submitted: { label: "待审查", color: "text-amber-600",  icon: RefreshCw },
  approved:  { label: "已通过", color: "text-green-600",  icon: CheckCircle2 },
  rejected:  { label: "已打回", color: "text-red-500",    icon: XCircle },
};

const DELIVERABLE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  submitted: { label: "待审查", color: "bg-amber-100 text-amber-700" },
  approved:  { label: "已通过", color: "bg-green-100 text-green-700" },
  rejected:  { label: "已打回", color: "bg-red-100 text-red-600" },
};

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            size={22}
            className={
              s <= (hover || value)
                ? "fill-amber-400 text-amber-400"
                : "text-slate-200"
            }
          />
        </button>
      ))}
      {value > 0 && (
        <span className="text-sm text-slate-500 ml-1">
          {["", "较差", "一般", "良好", "优秀", "完美"][value]}
        </span>
      )}
    </div>
  );
}

/** Derive milestone status from deliverables (same as OPC view logic) */
function getMilestoneStatus(
  milestoneIndex: number,
  deliverables: Array<{ milestoneId?: number | null; status: string }>,
): "pending" | "submitted" | "approved" | "rejected" {
  const msDelivs = deliverables.filter(d => d.milestoneId === milestoneIndex + 1);
  if (msDelivs.some(d => d.status === "approved")) return "approved";
  if (msDelivs.some(d => d.status === "submitted")) return "submitted";
  if (msDelivs.some(d => d.status === "rejected")) return "rejected";
  return "pending";
}

export default function PublisherOrderDetail() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const orderId = parseInt(params.id ?? "0", 10);
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── Payment state (for pending_payment orders) ───────────────────────────
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<"online" | "offline">("online");
  const [orderReceiptUrl, setOrderReceiptUrl] = useState("");
  const [orderReceiptUploading, setOrderReceiptUploading] = useState(false);
  const [orderOnlineQrUrl, setOrderOnlineQrUrl] = useState<string | null>(null);
  const [orderOnlinePaid, setOrderOnlinePaid] = useState(false);
  const [orderQrGenerating, setOrderQrGenerating] = useState(false);
  const [orderPaymentSubmitting, setOrderPaymentSubmitting] = useState(false);
  const [orderPaymentNote, setOrderPaymentNote] = useState("");
  const orderPollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Global accept/reject state (non-milestone orders only)
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Per-milestone accept state
  const [acceptMilestoneId, setAcceptMilestoneId] = useState<number | null>(null);
  const [milestoneAcceptRating, setMilestoneAcceptRating] = useState(0);
  const [milestoneAcceptComment, setMilestoneAcceptComment] = useState("");

  // Per-milestone reject state
  const [rejectMilestoneId, setRejectMilestoneId] = useState<number | null>(null);
  const [milestoneRejectReason, setMilestoneRejectReason] = useState("");

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { data: order, isLoading, refetch: refetchOrder } = useGetOrderById(orderId, {
    query: { enabled: orderId > 0 },
  });

  // ── Payment handlers ──────────────────────────────────────────────────────
  const handleOrderReceiptUpload = async (file: File) => {
    setOrderReceiptUploading(true);
    try {
      const reqRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!reqRes.ok) throw new Error("上传请求失败");
      const { uploadURL, objectPath } = await reqRes.json();
      const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("文件上传失败");
      setOrderReceiptUrl(`${BASE}/api/storage${objectPath}`);
      toast({ title: "截图上传成功" });
    } catch (err: unknown) {
      toast({ title: "上传失败", description: (err as Error).message, variant: "destructive" });
    } finally {
      setOrderReceiptUploading(false);
    }
  };

  const handleOrderGenerateQr = async () => {
    setOrderQrGenerating(true);
    try {
      const r = await fetch(`${BASE}/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
        body: JSON.stringify({ method: "online", paymentNote: orderPaymentNote.trim() || undefined }),
      }).then(r => r.json());
      if (r.qrCodeUrl) {
        setOrderOnlineQrUrl(r.qrCodeUrl);
        setOrderOnlinePaid(false);
      } else {
        toast({ title: "创建支付订单失败", description: "未收到二维码，请稍后重试", variant: "destructive" });
      }
    } catch {
      toast({ title: "生成支付二维码失败", variant: "destructive" });
    } finally {
      setOrderQrGenerating(false);
    }
  };

  const handleOrderSubmitOffline = async () => {
    if (!orderReceiptUrl.trim()) return;
    setOrderPaymentSubmitting(true);
    try {
      const r = await fetch(`${BASE}/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
        body: JSON.stringify({ method: "offline", receiptUrl: orderReceiptUrl.trim(), paymentNote: orderPaymentNote.trim() || undefined }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error((e as any).error ?? "提交失败");
      }
      toast({ title: "凭证已提交", description: "请等待财务审核，审核通过后订单正式开始" });
      setOrderReceiptUrl("");
      await refetchOrder();
    } catch (err: unknown) {
      toast({ title: "提交失败", description: (err as Error).message, variant: "destructive" });
    } finally {
      setOrderPaymentSubmitting(false);
    }
  };

  // Poll order online payment status every 3 seconds while QR is shown
  useEffect(() => {
    if (!orderOnlineQrUrl || orderOnlinePaid || !order || order.status !== "pending_payment") return;
    orderPollTimerRef.current = setInterval(async () => {
      try {
        const result = await fetch(`${BASE}/api/orders/${orderId}/payment-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
        }).then(r => r.json());
        if (result.paid || result.confirmed) {
          setOrderOnlinePaid(true);
          if (orderPollTimerRef.current) clearInterval(orderPollTimerRef.current);
          await refetchOrder();
          toast({ title: "✅ 付款已到账", description: "订单已正式开始，请关注交付进度" });
        } else if (result.terminal) {
          if (orderPollTimerRef.current) clearInterval(orderPollTimerRef.current);
          toast({ title: "支付未完成", description: `支付状态：${result.statusName ?? "已结束"}`, variant: "destructive" });
          setOrderOnlineQrUrl(null);
        }
      } catch { /* silent */ }
    }, 3000);
    return () => { if (orderPollTimerRef.current) clearInterval(orderPollTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderOnlineQrUrl, orderOnlinePaid, order?.status]);

  // Auto-generate QR when entering pending_payment with online mode
  useEffect(() => {
    if (!order || order.status !== "pending_payment") return;
    if (orderPaymentMethod !== "online" || orderOnlineQrUrl || orderOnlinePaid || orderQrGenerating) return;
    const hasOfflineReceipt = order.paymentMethod === "offline" && order.paymentReceiptUrl;
    if (!hasOfflineReceipt || order.paymentRejectReason) {
      handleOrderGenerateQr();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status, order?.id, orderPaymentMethod]);

  const acceptOrder = useAcceptOrder();
  const rejectDelivery = useRejectDelivery();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
    await qc.invalidateQueries({ queryKey: ["/api/orders"] });
  };

  // Per-milestone accept mutation
  const milestoneAcceptMutation = useMutation({
    mutationFn: async ({ msId, rt, cm }: { msId: number; rt: number; cm: string }) => {
      const res = await fetch(`${BASE}/api/orders/${orderId}/milestones/${msId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() ?? ""}` },
        body: JSON.stringify({
          ...(rt > 0 ? { rating: rt } : {}),
          ...(cm.trim() ? { comment: cm.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const err: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "操作失败");
      }
      return res.json();
    },
    onSuccess: async (data: { allCompleted?: boolean }) => {
      await refetchOrder();
      await invalidate();
      setAcceptMilestoneId(null);
      setMilestoneAcceptRating(0);
      setMilestoneAcceptComment("");
      setActionSuccess(data?.allCompleted ? "订单已完成，结算流程已触发。" : "里程碑已通过审核。");
    },
    onError: async (e: Error) => {
      await refetchOrder();
      setAcceptMilestoneId(null);
      setActionError(e.message || "操作失败，请稍后重试");
    },
  });

  // Per-milestone reject mutation
  const milestoneRejectMutation = useMutation({
    mutationFn: async ({ msId, reason }: { msId: number; reason: string }) => {
      const res = await fetch(`${BASE}/api/orders/${orderId}/milestones/${msId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() ?? ""}` },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "操作失败");
      }
      return res.json();
    },
    onSuccess: async () => {
      await refetchOrder();
      await invalidate();
      setRejectMilestoneId(null);
      setMilestoneRejectReason("");
      setActionSuccess("已打回该里程碑，OPC 可重新提交。");
    },
    onError: async (e: Error) => {
      await refetchOrder();
      setRejectMilestoneId(null);
      setActionError(e.message || "操作失败，请稍后重试");
    },
  });

  const handleAccept = async () => {
    setActionError(null);
    try {
      await acceptOrder.mutateAsync({
        orderId,
        data: {
          ...(rating > 0 ? { rating } : {}),
          ...(reviewComment ? { comment: reviewComment } : {}),
        },
      });
      await invalidate();
      setShowAcceptModal(false);
      setActionSuccess("订单已完成，结算流程已触发。");
    } catch {
      setActionError("操作失败，请稍后重试");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setActionError("请填写返工意见");
      return;
    }
    setActionError(null);
    try {
      await rejectDelivery.mutateAsync({ orderId, data: { reason: rejectReason } });
      await invalidate();
      setShowRejectModal(false);
      setRejectReason("");
      setActionSuccess("已要求 OPC 返工，返工意见已发送。");
    } catch {
      setActionError("操作失败，请稍后重试");
    }
  };

  const statusCfg = order?.status
    ? (ORDER_STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-slate-100 text-slate-500" })
    : { label: "", color: "" };

  const hasMilestones = (order?.milestones ?? []).length > 0;
  const deliverables = order?.deliverables ?? [];

  // Derive milestone statuses from deliverables
  const milestoneStatuses = (order?.milestones ?? []).map((_, i) =>
    getMilestoneStatus(i, deliverables)
  );

  const approvedMilestones = milestoneStatuses.filter(s => s === "approved").length;
  const totalMilestones = (order?.milestones ?? []).length;

  // Global accept/reject banner only for non-milestone orders
  const canAccept = order?.status === "pending_acceptance" && !hasMilestones;

  return (
    <div className="flex min-h-screen bg-[#f9f9fc] text-[#1a1c1e] overflow-x-hidden">
      <PublisherSidebar onLogout={logout} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      <main className="flex-1 md:ml-64 min-h-screen">
        {/* Top bar */}
        <header className="fixed top-0 right-0 md:left-64 left-0 z-40 bg-white/80 backdrop-blur-md shadow-sm flex items-center px-4 md:px-8 py-3 gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden shrink-0 p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/publisher/orders")}
              className="flex items-center gap-2 text-slate-500 hover:text-primary text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} /> 返回订单列表
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="relative w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索…"
                className="w-full bg-slate-100 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
            </button>
            <PublisherHeaderUser onLogout={logout} />
          </div>
        </header>

        <div className="pt-20 pb-16 px-8 max-w-[1280px] mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : !order ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <AlertCircle size={48} className="mb-4 text-slate-300" />
              <p className="text-lg font-medium">订单不存在或已被删除</p>
              <button onClick={() => navigate("/publisher/orders")} className="mt-4 text-primary text-sm hover:underline">
                返回订单列表
              </button>
            </div>
          ) : (
            <>
              {/* Alerts */}
              {actionSuccess && (
                <div className="mb-6 flex items-center gap-3 bg-green-50 text-green-700 rounded-xl p-4 border border-green-200">
                  <CheckCircle2 size={18} />
                  <span className="text-sm font-medium">{actionSuccess}</span>
                  <button onClick={() => setActionSuccess(null)} className="ml-auto text-green-400 hover:text-green-600">
                    <XCircle size={16} />
                  </button>
                </div>
              )}
              {actionError && (
                <div className="mb-6 flex items-center gap-3 bg-red-50 text-red-700 rounded-xl p-4 border border-red-200">
                  <AlertCircle size={18} />
                  <span className="text-sm font-medium">{actionError}</span>
                  <button onClick={() => setActionError(null)} className="ml-auto text-red-400 hover:text-red-600">
                    <XCircle size={16} />
                  </button>
                </div>
              )}

              {/* ── Pending payment banner ── */}
              {order.status === "pending_payment" && !orderOnlinePaid && (
                <div className="mb-6 bg-orange-50 border border-orange-200 rounded-2xl p-6 flex items-center gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                    <CreditCard size={18} className="text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-orange-800">请完成付款，订单将正式开始</p>
                    <p className="text-xs text-orange-600 mt-0.5">
                      您已选定 OPC <span className="font-semibold">{order.opcNickname ?? `#${order.opcId}`}</span>，
                      请支付 <span className="font-bold">¥{order.amount.toLocaleString()}</span> 后项目正式启动
                    </p>
                  </div>
                </div>
              )}
              {order.status === "pending_payment" && orderOnlinePaid && (
                <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-green-600 shrink-0" />
                  <div>
                    <p className="font-bold text-green-800">付款成功，订单正式开始</p>
                    <p className="text-xs text-green-600 mt-0.5">OPC 已收到通知，请关注交付进度</p>
                  </div>
                </div>
              )}

              {/* Pending acceptance banner (non-milestone orders only) */}
              {order.status === "pending_acceptance" && !hasMilestones && (
                <div className="mb-6 bg-orange-50 border border-orange-200 rounded-2xl p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <Zap size={18} className="text-orange-600" />
                    </div>
                    <div>
                      <p className="font-bold text-orange-800">OPC 已提交交付物，等待您确认验收</p>
                      <p className="text-xs text-orange-600 mt-0.5">若7个自然日内未操作，系统将自动确认验收</p>
                    </div>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button
                      onClick={() => { setActionError(null); setShowAcceptModal(true); }}
                      className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <CheckCircle2 size={16} /> 确认验收
                    </button>
                    <button
                      onClick={() => { setActionError(null); setShowRejectModal(true); }}
                      className="flex items-center gap-2 border border-red-300 text-red-600 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
                    >
                      <XCircle size={16} /> 要求返工
                    </button>
                  </div>
                </div>
              )}

              {order.status === "completed" && (
                <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
                  <Trophy size={20} className="text-emerald-600" />
                  <div>
                    <p className="font-bold text-emerald-800">订单已完成</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Main Content */}
                <div className="lg:col-span-2 space-y-8">

                  {/* ── Payment UI (pending_payment orders) ── */}
                  {order.status === "pending_payment" && !orderOnlinePaid && (
                    <section className="bg-white rounded-2xl border border-orange-200 shadow-sm p-6 space-y-5">
                      <h2 className="text-base font-bold text-orange-700 flex items-center gap-2">
                        <CreditCard size={16} /> 请完成付款
                      </h2>

                      {/* Rejection notice */}
                      {order.paymentRejectReason && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                          <p className="text-sm font-bold text-red-700 mb-1">付款凭证审核未通过</p>
                          <p className="text-xs text-red-600">原因：{order.paymentRejectReason}</p>
                          <p className="text-xs text-red-500 mt-1">请重新选择支付方式并提交凭证</p>
                        </div>
                      )}

                      {/* Awaiting review state */}
                      {order.paymentMethod === "offline" && order.paymentReceiptUrl && !order.paymentRejectReason ? (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                            <p className="text-sm font-bold text-blue-800">付款凭证已提交，等待财务审核</p>
                          </div>
                          <p className="text-xs text-blue-700">财务确认到账后订单将自动正式开始，请耐心等待。</p>
                          <a href={order.paymentReceiptUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={order.paymentReceiptUrl}
                              alt="付款凭证"
                              className="max-h-48 rounded-xl border border-blue-200 object-contain bg-white hover:opacity-90 transition-opacity cursor-zoom-in"
                              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          </a>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Method tabs */}
                          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                            {(["online", "offline"] as const).map(m => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => {
                                  setOrderPaymentMethod(m);
                                  if (m === "offline") {
                                    setOrderOnlineQrUrl(null);
                                    if (orderPollTimerRef.current) clearInterval(orderPollTimerRef.current);
                                  }
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  orderPaymentMethod === m ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                                }`}
                              >
                                {m === "online" ? "📱 扫码支付" : "🏦 线下转账"}
                              </button>
                            ))}
                          </div>

                          {/* Online: QR */}
                          {orderPaymentMethod === "online" && (
                            <div className="text-center space-y-3">
                              {orderQrGenerating ? (
                                <div className="py-10 space-y-2">
                                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                                  <p className="text-xs text-slate-500">正在生成支付二维码…</p>
                                </div>
                              ) : orderOnlineQrUrl ? (
                                <>
                                  <p className="text-xs font-medium text-slate-600">扫描二维码完成支付 · ¥{order.amount.toLocaleString()}</p>
                                  <div className="w-52 h-52 mx-auto rounded-xl overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center bg-white p-3">
                                    <QRCodeSVG value={orderOnlineQrUrl} size={192} />
                                  </div>
                                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    <span>等待支付确认中…</span>
                                  </div>
                                  <button onClick={() => { setOrderOnlineQrUrl(null); handleOrderGenerateQr(); }} className="text-xs text-slate-400 hover:text-slate-600 underline">刷新二维码</button>
                                </>
                              ) : (
                                <div className="py-8 space-y-2">
                                  <div className="w-8 h-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin mx-auto" />
                                  <p className="text-xs text-slate-400">正在准备支付…</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Offline: bank + receipt */}
                          {orderPaymentMethod === "offline" && (
                            <div className="space-y-4">
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">收款账号信息</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <p className="text-xs text-slate-400 mb-0.5">开户行</p>
                                    <p className="font-medium text-slate-700">中国工商银行股份有限公司北京海淀支行</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-slate-400 mb-0.5">账户名</p>
                                    <p className="font-medium text-slate-700">北京海创元人工智能教育科技有限公司</p>
                                  </div>
                                  <div className="col-span-full">
                                    <p className="text-xs text-slate-400 mb-0.5">账号</p>
                                    <p className="font-mono font-bold text-slate-800 text-base tracking-wider">0200049619201891562</p>
                                  </div>
                                  <div className="col-span-full">
                                    <p className="text-xs text-slate-400 mb-0.5">转账备注（必填）</p>
                                    <p className="font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-lg text-xs">订单编号: {order.orderNo}</p>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-2">上传转账截图 / 凭证</p>
                                {orderReceiptUrl ? (
                                  <div className="relative">
                                    <img src={orderReceiptUrl} alt="付款凭证" className="max-h-48 rounded-xl border border-slate-200 object-contain w-full bg-slate-50" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                    <button type="button" onClick={() => setOrderReceiptUrl("")} className="absolute top-2 right-2 bg-white/90 border border-slate-200 rounded-full p-1 hover:bg-red-50 hover:text-red-600 transition-colors"><X size={12} /></button>
                                    <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1"><CheckCircle2 size={12} /> 截图已上传</p>
                                  </div>
                                ) : (
                                  <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${orderReceiptUploading ? "border-primary/40 bg-primary/5" : "border-slate-200 hover:border-primary/40 hover:bg-slate-50"}`}>
                                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => e.target.files?.[0] && handleOrderReceiptUpload(e.target.files[0])} disabled={orderReceiptUploading} />
                                    {orderReceiptUploading ? (
                                      <><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /><span className="text-xs text-primary font-medium">上传中…</span></>
                                    ) : (
                                      <><Upload size={20} className="text-slate-400" /><span className="text-xs text-slate-500 font-medium">点击上传转账截图</span><span className="text-[11px] text-slate-400">支持 JPG / PNG / PDF</span></>
                                    )}
                                  </label>
                                )}
                              </div>
                              <button
                                onClick={handleOrderSubmitOffline}
                                disabled={orderPaymentSubmitting || orderReceiptUploading || !orderReceiptUrl.trim()}
                                className="flex items-center gap-2 bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <Upload size={14} />
                                {orderPaymentSubmitting ? "提交中…" : "提交付款凭证"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  )}

                  {/* ── Demand Details ── */}
                  {(order.demandDescription || (order.demandSkillTags && order.demandSkillTags.length > 0) || order.demandBudgetMin != null || (order.demandAttachments && order.demandAttachments.length > 0)) && (
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                      <h2 className="text-base font-bold text-primary font-display flex items-center gap-2">
                        <FileText size={16} /> 需求详情
                      </h2>

                      {/* Description */}
                      {order.demandDescription && (
                        <div>
                          <p className="text-sm font-bold text-slate-500 mb-2">需求描述</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl px-4 py-3">
                            {order.demandDescription}
                          </p>
                        </div>
                      )}

                      {/* Budget + Skill tags row */}
                      <div className="flex flex-wrap gap-4">
                        {(order.demandBudgetMin != null || order.demandBudgetMax != null) && (
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">预算范围</p>
                            <p className="text-sm font-extrabold text-primary">
                              ¥{(order.demandBudgetMin ?? 0).toLocaleString()}
                              {order.demandBudgetMax && order.demandBudgetMax !== order.demandBudgetMin
                                ? ` – ¥${order.demandBudgetMax.toLocaleString()}`
                                : ""}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Skill tags */}
                      {order.demandSkillTags && order.demandSkillTags.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <Tag size={11} /> 技能标签
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {order.demandSkillTags.map((tag, i) => (
                              <span key={i} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Attachments */}
                      {order.demandAttachments && order.demandAttachments.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <Paperclip size={11} /> 需求附件
                          </p>
                          <div className="space-y-2">
                            {order.demandAttachments.map((att, i) => {
                              const hasUrl = att.url && att.url !== "#";
                              const href = hasUrl ? `${att.url}?name=${encodeURIComponent(att.name)}` : undefined;
                              return hasUrl ? (
                                <a
                                  key={i}
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={att.name}
                                  className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 transition-colors group"
                                >
                                  <FileText size={14} className="text-slate-400 shrink-0" />
                                  <span className="text-sm font-medium text-slate-700 flex-1 truncate">{att.name}</span>
                                  <span className="text-xs text-slate-400">{att.size}</span>
                                  <Download size={13} className="text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                              ) : (
                                <div
                                  key={i}
                                  className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 opacity-50 cursor-not-allowed"
                                >
                                  <FileText size={14} className="text-slate-400 shrink-0" />
                                  <span className="text-sm font-medium text-slate-500 flex-1 truncate">{att.name}</span>
                                  <span className="text-xs text-slate-400">{att.size} · 暂不可下载</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {/* ── OPC 提案 ── */}
                  {(order.opcProposal || order.opcQuoteCardSnapshot) && (
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-5">
                      <h2 className="text-base font-bold text-primary font-display flex items-center gap-2">
                        <MessageSquare size={16} /> OPC 提案
                      </h2>

                      {/* Meta row */}
                      <div className="flex flex-wrap gap-6 text-sm">
                        {order.opcQuotedPrice != null && (
                          <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-0.5">报价</p>
                            <p className="font-extrabold text-primary text-base">¥{order.opcQuotedPrice.toLocaleString()}</p>
                          </div>
                        )}
                        {order.opcEstimatedDays != null && (
                          <div>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-0.5 flex items-center gap-1">
                              <CalendarDays size={10} /> 预计工期
                            </p>
                            <p className="font-bold text-slate-700">{order.opcEstimatedDays} 天</p>
                          </div>
                        )}
                      </div>

                      {/* Proposal text */}
                      {order.opcProposal && (
                        <div>
                          <p className="text-sm font-bold text-slate-500 mb-2">OPC 提案说明</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl px-4 py-3">
                            {order.opcProposal}
                          </p>
                        </div>
                      )}

                      {/* Quote card snapshot */}
                      {order.opcQuoteCardSnapshot && (
                        <div>
                          <p className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                            <Calculator size={13} /> 报价明细
                          </p>
                          <div className="rounded-xl border border-slate-200 overflow-hidden text-sm">
                            {/* Base layers */}
                            {order.opcQuoteCardSnapshot.baseLayers.length > 0 && (
                              <div className="divide-y divide-slate-100">
                                {order.opcQuoteCardSnapshot.baseLayers.map((row, i) => (
                                  <div key={i} className="flex items-center justify-between px-4 py-2.5 bg-white">
                                    <div>
                                      <span className="font-medium text-slate-700">{row.label}</span>
                                      <span className="ml-2 text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{row.tierLabel}</span>
                                    </div>
                                    {row.price != null && (
                                      <span className="font-bold text-slate-800">¥{row.price.toLocaleString()}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Adjust layers */}
                            {order.opcQuoteCardSnapshot.adjustLayers.length > 0 && (
                              <div className="divide-y divide-slate-100 bg-amber-50/50">
                                {order.opcQuoteCardSnapshot.adjustLayers.map((row, i) => (
                                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                                    <div>
                                      <span className="font-medium text-slate-600">{row.label}</span>
                                      <span className="ml-2 text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">{row.tierLabel}</span>
                                    </div>
                                    {row.coefficient != null && (
                                      <span className="text-xs font-bold text-amber-700">× {row.coefficient}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Total */}
                            <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-t border-primary/20">
                              <span className="font-bold text-slate-700">最终报价</span>
                              <span className="font-extrabold text-primary text-base">¥{order.opcQuoteCardSnapshot.finalPrice.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {/* Milestone Progress */}
                  {order.milestones && order.milestones.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-base font-bold text-primary font-display flex items-center gap-2">
                          <Zap size={16} /> 里程碑进度
                        </h2>
                        <span className="text-sm font-bold text-slate-600">
                          {approvedMilestones} / {totalMilestones} 已通过
                        </span>
                      </div>

                      {/* Progress bar derived from deliverables */}
                      <div className="mb-8">
                        <div className="flex gap-1">
                          {order.milestones.map((_, i) => {
                            const st = milestoneStatuses[i] ?? "pending";
                            return (
                              <div
                                key={i}
                                className={`h-2 flex-1 rounded-full ${
                                  st === "approved"
                                    ? "bg-green-400"
                                    : st === "submitted"
                                    ? "bg-amber-400"
                                    : st === "rejected"
                                    ? "bg-red-300"
                                    : "bg-slate-200"
                                }`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-4">
                        {order.milestones.map((m, i) => {
                          const msStatus = milestoneStatuses[i] ?? "pending";
                          const mCfg = MILESTONE_STATUS_CONFIG[msStatus] ?? MILESTONE_STATUS_CONFIG.pending;
                          const MIcon = mCfg.icon;
                          const msId = i + 1; // 1-based
                          const msDelivs = deliverables.filter(d => d.milestoneId === msId);
                          const latestRejected = msDelivs.find(d => d.status === "rejected");
                          const isRejectOpen = rejectMilestoneId === msId;
                          const isAcceptOpen = acceptMilestoneId === msId;

                          return (
                            <div
                              key={i}
                              className={`rounded-xl border p-5 ${
                                msStatus === "submitted"
                                  ? "border-amber-200 bg-amber-50"
                                  : msStatus === "approved"
                                  ? "border-green-100 bg-green-50"
                                  : msStatus === "rejected"
                                  ? "border-red-100 bg-red-50"
                                  : "border-slate-100 bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-sm ${mCfg.color}`}>
                                    <MIcon size={16} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-foreground text-sm">{m.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      截止：{new Date(m.deadline).toLocaleDateString("zh-CN")}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold ${mCfg.color}`}>{mCfg.label}</span>
                                  {/* Per-milestone action buttons (only when status is 'submitted') */}
                                  {msStatus === "submitted" && order.status !== "completed" && order.status !== "disputed" && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setActionError(null);
                                          setAcceptMilestoneId(isAcceptOpen ? null : msId);
                                          setRejectMilestoneId(null);
                                          setMilestoneAcceptRating(0);
                                          setMilestoneAcceptComment("");
                                        }}
                                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                                      >
                                        <CheckCircle2 size={13} /> 通过
                                      </button>
                                      <button
                                        onClick={() => {
                                          setActionError(null);
                                          setRejectMilestoneId(isRejectOpen ? null : msId);
                                          setAcceptMilestoneId(null);
                                          setMilestoneRejectReason("");
                                        }}
                                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                                      >
                                        <XCircle size={13} /> 打回
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {m.deliverableDesc && (
                                <p className="text-xs text-slate-500 mt-3 pl-11">{m.deliverableDesc}</p>
                              )}

                              {/* Inline accept confirmation */}
                              {isAcceptOpen && (
                                <div className="mt-4 pl-11 border-t border-amber-200 pt-4 space-y-3">
                                  <p className="text-sm font-bold text-green-700">确认通过该里程碑？</p>
                                  <div>
                                    <p className="text-xs text-slate-500 mb-1.5">评分（可选）</p>
                                    <StarPicker value={milestoneAcceptRating} onChange={setMilestoneAcceptRating} />
                                  </div>
                                  <textarea
                                    rows={2}
                                    placeholder="评价意见（可选）…"
                                    value={milestoneAcceptComment}
                                    onChange={e => setMilestoneAcceptComment(e.target.value)}
                                    className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      disabled={milestoneAcceptMutation.isPending}
                                      onClick={() => milestoneAcceptMutation.mutate({
                                        msId,
                                        rt: milestoneAcceptRating,
                                        cm: milestoneAcceptComment,
                                      })}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                    >
                                      {milestoneAcceptMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                      确认通过
                                    </button>
                                    <button
                                      onClick={() => { setAcceptMilestoneId(null); setActionError(null); }}
                                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                                    >
                                      取消
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Inline reject form */}
                              {isRejectOpen && (
                                <div className="mt-4 pl-11 border-t border-red-200 pt-4 space-y-3">
                                  <p className="text-sm font-bold text-red-700">填写打回原因</p>
                                  <textarea
                                    rows={3}
                                    placeholder="请说明哪些内容需要修改…"
                                    value={milestoneRejectReason}
                                    onChange={e => setMilestoneRejectReason(e.target.value)}
                                    className="w-full text-xs rounded-lg border border-red-200 bg-white px-3 py-2 focus:ring-2 focus:ring-red-200 outline-none resize-none"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      disabled={milestoneRejectMutation.isPending || !milestoneRejectReason.trim()}
                                      onClick={() => milestoneRejectMutation.mutate({
                                        msId,
                                        reason: milestoneRejectReason,
                                      })}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                    >
                                      {milestoneRejectMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                                      确认打回
                                    </button>
                                    <button
                                      onClick={() => { setRejectMilestoneId(null); setActionError(null); }}
                                      className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                                    >
                                      取消
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Latest rejected feedback display */}
                              {msStatus === "rejected" && latestRejected?.feedback && !isRejectOpen && !isAcceptOpen && (
                                <div className="mt-3 pl-11 flex items-start gap-1.5 text-xs text-red-600">
                                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                  <span>打回原因：{latestRejected.feedback}</span>
                                </div>
                              )}

                              {/* Milestone rating/comment from publisher */}
                              {msStatus === "approved" && !isAcceptOpen && !isRejectOpen && (() => {
                                const mExt = m as unknown as { rating?: number; comment?: string };
                                if (!mExt.rating && !mExt.comment) return null;
                                return (
                                  <div className="mt-3 pl-11 flex items-start gap-2">
                                    <CheckCircle2 size={13} className="text-green-600 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                      {mExt.rating && (
                                        <div className="flex items-center gap-1">
                                          {[1,2,3,4,5].map(s => (
                                            <Star key={s} size={11} className={s <= mExt.rating! ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
                                          ))}
                                          <span className="text-xs text-green-700 font-bold ml-1">您的评分 {mExt.rating} 分</span>
                                        </div>
                                      )}
                                      {mExt.comment && <p className="text-xs text-green-700">评语：{mExt.comment}</p>}
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Submitted deliverables for this milestone */}
                              {msDelivs.length > 0 && !isAcceptOpen && !isRejectOpen && (
                                <div className="mt-3 pl-11 space-y-2">
                                  {msDelivs.map(d => {
                                    const dCfg = DELIVERABLE_STATUS_CONFIG[d.status] ?? { label: d.status, color: "bg-slate-100 text-slate-500" };
                                    const delivFiles = parseDelivFiles(d.description, d.fileUrl, d.fileName);
                                    const plainText = extractDescriptionText(d.description);
                                    return (
                                      <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-slate-100 text-xs">
                                        <FileText size={14} className="text-primary shrink-0 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2">
                                            <span className="font-bold text-foreground">{d.title}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${dCfg.color}`}>{dCfg.label}</span>
                                          </div>
                                          {plainText && <p className="text-slate-500 mt-0.5">{plainText}</p>}
                                          {delivFiles.length > 0 && (
                                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                              {delivFiles.map((f, j) => (
                                                <a
                                                  key={j}
                                                  href={f.url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-colors"
                                                >
                                                  <Download size={10} />
                                                  {f.label.length > 20 ? f.label.slice(0, 18) + "…" : f.label}
                                                </a>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Deliverables (non-milestone orders) */}
                  {!hasMilestones && deliverables.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                      <h2 className="text-base font-bold text-primary font-display flex items-center gap-2 mb-6">
                        <FileText size={16} /> 交付物列表
                      </h2>
                      <div className="space-y-3">
                        {deliverables.map((d) => {
                          const dCfg = DELIVERABLE_STATUS_CONFIG[d.status] ?? { label: d.status, color: "bg-slate-100 text-slate-500" };
                          const delivFiles = parseDelivFiles(d.description, d.fileUrl, d.fileName);
                          const plainText = extractDescriptionText(d.description);
                          return (
                            <div
                              key={d.id}
                              className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100"
                            >
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <FileText size={18} className="text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-bold text-sm text-foreground truncate">{d.title}</p>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${dCfg.color}`}>
                                    {dCfg.label}
                                  </span>
                                </div>
                                {plainText && (
                                  <p className="text-xs text-slate-500 leading-relaxed">{plainText}</p>
                                )}
                                {delivFiles.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {delivFiles.map((f, i) => (
                                      <a
                                        key={i}
                                        href={f.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
                                      >
                                        <Download size={12} />
                                        {f.label.length > 24 ? f.label.slice(0, 21) + "…" : f.label}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                {delivFiles.length === 0 && !plainText && (
                                  <p className="text-xs text-slate-400 italic">暂无附件</p>
                                )}
                                {d.feedback && (
                                  <p className="text-xs text-red-600 mt-2 flex items-start gap-1">
                                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                    反馈：{d.feedback}
                                  </p>
                                )}
                                <p className="text-xs text-slate-400 mt-1.5">
                                  提交于 {new Date(d.submittedAt).toLocaleDateString("zh-CN")}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Empty state when no milestones or deliverables */}
                  {!hasMilestones && deliverables.length === 0 && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-400">
                      <Clock size={44} className="mx-auto mb-3 text-slate-200" />
                      <p className="font-medium">项目正在推进中</p>
                      <p className="text-xs mt-1">OPC 提交交付物后将在此显示</p>
                    </div>
                  )}
                </div>

                {/* Right Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Order Summary */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">订单信息</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-500 shrink-0">订单编号</span>
                        <span className="font-mono text-xs font-bold text-right text-slate-700">{order.orderNo}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-500">当前状态</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">OPC</span>
                        <span className="font-bold">{order.opcNickname ?? `#${order.opcId}`}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">订单金额</span>
                        <span className="font-extrabold text-primary text-base">¥{(order.amount ?? 0).toLocaleString()}</span>
                      </div>
                      {order.deadline && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">交付截止</span>
                          <span className="font-semibold">{new Date(order.deadline).toLocaleDateString("zh-CN")}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">创建时间</span>
                        <span className="text-slate-600">{new Date(order.createdAt).toLocaleDateString("zh-CN")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Settlement Breakdown */}
                  {(order.opcShare != null || order.publisherShare != null) && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">结算分配</h3>
                      <div className="space-y-3 text-sm">
                        {order.opcShare != null && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">OPC 接单方</span>
                            <span className="font-bold text-green-700">¥{order.opcShare.toLocaleString()}</span>
                          </div>
                        )}
                        {order.publisherShare != null && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">发单方</span>
                            <span className="font-bold text-blue-700">¥{order.publisherShare.toLocaleString()}</span>
                          </div>
                        )}
                        {order.platformFee != null && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">平台服务费</span>
                            <span className="font-bold text-slate-500">¥{order.platformFee.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center">
                          <span className="font-bold text-slate-700">合计</span>
                          <span className="font-extrabold text-primary">¥{order.amount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons (non-milestone orders only) */}
                  {canAccept && (
                    <div className="bg-white rounded-2xl border border-orange-200 shadow-sm p-6 space-y-3">
                      <h3 className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Zap size={12} /> 待处理操作
                      </h3>
                      <button
                        onClick={() => { setActionError(null); setShowAcceptModal(true); }}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-4 py-3 text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
                      >
                        <CheckCircle2 size={16} /> 确认验收
                      </button>
                      <button
                        onClick={() => { setActionError(null); setShowRejectModal(true); }}
                        className="w-full flex items-center justify-center gap-2 border border-red-300 text-red-600 rounded-xl px-4 py-3 text-sm font-bold hover:bg-red-50 transition-colors"
                      >
                        <XCircle size={16} /> 要求返工
                      </button>
                    </div>
                  )}

                  {/* Payment info (when paid or pending review) */}
                  {(order.paymentMethod || order.paidAt) && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">付款信息</h3>
                      <div className="space-y-3 text-sm">
                        {order.paymentMethod && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">支付方式</span>
                            <span className="font-medium text-slate-700">
                              {order.paymentMethod === "online" ? "📱 扫码支付" : "🏦 线下转账"}
                            </span>
                          </div>
                        )}
                        {order.paidAt && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">付款时间</span>
                            <span className="font-medium text-slate-700">
                              {new Date(order.paidAt).toLocaleDateString("zh-CN")}
                            </span>
                          </div>
                        )}
                        {order.paymentNote && (
                          <div>
                            <p className="text-slate-500 mb-1">备注</p>
                            <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{order.paymentNote}</p>
                          </div>
                        )}
                        {order.paymentReceiptUrl && (
                          <div>
                            <p className="text-slate-500 mb-1.5">付款凭证</p>
                            <a href={order.paymentReceiptUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={order.paymentReceiptUrl}
                                alt="付款凭证"
                                className="w-full max-h-32 object-contain rounded-xl border border-slate-200 bg-slate-50 hover:opacity-90 transition-opacity cursor-zoom-in"
                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            </a>
                          </div>
                        )}
                        {order.status === "pending_payment" && !order.paidAt && (
                          <div className="pt-1">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                              order.paymentReceiptUrl && !order.paymentRejectReason
                                ? "bg-blue-100 text-blue-700"
                                : order.paymentRejectReason
                                ? "bg-red-100 text-red-700"
                                : "bg-orange-100 text-orange-700"
                            }`}>
                              {order.paymentReceiptUrl && !order.paymentRejectReason
                                ? "⏳ 等待财务审核"
                                : order.paymentRejectReason
                                ? "❌ 凭证已拒绝"
                                : "⚠️ 待付款"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Related Demand */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">关联需求</h3>
                    <button
                      onClick={() => navigate(`/publisher/demand/${order.demandId}`)}
                      className="w-full flex items-start justify-between gap-2 text-sm font-bold text-slate-800 hover:text-primary transition-colors group text-left"
                    >
                      <span className="line-clamp-3">{order.demandTitle}</span>
                      <ChevronRight size={16} className="shrink-0 mt-0.5 group-hover:translate-x-1 transition-transform text-primary" />
                    </button>
                    {order.demandType && (
                      <span className="inline-block text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{order.demandType}</span>
                    )}
                    <button
                      onClick={() => navigate(`/publisher/demand/${order.demandId}`)}
                      className="w-full text-center text-xs text-primary font-bold hover:underline"
                    >
                      查看需求详情 →
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Accept Modal (non-milestone orders) ── */}
              {showAcceptModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
                    <h3 className="text-xl font-extrabold text-primary mb-2 font-display">确认验收</h3>
                    <p className="text-slate-500 text-sm mb-6">
                      确认后结算流程将自动触发，OPC 将在 3 个工作日内收到分成款项。
                    </p>

                    <div className="mb-5">
                      <label className="block text-sm font-bold text-foreground mb-3">
                        评价本次交付（可选）
                      </label>
                      <StarPicker value={rating} onChange={setRating} />
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-bold text-foreground mb-2">
                        评价意见（可选）
                      </label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="对本次 OPC 服务的整体评价…"
                        rows={3}
                        className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                      />
                    </div>

                    {actionError && (
                      <div className="mb-4 flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle size={16} /> {actionError}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handleAccept}
                        disabled={acceptOrder.isPending}
                        className="flex-1 flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-3 font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} />
                        {acceptOrder.isPending ? "处理中…" : "确认验收并结算"}
                      </button>
                      <button
                        onClick={() => { setShowAcceptModal(false); setActionError(null); }}
                        className="px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Reject Modal (non-milestone orders) ── */}
              {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
                    <h3 className="text-xl font-extrabold text-red-700 mb-2 font-display">要求返工</h3>
                    <p className="text-slate-500 text-sm mb-6">
                      请说明需要返工的具体内容，该意见将直接发送给 OPC。
                    </p>

                    <div className="mb-6">
                      <label className="block text-sm font-bold text-foreground mb-2">
                        返工意见 <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => { setRejectReason(e.target.value); setActionError(null); }}
                        placeholder="请详细说明哪些内容需要修改、修改标准是什么…"
                        rows={4}
                        className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus:ring-2 focus:ring-red-200 outline-none resize-none"
                      />
                    </div>

                    {actionError && (
                      <div className="mb-4 flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle size={16} /> {actionError}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handleReject}
                        disabled={rejectDelivery.isPending}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white rounded-xl py-3 font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <XCircle size={16} />
                        {rejectDelivery.isPending ? "发送中…" : "发送返工意见"}
                      </button>
                      <button
                        onClick={() => { setShowRejectModal(false); setActionError(null); setRejectReason(""); }}
                        className="px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
