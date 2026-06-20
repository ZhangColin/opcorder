import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  Loader2, AlertCircle, Zap, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  FileText, FileSignature, CreditCard, Wrench, ExternalLink, Plus, History, Edit2, X,
} from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownContent } from "@/components/MarkdownContent";
import { v2Get, v2Post, uploadFile } from "@/lib/v2api";
import { useToast } from "@/hooks/use-toast";
import { markRead } from "@/lib/demandRead";

/* ── Types ── */
interface Demand {
  id: number;
  demandNo: string;
  title: string;
  demandType: string | null;
  isUrgent: boolean;
  budgetMin: number | null;
  budgetMax: number | null;
  hopeDeliveryDate: string | null;
  status: string;
  warrantyEndDate: string | null;
  closedReason: string | null;
  createdAt: string;
  updatedAt: string;
  latestVersion: {
    id: number;
    versionNo: number;
    detail: string;
    attachments: Array<{ name: string; url: string }>;
    editedByNickname: string;
    editComment: string;
    createdAt: string;
  } | null;
}
interface QuotationCard {
  id: number;
  totalPrice: number;
  breakdown: Array<{ item: string; amount: number; note?: string }>;
  note: string | null;
  createdByNickname: string | null;
  createdAt: string;
}
interface Contract {
  id: number;
  contractNo: string;
  status: string;
  content: string | null;
  signedFileUrl: string | null;
  publisherRejectedReason: string | null;
}
interface PaymentPlan {
  id: number;
  itemNo: number;
  description: string | null;
  amount: number;
  dueDate: string;
  status: string;
  isOverdue: boolean;
}
interface DeliverableA {
  id: number;
  title: string;
  content: string | null;
  attachments: Array<{ name: string; url: string }>;
  status: string;
  confirmedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
}
interface TicketA {
  id: number;
  title: string;
  status: string;
  createdAt: string;
}
interface VersionItem {
  id: number;
  versionNo: number;
  detail: string;
  attachments: Array<{ name: string; url: string }>;
  editedByNickname: string | null;
  editedByRole: "publisher" | "opc" | "admin" | null;
  editComment: string | null;
  createdAt: string;
}

const ROLE_LABEL: Record<string, string> = {
  publisher: "发单方",
  opc: "OPC",
  admin: "运营方",
};

/* ── Status configs ── */
const DEMAND_STATUS: Record<string, { label: string; color: string }> = {
  draft:            { label: "草稿",   color: "bg-slate-100 text-slate-500" },
  negotiating:      { label: "沟通中", color: "bg-blue-100 text-blue-700" },
  quoting:          { label: "报价中", color: "bg-amber-100 text-amber-700" },
  pending_contract: { label: "待签约", color: "bg-orange-100 text-orange-700" },
  executing:        { label: "执行中", color: "bg-green-100 text-green-700" },
  warranty:         { label: "质保中", color: "bg-teal-100 text-teal-700" },
  completed:        { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
  closed:           { label: "已关闭", color: "bg-red-100 text-red-500" },
};

const CONTRACT_STATUS: Record<string, { label: string; color: string }> = {
  draft:                    { label: "草稿",     color: "bg-slate-100 text-slate-500" },
  pending_publisher_confirm:{ label: "待您确认", color: "bg-amber-100 text-amber-700" },
  publisher_rejected:       { label: "已退回",   color: "bg-red-100 text-red-600" },
  pending_sign:             { label: "待签约",   color: "bg-orange-100 text-orange-700" },
  signed:                   { label: "已签约",   color: "bg-green-100 text-green-700" },
};

const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending:        { label: "待付款", color: "bg-orange-100 text-orange-700" },
  awaiting_review:{ label: "审核中", color: "bg-amber-100 text-amber-700" },
  paid:           { label: "已付款", color: "bg-green-100 text-green-700" },
};

const DELIVERABLE_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: "待确认", color: "bg-amber-100 text-amber-700" },
  confirmed: { label: "已确认", color: "bg-green-100 text-green-700" },
  rejected:  { label: "已驳回", color: "bg-red-100 text-red-600" },
};

/* ── Section wrapper ── */
function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <Icon size={16} className="text-primary shrink-0" />
        <span className="font-bold text-slate-800 flex-1">{title}</span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="px-6 pb-6 border-t border-slate-100">{children}</div>}
    </div>
  );
}

/* ── Main component ── */
export default function PubDemandDetail() {
  const params = useParams<{ id: string }>();
  const demandId = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [demand, setDemand] = useState<Demand | null>(null);
  const [quotation, setQuotation] = useState<QuotationCard | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [payments, setPayments] = useState<PaymentPlan[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableA[]>([]);
  const [tickets, setTickets] = useState<TicketA[]>([]);
  const [versions, setVersions] = useState<VersionItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editDetail, setEditDetail] = useState("");
  const [editAttachments, setEditAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [editComment, setEditComment] = useState("");
  const [editUploading, setEditUploading] = useState(false);

  /* Quote actions */
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentText, setCommentText] = useState("");

  /* Ticket creation */
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketAttachments, setTicketAttachments] = useState<Array<{ name: string; url: string; size?: string; type?: string }>>([]);
  const [ticketUploading, setTicketUploading] = useState(false);

  /* Deliverable reject */
  const [rejectDelivId, setRejectDelivId] = useState<number | null>(null);
  const [rejectDelivReason, setRejectDelivReason] = useState("");

  useEffect(() => {
    if (demandId > 0) markRead("client", demandId);
    return () => { if (demandId > 0) markRead("client", demandId); };
  }, [demandId]);

  const load = useCallback(async () => {
    if (demandId <= 0) return;
    try {
      const [d, q, c, p, deliv, t] = await Promise.all([
        v2Get<Demand>(`/client-demands/${demandId}`),
        v2Get<QuotationCard[]>(`/quotation-cards?clientDemandId=${demandId}`).then(r => r[0] ?? null).catch(() => null),
        v2Get<Contract[]>(`/contracts?clientDemandId=${demandId}`).catch(() => [] as Contract[]),
        v2Get<PaymentPlan[]>(`/payment-plans?clientDemandId=${demandId}`).catch(() => [] as PaymentPlan[]),
        v2Get<DeliverableA[]>(`/deliverables-a?clientDemandId=${demandId}`).catch(() => [] as DeliverableA[]),
        v2Get<TicketA[]>(`/tickets-a?clientDemandId=${demandId}`).catch(() => [] as TicketA[]),
      ]);
      setDemand(d);
      setQuotation(q);
      setContracts(c);
      setPayments(p);
      setDeliverables(deliv);
      setTickets(t);
    } catch {
      setDemand(null);
    } finally {
      setLoading(false);
    }
  }, [demandId]);

  useEffect(() => { load(); }, [load]);

  const loadVersions = async () => {
    const data = await v2Get<VersionItem[]>(`/client-demands/${demandId}/versions`);
    setVersions(data);
    setShowVersions(true);
  };

  /* ── Actions ── */
  const handleConfirmQuote = async () => {
    setActing(true);
    try {
      await v2Post(`/client-demands/${demandId}/confirm-quote`);
      toast({ title: "已确认报价，等待合同起草" });
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally { setActing(false); }
  };

  const handleCommentQuote = async () => {
    if (!commentText.trim()) return;
    setActing(true);
    try {
      await v2Post(`/client-demands/${demandId}/comment-quote`, { comment: commentText.trim() });
      toast({ title: "意见已提交" });
      setShowCommentModal(false);
      setCommentText("");
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally { setActing(false); }
  };

  const handleVerify = async () => {
    setActing(true);
    try {
      await v2Post(`/client-demands/${demandId}/verify`);
      toast({ title: "已确认验收，进入质保期" });
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally { setActing(false); }
  };

  const handleClose = async () => {
    setActing(true);
    try {
      await v2Post(`/client-demands/${demandId}/close`, { reason: "发单方主动关闭" });
      toast({ title: "需求已关闭" });
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally { setActing(false); }
  };

  const handleSubmitEdit = async () => {
    if (!editDetail.trim()) { toast({ title: "请填写需求详情", variant: "destructive" }); return; }
    setActing(true);
    try {
      await v2Post(`/client-demands/${demandId}/update-detail`, { detail: editDetail.trim(), attachments: editAttachments, editComment: editComment.trim() || undefined });
      toast({ title: "需求详情已更新" });
      setEditMode(false);
      setEditComment("");
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally { setActing(false); }
  };

  const handleConfirmDelivery = async (delivId: number) => {
    setActing(true);
    try {
      await v2Post(`/deliverables-a/${delivId}/publisher-confirm`);
      toast({ title: "已确认交付" });
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally { setActing(false); }
  };

  const handleRejectDelivery = async () => {
    if (!rejectDelivReason.trim() || !rejectDelivId) return;
    setActing(true);
    try {
      await v2Post(`/deliverables-a/${rejectDelivId}/publisher-reject`, { reason: rejectDelivReason.trim() });
      toast({ title: "已驳回交付，等待运营方重新提交" });
      setRejectDelivId(null);
      setRejectDelivReason("");
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally { setActing(false); }
  };

  const handleTicketFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    setTicketUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadFile(file);
        const size = file.size >= 1048576
          ? `${(file.size / 1048576).toFixed(1)}MB`
          : `${Math.max(1, Math.round(file.size / 1024))}KB`;
        setTicketAttachments(prev => [...prev, { name: file.name, url, size, type: file.type }]);
      }
    } catch (err: any) {
      toast({ title: "附件上传失败", description: err.message, variant: "destructive" });
    } finally {
      setTicketUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleCreateTicket = async () => {
    if (!ticketTitle.trim()) { toast({ title: "请填写工单标题", variant: "destructive" }); return; }
    setActing(true);
    try {
      await v2Post("/tickets-a", {
        clientDemandId: demandId,
        title: ticketTitle.trim(),
        description: ticketDesc.trim() || undefined,
        attachments: ticketAttachments,
      });
      toast({ title: "工单已提交，运营方将跟进处理" });
      setShowCreateTicket(false);
      setTicketTitle("");
      setTicketDesc("");
      setTicketAttachments([]);
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally { setActing(false); }
  };

  const handleEditFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditUploading(true);
    try {
      const url = await uploadFile(file);
      setEditAttachments(prev => [...prev, { name: file.name, url }]);
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setEditUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  /* ── Render ── */
  if (loading) {
    return (
      <PubLayout title="需求详情" backHref="/pub/demands" backLabel="需求列表">
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
        </div>
      </PubLayout>
    );
  }

  if (!demand) {
    return (
      <PubLayout title="需求详情" backHref="/pub/demands" backLabel="需求列表">
        <div className="flex flex-col items-center py-24 text-slate-400">
          <AlertCircle size={36} className="mb-3 text-slate-300" />
          <p>需求不存在或无权查看</p>
        </div>
      </PubLayout>
    );
  }

  const statusCfg = DEMAND_STATUS[demand.status] ?? { label: demand.status, color: "bg-slate-100 text-slate-500" };
  const aContract = contracts[0] ?? null;
  const canEditDetail = demand.status === "negotiating";
  const canConfirmQuote = demand.status === "quoting";
  const canVerify = demand.status === "executing" && deliverables.some(d => d.status === "confirmed");
  const canClose = ["draft", "negotiating", "quoting"].includes(demand.status);
  const isWarranty = demand.status === "warranty";
  const pendingDelivery = deliverables.find(d => d.status === "pending");
  const pendingPayment = payments.find(p => p.status === "pending");
  const pendingContractConfirm = aContract?.status === "pending_publisher_confirm";

  return (
    <PubLayout
      title={demand.title}
      backHref="/pub/demands"
      backLabel="需求列表"
      actions={
        canClose ? (
          <button
            onClick={handleClose}
            disabled={acting}
            className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5 font-bold transition-colors"
          >
            关闭需求
          </button>
        ) : undefined
      }
    >
      <div className="mt-6 space-y-5">
        {/* ── Header ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start gap-3 mb-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${statusCfg.color}`}>{statusCfg.label}</span>
            {demand.isUrgent && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full shrink-0">
                <Zap size={10} /> 紧急
              </span>
            )}
            <span className="text-xs text-slate-400 font-mono">{demand.demandNo}</span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-800 mb-3">{demand.title}</h1>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {(demand.budgetMin || demand.budgetMax) && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">预算区间</p>
                <p className="font-bold text-slate-800">
                  ¥{demand.budgetMin?.toLocaleString()} – ¥{demand.budgetMax?.toLocaleString()}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 mb-0.5">是否紧急</p>
              <p className={`font-bold flex items-center gap-1 ${demand.isUrgent ? "text-red-500" : "text-slate-500"}`}>
                {demand.isUrgent ? <><Zap size={13} /> 紧急需求</> : "普通需求"}
              </p>
            </div>
            {demand.hopeDeliveryDate && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">希望交付</p>
                <p className="font-bold text-slate-800">{new Date(demand.hopeDeliveryDate).toLocaleDateString("zh-CN")}</p>
              </div>
            )}
            {demand.warrantyEndDate && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">质保到期</p>
                <p className="font-bold text-teal-700">{new Date(demand.warrantyEndDate).toLocaleDateString("zh-CN")}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 mb-0.5">创建时间</p>
              <p className="font-bold text-slate-800 flex items-center gap-1">
                <Clock size={11} /> {new Date(demand.createdAt).toLocaleDateString("zh-CN")}
              </p>
            </div>
          </div>
          {demand.closedReason && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-red-500 font-bold">关闭原因：{demand.closedReason}</p>
            </div>
          )}
        </div>

        {/* ── Pending contract confirm banner ── */}
        {pendingContractConfirm && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSignature size={16} className="text-amber-600" />
              <span className="text-sm font-bold text-amber-800">合同待您确认</span>
            </div>
            <button
              onClick={() => navigate(`/pub/contracts/${aContract?.id}`)}
              className="text-xs bg-amber-600 text-white rounded-lg px-3 py-1.5 font-bold hover:bg-amber-700 transition-colors"
            >
              查看合同
            </button>
          </div>
        )}

        {/* ── Pending payment banner ── */}
        {pendingPayment && (
          <div className={`border rounded-2xl p-4 flex items-center justify-between gap-3 ${pendingPayment.isOverdue ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-200"}`}>
            <div className="flex items-center gap-2">
              <CreditCard size={16} className={pendingPayment.isOverdue ? "text-red-600" : "text-orange-600"} />
              <span className={`text-sm font-bold ${pendingPayment.isOverdue ? "text-red-800" : "text-orange-800"}`}>
                {pendingPayment.isOverdue ? "付款已逾期" : "有待付款项"}
                —— 第 {pendingPayment.itemNo} 期 ¥{pendingPayment.amount.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => navigate(`/pub/payments/${pendingPayment.id}`)}
              className={`text-xs rounded-lg px-3 py-1.5 font-bold transition-colors ${pendingPayment.isOverdue ? "bg-red-600 text-white hover:bg-red-700" : "bg-orange-600 text-white hover:bg-orange-700"}`}
            >
              去付款
            </button>
          </div>
        )}

        {/* ── Delivery pending confirmation ── */}
        {pendingDelivery && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-blue-800">交付物待您确认：{pendingDelivery.title}</span>
            </div>
            {pendingDelivery.content && (
              <p className="text-xs text-blue-700 mb-3 line-clamp-2">{pendingDelivery.content}</p>
            )}
            {pendingDelivery.attachments?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {pendingDelivery.attachments.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer"
                    className="text-xs flex items-center gap-1 text-blue-700 underline">
                    <ExternalLink size={11} /> {a.name}
                  </a>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => handleConfirmDelivery(pendingDelivery.id)}
                disabled={acting}
                className="flex items-center gap-1.5 bg-green-600 text-white rounded-lg px-4 py-1.5 text-xs font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {acting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                确认交付
              </button>
              <button
                onClick={() => setRejectDelivId(pendingDelivery.id)}
                disabled={acting}
                className="flex items-center gap-1.5 bg-white border border-red-200 text-red-600 rounded-lg px-4 py-1.5 text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <XCircle size={12} /> 驳回
              </button>
            </div>
          </div>
        )}

        {/* ── Verify acceptance (executing state) ── */}
        {canVerify && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-green-800">所有交付物已确认，可进行最终验收</p>
              <p className="text-xs text-green-600 mt-0.5">验收后项目进入质保期，质保期内可发起工单</p>
            </div>
            <button
              onClick={handleVerify}
              disabled={acting}
              className="shrink-0 flex items-center gap-1.5 bg-green-600 text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              验收确认
            </button>
          </div>
        )}

        {/* ── Demand detail section ── */}
        <Section title="需求详情" icon={FileText}>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {demand.latestVersion && (
                  <span className="text-xs text-slate-400">版本 v{demand.latestVersion.versionNo}</span>
                )}
                {canEditDetail && !editMode && (
                  <button
                    onClick={() => {
                      setEditDetail(demand.latestVersion?.detail ?? "");
                      setEditAttachments(demand.latestVersion?.attachments ?? []);
                      setEditMode(true);
                    }}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Edit2 size={11} /> 编辑
                  </button>
                )}
              </div>
              {demand.latestVersion && (
                <button
                  onClick={loadVersions}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition-colors"
                >
                  <History size={11} /> 历史版本
                </button>
              )}
            </div>

            {editMode ? (
              <div className="space-y-3">
                <MarkdownEditor value={editDetail} onChange={setEditDetail} placeholder="更新您的需求详情…" />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                    {editUploading ? <Loader2 size={12} className="animate-spin" /> : "+ 添加附件"}
                    <input type="file" className="hidden" onChange={handleEditFileUpload} disabled={editUploading} />
                  </label>
                  {editAttachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 rounded px-2 py-1">
                      {a.name}
                      <button onClick={() => setEditAttachments(prev => prev.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
                <input
                  value={editComment}
                  onChange={e => setEditComment(e.target.value)}
                  placeholder="修改说明（可选）"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex gap-2">
                  <button onClick={handleSubmitEdit} disabled={acting} className="bg-primary text-white rounded-lg px-4 py-1.5 text-xs font-bold disabled:opacity-50">
                    {acting ? "提交中…" : "提交更新"}
                  </button>
                  <button onClick={() => { setEditMode(false); setEditComment(""); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">取消</button>
                </div>
              </div>
            ) : demand.latestVersion ? (
              <div>
                <MarkdownContent content={demand.latestVersion.detail} />
                {demand.latestVersion.attachments?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {demand.latestVersion.attachments.map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                        <ExternalLink size={11} /> {a.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400">
                <FileText size={24} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm">尚未提交需求详情</p>
                {demand.status === "draft" && (
                  <button
                    onClick={() => navigate(`/pub/demands/${demandId}/edit`)}
                    className="mt-3 text-xs text-primary hover:underline"
                  >
                    去填写
                  </button>
                )}
              </div>
            )}
          </div>

        </Section>

        {/* ── Discussion ── */}
        <Section title="需求沟通区" icon={FileText}>
          <div className="mt-4">
            <DiscussionThread
              parentType="client_demand"
              parentId={demandId}
              placeholder="向运营方提问或补充信息…"
              readOnly={["completed", "closed"].includes(demand.status)}
            />
          </div>
        </Section>

        {/* ── Quotation card ── */}
        {(demand.status === "quoting" || quotation) && (
          <Section title="报价单" icon={CreditCard}>
            <div className="mt-4">
              {quotation ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-2xl font-black text-green-600">¥{quotation.totalPrice.toLocaleString()}</p>
                    <span className="text-xs text-slate-400">由 {quotation.createdByNickname ?? "运营方"} 出具</span>
                  </div>
                  {quotation.breakdown?.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {quotation.breakdown.map((b, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-slate-600">{b.item}{b.note && <span className="text-slate-400 text-xs"> · {b.note}</span>}</span>
                          <span className="font-bold text-slate-800">¥{b.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {quotation.note && (
                    <p className="text-xs text-slate-500 mb-4 p-3 bg-slate-50 rounded-xl">{quotation.note}</p>
                  )}
                  {canConfirmQuote && (
                    <div className="flex gap-3">
                      <button
                        onClick={handleConfirmQuote}
                        disabled={acting}
                        className="flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        确认报价
                      </button>
                      <button
                        onClick={() => setShowCommentModal(true)}
                        disabled={acting}
                        className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:border-primary hover:text-primary transition-colors"
                      >
                        提出意见
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm">运营方正在核算报价，请耐心等待</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Contract ── */}
        {(demand.status !== "draft" && demand.status !== "negotiating") && aContract && (
          <Section title="合同" icon={FileSignature}>
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const cfg = CONTRACT_STATUS[aContract.status] ?? { label: aContract.status, color: "bg-slate-100 text-slate-500" };
                      return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>;
                    })()}
                    <span className="text-xs text-slate-400 font-mono">{aContract.contractNo}</span>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/pub/contracts/${aContract.id}`)}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  查看合同 <ExternalLink size={11} />
                </button>
              </div>
              {aContract.signedFileUrl && (
                <a href={aContract.signedFileUrl} target="_blank" rel="noreferrer"
                  className="mt-3 flex items-center gap-2 text-sm text-primary hover:underline">
                  <ExternalLink size={14} /> 下载已签约文件
                </a>
              )}
            </div>
          </Section>
        )}

        {/* ── Payment plans ── */}
        {payments.length > 0 && (
          <Section title="付款计划" icon={CreditCard}>
            <div className="mt-4 space-y-3">
              {payments.map(p => {
                const cfg = PAYMENT_STATUS[p.status] ?? { label: p.status, color: "bg-slate-100 text-slate-500" };
                return (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/pub/payments/${p.id}`)}
                    className={`border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:shadow-sm transition-all ${
                      p.isOverdue && p.status === "pending" ? "border-red-300 bg-red-50/30" : "border-slate-200 hover:border-primary/30"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                        {p.isOverdue && p.status === "pending" && <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">逾期</span>}
                        <span className="text-xs text-slate-400">第 {p.itemNo} 期</span>
                      </div>
                      {p.description && <p className="text-xs text-slate-500">{p.description}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-800">¥{p.amount.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">{new Date(p.dueDate).toLocaleDateString("zh-CN")}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── Deliverables ── */}
        {deliverables.length > 0 && (
          <Section title="交付记录" icon={FileText}>
            <div className="mt-4 space-y-3">
              {deliverables.map(d => {
                const cfg = DELIVERABLE_STATUS[d.status] ?? { label: d.status, color: "bg-slate-100 text-slate-500" };
                return (
                  <div key={d.id} className="border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-sm font-bold text-slate-800">{d.title}</span>
                      </div>
                      <span className="text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString("zh-CN")}</span>
                    </div>
                    {d.content && <p className="text-xs text-slate-600 mb-2">{d.content}</p>}
                    {d.attachments?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {d.attachments.map((a, i) => (
                          <a key={i} href={a.url} target="_blank" rel="noreferrer"
                            className="text-xs flex items-center gap-1 text-primary underline">
                            <ExternalLink size={10} /> {a.name}
                          </a>
                        ))}
                      </div>
                    )}
                    {d.rejectedReason && (
                      <p className="text-xs text-red-500">驳回原因：{d.rejectedReason}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* ── Tickets ── */}
        {(isWarranty || tickets.length > 0) && (
          <Section title="质保工单" icon={Wrench}>
            <div className="mt-4 space-y-3">
              {isWarranty && (
                <button
                  onClick={() => setShowCreateTicket(true)}
                  className="w-full flex items-center gap-2 justify-center border-2 border-dashed border-primary/30 text-primary rounded-xl py-3 text-sm font-bold hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus size={16} /> 发起新工单
                </button>
              )}
              {tickets.map(t => (
                <div
                  key={t.id}
                  onClick={() => navigate(`/pub/tickets/${t.id}`)}
                  className="border border-slate-200 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.status === "open" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"} mr-2`}>
                      {t.status === "open" ? "处理中" : "已关闭"}
                    </span>
                    <span className="text-sm font-bold text-slate-800">{t.title}</span>
                  </div>
                  <span className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
              ))}
              {!isWarranty && tickets.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">暂无工单</p>
              )}
            </div>
          </Section>
        )}
      </div>

      {/* ── Comment quote modal ── */}
      {showCommentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-extrabold text-slate-800 mb-2">提出报价意见</h3>
            <p className="text-sm text-slate-500 mb-4">您的意见将发送给运营方，请具体说明您的想法</p>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="例如：报价中维护费用偏高，希望调整为…"
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowCommentModal(false); setCommentText(""); }} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600">取消</button>
              <button onClick={handleCommentQuote} disabled={acting || !commentText.trim()} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
                {acting && <Loader2 size={14} className="animate-spin" />} 提交意见
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject delivery modal ── */}
      {rejectDelivId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-extrabold text-slate-800 mb-2">驳回交付物</h3>
            <p className="text-sm text-slate-500 mb-4">请说明不通过原因，运营方将据此重新提交</p>
            <textarea
              value={rejectDelivReason}
              onChange={e => setRejectDelivReason(e.target.value)}
              placeholder="例如：代码中缺少单元测试，需要补充…"
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setRejectDelivId(null); setRejectDelivReason(""); }} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600">取消</button>
              <button onClick={handleRejectDelivery} disabled={acting || !rejectDelivReason.trim()} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50">
                {acting && <Loader2 size={14} className="animate-spin" />} 确认驳回
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create ticket modal ── */}
      {showCreateTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-extrabold text-slate-800 mb-2">发起质保工单</h3>
            <p className="text-sm text-slate-500 mb-4">在质保期内发现问题？请发起工单，运营方将及时跟进</p>
            <div className="space-y-3 mb-4">
              <input
                value={ticketTitle}
                onChange={e => setTicketTitle(e.target.value)}
                placeholder="工单标题，如：首页加载速度异常"
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <textarea
                value={ticketDesc}
                onChange={e => setTicketDesc(e.target.value)}
                placeholder="问题描述（可选）：详细描述问题现象…"
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
              />
              {/* Attachment upload */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 hover:text-primary w-fit">
                  <input type="file" multiple className="hidden" onChange={handleTicketFileUpload} disabled={ticketUploading} />
                  <Plus size={12} /> {ticketUploading ? "上传中…" : "添加附件"}
                </label>
                {ticketAttachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {ticketAttachments.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5">
                        <span className="text-xs text-slate-700 flex-1 truncate">{a.name}</span>
                        {a.size && <span className="text-xs text-slate-400">{a.size}</span>}
                        <button onClick={() => setTicketAttachments(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowCreateTicket(false); setTicketTitle(""); setTicketDesc(""); setTicketAttachments([]); }} className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600">取消</button>
              <button onClick={handleCreateTicket} disabled={acting || ticketUploading || !ticketTitle.trim()} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50">
                {acting && <Loader2 size={14} className="animate-spin" />} 提交工单
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Version Diff Modal ── */}
      {showVersions && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col" style={{ maxHeight: "90vh" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <History size={15} className="text-primary" />
                <span className="text-sm font-extrabold text-slate-800">历史版本对比</span>
                {demand.latestVersion && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">当前 v{demand.latestVersion.versionNo}</span>}
              </div>
              <button onClick={() => setShowVersions(false)} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
            </div>
            {versions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">
                <Loader2 size={16} className="animate-spin mr-2" /> 加载中…
              </div>
            ) : versions.length <= 1 ? (
              <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">暂无更早的历史版本</div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 overflow-x-auto shrink-0">
                  <span className="text-xs text-slate-400 shrink-0 mr-1">选择历史版本：</span>
                  {versions.slice(1).map((v, i) => (
                    <button key={v.id} onClick={() => setSelectedVersionIdx(i)}
                      className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors border ${selectedVersionIdx === i ? "bg-primary text-white border-primary" : "bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary"}`}>
                      v{v.versionNo}{v.editedByRole ? ` · ${ROLE_LABEL[v.editedByRole] ?? v.editedByRole}` : ""}
                    </button>
                  ))}
                </div>
                {(() => {
                  const hist = versions.slice(1)[selectedVersionIdx] ?? versions[1];
                  const curr = versions[0];
                  const renderPanel = (v: VersionItem, isCurrent: boolean) => (
                    <div className={`overflow-y-auto min-h-0 p-5 ${isCurrent ? "bg-blue-50/30" : ""}`}>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCurrent ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                          v{v.versionNo} {isCurrent ? "当前" : "历史"}
                        </span>
                        <span className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleDateString("zh-CN")}</span>
                        {v.editedByRole && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                            {ROLE_LABEL[v.editedByRole] ?? v.editedByRole}
                          </span>
                        )}
                        {v.editedByNickname && <span className="text-xs text-slate-500">{v.editedByNickname}</span>}
                        {v.editComment && <span className="text-xs text-slate-400 italic">「{v.editComment}」</span>}
                      </div>
                      <div className="text-sm text-slate-700 leading-relaxed">
                        <MarkdownContent content={v.detail} />
                      </div>
                      {v.attachments?.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {v.attachments.map((a, i) => (
                            <a key={i} href={a.url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                              <ExternalLink size={11} /> {a.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                  return (
                    <div className="flex-1 grid grid-cols-2 min-h-0 divide-x divide-slate-100" style={{ overflow: "hidden" }}>
                      {renderPanel(hist, false)}
                      {renderPanel(curr, true)}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}
    </PubLayout>
  );
}
