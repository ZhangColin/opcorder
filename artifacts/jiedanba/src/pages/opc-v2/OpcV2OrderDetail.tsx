import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  Loader2, AlertCircle, FileSignature, CheckCircle2, Paperclip,
  Upload, Send, Package, Clock, Shield, XCircle, Plus, Wrench,
  RefreshCw, Lock, ChevronRight,
} from "lucide-react";
import { v2Get, v2Post, uploadFile } from "@/lib/v2api";
import { markRead } from "@/lib/demandRead";
import { useToast } from "@/hooks/use-toast";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { OpcV2Layout } from "./OpcV2Layout";

interface OrderDetail {
  id: number;
  orderNo: string;
  outsourceDemandId: number;
  demandTitle: string | null;
  tenderId: number;
  contractId: number | null;
  opcId: number;
  opcNickname: string | null;
  signedFileUrl: string | null;
  status: string;
  warrantyEndDate: string | null;
  cancelledReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeliverableItem {
  id: number;
  outsourceOrderId: number;
  title: string;
  content: string | null;
  attachments: Array<{ name: string; url: string }>;
  status: string;
  createdAt: string;
}

interface SettlementItem {
  id: number;
  title: string;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  paymentVoucherUrl: string | null;
  status: string;
  isLastItem: boolean;
  isBlockingPayment: boolean;
  isOverdue: boolean;
}

interface TicketItem {
  id: number;
  outsourceOrderId: number;
  title: string;
  description: string | null;
  status: string;
  isBlockingPayment: boolean;
  createdByNickname: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_contract: { label: "待签约",  color: "bg-amber-100 text-amber-700",   icon: <FileSignature size={14} /> },
  executing:        { label: "执行中",  color: "bg-blue-100 text-blue-700",     icon: <Package size={14} /> },
  warranty:         { label: "质保期",  color: "bg-violet-100 text-violet-700", icon: <Shield size={14} /> },
  completed:        { label: "已完成",  color: "bg-green-100 text-green-700",   icon: <CheckCircle2 size={14} /> },
  cancelled:        { label: "已取消",  color: "bg-slate-100 text-slate-500",   icon: <XCircle size={14} /> },
};

const DELIVERABLE_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: "待审核", color: "bg-amber-100 text-amber-700" },
  approved: { label: "已通过", color: "bg-green-100 text-green-700" },
  revision: { label: "已退回", color: "bg-red-100 text-red-600" },
};

const SETTLEMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "待付款", color: "bg-amber-100 text-amber-700" },
  paid:    { label: "已付款", color: "bg-green-100 text-green-700" },
};

const TICKET_STATUS: Record<string, { label: string; color: string }> = {
  open:   { label: "处理中", color: "bg-amber-100 text-amber-700" },
  closed: { label: "已关闭", color: "bg-green-100 text-green-700" },
};

export default function OpcV2OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = parseInt(id ?? "0");
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resubmitFileRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  const [confirmingContract, setConfirmingContract] = useState(false);
  const [opcSignedFileUrl, setOpcSignedFileUrl] = useState<string | null>(null);
  const [uploadingOpcSigned, setUploadingOpcSigned] = useState(false);
  const opcSignedFileRef = useRef<HTMLInputElement>(null);
  const [showDeliverableForm, setShowDeliverableForm] = useState(false);
  const [delivTitle, setDelivTitle] = useState("");
  const [delivContent, setDelivContent] = useState("");
  const [delivAttachments, setDelivAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [submittingDeliv, setSubmittingDeliv] = useState(false);

  const [resubmitTargetId, setResubmitTargetId] = useState<number | null>(null);
  const [resubmitTitle, setResubmitTitle] = useState("");
  const [resubmitContent, setResubmitContent] = useState("");
  const [resubmitAttachments, setResubmitAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [resubmitUploading, setResubmitUploading] = useState(false);
  const [submittingResubmit, setSubmittingResubmit] = useState(false);

  const { data: order, isLoading, isError, refetch, dataUpdatedAt } = useQuery<OrderDetail>({
    queryKey: ["v2-opc-order", orderId],
    queryFn: () => v2Get(`/outsource-orders/${orderId}`),
    enabled: !!orderId,
  });

  useEffect(() => { if (orderId > 0 && order) markRead("order", orderId); }, [orderId, dataUpdatedAt]);

  const { data: deliverables = [], refetch: refetchDelivs } = useQuery<DeliverableItem[]>({
    queryKey: ["v2-opc-deliverables", orderId],
    queryFn: () => v2Get(`/deliverables-b?outsourceOrderId=${orderId}`),
    enabled: !!orderId,
  });

  const { data: settlements = [] } = useQuery<SettlementItem[]>({
    queryKey: ["v2-opc-settlements-order", orderId],
    queryFn: () => v2Get(`/settlement-plans?outsourceOrderId=${orderId}`),
    enabled: !!orderId,
  });

  const { data: tickets = [] } = useQuery<TicketItem[]>({
    queryKey: ["v2-opc-order-tickets", orderId],
    queryFn: () => v2Get(`/tickets-b?outsourceOrderId=${orderId}`),
    enabled: !!orderId,
  });

  async function handleOpcSignedUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingOpcSigned(true);
    try {
      const url = await uploadFile(file);
      setOpcSignedFileUrl(url);
      toast({ title: "文件已上传", description: "请点击「确认合同」完成签署" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "上传失败";
      toast({ title: "上传失败", description: msg, variant: "destructive" });
    } finally {
      setUploadingOpcSigned(false);
      if (opcSignedFileRef.current) opcSignedFileRef.current.value = "";
    }
  }

  async function handleConfirmContract() {
    setConfirmingContract(true);
    try {
      await v2Post(`/outsource-orders/${orderId}/opc-confirm-contract`, {
        ...(opcSignedFileUrl ? { opcSignedFileUrl } : {}),
      });
      toast({ title: "合同已确认", description: "订单已进入执行阶段" });
      qc.invalidateQueries({ queryKey: ["v2-opc-order", orderId] });
      qc.invalidateQueries({ queryKey: ["v2-opc-orders"] });
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "请稍后重试";
      toast({ title: "确认失败", description: msg, variant: "destructive" });
    } finally {
      setConfirmingContract(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setDelivAttachments(prev => [...prev, { name: file.name, url }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "上传失败";
      toast({ title: "上传失败", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleResubmitFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResubmitUploading(true);
    try {
      const url = await uploadFile(file);
      setResubmitAttachments(prev => [...prev, { name: file.name, url }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "上传失败";
      toast({ title: "上传失败", description: msg, variant: "destructive" });
    } finally {
      setResubmitUploading(false);
      if (resubmitFileRef.current) resubmitFileRef.current.value = "";
    }
  }

  async function handleSubmitDeliverable(e: React.FormEvent) {
    e.preventDefault();
    if (!delivTitle.trim()) {
      toast({ title: "请填写交付标题", variant: "destructive" });
      return;
    }
    setSubmittingDeliv(true);
    try {
      await v2Post("/deliverables-b", {
        outsourceOrderId: orderId,
        title: delivTitle.trim(),
        content: delivContent.trim() || undefined,
        attachments: delivAttachments,
      });
      toast({ title: "交付物已提交", description: "平台将审核您的交付内容" });
      setShowDeliverableForm(false);
      setDelivTitle("");
      setDelivContent("");
      setDelivAttachments([]);
      refetchDelivs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "请稍后重试";
      toast({ title: "提交失败", description: msg, variant: "destructive" });
    } finally {
      setSubmittingDeliv(false);
    }
  }

  async function handleResubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resubmitTargetId) return;
    setSubmittingResubmit(true);
    try {
      await v2Post(`/deliverables-b/${resubmitTargetId}/resubmit`, {
        title: resubmitTitle.trim(),
        content: resubmitContent.trim() || undefined,
        attachments: resubmitAttachments,
      });
      toast({ title: "已重新提交", description: "平台将重新审核" });
      setResubmitTargetId(null);
      setResubmitTitle("");
      setResubmitContent("");
      setResubmitAttachments([]);
      refetchDelivs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "请稍后重试";
      toast({ title: "重交失败", description: msg, variant: "destructive" });
    } finally {
      setSubmittingResubmit(false);
    }
  }

  if (isLoading) {
    return (
      <OpcV2Layout title="订单详情" backHref="/opc/orders" backLabel="我的订单">
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" /> 加载中…
        </div>
      </OpcV2Layout>
    );
  }

  if (isError || !order) {
    return (
      <OpcV2Layout title="订单详情" backHref="/opc/orders" backLabel="我的订单">
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 mt-6">
          <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
          <p className="text-sm text-red-500 font-medium">加载失败，请返回重试</p>
        </div>
      </OpcV2Layout>
    );
  }

  const cfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-slate-100 text-slate-500", icon: null };
  const canConfirmContract = order.status === "pending_contract" && !!order.signedFileUrl;
  const canSubmitDeliverable = order.status === "executing" || order.status === "warranty";
  const openTickets = tickets.filter(t => t.status === "open");
  const blockingTickets = openTickets.filter(t => t.isBlockingPayment);

  return (
    <OpcV2Layout
      title={order.demandTitle ?? order.orderNo}
      backHref="/opc/orders"
      backLabel="我的订单"
    >
      <div className="py-6 space-y-6">

        {/* Order info */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-xl font-black text-slate-800 mb-2">
              {order.demandTitle ?? `订单 #${order.id}`}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${cfg.color}`}>
                {cfg.icon} {cfg.label}
              </span>
              <span className="text-xs font-mono text-slate-400">{order.orderNo}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">创建时间</p>
              <p className="text-sm font-bold text-slate-700">{new Date(order.createdAt).toLocaleDateString("zh-CN")}</p>
            </div>
            {order.warrantyEndDate && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">质保截止</p>
                <p className="text-sm font-bold text-slate-700">{new Date(order.warrantyEndDate).toLocaleDateString("zh-CN")}</p>
              </div>
            )}
          </div>

          {order.cancelledReason && (
            <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-600">取消原因</p>
              <p className="text-sm text-slate-500 mt-0.5">{order.cancelledReason}</p>
            </div>
          )}

          {/* Signed-after notice */}
          {(order.status === "executing" || order.status === "warranty" || order.status === "completed") && (
            <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500">
                ⚠️ 合同签署后不可单方面终止订单，如有异议请通过工单与平台沟通。
              </p>
            </div>
          )}
        </div>

        {/* Contract section */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <FileSignature size={16} className="text-emerald-600" />
            <h3 className="font-bold text-slate-800">合同</h3>
          </div>
          <div className="px-5 py-4">
            {order.status === "pending_contract" ? (
              order.signedFileUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
                    <FileSignature size={18} className="text-amber-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-800">平台已上传合同，请查阅后上传已签版本并确认</p>
                      <a
                        href={order.signedFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-amber-700 underline hover:text-amber-900"
                      >
                        查看平台合同文件
                      </a>
                    </div>
                  </div>

                  <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-xs font-bold text-slate-700">第 1 步：上传您的已签署合同 PDF</p>
                    {opcSignedFileUrl ? (
                      <div className="flex items-center gap-2">
                        <Paperclip size={13} className="text-green-600" />
                        <a href={opcSignedFileUrl} target="_blank" rel="noreferrer" className="text-xs text-green-700 font-bold hover:underline">
                          已签PDF已上传 ✓
                        </a>
                        <button onClick={() => setOpcSignedFileUrl(null)} className="text-xs text-slate-400 hover:text-red-500 ml-1">重新上传</button>
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={() => opcSignedFileRef.current?.click()}
                          disabled={uploadingOpcSigned}
                          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-600 text-xs font-bold rounded-lg hover:border-emerald-500 hover:text-emerald-700 transition-colors"
                        >
                          {uploadingOpcSigned ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                          选择已签 PDF 文件
                        </button>
                        <input ref={opcSignedFileRef} type="file" accept=".pdf" className="hidden" onChange={handleOpcSignedUpload} />
                        <p className="text-[10px] text-slate-400 mt-1">请上传您在纸质/电子合同上签名后的 PDF 扫描件</p>
                      </div>
                    )}

                    <p className="text-xs font-bold text-slate-700 pt-1">第 2 步：确认签约</p>
                    <button
                      onClick={handleConfirmContract}
                      disabled={confirmingContract || !opcSignedFileUrl}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-sm font-bold rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60"
                    >
                      {confirmingContract ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      确认合同（开始执行）
                    </button>
                    {!opcSignedFileUrl && (
                      <p className="text-[11px] text-slate-400">请先上传您的已签 PDF 后再确认</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Clock size={18} className="text-slate-400 shrink-0" />
                  <p className="text-sm text-slate-500">等待平台上传合同文件…</p>
                </div>
              )
            ) : order.signedFileUrl ? (
              <a
                href={order.signedFileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 hover:underline"
              >
                <Paperclip size={14} /> 查看合同文件
              </a>
            ) : (
              <p className="text-sm text-slate-400">合同文件暂未上传</p>
            )}
          </div>
        </div>

        {/* Settlement section */}
        {settlements.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <Shield size={16} className="text-emerald-600" />
              <h3 className="font-bold text-slate-800">收款计划</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {settlements.map(s => {
                const sc = SETTLEMENT_STATUS[s.status] ?? SETTLEMENT_STATUS.pending;
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/opc/income/${s.id}`)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors group text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-700">{s.title}</p>
                        {s.isLastItem && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">尾款</span>}
                        {s.isBlockingPayment && s.status !== "paid" && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded flex items-center gap-0.5">
                            <Lock size={9} /> 阻款
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${s.isOverdue && s.status !== "paid" ? "text-red-500 font-bold" : "text-slate-400"}`}>
                        到期 {new Date(s.dueDate).toLocaleDateString("zh-CN")}
                        {s.isOverdue && s.status !== "paid" && " · 已逾期"}
                      </p>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-3">
                      <div>
                        <p className={`text-base font-black ${s.status === "paid" ? "text-green-700" : "text-slate-800"}`}>
                          ¥{s.amount.toLocaleString()}
                        </p>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${sc.color}`}>
                          {sc.label}
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-600 transition-colors" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Deliverables section */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Upload size={16} className="text-emerald-600" />
              <h3 className="font-bold text-slate-800">交付物</h3>
              <span className="text-xs text-slate-400">({deliverables.length})</span>
            </div>
            {canSubmitDeliverable && !showDeliverableForm && !resubmitTargetId && (
              <button
                onClick={() => setShowDeliverableForm(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-lg hover:bg-emerald-800 transition-colors"
              >
                <Plus size={13} /> 提交交付物
              </button>
            )}
          </div>

          {showDeliverableForm && (
            <form onSubmit={handleSubmitDeliverable} className="p-5 space-y-4 border-b border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  交付标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={delivTitle}
                  onChange={e => setDelivTitle(e.target.value)}
                  placeholder="例: 第一阶段功能交付"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">交付说明</label>
                <textarea
                  value={delivContent}
                  onChange={e => setDelivContent(e.target.value)}
                  placeholder="描述交付内容…"
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 resize-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-600">附件</label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-bold"
                  >
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                    上传文件
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                </div>
                {delivAttachments.length > 0 && (
                  <div className="space-y-1">
                    {delivAttachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-1.5">
                        <Paperclip size={11} className="text-slate-400" />
                        <span className="flex-1 truncate text-slate-600">{att.name}</span>
                        <button type="button" onClick={() => setDelivAttachments(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={submittingDeliv} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 text-white text-sm font-bold rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60">
                  {submittingDeliv ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  提交交付物
                </button>
                <button type="button" onClick={() => setShowDeliverableForm(false)} className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors">取消</button>
              </div>
            </form>
          )}

          {/* Resubmit form */}
          {resubmitTargetId && (
            <form onSubmit={handleResubmit} className="p-5 space-y-4 border-b border-slate-100 bg-red-50">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw size={14} className="text-red-600" />
                <p className="text-sm font-bold text-red-700">重新提交被退回的交付物</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">新标题 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={resubmitTitle}
                  onChange={e => setResubmitTitle(e.target.value)}
                  placeholder="修改后的交付标题"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">更新说明</label>
                <textarea
                  value={resubmitContent}
                  onChange={e => setResubmitContent(e.target.value)}
                  placeholder="说明本次修改了什么…"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 resize-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-600">附件</label>
                  <button type="button" onClick={() => resubmitFileRef.current?.click()} disabled={resubmitUploading}
                    className="flex items-center gap-1 text-xs text-red-700 hover:text-red-900 font-bold">
                    {resubmitUploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                    上传文件
                  </button>
                  <input ref={resubmitFileRef} type="file" className="hidden" onChange={handleResubmitFileUpload} />
                </div>
                {resubmitAttachments.length > 0 && (
                  <div className="space-y-1">
                    {resubmitAttachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-1.5">
                        <Paperclip size={11} className="text-slate-400" />
                        <span className="flex-1 truncate text-slate-600">{att.name}</span>
                        <button type="button" onClick={() => setResubmitAttachments(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={submittingResubmit} className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-60">
                  {submittingResubmit ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  重新提交
                </button>
                <button type="button" onClick={() => setResubmitTargetId(null)} className="px-5 py-2.5 bg-white text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-100 transition-colors border border-slate-200">取消</button>
              </div>
            </form>
          )}

          {deliverables.length === 0 && !showDeliverableForm && !resubmitTargetId ? (
            <div className="py-10 text-center">
              <Upload size={28} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-400">
                {canSubmitDeliverable ? "点击上方按钮提交交付物" : "暂无交付记录"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {deliverables.map(d => {
                const ds = DELIVERABLE_STATUS[d.status] ?? DELIVERABLE_STATUS.pending;
                const canResubmit = d.status === "revision" && canSubmitDeliverable;
                return (
                  <div key={d.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-800">{d.title}</p>
                        {d.content && <p className="text-xs text-slate-500 mt-1">{d.content}</p>}
                        {d.attachments?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {d.attachments.map((att, i) => (
                              <a key={i} href={att.url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-emerald-700 hover:underline">
                                <Paperclip size={11} /> {att.name}
                              </a>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-slate-400 mt-1.5">{new Date(d.createdAt).toLocaleDateString("zh-CN")} 提交</p>
                        {canResubmit && !resubmitTargetId && (
                          <button
                            onClick={() => {
                              setResubmitTargetId(d.id);
                              setResubmitTitle(d.title);
                              setResubmitContent(d.content ?? "");
                              setResubmitAttachments(d.attachments ?? []);
                            }}
                            className="mt-2 flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-800 transition-colors"
                          >
                            <RefreshCw size={12} /> 重新提交
                          </button>
                        )}
                      </div>
                      <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full ${ds.color}`}>
                        {ds.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Ticket section */}
        {(tickets.length > 0 || order.status === "warranty" || order.status === "completed") && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <Wrench size={16} className="text-emerald-600" />
              <h3 className="font-bold text-slate-800">工单</h3>
              <span className="text-xs text-slate-400">({tickets.length})</span>
              {blockingTickets.length > 0 && (
                <span className="ml-auto text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  {blockingTickets.length} 个阻款工单
                </span>
              )}
            </div>

            {blockingTickets.length > 0 && (
              <div className="mx-5 mt-4 flex items-start gap-3 px-4 py-3 bg-red-50 rounded-xl border border-red-200">
                <Lock size={16} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">
                  <span className="font-bold">有未关闭工单正在阻止尾款释放。</span>
                  请积极配合处理工单，工单关闭后尾款将正常打款。
                </p>
              </div>
            )}

            {tickets.length === 0 ? (
              <div className="py-10 text-center">
                <Wrench size={28} className="mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-400">暂无工单</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {tickets.map(t => {
                  const tc = TICKET_STATUS[t.status] ?? TICKET_STATUS.open;
                  return (
                    <button
                      key={t.id}
                      onClick={() => navigate(`/opc/tickets/${t.id}`)}
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tc.color}`}>{tc.label}</span>
                          {t.isBlockingPayment && t.status === "open" && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded flex items-center gap-0.5">
                              <Lock size={9} /> 阻款
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-sm text-slate-800 group-hover:text-emerald-800 transition-colors">{t.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{new Date(t.createdAt).toLocaleDateString("zh-CN")} · {t.createdByNickname ?? "平台"}</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-300 group-hover:text-emerald-600 transition-colors shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Discussion */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">沟通记录</h3>
            <p className="text-xs text-slate-400 mt-0.5">与平台就此订单的讨论</p>
          </div>
          <div className="p-5">
            <DiscussionThread parentType="outsource_demand" parentId={orderId} />
          </div>
        </div>
      </div>
    </OpcV2Layout>
  );
}
