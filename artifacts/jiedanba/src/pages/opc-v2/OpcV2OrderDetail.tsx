import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  Loader2, AlertCircle, FileSignature, CheckCircle2, Paperclip,
  Package, Clock, Shield, XCircle, Plus, Wrench,
  RefreshCw, Lock, ChevronDown, ChevronUp, FileText,
  ExternalLink, Send, DollarSign, Tag, CreditCard, Calendar, Flag,
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
interface DemandInfo {
  id: number;
  title: string;
  demandType: string | null;
  isUrgent: boolean;
  expectedPriceMin: number | null;
  expectedPriceMax: number | null;
  status: string;
  milestones?: Array<{ name: string; deadline?: string | null; description?: string | null }>;
  latestVersion: { id: number; versionNo: number; detail: string | null; attachments: Array<{ name: string; url: string }> } | null;
}
interface ContractDetail {
  id: number;
  contractNo: string;
  status: string;
  content: string | null;
  signedFileUrl: string | null;
  signedAt: string | null;
  opcConfirmedAt?: string | null;
}
interface TenderInfo {
  id: number;
  totalPrice: number | null;
  priceBreakdown: Array<{ item: string; amount: number; note?: string }>;
  quotedAt: string | null;
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
  education: "教育培训", software: "软件开发", marketing: "营销推广",
  content: "内容设计", other: "其他",
  CG: "内容设计", SA: "软件开发", TK: "教育培训", BO: "营销推广", OTHER: "其他",
};
const ORDER_STAGE_KEYS = ["pending_contract", "executing", "warranty", "completed"] as const;
const ORDER_STAGE_LABELS: Record<string, string> = {
  pending_contract: "待签约", executing: "执行中", warranty: "质保期", completed: "已完成",
};

/* ── Card section component ── */
function CardSection({
  title, icon: Icon, badge, actions, children,
}: {
  title: string;
  icon: React.ElementType;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
        <Icon size={15} className="text-primary shrink-0" />
        <h3 className="font-bold text-foreground text-sm flex-1">{title}</h3>
        {badge}
        {actions}
      </div>
      <div className="px-5 py-4">
        {children}
      </div>
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
  const [, navigate] = useLocation();

  /* Contract */
  const [confirmingContract, setConfirmingContract] = useState(false);

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

  /* Tab */
  const [activeTab, setActiveTab] = useState<"demand" | "contract" | "delivery" | "ticket">(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("tab");
    if (t === "demand" || t === "delivery" || t === "ticket") return t;
    return "contract";
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

  const { data: contractList = [] } = useQuery<ContractDetail[]>({
    queryKey: ["v2-opc-order-contract", orderId],
    queryFn: () => v2Get(`/contracts?outsourceOrderId=${orderId}`),
    enabled: !!orderId,
  });
  const contract = contractList[0] ?? null;

  const { data: tender } = useQuery<TenderInfo>({
    queryKey: ["v2-opc-tender", order?.tenderId],
    queryFn: () => v2Get(`/tenders/${order!.tenderId}`),
    enabled: !!order?.tenderId,
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
  async function handleConfirmContract() {
    setConfirmingContract(true);
    try {
      await v2Post(`/outsource-orders/${orderId}/opc-confirm-contract`, {});
      toast({ title: "合同内容已确认", description: "等待运营上传已签合同文件，完成后项目将正式进入执行阶段" });
      qc.invalidateQueries({ queryKey: ["v2-opc-order", orderId] });
      qc.invalidateQueries({ queryKey: ["v2-opc-orders"] });
      qc.invalidateQueries({ queryKey: ["v2-opc-order-contract", orderId] });
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
    if (!delivTitle.trim()) { toast({ title: "请填写交付标题", variant: "destructive" }); return; }
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

  /* ── Loading / error ── */
  if (isLoading) return (
    <OpcV2Layout title="订单详情" backHref="/opc/orders" backLabel="我的订单">
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 size={24} className="animate-spin mr-2" /> 加载中…
      </div>
    </OpcV2Layout>
  );
  if (isError || !order) return (
    <OpcV2Layout title="订单详情" backHref="/opc/orders" backLabel="我的订单">
      <div className="bg-card rounded-2xl p-12 text-center border border-border mt-6">
        <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
        <p className="text-sm text-red-500 font-medium">加载失败，请返回重试</p>
      </div>
    </OpcV2Layout>
  );

  const cfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-slate-100 text-slate-500", icon: null };
  const canConfirmContract = order.status === "pending_contract" && !!contract && !contract.opcConfirmedAt;
  const canSubmitDeliverable = ["executing", "warranty"].includes(order.status);
  const openTickets = tickets.filter(t => t.status === "open");
  const blockingTickets = openTickets.filter(t => t.isBlockingPayment);
  const stageIdx = ORDER_STAGE_KEYS.indexOf(order.status as typeof ORDER_STAGE_KEYS[number]);

  const visibleTabs = [
    { key: "demand"   as const, label: "需求详情", icon: FileText, badge: null as number | null,
      show: true },
    { key: "contract" as const, label: "合同", icon: FileSignature, badge: null as number | null,
      show: true },
    { key: "delivery" as const, label: "交付", icon: Package,
      badge: deliverables.length > 0 ? deliverables.length : null,
      show: ["executing", "warranty", "completed"].includes(order.status) },
    { key: "ticket"   as const, label: "工单", icon: Wrench,
      badge: openTickets.length > 0 ? openTickets.length : null,
      show: ["warranty", "completed"].includes(order.status) },
  ].filter(t => t.show);

  return (
    <OpcV2Layout
      title={order.demandTitle ?? order.orderNo}
      backHref="/opc/orders"
      backLabel="我的订单"
    >
      <div className="py-6 space-y-4">

        {/* ── 基本信息 ── */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
                {cfg.icon} {cfg.label}
              </span>
              <span className="text-xs font-mono text-muted-foreground">{order.orderNo}</span>
              {demand?.isUrgent && (
                <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">紧急</span>
              )}
            </div>
            <h2 className="text-base font-extrabold text-foreground mb-3 leading-snug">
              {order.demandTitle ?? `订单 #${order.id}`}
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {demand?.demandType && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">需求类型</p>
                  <p className="font-semibold text-foreground text-sm">
                    {DEMAND_TYPE_LABELS[demand.demandType] ?? demand.demandType}
                  </p>
                </div>
              )}
              {(demand?.expectedPriceMin != null || demand?.expectedPriceMax != null) && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">预算区间</p>
                  <p className="font-semibold text-foreground text-sm">
                    {demand.expectedPriceMin != null ? `¥${demand.expectedPriceMin.toLocaleString()}` : "—"}
                    {" ~ "}
                    {demand.expectedPriceMax != null ? `¥${demand.expectedPriceMax.toLocaleString()}` : "—"}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">创建时间</p>
                <p className="font-semibold text-foreground text-sm">
                  {new Date(order.createdAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
              {order.warrantyEndDate && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">质保截止</p>
                  <p className="font-semibold text-foreground text-sm">
                    {new Date(order.warrantyEndDate).toLocaleDateString("zh-CN")}
                  </p>
                </div>
              )}
            </div>
            {/* 状态轴 */}
            {order.status !== "cancelled" && stageIdx >= 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center">
                  {ORDER_STAGE_KEYS.map((k, i) => (
                    <div key={k} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                          i < stageIdx ? "bg-primary" : i === stageIdx ? "bg-primary ring-4 ring-primary/15" : "bg-border"
                        }`} />
                        <span className={`text-[9px] mt-1 leading-none font-medium whitespace-nowrap ${
                          i === stageIdx ? "text-primary font-bold" : i < stageIdx ? "text-muted-foreground" : "text-muted-foreground/40"
                        }`}>
                          {ORDER_STAGE_LABELS[k]}
                        </span>
                      </div>
                      {i < ORDER_STAGE_KEYS.length - 1 && (
                        <div className={`flex-1 h-px mx-1 mb-3 ${i < stageIdx ? "bg-primary/40" : "bg-border"}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {order.cancelledReason && (
              <div className="mt-3 px-4 py-3 bg-muted/50 rounded-xl border border-border">
                <p className="text-xs font-bold text-muted-foreground">取消原因</p>
                <p className="text-sm text-foreground mt-0.5">{order.cancelledReason}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── 阻款工单提示 ── */}
        {blockingTickets.length > 0 && (
          <div className="flex items-start gap-3 px-5 py-4 bg-red-50 rounded-2xl border border-red-200">
            <Lock size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700">
              <span className="font-bold">有 {blockingTickets.length} 个未关闭工单正在阻止尾款释放。</span>{" "}
              请积极配合处理，工单关闭后尾款将正常打款。
            </p>
          </div>
        )}

        {/* ── Tab 栏（只有多个 tab 时才显示） ── */}
        {visibleTabs.length > 1 && (
          <div className="flex gap-1 bg-card rounded-2xl border border-border shadow-sm p-1">
            {visibleTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl transition-colors ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted/60"
                }`}
              >
                <tab.icon size={13} />
                {tab.label}
                {tab.badge != null && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key ? "bg-white/20" : "bg-muted text-muted-foreground"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ── 需求详情 Tab ── */}
        {activeTab === "demand" && (
          <div className="space-y-4">
            {!demand ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 size={16} className="animate-spin mr-2" /> 加载中…
              </div>
            ) : (
              <>
                {/* 需求描述 */}
                <CardSection title="需求说明" icon={FileText}>
                  {demand.latestVersion?.detail ? (
                    <div className="prose prose-sm max-w-none">
                      <MarkdownContent content={demand.latestVersion.detail} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无需求描述</p>
                  )}
                </CardSection>

                {/* 里程碑 */}
                <CardSection
                  title={`里程碑${demand.milestones?.length ? `（${demand.milestones.length}）` : ""}`}
                  icon={Flag}
                >
                  {demand.milestones && demand.milestones.length > 0 ? (
                    <div className="space-y-1">
                      {demand.milestones.map((m, i) => (
                        <div key={i} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                          <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{m.name}</p>
                            {m.deadline && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Calendar size={10} />
                                截止 {new Date(m.deadline).toLocaleDateString("zh-CN")}
                              </p>
                            )}
                            {m.description && (
                              <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无里程碑</p>
                  )}
                </CardSection>

                {/* 附件 */}
                {demand.latestVersion?.attachments && demand.latestVersion.attachments.length > 0 && (
                  <CardSection title="附件" icon={Paperclip}>
                    <div className="space-y-2">
                      {demand.latestVersion.attachments.map((att, i) => (
                        <a key={i} href={att.url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/40 transition-colors group">
                          <Paperclip size={13} className="text-muted-foreground shrink-0 group-hover:text-primary" />
                          <span className="text-sm text-foreground truncate flex-1">{att.name}</span>
                          <ExternalLink size={12} className="text-muted-foreground shrink-0" />
                        </a>
                      ))}
                    </div>
                  </CardSection>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ── 合同 Tab ── */}
        {activeTab === "contract" && (
          <div className="space-y-4">

            {/* 合同区块 */}
            <CardSection title="合同" icon={FileSignature}>
              {/* 签约操作区 */}
              {order.status === "pending_contract" && (
                contract ? (
                  contract.opcConfirmedAt ? (
                    <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 rounded-xl border border-blue-200">
                      <CheckCircle2 size={16} className="text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-blue-800">您已确认合同内容</p>
                        <p className="text-xs text-blue-600 mt-0.5">等待运营上传已签合同文件，完成后项目将正式进入执行阶段</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
                        <FileSignature size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-sm font-bold text-amber-800">请仔细查阅下方合同内容、里程碑及收款计划，确认无误后点击确认，运营上传已签合同文件后项目正式进入执行阶段</p>
                      </div>
                      <button
                        onClick={handleConfirmContract}
                        disabled={confirmingContract}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60"
                      >
                        {confirmingContract ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        确认合同内容
                      </button>
                    </div>
                  )
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-xl border border-border">
                    <Clock size={16} className="text-muted-foreground shrink-0" />
                    <p className="text-sm text-muted-foreground">等待运营创建合同内容…</p>
                  </div>
                )
              )}

              {/* 已签约状态 */}
              {order.status !== "pending_contract" && order.signedFileUrl && (
                <a href={order.signedFileUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 hover:bg-green-100 transition-colors group mb-4">
                  <div className="w-8 h-8 rounded-lg bg-green-100 group-hover:bg-green-200 flex items-center justify-center shrink-0">
                    <FileSignature size={14} className="text-green-700" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-green-700">已签约合同文件</p>
                    <p className="text-xs text-green-600">点击下载</p>
                  </div>
                  <ExternalLink size={14} className="text-green-500 shrink-0" />
                </a>
              )}

              {/* 合同正文（Markdown） */}
              {contract?.content ? (
                <div className="mt-4">
                  <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">合同正文</p>
                  <div className="bg-muted/40 border border-border rounded-xl px-5 py-4 prose prose-sm max-w-none">
                    <MarkdownContent content={contract.content} />
                  </div>
                  {contract.contractNo && (
                    <p className="text-xs text-muted-foreground mt-2">合同编号：{contract.contractNo}</p>
                  )}
                </div>
              ) : (
                order.status !== "pending_contract" && (
                  <p className="text-sm text-muted-foreground mt-2">合同正文暂未录入</p>
                )
              )}
            </CardSection>

            {/* 我的报价 */}
            {tender && (
              <CardSection title="我的报价" icon={DollarSign}>
                <div className="space-y-2">
                  {tender.priceBreakdown && tender.priceBreakdown.length > 0 ? (
                    <>
                      <div className="space-y-1">
                        {tender.priceBreakdown.map((row, i) => (
                          <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground">{row.item}</p>
                              {row.note && <p className="text-xs text-muted-foreground mt-0.5">{row.note}</p>}
                            </div>
                            <p className="text-sm font-bold text-foreground shrink-0">¥{row.amount.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">报价总额</span>
                        <span className="text-lg font-black text-primary">¥{tender.totalPrice?.toLocaleString() ?? "-"}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">报价总额</span>
                      <span className="text-lg font-black text-primary">¥{tender.totalPrice?.toLocaleString() ?? "-"}</span>
                    </div>
                  )}
                </div>
              </CardSection>
            )}

            {/* 收款计划 */}
            {settlements.length > 0 && (
              <CardSection
                title="收款计划"
                icon={CreditCard}
                badge={
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    {settlements.length} 项
                  </span>
                }
              >
                <div className="space-y-2 -mx-1">
                  {settlements.map(s => {
                    const sc = SETTLEMENT_STATUS[s.status] ?? SETTLEMENT_STATUS.pending;
                    return (
                      <button
                        key={s.id}
                        onClick={() => navigate(`/opc/income/${s.id}`)}
                        className={`w-full flex items-center justify-between border rounded-xl px-4 py-3 hover:shadow-sm transition-all text-left ${
                          s.isOverdue && s.status !== "paid"
                            ? "border-red-200 bg-red-50/40"
                            : "border-border hover:border-primary/30 bg-card"
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.color}`}>{sc.label}</span>
                            {s.isLastItem && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">尾款</span>
                            )}
                            {s.isBlockingPayment && s.status !== "paid" && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded flex items-center gap-0.5">
                                <Lock size={9} /> 阻款
                              </span>
                            )}
                            {s.isOverdue && s.status !== "paid" && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">逾期</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{s.title}</p>
                          <p className="text-xs text-muted-foreground/70 mt-0.5">
                            到期 {new Date(s.dueDate).toLocaleDateString("zh-CN")}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-base font-black ${s.status === "paid" ? "text-green-700" : "text-foreground"}`}>
                            ¥{s.amount.toLocaleString()}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardSection>
            )}

          </div>
        )}

        {/* ══════════════════════════════════════════ */}
        {/* ── 交付 Tab ── */}
        {activeTab === "delivery" && (
          <div className="space-y-3">

            {/* 无法提交时的提示 */}
            {!canSubmitDeliverable && order.status === "pending_contract" && (
              <div className="flex items-center gap-3 px-5 py-4 bg-muted/50 rounded-2xl border border-border">
                <Clock size={16} className="text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">合同签约完成后才能提交交付物</p>
              </div>
            )}

            {/* 新建交付表单入口 */}
            {canSubmitDeliverable && !resubmitTargetId && (
              showDeliverableForm ? (
                <form onSubmit={handleSubmitDeliverable} className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-foreground">提交交付物</span>
                    <button type="button" onClick={() => setShowDeliverableForm(false)}>
                      <span className="text-muted-foreground hover:text-foreground text-lg leading-none">×</span>
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                      交付标题 <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={delivTitle} onChange={e => setDelivTitle(e.target.value)}
                      placeholder="例: 第一阶段功能交付"
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">交付说明</label>
                    <textarea value={delivContent} onChange={e => setDelivContent(e.target.value)}
                      placeholder="描述交付内容…" rows={3}
                      className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-muted-foreground">附件</label>
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-bold">
                        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                        上传文件
                      </button>
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                    </div>
                    {delivAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {delivAttachments.map((att, i) => (
                          <div key={i} className="flex items-center gap-1 text-xs bg-muted border border-border rounded-lg px-2 py-1">
                            <Paperclip size={11} className="text-muted-foreground" />
                            <span className="text-foreground truncate max-w-[120px]">{att.name}</span>
                            <button type="button" onClick={() => setDelivAttachments(prev => prev.filter((_, j) => j !== i))}
                              className="text-muted-foreground hover:text-red-500 ml-0.5">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" disabled={submittingDeliv}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60">
                      {submittingDeliv ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      提交交付物
                    </button>
                    <button type="button" onClick={() => setShowDeliverableForm(false)}
                      className="px-5 py-2.5 bg-muted text-muted-foreground text-sm font-bold rounded-xl hover:bg-muted/80 transition-colors">
                      取消
                    </button>
                  </div>
                </form>
              ) : (
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
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">新标题 <span className="text-red-500">*</span></label>
                  <input type="text" value={resubmitTitle} onChange={e => setResubmitTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">更新说明</label>
                  <textarea value={resubmitContent} onChange={e => setResubmitContent(e.target.value)}
                    rows={2} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none resize-none" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-muted-foreground">附件</label>
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
                        <div key={i} className="flex items-center gap-1 text-xs bg-muted border border-border rounded-lg px-2 py-1">
                          <Paperclip size={11} className="text-muted-foreground" />
                          <span className="truncate max-w-[120px]">{att.name}</span>
                          <button type="button" onClick={() => setResubmitAttachments(prev => prev.filter((_, j) => j !== i))}
                            className="text-muted-foreground hover:text-red-500 ml-0.5">×</button>
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
                    className="px-5 py-2.5 bg-muted text-muted-foreground text-sm font-bold rounded-xl hover:bg-muted/80 border border-border transition-colors">
                    取消
                  </button>
                </div>
              </form>
            )}

            {/* 空态 */}
            {deliverables.length === 0 && !showDeliverableForm && !resubmitTargetId && (
              <div className="bg-card rounded-2xl border border-border p-10 text-center">
                <Package size={32} className="mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {canSubmitDeliverable ? "点击上方按钮提交交付物" : "暂无交付记录"}
                </p>
              </div>
            )}

            {/* 交付卡片手风琴 */}
            {deliverables.map(d => {
              const ds = DELIVERABLE_STATUS[d.status] ?? { label: d.status, color: "bg-muted text-muted-foreground" };
              const isExpanded = expandedDelivId === d.id;
              const canResubmit = d.status === "revision" && canSubmitDeliverable;
              return (
                <div key={d.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/40 transition-colors text-left"
                    onClick={() => setExpandedDelivId(isExpanded ? null : d.id)}
                  >
                    <CheckCircle2 size={16} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleDateString("zh-CN")} 提交</p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${ds.color}`}>{ds.label}</span>
                    {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-4 border-t border-border">
                      {d.content && (
                        <div className="pt-4">
                          <p className="text-xs font-bold text-muted-foreground mb-2">交付说明</p>
                          <div className="bg-muted/40 border border-border rounded-xl px-4 py-3 prose prose-sm max-w-none">
                            <MarkdownContent content={d.content} />
                          </div>
                        </div>
                      )}
                      {d.attachments?.length > 0 && (
                        <div className={d.content ? "" : "pt-4"}>
                          <p className="text-xs font-bold text-muted-foreground mb-2">附件</p>
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
                          <p className="text-xs font-bold text-red-600 mb-0.5">已被退回</p>
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
                      <div className="border-t border-border pt-4">
                        <p className="text-xs font-bold text-muted-foreground mb-3">交付讨论</p>
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
              <div className="bg-card rounded-2xl border border-border p-10 text-center">
                <Wrench size={32} className="mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">暂无工单</p>
                <p className="text-xs text-muted-foreground/60 mt-1">质保期内如发现问题，可联系平台发起工单</p>
              </div>
            ) : tickets.map(t => {
              const tc = TICKET_STATUS[t.status] ?? TICKET_STATUS.open;
              const isExpanded = expandedTicketId === t.id;
              return (
                <div key={t.id} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                  <div
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/40 transition-colors cursor-pointer"
                    onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}
                  >
                    <Wrench size={16} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
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
                      className="text-[11px] font-bold px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors shrink-0"
                    >
                      详情
                    </button>
                    {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-4 border-t border-border">
                      {t.description && (
                        <div className="pt-4">
                          <p className="text-xs font-bold text-muted-foreground mb-2">问题描述</p>
                          <div className="bg-muted/40 border border-border rounded-xl px-4 py-3 prose prose-sm max-w-none">
                            <MarkdownContent content={t.description} />
                          </div>
                        </div>
                      )}
                      <div className="border-t border-border pt-4">
                        <p className="text-xs font-bold text-muted-foreground mb-3">工单讨论</p>
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
