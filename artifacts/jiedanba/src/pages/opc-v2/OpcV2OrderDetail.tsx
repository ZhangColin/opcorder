import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  Loader2, AlertCircle, FileSignature, CheckCircle2, Paperclip,
  Upload, Package, Clock, Shield, XCircle, Plus, Wrench,
  RefreshCw, Lock, ChevronDown, ChevronUp, FileText, History,
  ExternalLink, Send,
} from "lucide-react";
import { v2Get, v2Post, uploadFile } from "@/lib/v2api";
import { markRead } from "@/lib/demandRead";
import { useToast } from "@/hooks/use-toast";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { MarkdownContent } from "@/components/MarkdownContent";
import { OpcV2Layout } from "./OpcV2Layout";

/* ── Types ── */
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
interface DemandVersion {
  id: number;
  versionNo: number;
  detail: string | null;
  attachments: Array<{ name: string; url: string }>;
  editedByNickname: string | null;
  createdAt: string;
}
interface DemandInfo {
  id: number;
  title: string;
  demandType: string;
  isUrgent: boolean;
  expectedPriceMin: number | null;
  expectedPriceMax: number | null;
  status: string;
  latestVersion: DemandVersion | null;
}
interface DeliverableItem {
  id: number;
  outsourceOrderId: number;
  title: string;
  content: string | null;
  url?: string | null;
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

/* ── Config ── */
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
  open:   { label: "处理中", color: "bg-blue-100 text-blue-700" },
  closed: { label: "已关闭", color: "bg-slate-100 text-slate-500" },
};
const DEMAND_TYPE_LABELS: Record<string, string> = {
  education: "教育培训", software: "软件开发", marketing: "营销",
  content: "内容设计", other: "其他",
};

/* ── Section component (matches PubDemandDetail style exactly) ── */
function Section({
  title, icon: Icon, defaultOpen = true, actions, children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
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
        {actions && (
          <div className="shrink-0" onClick={e => e.stopPropagation()}>{actions}</div>
        )}
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="px-6 pt-4 pb-6 border-t border-slate-100">{children}</div>}
    </div>
  );
}

/* ── Main component ── */
export default function OpcV2OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const orderId = parseInt(id ?? "0");
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resubmitFileRef = useRef<HTMLInputElement>(null);
  const opcSignedFileRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  /* Contract */
  const [confirmingContract, setConfirmingContract] = useState(false);
  const [opcSignedFileUrl, setOpcSignedFileUrl] = useState<string | null>(null);
  const [uploadingOpcSigned, setUploadingOpcSigned] = useState(false);

  /* Deliverable form */
  const [showDeliverableForm, setShowDeliverableForm] = useState(false);
  const [delivTitle, setDelivTitle] = useState("");
  const [delivContent, setDelivContent] = useState("");
  const [delivAttachments, setDelivAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [submittingDeliv, setSubmittingDeliv] = useState(false);

  /* Resubmit */
  const [resubmitTargetId, setResubmitTargetId] = useState<number | null>(null);
  const [resubmitTitle, setResubmitTitle] = useState("");
  const [resubmitContent, setResubmitContent] = useState("");
  const [resubmitAttachments, setResubmitAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [resubmitUploading, setResubmitUploading] = useState(false);
  const [submittingResubmit, setSubmittingResubmit] = useState(false);

  /* Accordion expand state */
  const [expandedDelivId, setExpandedDelivId] = useState<number | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null);

  /* Versions modal */
  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);

  /* Tab */
  const [activeTab, setActiveTab] = useState<"info" | "contract" | "delivery" | "ticket">(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("tab");
    if (t === "contract" || t === "delivery" || t === "ticket") return t;
    return "info";
  });

  /* ── Data ── */
  const { data: order, isLoading, isError, refetch, dataUpdatedAt } = useQuery<OrderDetail>({
    queryKey: ["v2-opc-order", orderId],
    queryFn: () => v2Get(`/outsource-orders/${orderId}`),
    enabled: !!orderId,
  });

  const { data: demand } = useQuery<DemandInfo>({
    queryKey: ["v2-opc-order-demand", order?.outsourceDemandId],
    queryFn: () => v2Get(`/outsource-demands/${order!.outsourceDemandId}`),
    enabled: !!order?.outsourceDemandId,
  });

  const { data: versions = [] } = useQuery<DemandVersion[]>({
    queryKey: ["v2-opc-order-demand-versions", order?.outsourceDemandId],
    queryFn: () => v2Get(`/outsource-demands/${order!.outsourceDemandId}/versions`),
    enabled: showVersions && !!order?.outsourceDemandId,
  });

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

  useEffect(() => { if (orderId > 0 && order) markRead("order", orderId); }, [orderId, dataUpdatedAt]);

  /* ── Handlers ── */
  async function handleOpcSignedUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingOpcSigned(true);
    try {
      const url = await uploadFile(file);
      setOpcSignedFileUrl(url);
      toast({ title: "文件已上传", description: "请点击「确认合同」完成签署" });
    } catch (err: unknown) {
      toast({ title: "上传失败", description: err instanceof Error ? err.message : "请重试", variant: "destructive" });
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
      toast({ title: "确认失败", description: err instanceof Error ? err.message : "请稍后重试", variant: "destructive" });
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
      toast({ title: "上传失败", description: err instanceof Error ? err.message : "请重试", variant: "destructive" });
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
      toast({ title: "上传失败", description: err instanceof Error ? err.message : "请重试", variant: "destructive" });
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
      setDelivTitle(""); setDelivContent(""); setDelivAttachments([]);
      refetchDelivs();
    } catch (err: unknown) {
      toast({ title: "提交失败", description: err instanceof Error ? err.message : "请稍后重试", variant: "destructive" });
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
      toast({ title: "已重新提交" });
      setResubmitTargetId(null);
      setResubmitTitle(""); setResubmitContent(""); setResubmitAttachments([]);
      refetchDelivs();
    } catch (err: unknown) {
      toast({ title: "重交失败", description: err instanceof Error ? err.message : "请稍后重试", variant: "destructive" });
    } finally {
      setSubmittingResubmit(false);
    }
  }

  /* ── Loading / error states ── */
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
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 mt-6">
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

  /* Tab visibility */
  const visibleTabs = [
    "info",
    "contract",
    ...(["executing", "warranty", "completed"].includes(order.status) ? ["delivery"] : []),
    ...(["warranty", "completed"].includes(order.status) ? ["ticket"] : []),
  ] as const;
  const TAB_LABELS: Record<string, string> = {
    info: "需求详情",
    contract: "合同",
    delivery: "交付",
    ticket: "工单",
  };

  return (
    <OpcV2Layout
      title={order.demandTitle ?? order.orderNo}
      backHref="/opc/orders"
      backLabel="我的订单"
    >
      <div className="py-6 space-y-4">

        {/* ── 基本信息卡 ── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${cfg.color}`}>
              {cfg.icon} {cfg.label}
            </span>
            <span className="text-xs font-mono text-slate-400">{order.orderNo}</span>
          </div>
          <h2 className="text-lg font-extrabold text-slate-800 mb-3">
            {order.demandTitle ?? `订单 #${order.id}`}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">创建时间</p>
              <p className="font-semibold text-slate-700">{new Date(order.createdAt).toLocaleDateString("zh-CN")}</p>
            </div>
            {order.warrantyEndDate && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">质保截止</p>
                <p className="font-semibold text-slate-700">{new Date(order.warrantyEndDate).toLocaleDateString("zh-CN")}</p>
              </div>
            )}
          </div>
          {order.cancelledReason && (
            <div className="mt-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-600">取消原因</p>
              <p className="text-sm text-slate-500 mt-0.5">{order.cancelledReason}</p>
            </div>
          )}
          {["executing", "warranty", "completed"].includes(order.status) && (
            <div className="mt-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500">
                ⚠️ 合同签署后不可单方面终止订单，如有异议请通过工单与平台沟通。
              </p>
            </div>
          )}
        </div>

        {/* ── 阻款工单提示 ── */}
        {blockingTickets.length > 0 && (
          <div className="flex items-start gap-3 px-5 py-4 bg-red-50 rounded-2xl border border-red-200">
            <Lock size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">
              <span className="font-bold">有 {blockingTickets.length} 个未关闭工单正在阻止尾款释放。</span>
              请积极配合处理，工单关闭后尾款将正常打款。
            </p>
          </div>
        )}

        {/* ── Tab 栏 ── */}
        {visibleTabs.length > 1 && (
          <div className="flex gap-1 bg-white rounded-2xl border border-slate-200 p-1">
            {visibleTabs.map(tab => {
              const badge = tab === "delivery" ? (deliverables.length > 0 ? deliverables.length : null)
                          : tab === "ticket"   ? (openTickets.length > 0 ? openTickets.length : null)
                          : null;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-colors ${
                    activeTab === tab ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {TAB_LABELS[tab]}
                  {badge != null && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab ? "bg-white/20" : "bg-slate-200 text-slate-600"}`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ── 需求详情 Tab ── */}
        {activeTab === "info" && <>

        <Section
          title="需求详情"
          icon={FileText}
          actions={demand?.latestVersion ? (
            <button
              onClick={() => setShowVersions(v => !v)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition-colors"
            >
              <History size={11} />
              v{demand.latestVersion.versionNo} 历史版本
            </button>
          ) : undefined}
        >
          {demand?.latestVersion ? (
            <div>
              {demand.latestVersion.detail ? (
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 prose prose-sm max-w-none">
                  <MarkdownContent content={demand.latestVersion.detail} />
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-4">暂无详情内容</p>
              )}
              {demand.latestVersion.attachments?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {demand.latestVersion.attachments.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors">
                      <ExternalLink size={11} /> {a.name}
                    </a>
                  ))}
                </div>
              )}
              {showVersions && versions.length > 0 && (
                <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                  <p className="text-xs font-bold text-slate-500">历史版本</p>
                  {versions.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVersionIdx(i)}
                      className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition-colors ${
                        selectedVersionIdx === i ? "border-primary/30 bg-primary/5 text-primary font-bold" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span className="font-bold">v{v.versionNo}</span>
                      {v.editedByNickname && <span className="text-slate-400 ml-2">{v.editedByNickname}</span>}
                      <span className="text-slate-400 ml-2">{new Date(v.createdAt).toLocaleDateString("zh-CN")}</span>
                    </button>
                  ))}
                  {selectedVersionIdx < versions.length && versions[selectedVersionIdx].detail && (
                    <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 prose prose-sm max-w-none">
                      <MarkdownContent content={versions[selectedVersionIdx].detail!} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : demand ? (
            <p className="text-sm text-slate-400 py-4">发单方尚未提交需求详情</p>
          ) : (
            <div className="flex items-center justify-center py-6 text-slate-400">
              <Loader2 size={16} className="animate-spin mr-2" /> 加载中…
            </div>
          )}
        </Section>

        <Section title="需求沟通" icon={FileText}>
          <DiscussionThread
            parentType="outsource_demand"
            parentId={orderId}
            placeholder="就此订单与平台沟通…"
          />
        </Section>

        </>}

        {/* ══════════════════════════════════════════ */}
        {/* ── 合同 Tab ── */}
        {activeTab === "contract" && <>

        {/* 合同 */}
        <Section title="合同" icon={FileSignature}>
          {order.status === "pending_contract" ? (
            order.signedFileUrl ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
                  <FileSignature size={18} className="text-amber-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-800">平台已上传合同，请查阅后上传已签版本并确认</p>
                    <a href={order.signedFileUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-amber-700 underline hover:text-amber-900">
                      查看平台合同文件
                    </a>
                  </div>
                </div>
                <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <p className="text-xs font-bold text-slate-700">第 1 步：上传您的已签署合同 PDF</p>
                  {opcSignedFileUrl ? (
                    <div className="flex items-center gap-2">
                      <Paperclip size={13} className="text-green-600" />
                      <a href={opcSignedFileUrl} target="_blank" rel="noreferrer"
                        className="text-xs text-green-700 font-bold hover:underline">
                        已签PDF已上传 ✓
                      </a>
                      <button onClick={() => setOpcSignedFileUrl(null)}
                        className="text-xs text-slate-400 hover:text-red-500 ml-1">重新上传</button>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => opcSignedFileRef.current?.click()}
                        disabled={uploadingOpcSigned}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-600 text-xs font-bold rounded-lg hover:border-primary hover:text-primary transition-colors"
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
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {confirmingContract ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    确认合同（开始执行）
                  </button>
                  {!opcSignedFileUrl && <p className="text-[11px] text-slate-400">请先上传您的已签 PDF 后再确认</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                <Clock size={18} className="text-slate-400 shrink-0" />
                <p className="text-sm text-slate-500">等待平台上传合同文件…</p>
              </div>
            )
          ) : order.signedFileUrl ? (
            <a href={order.signedFileUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 hover:bg-green-100 transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-green-100 group-hover:bg-green-200 transition-colors flex items-center justify-center shrink-0">
                <FileSignature size={15} className="text-green-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-green-700">已签约合同文件</p>
                <p className="text-xs text-green-600">点击下载</p>
              </div>
              <ExternalLink size={14} className="text-green-500 shrink-0" />
            </a>
          ) : (
            <p className="text-sm text-slate-400">合同文件暂未上传</p>
          )}
        </Section>

        {/* 收款计划 */}
        {settlements.length > 0 && (
          <Section title={`收款计划（${settlements.length} 项）`} icon={Shield}>
            <div className="space-y-3">
              {settlements.map(s => {
                const sc = SETTLEMENT_STATUS[s.status] ?? SETTLEMENT_STATUS.pending;
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/opc/income/${s.id}`)}
                    className={`w-full flex items-center justify-between border rounded-xl p-4 hover:shadow-sm transition-all text-left ${
                      s.isOverdue && s.status !== "paid" ? "border-red-300 bg-red-50/30" : "border-slate-200 hover:border-primary/30"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
                        {s.isLastItem && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">尾款</span>}
                        {s.isBlockingPayment && s.status !== "paid" && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded flex items-center gap-0.5">
                            <Lock size={9} /> 阻款
                          </span>
                        )}
                        {s.isOverdue && s.status !== "paid" && (
                          <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">逾期</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{s.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        到期 {new Date(s.dueDate).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-base font-black ${s.status === "paid" ? "text-green-700" : "text-slate-800"}`}>
                        ¥{s.amount.toLocaleString()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        </>}

        {/* ══════════════════════════════════════════ */}
        {/* ── 交付 Tab ── */}
        {activeTab === "delivery" && (
          <div className="space-y-4">

            {/* 新建交付表单 */}
            {canSubmitDeliverable && (
              showDeliverableForm ? (
                <form onSubmit={handleSubmitDeliverable} className="bg-teal-50 border border-teal-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-teal-800">提交交付物</span>
                    <button type="button" onClick={() => setShowDeliverableForm(false)}>
                      <XCircle size={16} className="text-slate-400 hover:text-slate-600" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      交付标题 <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={delivTitle} onChange={e => setDelivTitle(e.target.value)}
                      placeholder="例: 第一阶段功能交付"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">交付说明</label>
                    <textarea value={delivContent} onChange={e => setDelivContent(e.target.value)}
                      placeholder="描述交付内容…" rows={3}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 resize-none" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-600">附件</label>
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        className="flex items-center gap-1 text-xs text-teal-700 hover:text-teal-900 font-bold">
                        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                        上传文件
                      </button>
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                    </div>
                    {delivAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {delivAttachments.map((att, i) => (
                          <div key={i} className="flex items-center gap-1 text-xs bg-white border border-slate-200 rounded-lg px-2 py-1">
                            <Paperclip size={11} className="text-slate-400" />
                            <span className="text-slate-600 truncate max-w-[120px]">{att.name}</span>
                            <button type="button" onClick={() => setDelivAttachments(prev => prev.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500 ml-0.5">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={submittingDeliv}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60">
                      {submittingDeliv ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      提交交付物
                    </button>
                    <button type="button" onClick={() => setShowDeliverableForm(false)}
                      className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-colors">取消</button>
                  </div>
                </form>
              ) : !resubmitTargetId && (
                <button
                  onClick={() => setShowDeliverableForm(true)}
                  className="w-full flex items-center gap-2 justify-center border-2 border-dashed border-primary/30 text-primary rounded-2xl py-3 text-sm font-bold hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus size={16} /> 提交新交付物
                </button>
              )
            )}

            {/* 重交表单 */}
            {resubmitTargetId && (
              <form onSubmit={handleResubmit} className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw size={14} className="text-amber-600" />
                  <p className="text-sm font-bold text-amber-700">重新提交被退回的交付物</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">新标题 <span className="text-red-500">*</span></label>
                  <input type="text" value={resubmitTitle} onChange={e => setResubmitTitle(e.target.value)}
                    placeholder="修改后的交付标题"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">更新说明</label>
                  <textarea value={resubmitContent} onChange={e => setResubmitContent(e.target.value)}
                    placeholder="说明本次修改了什么…" rows={2}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none resize-none" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-600">附件</label>
                    <button type="button" onClick={() => resubmitFileRef.current?.click()} disabled={resubmitUploading}
                      className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 font-bold">
                      {resubmitUploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                      上传文件
                    </button>
                    <input ref={resubmitFileRef} type="file" className="hidden" onChange={handleResubmitFileUpload} />
                  </div>
                  {resubmitAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {resubmitAttachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-1 text-xs bg-white border border-slate-200 rounded-lg px-2 py-1">
                          <Paperclip size={11} className="text-slate-400" />
                          <span className="text-slate-600 truncate max-w-[120px]">{att.name}</span>
                          <button type="button" onClick={() => setResubmitAttachments(prev => prev.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500 ml-0.5">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={submittingResubmit}
                    className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-60">
                    {submittingResubmit ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    重新提交
                  </button>
                  <button type="button" onClick={() => setResubmitTargetId(null)}
                    className="px-5 py-2.5 bg-white text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-100 transition-colors border border-slate-200">取消</button>
                </div>
              </form>
            )}

            {/* 空态 */}
            {deliverables.length === 0 && !showDeliverableForm && !resubmitTargetId && (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <Upload size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">
                  {canSubmitDeliverable ? "点击上方按钮提交交付物" : "暂无交付记录"}
                </p>
              </div>
            )}

            {/* 交付卡片手风琴 */}
            {deliverables.map(d => {
              const ds = DELIVERABLE_STATUS[d.status] ?? { label: d.status, color: "bg-slate-100 text-slate-500" };
              const isExpanded = expandedDelivId === d.id;
              const canResubmit = d.status === "revision" && canSubmitDeliverable;
              return (
                <div key={d.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                    onClick={() => setExpandedDelivId(isExpanded ? null : d.id)}
                  >
                    <CheckCircle2 size={16} className="text-teal-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{d.title}</p>
                      <p className="text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString("zh-CN")} 提交</p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${ds.color}`}>{ds.label}</span>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
                      {d.content && (
                        <div className="pt-4">
                          <p className="text-xs font-bold text-slate-500 mb-2">交付说明</p>
                          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 prose prose-sm max-w-none">
                            <MarkdownContent content={d.content} />
                          </div>
                        </div>
                      )}
                      {d.attachments?.length > 0 && (
                        <div className={d.content ? "" : "pt-4"}>
                          <p className="text-xs font-bold text-slate-500 mb-2">附件</p>
                          <div className="flex flex-wrap gap-2">
                            {d.attachments.map((att, i) => (
                              <a key={i} href={att.url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors">
                                <Paperclip size={11} /> {att.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {d.status === "revision" && (
                        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                          <p className="text-xs font-bold text-red-600 mb-1">已被退回</p>
                          <p className="text-xs text-red-500">平台已驳回此次交付，请修改后重新提交。</p>
                        </div>
                      )}
                      {canResubmit && !resubmitTargetId && (
                        <button
                          onClick={() => {
                            setResubmitTargetId(d.id);
                            setResubmitTitle(d.title);
                            setResubmitContent(d.content ?? "");
                            setResubmitAttachments(d.attachments ?? []);
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-amber-700 border border-amber-200 rounded-xl px-3 py-1.5 hover:bg-amber-50 transition-colors"
                        >
                          <RefreshCw size={12} /> 重新提交
                        </button>
                      )}
                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-bold text-slate-500 mb-3">交付讨论</p>
                        <DiscussionThread
                          parentType="deliverable_b"
                          parentId={d.id}
                          placeholder="就此交付物与平台沟通…"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ── 工单 Tab ── */}
        {activeTab === "ticket" && (
          <div className="space-y-3">
            {tickets.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <Wrench size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">暂无工单</p>
                <p className="text-xs text-slate-300 mt-1">质保期内如发现问题，可联系平台发起工单</p>
              </div>
            ) : tickets.map(t => {
              const tc = TICKET_STATUS[t.status] ?? TICKET_STATUS.open;
              const isExpanded = expandedTicketId === t.id;
              return (
                <div key={t.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}
                  >
                    <Wrench size={16} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{t.title}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(t.createdAt).toLocaleDateString("zh-CN")}
                        {t.createdByNickname && ` · ${t.createdByNickname}`}
                      </p>
                    </div>
                    {t.isBlockingPayment && t.status === "open" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded flex items-center gap-0.5 shrink-0">
                        <Lock size={9} /> 阻款
                      </span>
                    )}
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${tc.color}`}>
                      {tc.label}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/opc/tickets/${t.id}`); }}
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 hover:border-primary hover:text-primary transition-colors shrink-0"
                    >
                      详情
                    </button>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
                      {t.description && (
                        <div className="pt-4">
                          <p className="text-xs font-bold text-slate-500 mb-2">问题描述</p>
                          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 prose prose-sm max-w-none">
                            <MarkdownContent content={t.description} />
                          </div>
                        </div>
                      )}
                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-bold text-slate-500 mb-3">工单讨论</p>
                        <DiscussionThread
                          parentType="ticket_b"
                          parentId={t.id}
                          placeholder="回复平台或补充说明…"
                          readOnly={t.status !== "open"}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </OpcV2Layout>
  );
}
