import { useCurrentUser } from "@/hooks/use-current-user";
import { clearSession, getAccessToken } from "@/lib/auth";
import { useState, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useLocation, Link } from "wouter";
import {
  Search, Bell, Star, BadgeCheck, Calendar,
  Zap, ArrowLeft, User, ChevronRight, CheckCircle2, Clock,
  XCircle, ExternalLink, AlertCircle, Timer, Trophy,
  FileText, Download, FileImage, FileSpreadsheet, FileArchive, File,
  Menu, Edit2, Send, X, Undo2, CreditCard, Upload, RotateCcw, Loader2, Save,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import {
  useGetDemandById,
  useGetDemandPayment,
  useListBidsForDemand,
  useSubmitDemandPayment,
  usePollDemandPaymentStatus,
  useUpdateBidStatus,
  useUpdateDemandStatus,
} from "@workspace/api-client-react";
import { useParams } from "wouter";
import { PublisherSidebar } from "@/components/publisher/PublisherSidebar";
import { PublisherHeaderUser } from '@/components/publisher/PublisherHeaderUser';
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const DEMAND_TYPE_LABELS: Record<string, string> = {
  ai_education: "AI 教育",
  gov_training: "政企培训",
  ai_research: "AI 研究",
  ai_tool_dev: "AI 工具开发",
  party_building: "党建数字化",
  livestream_media: "直播媒体",
  other: "综合",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:              { label: "草稿",     color: "bg-slate-100 text-slate-600" },
  pending_review:     { label: "待审核",   color: "bg-amber-100 text-amber-700" },
  pending_payment:    { label: "待缴保证金", color: "bg-orange-100 text-orange-700" },
  published:          { label: "招募中",   color: "bg-blue-100 text-blue-700" },
  matched:            { label: "已匹配",   color: "bg-purple-100 text-purple-700" },
  in_progress:        { label: "进行中",   color: "bg-green-100 text-green-700" },
  pending_acceptance: { label: "待验收",   color: "bg-orange-100 text-orange-700" },
  completed:          { label: "已完成",     color: "bg-emerald-100 text-emerald-700" },
  closed:             { label: "已关闭",     color: "bg-red-100 text-red-600" },
  refund_pending:     { label: "退款审核中", color: "bg-purple-100 text-purple-700" },
  refunding:          { label: "退款中",     color: "bg-indigo-100 text-indigo-700" },
  refunded:           { label: "已退款",     color: "bg-slate-100 text-slate-600" },
};

const OPC_LEVEL_COLOR: Record<string, string> = {
  C: "bg-slate-100 text-slate-600",
  B: "bg-blue-100 text-blue-700",
  A: "bg-amber-100 text-amber-700",
};

function AttachmentIcon({ type }: { type: string }) {
  if (type?.startsWith("image") || type === "image") return <FileImage size={18} className="text-blue-500" />;
  if (type?.includes("sheet") || type === "spreadsheet") return <FileSpreadsheet size={18} className="text-green-600" />;
  if (type?.includes("zip") || type?.includes("rar") || type === "archive") return <FileArchive size={18} className="text-yellow-600" />;
  return <File size={18} className="text-slate-400" />;
}

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={12}
          className={s <= Math.round(score) ? "fill-amber-400 text-amber-400" : "text-slate-200"}
        />
      ))}
      <span className="text-xs text-slate-500 ml-1">{score.toFixed(1)}</span>
    </div>
  );
}

export default function PublisherDemandDetail() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const demandId = parseInt(params.id ?? "0", 10);
  const qc = useQueryClient();
  const { toast } = useToast();

  const [confirmingBidId, setConfirmingBidId] = useState<number | null>(null);
  const [rejectingBidId, setRejectingBidId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [demandActionLoading, setDemandActionLoading] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [showAdjustPanel, setShowAdjustPanel] = useState(false);
  const [adjustOpcLevel, setAdjustOpcLevel] = useState<string>("");
  const [adjustBidDeadline, setAdjustBidDeadline] = useState<string>("");
  const [adjustBudget, setAdjustBudget] = useState<string>("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<"online" | "offline">("online");
  const [paymentNote, setPaymentNote] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [onlineQrUrl, setOnlineQrUrl] = useState<string | null>(null);
  const [onlinePaymentId, setOnlinePaymentId] = useState<number | null>(null);
  const [onlinePaid, setOnlinePaid] = useState(false);
  const [qrGenerating, setQrGenerating] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: demand, isLoading: demandLoading, refetch: refetchDemand } = useGetDemandById(demandId, {
    query: { enabled: demandId > 0 },
  });

  // Fetch existing payment (only active when demand is in pending_payment state)
  const { data: existingPayment, refetch: refetchPayment } = useGetDemandPayment(demandId, {
    query: { enabled: demandId > 0 && demand?.status === "pending_payment" },
  });

  const { data: bids = [], isLoading: bidsLoading } = useListBidsForDemand(demandId, {
    query: { enabled: demandId > 0 },
  });

  const updateBidStatus = useUpdateBidStatus();
  const updateDemandStatus = useUpdateDemandStatus();
  const submitPaymentMutation = useSubmitDemandPayment();
  const pollPaymentStatus = usePollDemandPaymentStatus();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  // When viewing a demand in "refunding" state, trigger an on-demand status sync
  useEffect(() => {
    if (!demand || demand.status !== "refunding") return;
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${BASE}/api/demands/${demandId}/sync-refund-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
    })
      .then(r => r.json())
      .then((r: any) => { if (r.synced) refetchDemand(); })
      .catch(() => {});
  }, [demand?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmitReview = async () => {
    setDemandActionLoading(true);
    try {
      await updateDemandStatus.mutateAsync({ demandId, data: { status: "pending_review" } });
      toast({ title: "已提交审核", description: "平台将在24小时内完成审核" });
      refetchDemand();
    } catch {
      toast({ title: "操作失败", description: "请稍后重试", variant: "destructive" });
    } finally {
      setDemandActionLoading(false);
    }
  };

  const doWithdrawDemand = async () => {
    setShowWithdrawDialog(false);
    setDemandActionLoading(true);
    try {
      await updateDemandStatus.mutateAsync({ demandId, data: { status: "draft" } });
      toast({ title: "已撤回", description: "需求已变回草稿，可重新编辑后提交审核" });
      refetchDemand();
    } catch {
      toast({ title: "操作失败", description: "请稍后重试", variant: "destructive" });
    } finally {
      setDemandActionLoading(false);
    }
  };

  const doCloseDemand = async () => {
    setShowCloseDialog(false);
    setDemandActionLoading(true);
    try {
      await updateDemandStatus.mutateAsync({ demandId, data: { status: "closed" } });
      toast({ title: "需求已关闭" });
      refetchDemand();
    } catch {
      toast({ title: "操作失败", description: "请稍后重试", variant: "destructive" });
    } finally {
      setDemandActionLoading(false);
    }
  };

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleAdjustDemand = async () => {
    if (!adjustOpcLevel && !adjustBidDeadline && !adjustBudget) {
      toast({ title: "请至少修改一项", variant: "destructive" });
      return;
    }
    if (adjustBudget) {
      const newBudget = parseInt(adjustBudget);
      if (isNaN(newBudget) || newBudget <= 0) {
        toast({ title: "请输入有效预算金额", variant: "destructive" });
        return;
      }
      if (demand && newBudget <= (demand.budget ?? 0)) {
        toast({ title: "预算只能上调", description: "新预算必须高于当前预算", variant: "destructive" });
        return;
      }
    }
    setAdjustLoading(true);
    try {
      const body: Record<string, string | number> = {};
      if (adjustOpcLevel) body.opcLevel = adjustOpcLevel;
      if (adjustBidDeadline) body.bidDeadline = adjustBidDeadline;
      if (adjustBudget) body.budget = parseInt(adjustBudget);
      const res = await fetch(`${BASE}/api/demands/${demandId}/adjust`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "调整失败");
      }
      toast({ title: "调整成功", description: "需求参数已更新" });
      setShowAdjustPanel(false);
      setAdjustOpcLevel("");
      setAdjustBidDeadline("");
      setAdjustBudget("");
      refetchDemand();
    } catch (err: any) {
      toast({ title: "调整失败", description: err?.message ?? "请稍后重试", variant: "destructive" });
    } finally {
      setAdjustLoading(false);
    }
  };

  const requestRefundMut = useMutation({
    mutationFn: async (reason: string) => {
      const token = getAccessToken();
      const res = await fetch(`${BASE}/api/demands/${demandId}/request-refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "申请退款失败");
      return data;
    },
    onSuccess: () => {
      toast({ title: "退款申请已提交", description: "管理员将在1-3个工作日内审核" });
      setShowRefundDialog(false);
      setRefundReason("");
      refetchDemand();
    },
    onError: (e: Error) => toast({ title: "申请退款失败", description: e.message, variant: "destructive" }),
  });

  const handleReceiptUpload = async (file: File) => {
    setReceiptUploading(true);
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
      setReceiptUrl(`${BASE}/api/storage${objectPath}`);
      toast({ title: "截图上传成功", description: "已附加到缴费凭证" });
    } catch (err: unknown) {
      toast({ title: "上传失败", description: (err as Error).message, variant: "destructive" });
    } finally {
      setReceiptUploading(false);
    }
  };

  // Poll online payment status every 3 seconds while QR is shown
  useEffect(() => {
    if (!onlineQrUrl || onlinePaid) return;
    pollTimerRef.current = setInterval(async () => {
      try {
        const result = await pollPaymentStatus.mutateAsync({ demandId });
        if (result.paid || result.confirmed) {
          setOnlinePaid(true);
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          await refetchDemand();
          await refetchPayment();
          toast({ title: "✅ 保证金已到账", description: "需求已自动发布，OPC 现在可以看到并投标" });
        } else if (result.terminal) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          toast({ title: "支付未完成", description: `支付状态：${result.statusName ?? "已结束"}`, variant: "destructive" });
          setOnlineQrUrl(null);
          setOnlinePaymentId(null);
        }
      } catch {
        // Silent - just try again next interval
      }
    }, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [onlineQrUrl, onlinePaid, demandId]);

  const handleGenerateQr = async () => {
    setQrGenerating(true);
    try {
      const result = await submitPaymentMutation.mutateAsync({
        demandId,
        data: { method: "online" },
      });
      if (result.qrCodeUrl) {
        setOnlineQrUrl(result.qrCodeUrl);
        setOnlinePaymentId(result.id);
        setOnlinePaid(false);
      } else {
        toast({ title: "创建支付订单失败", description: "未收到二维码，请稍后重试", variant: "destructive" });
      }
    } catch {
      toast({ title: "生成支付二维码失败", description: "请稍后重试", variant: "destructive" });
    } finally {
      setQrGenerating(false);
    }
  };

  // Auto-generate QR when demand is in pending_payment state and online mode is active
  // Skip if there's already an offline voucher pending review
  useEffect(() => {
    const offlinePending = existingPayment?.method === "offline" && existingPayment?.status === "pending";
    if (
      demand?.status === "pending_payment" &&
      paymentMethod === "online" &&
      !onlineQrUrl &&
      !onlinePaid &&
      !qrGenerating &&
      !submitPaymentMutation.isPending &&
      !offlinePending
    ) {
      handleGenerateQr();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demand?.status, paymentMethod, existingPayment?.status, existingPayment?.method]);

  const handleSubmitPayment = async () => {
    try {
      if (paymentMethod === "online") {
        await handleGenerateQr();
        return;
      }

      // Offline flow
      if (!receiptUrl.trim()) {
        toast({ title: "请先上传转账凭证", description: "需上传转账截图或凭证文件后才能提交", variant: "destructive" });
        return;
      }
      const body: { method: "online" | "offline"; receiptUrl?: string; paymentNote?: string } = {
        method: "offline",
        receiptUrl: receiptUrl.trim(),
      };
      if (paymentNote.trim()) body.paymentNote = paymentNote.trim();

      await submitPaymentMutation.mutateAsync({ demandId, data: body });
      // Stop any online payment polling since user switched to offline
      setOnlineQrUrl(null);
      setOnlinePaymentId(null);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      await refetchPayment();
      toast({ title: "缴费凭证已提交", description: "请等待平台审核确认，确认后需求将自动发布" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "请稍后重试";
      toast({ title: "提交失败", description: msg, variant: "destructive" });
    }
  };

  const handleConfirm = async (bidId: number) => {
    setActionError(null);
    try {
      await updateBidStatus.mutateAsync({ bidId, data: { status: "accepted" } });
      await qc.invalidateQueries({ queryKey: [`/api/demands/${demandId}/bids`] });
      await qc.invalidateQueries({ queryKey: [`/api/demands/${demandId}`] });
      setConfirmingBidId(null);
    } catch {
      setActionError("操作失败，请稍后重试");
    }
  };

  const handleReject = async (bidId: number) => {
    setActionError(null);
    try {
      await updateBidStatus.mutateAsync({ bidId, data: { status: "rejected" } });
      await qc.invalidateQueries({ queryKey: [`/api/demands/${demandId}/bids`] });
      setRejectingBidId(null);
      setRejectReason("");
    } catch {
      setActionError("操作失败，请稍后重试");
    }
  };

  const typeLabel = demand?.type ? (DEMAND_TYPE_LABELS[demand.type] ?? demand.type) : "综合";
  const statusCfg = demand?.status ? (STATUS_CONFIG[demand.status] ?? STATUS_CONFIG.draft) : STATUS_CONFIG.draft;

  const pendingBids = (bids as any[]).filter((b: any) => b.status === "pending");
  const processedBids = (bids as any[]).filter((b: any) => b.status !== "pending");

  return (
    <div className="flex min-h-screen bg-[#f9f9fc] text-[#1a1c1e] overflow-x-hidden">
      <PublisherSidebar onLogout={logout} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      <main className="flex-1 md:ml-64 min-h-screen">
        {/* Top bar */}
        <header className="fixed top-0 right-0 md:left-64 left-0 z-40 bg-white/80 backdrop-blur-md shadow-sm flex items-center px-4 md:px-8 py-3 gap-2">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden shrink-0 p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/publisher/demands")}
              className="flex items-center gap-2 text-slate-500 hover:text-primary text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} /> 返回需求列表
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
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors" onClick={() => navigate("/publisher/notifications")}>
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
            </button>
            <PublisherHeaderUser onLogout={logout} />
          </div>
        </header>

        <div className="pt-20 pb-16 px-8 max-w-[1280px] mx-auto">
          {demandLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : !demand ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <AlertCircle size={48} className="mb-4 text-slate-300" />
              <p className="text-lg font-medium">需求不存在或已被删除</p>
              <button onClick={() => navigate("/publisher/demands")} className="mt-4 text-primary text-sm hover:underline">
                返回需求列表
              </button>
            </div>
          ) : (
            <>
              {/* ── Demand Header ── */}
              <div className="mb-8 bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-widest bg-slate-100 px-2 py-1 rounded text-slate-600">
                        {typeLabel}
                      </span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                      {demand.isUrgent && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-600 flex items-center gap-1">
                          <Zap size={10} /> 紧急
                        </span>
                      )}
                      <span className="text-xs text-slate-400 font-mono">{demand.demandNo}</span>
                    </div>
                    <h1 className="text-2xl font-extrabold text-primary tracking-tight mb-3 font-display leading-tight">
                      {demand.title}
                    </h1>
                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-4">{demand.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400 mb-1">预算金额</p>
                    <p className="text-2xl font-extrabold text-primary">
                      ¥{demand.budget?.toLocaleString() ?? "面议"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center justify-end gap-1">
                      <Calendar size={12} />
                      截止 {new Date(demand.deadline).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                </div>

                {/* Skills */}
                {demand.skillTags && demand.skillTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-100">
                    {demand.skillTags.map((tag) => (
                      <span key={tag} className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Rejection reason banner */}
                {(demand as any).rejectionReason && demand.status === "draft" && (
                  <div className="mt-5 pt-5 border-t border-red-100">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle size={15} className="text-red-500 shrink-0" />
                        <p className="text-sm font-extrabold text-red-700">审核不通过 · 请根据以下原因修改后重新提交</p>
                      </div>
                      <p className="text-sm text-red-800 leading-relaxed whitespace-pre-wrap pl-5">
                        {(demand as any).rejectionReason}
                      </p>
                    </div>
                  </div>
                )}

                {/* Demand actions */}
                {(() => {
                  const isDraft = demand.status === "draft";
                  const isPendingReview = demand.status === "pending_review";
                  const isPendingPayment = demand.status === "pending_payment";
                  if (!isDraft && !isPendingReview && !isPendingPayment) return null;
                  return (
                    <div className="mt-5 pt-5 border-t border-slate-100">
                      {(isDraft || isPendingReview) && (
                        <div className="flex items-center gap-3 flex-wrap">
                          {isDraft && (
                            <button
                              onClick={handleSubmitReview}
                              disabled={demandActionLoading}
                              className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm shadow-primary/20"
                            >
                              <Send size={14} />
                              {demandActionLoading ? "提交中…" : "提交审核"}
                            </button>
                          )}
                          {isDraft && (
                            <Link href={`/publisher/demands/${demandId}/edit`}>
                              <button className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">
                                <Edit2 size={14} /> 编辑需求
                              </button>
                            </Link>
                          )}
                          {isPendingReview && (
                            <button
                              onClick={() => setShowWithdrawDialog(true)}
                              disabled={demandActionLoading}
                              className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-100 disabled:opacity-50 transition-colors border border-amber-200"
                            >
                              <Undo2 size={14} /> {demandActionLoading ? "撤回中…" : "撤回审核"}
                            </button>
                          )}
                          {isDraft && (
                            <button
                              onClick={() => setShowCloseDialog(true)}
                              disabled={demandActionLoading}
                              className="flex items-center gap-2 text-slate-400 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-red-50 hover:text-destructive disabled:opacity-50 transition-colors"
                            >
                              <X size={14} /> 关闭需求
                            </button>
                          )}
                        </div>
                      )}

                      {/* ── 保证金缴纳 UI ── */}
                      {isPendingPayment && (
                        <div className="space-y-4">
                          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <CreditCard size={16} className="text-orange-600 shrink-0" />
                              <p className="text-sm font-bold text-orange-800">需缴纳保证金后需求才会发布</p>
                            </div>
                            <p className="text-xs text-orange-700 leading-relaxed">
                              您的需求已通过审核。请按以下方式缴纳保证金 <span className="font-bold">¥{demand.budget.toLocaleString()}</span>，
                              平台确认到账后需求将自动发布至需求大厅。
                            </p>
                          </div>

                          {existingPayment && existingPayment.status === "rejected" && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                              <p className="text-sm font-bold text-red-700 mb-1">缴费凭证审核未通过</p>
                              <p className="text-xs text-red-600">原因：{existingPayment.rejectReason}</p>
                            </div>
                          )}

                          {/* Bank account / payment info — only shown in offline mode */}
                          {paymentMethod === "offline" && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">收款账号信息</p>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <p className="text-xs text-slate-400 mb-0.5">开户行</p>
                                  <p className="font-medium text-slate-700">中国工商银行股份有限公司北京海淀支行</p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-400 mb-0.5">账户名</p>
                                  <p className="font-medium text-slate-700">北京海创元人工智能教育科技有限公司</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-xs text-slate-400 mb-0.5">账号</p>
                                  <p className="font-mono font-bold text-slate-800 text-base tracking-wider">0200049619201891562</p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-xs text-slate-400 mb-0.5">转账备注（必填）</p>
                                  <p className="font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-lg text-xs">需求编号: {demand.demandNo}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* If offline voucher already submitted and pending review → show waiting state */}
                          {existingPayment?.method === "offline" && existingPayment?.status === "pending" ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                                <p className="text-sm font-bold text-blue-800">凭证已提交，等待平台审核</p>
                              </div>
                              <p className="text-xs text-blue-700">平台确认收款后需求将自动发布至需求大厅，请耐心等待。</p>
                              {existingPayment.receiptUrl && (
                                <div>
                                  <p className="text-xs text-blue-600 font-medium mb-1.5">已提交凭证：</p>
                                  <a href={existingPayment.receiptUrl} target="_blank" rel="noopener noreferrer">
                                    <img
                                      src={existingPayment.receiptUrl}
                                      alt="缴费凭证"
                                      className="max-h-40 rounded-xl border border-blue-200 object-contain bg-white hover:opacity-90 transition-opacity cursor-zoom-in"
                                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                    />
                                  </a>
                                </div>
                              )}
                            </div>
                          ) : !onlinePaid && (
                            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                              {/* Payment method tabs */}
                              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                                {(["online", "offline"] as const).map(m => (
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() => {
                                      setPaymentMethod(m);
                                      if (m === "offline") {
                                        // Stop online polling when switching to offline
                                        setOnlineQrUrl(null);
                                        setOnlinePaymentId(null);
                                        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                                      }
                                    }}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                      paymentMethod === m
                                        ? "bg-white text-primary shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                    }`}
                                  >
                                    {m === "online" ? "📱 扫码支付" : "🏦 线下转账"}
                                  </button>
                                ))}
                              </div>

                              {/* ── Online: QR code ── */}
                              {paymentMethod === "online" && (
                                <div className="text-center space-y-3">
                                  {qrGenerating || submitPaymentMutation.isPending ? (
                                    <div className="py-8 space-y-2">
                                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                                      <p className="text-xs text-slate-500">正在生成支付二维码…</p>
                                    </div>
                                  ) : onlineQrUrl ? (
                                    <>
                                      <p className="text-xs font-medium text-slate-600">扫描二维码完成支付 · ¥{demand.budget.toLocaleString()}</p>
                                      <div className="w-52 h-52 mx-auto rounded-xl overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center bg-white p-3">
                                        <QRCodeSVG value={onlineQrUrl} size={192} />
                                      </div>
                                      <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                                        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                        <span>等待支付确认中，到账后需求自动发布…</span>
                                      </div>
                                      <button
                                        onClick={() => { setOnlineQrUrl(null); setOnlinePaymentId(null); handleGenerateQr(); }}
                                        className="text-xs text-slate-400 hover:text-slate-600 underline"
                                      >
                                        刷新二维码
                                      </button>
                                    </>
                                  ) : (
                                    <div className="py-6 space-y-2">
                                      <div className="w-8 h-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin mx-auto" />
                                      <p className="text-xs text-slate-400">正在准备支付…</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* ── Offline: receipt upload ── */}
                              {paymentMethod === "offline" && (
                                <>
                                  <div>
                                    <p className="text-xs text-slate-500 mb-2">上传转账截图 / 凭证（推荐）</p>
                                    {receiptUrl ? (
                                      <div className="relative">
                                        <img
                                          src={receiptUrl}
                                          alt="缴费凭证"
                                          className="max-h-48 rounded-xl border border-slate-200 object-contain w-full bg-slate-50"
                                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setReceiptUrl("")}
                                          className="absolute top-2 right-2 bg-white/90 border border-slate-200 rounded-full p-1 hover:bg-red-50 hover:text-red-600 transition-colors"
                                        >
                                          <X size={12} />
                                        </button>
                                        <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                                          <CheckCircle2 size={12} /> 截图已上传
                                        </p>
                                      </div>
                                    ) : (
                                      <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${receiptUploading ? "border-primary/40 bg-primary/5" : "border-slate-200 hover:border-primary/40 hover:bg-slate-50"}`}>
                                        <input
                                          type="file"
                                          accept="image/*,.pdf"
                                          className="hidden"
                                          onChange={e => e.target.files?.[0] && handleReceiptUpload(e.target.files[0])}
                                          disabled={receiptUploading}
                                        />
                                        {receiptUploading ? (
                                          <>
                                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs text-primary font-medium">上传中…</span>
                                          </>
                                        ) : (
                                          <>
                                            <Upload size={20} className="text-slate-400" />
                                            <span className="text-xs text-slate-500 font-medium">点击上传转账截图</span>
                                            <span className="text-[11px] text-slate-400">支持 JPG / PNG / PDF</span>
                                          </>
                                        )}
                                      </label>
                                    )}
                                  </div>
                                  <button
                                    onClick={handleSubmitPayment}
                                    disabled={submitPaymentMutation.isPending || receiptUploading || !receiptUrl.trim()}
                                    className="flex items-center gap-2 bg-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Upload size={14} />
                                    {submitPaymentMutation.isPending ? "提交中…" : "提交缴费凭证"}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>

              {actionError && (
                <div className="mb-6 flex items-center gap-3 bg-red-50 text-red-700 rounded-xl p-4 border border-red-200">
                  <AlertCircle size={18} />
                  <span className="text-sm font-medium">{actionError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Content + Bid Applications */}
                <div className="lg:col-span-2 space-y-8">

                  {/* ── 需求详细说明 ── */}
                  <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                    <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2 font-display">
                      <FileText size={16} /> 需求详细说明
                    </h3>
                    <div className="text-sm text-slate-600 leading-relaxed space-y-2">
                      {(demand.description || "").split('\n').map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  </section>

                  {/* ── 附件资料 ── */}
                  {(() => {
                    const attachments: Array<{ name: string; size: string; type: string; url: string }> =
                      (demand as any).attachments?.length ? (demand as any).attachments : [];
                    return (
                      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                        <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2 font-display">
                          <Download size={16} /> 附件资料
                        </h3>
                        {attachments.length === 0 ? (
                          <p className="text-sm text-slate-400">暂无上传附件</p>
                        ) : (
                          <ul className="space-y-3">
                            {attachments.map((file, idx) => {
                              const hasUrl = file.url && file.url !== "#";
                              const downloadHref = hasUrl
                                ? `${file.url}?name=${encodeURIComponent(file.name)}`
                                : undefined;
                              return (
                                <li key={idx}>
                                  {hasUrl ? (
                                    <a
                                      href={downloadHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download={file.name}
                                      className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer"
                                    >
                                      <AttachmentIcon type={file.type} />
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-slate-700 truncate group-hover:text-primary transition-colors">{file.name}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{file.size}</p>
                                      </div>
                                      <Download size={14} className="text-slate-400 group-hover:text-primary transition-colors shrink-0" />
                                    </a>
                                  ) : (
                                    <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed">
                                      <AttachmentIcon type={file.type} />
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-slate-700 truncate">{file.name}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{file.size} · 文件暂不可下载</p>
                                      </div>
                                      <Download size={14} className="text-slate-300 shrink-0" />
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </section>
                    );
                  })()}

                  {/* ── Refund button (for published demands) ── */}
                  {demand.status === "published" && (
                    <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-end">
                      <button
                        onClick={() => setShowRefundDialog(true)}
                        className="flex items-center gap-1.5 text-slate-400 text-sm hover:text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <RotateCcw size={13} /> 申请退款
                      </button>
                    </div>
                  )}

                  {/* ── Refund status banners ── */}
                  {demand.status === "refund_pending" && (
                    <div className="mt-5 pt-5 border-t border-slate-100">
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
                        <RotateCcw size={18} className="text-purple-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-purple-800">退款申请审核中</p>
                          <p className="text-xs text-purple-700 mt-1 leading-relaxed">
                            您的退款申请已提交，平台将在1-3个工作日内审核。审核结果将通过站内信和邮件通知您。
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {demand.status === "refunding" && (
                    <div className="mt-5 pt-5 border-t border-slate-100">
                      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
                        <Loader2 size={18} className="text-indigo-500 shrink-0 mt-0.5 animate-spin" />
                        <div>
                          <p className="text-sm font-bold text-indigo-800">退款处理中</p>
                          <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                            退款已获批准，正在处理中。预计1-5个工作日到账，到账后将通过站内信和邮件通知您。
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {demand.status === "refunded" && (
                    <div className="mt-5 pt-5 border-t border-slate-100">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                        <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-emerald-800">保证金已退款</p>
                          <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                            保证金已成功退还，请确认到账情况。如有问题请联系平台客服。
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Refund request dialog ── */}
                  {showRefundDialog && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowRefundDialog(false)}>
                      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-4">
                          <RotateCcw size={18} className="text-slate-500" />
                          <h3 className="font-bold text-slate-800">申请退款</h3>
                        </div>
                        <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                          确认后，所有 OPC 投标将自动退回，需求变为退款审核中，等待管理员审核。
                        </p>
                        <div className="mb-4">
                          <label className="text-xs font-bold text-slate-500 block mb-1.5">退款原因（可选）</label>
                          <textarea
                            value={refundReason}
                            onChange={e => setRefundReason(e.target.value)}
                            placeholder="请说明申请退款的原因…"
                            rows={2}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setShowRefundDialog(false)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">取消</button>
                          <button
                            onClick={() => requestRefundMut.mutate(refundReason)}
                            disabled={requestRefundMut.isPending}
                            className="flex items-center gap-1.5 px-4 py-2 bg-slate-700 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors"
                          >
                            {requestRefundMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                            确认申请退款
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pending Bids */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-primary font-display flex items-center gap-2">
                        <User size={18} /> 抢单申请
                        {pendingBids.length > 0 && (
                          <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {pendingBids.length}
                          </span>
                        )}
                      </h2>
                    </div>

                    {bidsLoading ? (
                      <div className="flex items-center justify-center h-32 bg-white rounded-2xl border border-slate-100">
                        <div className="w-6 h-6 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                      </div>
                    ) : pendingBids.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">
                        <User size={40} className="mx-auto mb-3 text-slate-200" />
                        <p className="font-medium">暂无待审核的抢单申请</p>
                        <p className="text-xs mt-1">
                          {demand.status === "published"
                            ? "需求已发布，等待 OPC 提交申请"
                            : "需求尚未发布或招募已结束"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {pendingBids.map((bid: any) => (
                          <div
                            key={bid.id}
                            className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6"
                          >
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-bold text-primary">
                                  {bid.opcAvatar ? (
                                    <img src={bid.opcAvatar} alt={bid.opcNickname} className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    (bid.opcNickname?.[0] ?? "O")
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground">{bid.opcNickname ?? `OPC #${bid.opcId}`}</span>
                                    {bid.opcLevel && (
                                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${OPC_LEVEL_COLOR[bid.opcLevel] ?? "bg-slate-100 text-slate-600"}`}>
                                        {bid.opcLevel}级
                                      </span>
                                    )}
                                  </div>
                                  {bid.opcCreditScore !== undefined && (
                                    <div className="mt-1">
                                      <StarRating score={bid.opcCreditScore} />
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {bid.estimatedDays && (
                                  <div className="flex items-center gap-1 text-slate-500 text-sm">
                                    <Timer size={14} />
                                    <span>预计 {bid.estimatedDays} 天完成</span>
                                  </div>
                                )}
                                <p className="text-xs text-slate-400 mt-1">
                                  申请时间：{new Date(bid.createdAt).toLocaleDateString("zh-CN")}
                                </p>
                              </div>
                            </div>

                            {/* Proposal */}
                            <div className="bg-slate-50 rounded-xl p-4 mb-4">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">接单方案描述</p>
                              <p className="text-sm text-slate-700 leading-relaxed">{bid.proposal}</p>
                            </div>

                            {/* Portfolio Links */}
                            {bid.portfolioLinks && bid.portfolioLinks.length > 0 && (
                              <div className="mb-4">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">作品集链接</p>
                                <div className="flex flex-wrap gap-2">
                                  {bid.portfolioLinks.map((link: string, idx: number) => (
                                    <a
                                      key={idx}
                                      href={link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded-full"
                                    >
                                      <ExternalLink size={10} /> 查看作品 {idx + 1}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            {confirmingBidId === bid.id ? (
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <p className="text-sm font-bold text-blue-800 mb-3">
                                  确认选择 <span className="text-primary">{bid.opcNickname}</span> 接单？
                                </p>
                                <p className="text-xs text-blue-600 mb-4">
                                  确认后将自动生成交易订单，其余申请将自动婉拒。
                                </p>
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => handleConfirm(bid.id)}
                                    disabled={updateBidStatus.isPending}
                                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                                  >
                                    <CheckCircle2 size={14} />
                                    {updateBidStatus.isPending ? "处理中…" : "确认接单"}
                                  </button>
                                  <button
                                    onClick={() => setConfirmingBidId(null)}
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : rejectingBidId === bid.id ? (
                              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <p className="text-sm font-bold text-red-700 mb-3">
                                  婉拒 <span className="font-bold">{bid.opcNickname}</span> 的申请
                                </p>
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  placeholder="请填写婉拒原因（选填）"
                                  rows={2}
                                  className="w-full text-sm rounded-lg border border-red-200 bg-white px-3 py-2 mb-3 focus:ring-2 focus:ring-red-200 outline-none resize-none"
                                />
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => handleReject(bid.id)}
                                    disabled={updateBidStatus.isPending}
                                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                                  >
                                    <XCircle size={14} />
                                    {updateBidStatus.isPending ? "处理中…" : "确认婉拒"}
                                  </button>
                                  <button
                                    onClick={() => { setRejectingBidId(null); setRejectReason(""); }}
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-3">
                                <button
                                  onClick={() => setConfirmingBidId(bid.id)}
                                  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
                                >
                                  <CheckCircle2 size={14} /> 确认接单
                                </button>
                                <button
                                  onClick={() => setRejectingBidId(bid.id)}
                                  className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                                >
                                  <XCircle size={14} /> 婉拒
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Already processed bids */}
                  {processedBids.length > 0 && (
                    <section>
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">已处理申请</h3>
                      <div className="space-y-3">
                        {processedBids.map((bid: any) => (
                          <div
                            key={bid.id}
                            className="bg-white rounded-xl border border-slate-100 px-5 py-4 flex items-center gap-4"
                          >
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm">
                              {bid.opcNickname?.[0] ?? "O"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground text-sm">{bid.opcNickname ?? `OPC #${bid.opcId}`}</span>
                                {bid.opcLevel && (
                                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${OPC_LEVEL_COLOR[bid.opcLevel] ?? "bg-slate-100 text-slate-600"}`}>
                                    {bid.opcLevel}级
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{bid.proposal}</p>
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              bid.status === "accepted"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-600"
                            }`}>
                              {bid.status === "accepted" ? "已确认" : "已婉拒"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Milestone Roadmap */}
                  {demand.milestones && demand.milestones.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                      <h3 className="text-base font-bold text-primary mb-6 flex items-center gap-2 font-display">
                        <Zap size={16} /> 里程碑计划
                      </h3>
                      <div className="space-y-4">
                        {demand.milestones.map((m: any, i: number) => (
                          <div key={i} className="flex items-start gap-4">
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                                {i + 1}
                              </div>
                              {i < (demand.milestones?.length ?? 0) - 1 && (
                                <div className="w-px h-8 bg-slate-200 mt-2" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pb-4">
                              <p className="font-bold text-foreground text-sm">{m.name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">截止：{new Date(m.deadline).toLocaleDateString("zh-CN")}</p>
                              {m.deliverableDesc && (
                                <p className="text-xs text-slate-400 mt-1">{m.deliverableDesc}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                {/* Right Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Demand Meta */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">需求详情</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">需求编号</span>
                        <span className="font-mono text-xs font-bold text-slate-700">{demand.demandNo}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">派单模式</span>
                        <span className="font-semibold">{demand.mode === "open" ? "公开抢单" : "定向派单"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">OPC等级要求</span>
                        <span className="font-semibold">{demand.opcLevel === "any" ? "不限" : `${demand.opcLevel}级及以上`}</span>
                      </div>
                      {demand.bidDeadline && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">抢单截止</span>
                          <span className="font-semibold">{new Date(demand.bidDeadline).toLocaleDateString("zh-CN")}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">已收申请</span>
                        <span className="font-bold text-primary">{(bids as any[]).length} 份</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">待审核</span>
                        <span className={`font-bold ${pendingBids.length > 0 ? "text-amber-600" : "text-slate-400"}`}>
                          {pendingBids.length} 份
                        </span>
                      </div>
                    </div>
                    {(demand.status === "published" || demand.status === "matched") && (
                      <button
                        onClick={() => setShowAdjustPanel(true)}
                        className="mt-4 w-full flex items-center justify-center gap-2 border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors"
                      >
                        <Edit2 size={14} /> 调整需求参数
                      </button>
                    )}
                  </div>

                  {/* Status Info */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">当前状态</h3>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${statusCfg.color}`}>
                      {demand.status === "published" && <Clock size={14} />}
                      {demand.status === "matched" && <CheckCircle2 size={14} />}
                      {demand.status === "in_progress" && <Trophy size={14} />}
                      {statusCfg.label}
                    </div>

                    {demand.status === "matched" && (
                      <div className="mt-4">
                        <Link href={`/publisher/orders`}>
                          <button className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-4 py-3 text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">
                            查看关联订单 <ChevronRight size={16} />
                          </button>
                        </Link>
                      </div>
                    )}
                    {demand.status === "in_progress" && (
                      <div className="mt-4">
                        <Link href={`/publisher/orders`}>
                          <button className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-4 py-3 text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">
                            进入订单管理 <ChevronRight size={16} />
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Publisher Info */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">关于发单方</h3>
                    <div className="flex items-center gap-3">
                      {(demand as any).publisherAvatar ? (
                        <img
                          src={(demand as any).publisherAvatar}
                          alt={(demand as any).publisherName || "发单方"}
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-extrabold text-lg shrink-0">
                          {((demand as any).publisherName ?? "发")?.[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-foreground">{(demand as any).publisherName || "发单方"}</p>
                        {(demand as any).publisherTitle && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <BadgeCheck size={12} className="text-secondary" />
                            <span className="text-xs text-secondary font-medium">{(demand as any).publisherTitle}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">发布日期：{new Date(demand.createdAt).toLocaleDateString("zh-CN")}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <ConfirmDialog
        open={showWithdrawDialog}
        title="确认撤回审核？"
        description="撤回后需求将变回草稿状态，可重新编辑后再次提交审核。"
        confirmLabel="确认撤回"
        cancelLabel="取消"
        onConfirm={doWithdrawDemand}
        onCancel={() => setShowWithdrawDialog(false)}
      />
      <ConfirmDialog
        open={showCloseDialog}
        title="确认关闭需求？"
        description="关闭后该需求将无法恢复，OPC 无法再查看或报名。"
        confirmLabel="确认关闭"
        cancelLabel="取消"
        confirmVariant="destructive"
        onConfirm={doCloseDemand}
        onCancel={() => setShowCloseDialog(false)}
      />

      {/* ── 调整需求参数 Modal ── */}
      {showAdjustPanel && demand && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAdjustPanel(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Edit2 size={15} className="text-primary" />
                </div>
                <h3 className="text-base font-extrabold text-blue-900">调整需求参数</h3>
              </div>
              <button
                onClick={() => setShowAdjustPanel(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-xl p-3">
              可降低 OPC 等级要求以吸引更多人才参与，或延长抢单截止时间（只能往后延长，不能提前）。预算金额只能上调，且仅在 OPC 未接单前可修改。
            </p>

            {/* OPC Level */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">
                OPC 等级要求
                <span className="ml-2 font-normal text-slate-400">
                  当前：{demand.opcLevel === "any" || !demand.opcLevel ? "不限" : `${demand.opcLevel}级及以上`}
                </span>
              </label>
              <select
                value={adjustOpcLevel}
                onChange={e => setAdjustOpcLevel(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">不修改</option>
                <option value="any">不限</option>
                <option value="C">C级及以上</option>
                <option value="B">B级及以上</option>
                <option value="A">A级（专家）</option>
              </select>
            </div>

            {/* Bid Deadline */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">
                抢单截止时间
                {(demand as any).bidDeadline && (
                  <span className="ml-2 font-normal text-slate-400">
                    当前：{new Date((demand as any).bidDeadline).toLocaleDateString("zh-CN")}
                  </span>
                )}
              </label>
              <input
                type="date"
                value={adjustBidDeadline}
                min={
                  (demand as any).bidDeadline
                    ? new Date(new Date((demand as any).bidDeadline).getTime() + 86400000).toISOString().split("T")[0]
                    : new Date().toISOString().split("T")[0]
                }
                onChange={e => setAdjustBidDeadline(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Budget */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600">
                预算金额（元）
                <span className="ml-2 font-normal text-slate-400">
                  当前：¥{demand.budget?.toLocaleString() ?? "面议"}
                </span>
              </label>
              {demand.status === "matched" ? (
                <div className="flex items-center gap-2 h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
                  <span>OPC 已接单，预算不可修改</span>
                </div>
              ) : (
                <>
                  <input
                    type="number"
                    value={adjustBudget}
                    min={(demand.budget ?? 0) + 1}
                    step={100}
                    placeholder={`高于 ¥${demand.budget?.toLocaleString() ?? 0}`}
                    onChange={e => setAdjustBudget(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <p className="text-[11px] text-slate-400">预算只能往上调，不可降低</p>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setShowAdjustPanel(false); setAdjustOpcLevel(""); setAdjustBidDeadline(""); setAdjustBudget(""); }}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAdjustDemand}
                disabled={adjustLoading || (!adjustOpcLevel && !adjustBidDeadline)}
                className="flex-1 h-11 flex items-center justify-center gap-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {adjustLoading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {adjustLoading ? "保存中…" : "确认调整"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
