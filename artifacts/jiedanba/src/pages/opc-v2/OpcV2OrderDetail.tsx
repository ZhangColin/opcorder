import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  Loader2, AlertCircle, FileSignature, CheckCircle2, Paperclip,
  Upload, Send, Package, Clock, Shield, XCircle, Plus,
} from "lucide-react";
import { v2Get, v2Post, uploadFile } from "@/lib/v2api";
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
  status: string;
  isLastItem: boolean;
  isBlockingPayment: boolean;
  isOverdue: boolean;
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
  rejected: { label: "已退回", color: "bg-red-100 text-red-600" },
};

const SETTLEMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "待付款", color: "bg-amber-100 text-amber-700" },
  paid:    { label: "已付款", color: "bg-green-100 text-green-700" },
};

export default function OpcV2OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = parseInt(id ?? "0");
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmingContract, setConfirmingContract] = useState(false);
  const [showDeliverableForm, setShowDeliverableForm] = useState(false);
  const [delivTitle, setDelivTitle] = useState("");
  const [delivContent, setDelivContent] = useState("");
  const [delivAttachments, setDelivAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [submittingDeliv, setSubmittingDeliv] = useState(false);

  const { data: order, isLoading, isError, refetch } = useQuery<OrderDetail>({
    queryKey: ["v2-opc-order", orderId],
    queryFn: () => v2Get(`/outsource-orders/${orderId}`),
    enabled: !!orderId,
  });

  const { data: deliverables = [] } = useQuery<DeliverableItem[]>({
    queryKey: ["v2-opc-deliverables", orderId],
    queryFn: () => v2Get(`/deliverables-b?outsourceOrderId=${orderId}`),
    enabled: !!orderId,
  });

  const { data: settlements = [] } = useQuery<SettlementItem[]>({
    queryKey: ["v2-opc-settlements-order", orderId],
    queryFn: () => v2Get(`/settlement-plans?outsourceOrderId=${orderId}`),
    enabled: !!orderId,
  });

  async function handleConfirmContract() {
    setConfirmingContract(true);
    try {
      await v2Post(`/outsource-orders/${orderId}/opc-confirm-contract`);
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
      qc.invalidateQueries({ queryKey: ["v2-opc-deliverables", orderId] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "请稍后重试";
      toast({ title: "提交失败", description: msg, variant: "destructive" });
    } finally {
      setSubmittingDeliv(false);
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

  return (
    <OpcV2Layout
      title={order.demandTitle ?? order.orderNo}
      backHref="/opc/orders"
      backLabel="我的订单"
    >
      <div className="py-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
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
            {order.cancelledReason && (
              <div className="col-span-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">取消原因</p>
                <p className="text-sm text-slate-600">{order.cancelledReason}</p>
              </div>
            )}
          </div>

          {order.status === "pending_contract" && (
            <div className="space-y-3">
              {order.signedFileUrl ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
                  <FileSignature size={18} className="text-amber-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-800">合同已上传，请查阅并确认</p>
                    <a
                      href={order.signedFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-amber-700 underline hover:text-amber-900"
                    >
                      点击查看合同文件
                    </a>
                  </div>
                  <button
                    onClick={handleConfirmContract}
                    disabled={confirmingContract}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white text-sm font-bold rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60 shrink-0"
                  >
                    {confirmingContract ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    确认合同
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Clock size={18} className="text-slate-400 shrink-0" />
                  <p className="text-sm text-slate-500">等待平台上传合同文件…</p>
                </div>
              )}
            </div>
          )}
        </div>

        {settlements.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <Shield size={16} className="text-emerald-600" />
              <h3 className="font-bold text-slate-800">结算计划</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {settlements.map(s => {
                const sc = SETTLEMENT_STATUS[s.status] ?? SETTLEMENT_STATUS.pending;
                return (
                  <div key={s.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-700">{s.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        到期 {new Date(s.dueDate).toLocaleDateString("zh-CN")}
                        {s.isLastItem && <span className="ml-2 text-violet-600 font-bold">尾款</span>}
                        {s.isBlockingPayment && <span className="ml-2 text-red-600 font-bold">阻款中</span>}
                        {s.isOverdue && <span className="ml-2 text-red-500 font-bold">已逾期</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-base font-black ${s.status === "paid" ? "text-green-700" : "text-slate-800"}`}>
                        ¥{s.amount.toLocaleString()}
                      </p>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${sc.color}`}>
                        {sc.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Upload size={16} className="text-emerald-600" />
              <h3 className="font-bold text-slate-800">交付物</h3>
              <span className="text-xs text-slate-400">({deliverables.length})</span>
            </div>
            {canSubmitDeliverable && !showDeliverableForm && (
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>
                {delivAttachments.length > 0 && (
                  <div className="space-y-1">
                    {delivAttachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-1.5">
                        <Paperclip size={11} className="text-slate-400" />
                        <span className="flex-1 truncate text-slate-600">{att.name}</span>
                        <button
                          type="button"
                          onClick={() => setDelivAttachments(prev => prev.filter((_, j) => j !== i))}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submittingDeliv}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 text-white text-sm font-bold rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60"
                >
                  {submittingDeliv ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  提交交付物
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeliverableForm(false)}
                  className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          )}

          {deliverables.length === 0 && !showDeliverableForm ? (
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
                return (
                  <div key={d.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-800">{d.title}</p>
                        {d.content && <p className="text-xs text-slate-500 mt-1">{d.content}</p>}
                        {d.attachments?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {d.attachments.map((att, i) => (
                              <a
                                key={i}
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                              >
                                <Paperclip size={11} /> {att.name}
                              </a>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-slate-400 mt-1.5">
                          {new Date(d.createdAt).toLocaleDateString("zh-CN")} 提交
                        </p>
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

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">沟通记录</h3>
            <p className="text-xs text-slate-400 mt-0.5">与平台就此订单的讨论</p>
          </div>
          <div className="p-5">
            <DiscussionThread parentType="v2_outsource_order" parentId={orderId} />
          </div>
        </div>
      </div>
    </OpcV2Layout>
  );
}
