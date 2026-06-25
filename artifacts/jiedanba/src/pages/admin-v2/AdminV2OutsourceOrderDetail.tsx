import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import {
  Loader2, X, Upload, CheckCircle2, Clock, ExternalLink, Wrench,
  FileSignature, Package, Shield, XCircle, CreditCard, ChevronDown, ChevronUp,
  Paperclip, Plus, Edit2, Send, DollarSign, FileText, Flag, Calendar,
} from "lucide-react";
import { AdminV2Layout, Section } from "@/components/admin-v2/AdminV2Layout";
import { BreakdownDisplay } from "@/components/shared/BreakdownDisplay";
import { FilePickerZone } from "@/components/shared/FilePickerZone";
import { v2Get, v2Post, v2Patch, v2Delete, uploadFile } from "@/lib/v2api";
import { markRead } from "@/lib/demandRead";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { useToast } from "@/hooks/use-toast";

interface OutsourceOrder {
  id: number;
  orderNo: string;
  outsourceDemandId: number;
  demandTitle: string | null;
  tenderId: number | null;
  opcId: number;
  opcNickname: string | null;
  status: string;
  contractId: number | null;
  signedFileUrl: string | null;
  warrantyEndDate: string | null;
  cancelledReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TenderInfo {
  id: number;
  opcNickname: string | null;
  status: string;
  totalPrice: number | null;
  priceBreakdown: Array<{ item: string; amount: number; note?: string }> | null;
  quotedAt: string | null;
}

interface ContractDetail {
  id: number;
  contractNo: string;
  status: string;
  content: string | null;
  signedFileUrl: string | null;
  opcConfirmedAt?: string | null;
}

interface SettlementPlan {
  id: number;
  itemNo: number | null;
  description: string | null;
  amount: number;
  dueDate: string | null;
  status: string;
  isLastItem: boolean;
  isBlockingPayment?: boolean;
  isOverdue?: boolean;
  paidAt: string | null;
}

interface DeliverableB {
  id: number;
  title: string;
  content: string | null;
  attachments: Array<{ name: string; url: string }> | null;
  status: string;
  createdByNickname: string | null;
  createdAt: string;
}

interface TicketB {
  id: number;
  title: string;
  description: string | null;
  attachments: Array<{ name: string; url: string }> | null;
  status: string;
  isBlockingPayment: boolean | null;
  createdByNickname: string | null;
  createdAt: string;
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft:            { label: "草稿",   color: "bg-slate-100 text-slate-600",   icon: <FileText size={13} /> },
  pending_contract: { label: "待签约", color: "bg-amber-100 text-amber-700",   icon: <FileSignature size={13} /> },
  executing:        { label: "执行中", color: "bg-blue-100 text-blue-700",     icon: <Package size={13} /> },
  warranty:         { label: "质保中", color: "bg-violet-100 text-violet-700", icon: <Shield size={13} /> },
  completed:        { label: "已完成", color: "bg-green-100 text-green-700",   icon: <CheckCircle2 size={13} /> },
  cancelled:        { label: "已取消", color: "bg-slate-100 text-slate-500",   icon: <XCircle size={13} /> },
};
const ORDER_STAGE_KEYS = ["draft", "pending_contract", "executing", "warranty", "completed"] as const;
const ORDER_STAGE_LABELS: Record<string, string> = {
  draft: "草稿", pending_contract: "待签约", executing: "执行中", warranty: "质保期", completed: "已完成",
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-slate-800">{title}</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CardSection({
  title, icon: Icon, badge, actions, children,
}: {
  title: string; icon: React.ElementType; badge?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <Icon size={14} className="text-primary shrink-0" />
        <h3 className="font-bold text-slate-700 text-sm flex-1">{title}</h3>
        {badge}
        {actions}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export default function AdminV2OutsourceOrderDetail({ inlineId }: { inlineId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const { toast } = useToast();

  const [order, setOrder] = useState<OutsourceOrder | null>(null);
  const [tender, setTender] = useState<TenderInfo | null>(null);
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [demand, setDemand] = useState<DemandInfo | null>(null);
  const [settlements, setSettlements] = useState<SettlementPlan[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableB[]>([]);
  const [tickets, setTickets] = useState<TicketB[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const [activeTab, setActiveTab] = useState<"demand" | "contract" | "delivery" | "ticket">("contract");

  /* Accordion */
  const [expandedDelivId, setExpandedDelivId] = useState<number | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null);

  /* Upload contract PDF */
  const [showUploadContract, setShowUploadContract] = useState(false);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [uploadingContract, setUploadingContract] = useState(false);

  /* Contract inline editing */
  const [editingContract, setEditingContract] = useState(false);
  const [contractEditContent, setContractEditContent] = useState("");
  const [contractActing, setContractActing] = useState(false);

  /* Settlement plan inline forms */
  const [showAddSettlement, setShowAddSettlement] = useState(false);
  const [addSettleForm, setAddSettleForm] = useState({ description: "", amount: "", dueDate: "", isLastItem: false });
  const [editSettleId, setEditSettleId] = useState<number | null>(null);
  const [editSettleForm, setEditSettleForm] = useState({ description: "", amount: "", dueDate: "", isLastItem: false });
  const [settleActing, setSettleActing] = useState(false);

  /* Ticket modal */
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);

  /* Verify modal */
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyNote, setVerifyNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<OutsourceOrder>(`/outsource-orders/${id}`);
      setOrder(d);
      markRead("order", id);
      if (d.tenderId) {
        try {
          const t = await v2Get<TenderInfo>(`/tenders/${d.tenderId}`);
          setTender(t);
        } catch { setTender(null); }
      } else {
        setTender(null);
      }
      const contractList = await v2Get<ContractDetail[]>(`/contracts?outsourceOrderId=${id}`);
      setContract(Array.isArray(contractList) && contractList.length > 0 ? contractList[0] : null);
      if (d.outsourceDemandId) {
        try {
          const dem = await v2Get<DemandInfo>(`/outsource-demands/${d.outsourceDemandId}`);
          setDemand(dem);
        } catch { setDemand(null); }
      }
      const sp = await v2Get<SettlementPlan[]>(`/settlement-plans?outsourceOrderId=${id}`);
      setSettlements(Array.isArray(sp) ? sp : []);
      const db = await v2Get<DeliverableB[]>(`/deliverables-b?outsourceOrderId=${id}`);
      setDeliverables(Array.isArray(db) ? db : []);
      const tb = await v2Get<TicketB[]>(`/tickets-b?outsourceOrderId=${id}`);
      setTickets(Array.isArray(tb) ? tb : []);
    } catch {
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id > 0) load(); }, [id]);

  /* 静默刷新（不触发全局 loading 动画） */
  const softLoad = async () => {
    try {
      const d = await v2Get<OutsourceOrder>(`/outsource-orders/${id}`);
      setOrder(d);
      if (d.tenderId) {
        try { const t = await v2Get<TenderInfo>(`/tenders/${d.tenderId}`); setTender(t); } catch { setTender(null); }
      } else { setTender(null); }
      const contractList = await v2Get<ContractDetail[]>(`/contracts?outsourceOrderId=${id}`);
      setContract(Array.isArray(contractList) && contractList.length > 0 ? contractList[0] : null);
      if (d.outsourceDemandId) {
        try { const dem = await v2Get<DemandInfo>(`/outsource-demands/${d.outsourceDemandId}`); setDemand(dem); } catch { setDemand(null); }
      }
      const [sp, db, tb] = await Promise.all([
        v2Get<SettlementPlan[]>(`/settlement-plans?outsourceOrderId=${id}`),
        v2Get<DeliverableB[]>(`/deliverables-b?outsourceOrderId=${id}`),
        v2Get<TicketB[]>(`/tickets-b?outsourceOrderId=${id}`),
      ]);
      setSettlements(Array.isArray(sp) ? sp : []);
      setDeliverables(Array.isArray(db) ? db : []);
      setTickets(Array.isArray(tb) ? tb : []);
    } catch { /* ignore */ }
  };

  /* 静默刷新结算列表（不触发全局 loading 动画） */
  const softReloadSettlements = async () => {
    try {
      const sp = await v2Get<SettlementPlan[]>(`/settlement-plans?outsourceOrderId=${id}`);
      setSettlements(Array.isArray(sp) ? sp : []);
    } catch { /* ignore */ }
  };

  const act = async <T = unknown>(fn: () => Promise<T>, msg: string, onSuccess?: (result: T) => void) => {
    setActing(true);
    try {
      const result = await fn();
      toast({ title: msg });
      if (onSuccess) onSuccess(result);
      else await softLoad();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const handleUploadContract = async () => {
    if (!contractFile) { toast({ title: "请选择合同文件", variant: "destructive" }); return; }
    setUploadingContract(true);
    try {
      const url = await uploadFile(contractFile);
      const result = await v2Post<{ order: OutsourceOrder; contract: ContractDetail }>(`/outsource-orders/${id}/upload-signed-contract`, { signedFileUrl: url });
      toast({ title: "合同已上传，已通知OPC确认" });
      setShowUploadContract(false);
      setContractFile(null);
      setOrder(result.order);
      setContract(result.contract);
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setUploadingContract(false);
    }
  };

  const handleAdminVerify = async () => {
    await act(
      () => v2Post<OutsourceOrder>(`/outsource-orders/${id}/admin-verify`, { note: verifyNote.trim() || undefined }),
      "运营验收完成，订单进入质保中",
      (updated) => { setOrder(updated); }
    );
    setShowVerifyModal(false);
    setVerifyNote("");
  };

  const handleApproveDeliverable = (delivId: number) => act(
    () => v2Post<DeliverableB>(`/deliverables-b/${delivId}/approve`, {}),
    "交付已确认",
    (updated) => setDeliverables(prev => prev.map(d => d.id === delivId ? { ...d, ...updated } : d))
  );

  const handleRejectDeliverable = (delivId: number) => act(
    () => v2Post<DeliverableB>(`/deliverables-b/${delivId}/reject`, { reason: "运营驳回，请重新提交" }),
    "交付已驳回",
    (updated) => setDeliverables(prev => prev.map(d => d.id === delivId ? { ...d, ...updated } : d))
  );

  /* ── 合同操作 ── */
  const handleCreateContract = async () => {
    setContractActing(true);
    try {
      const created = await v2Post<ContractDetail>("/contracts", { channel: "b", outsourceOrderId: id, content: "" });
      toast({ title: "合同草稿已创建" });
      setContract(created);
      setEditingContract(true);
      setContractEditContent("");
    } catch (err: any) {
      toast({ title: "创建失败", description: err.message, variant: "destructive" });
    } finally {
      setContractActing(false);
    }
  };

  const handleSaveContractContent = async () => {
    if (!contract) return;
    setContractActing(true);
    try {
      const updated = await v2Patch<ContractDetail>(`/contracts/${contract.id}/content`, { content: contractEditContent });
      toast({ title: "合同内容已保存" });
      setContract(updated);
      setEditingContract(false);
    } catch (err: any) {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    } finally {
      setContractActing(false);
    }
  };

  const handleFinalizeContract = async () => {
    if (!contract) return;
    if (settlements.length === 0) {
      toast({ title: "请先添加付款计划", description: "发送合同前须至少设置一条结算付款项", variant: "destructive" });
      return;
    }
    setContractActing(true);
    try {
      const updated = await v2Post<ContractDetail>(`/contracts/${contract.id}/finalize`, {});
      toast({ title: "合同已定稿，已通知OPC确认" });
      setContract(updated);
    } catch (err: any) {
      toast({ title: "定稿失败", description: err.message, variant: "destructive" });
    } finally {
      setContractActing(false);
    }
  };

  /* ── 结算计划操作 ── */
  const handleAddSettlement = async () => {
    if (!addSettleForm.amount || parseFloat(addSettleForm.amount) <= 0) {
      toast({ title: "请填写有效金额", variant: "destructive" }); return;
    }
    if (!addSettleForm.dueDate) {
      toast({ title: "请选择应付日期", variant: "destructive" }); return;
    }
    setSettleActing(true);
    try {
      await v2Post("/settlement-plans", {
        outsourceOrderId: id,
        description: addSettleForm.description.trim() || undefined,
        amount: parseFloat(addSettleForm.amount),
        dueDate: addSettleForm.dueDate,
        isLastItem: addSettleForm.isLastItem,
      });
      toast({ title: "结算付款项已创建" });
      setShowAddSettlement(false);
      setAddSettleForm({ description: "", amount: "", dueDate: "", isLastItem: false });
      await softReloadSettlements();
    } catch (err: any) {
      toast({ title: "创建失败", description: err.message, variant: "destructive" });
    } finally {
      setSettleActing(false);
    }
  };

  const handleSaveSettlement = async (planId: number) => {
    if (!editSettleForm.amount || parseFloat(editSettleForm.amount) <= 0) {
      toast({ title: "请填写有效金额", variant: "destructive" }); return;
    }
    setSettleActing(true);
    try {
      const updated = await v2Patch<SettlementPlan>(`/settlement-plans/${planId}`, {
        description: editSettleForm.description.trim() || undefined,
        amount: parseFloat(editSettleForm.amount),
        dueDate: editSettleForm.dueDate || undefined,
        isLastItem: editSettleForm.isLastItem,
      });
      toast({ title: "结算计划已更新" });
      setEditSettleId(null);
      setSettlements(prev => prev.map(s => s.id === planId ? { ...s, ...updated } : s));
    } catch (err: any) {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    } finally {
      setSettleActing(false);
    }
  };

  const handleDeleteSettlement = async (planId: number) => {
    if (!window.confirm("确定删除该结算付款项？")) return;
    setSettleActing(true);
    try {
      await v2Delete(`/settlement-plans/${planId}`);
      toast({ title: "结算计划已删除" });
      setSettlements(prev => prev.filter(s => s.id !== planId));
    } catch (err: any) {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    } finally {
      setSettleActing(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!ticketTitle.trim()) { toast({ title: "请填写工单标题", variant: "destructive" }); return; }
    await act(async () => {
      const uploadedAttachments: Array<{ name: string; url: string }> = [];
      for (const f of ticketFiles) {
        const url = await uploadFile(f);
        uploadedAttachments.push({ name: f.name, url });
      }
      await v2Post("/tickets-b", {
        outsourceOrderId: id, title: ticketTitle.trim(),
        description: ticketDesc.trim() || null,
        attachments: uploadedAttachments,
      });
      setShowTicketModal(false);
      setTicketTitle(""); setTicketDesc(""); setTicketFiles([]);
    }, "工单已创建，已通知OPC");
  };

  if (loading) return (
    <AdminV2Layout backHref="/admin/v2/outsource-orders" backLabel="接单订单">
      <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>
    </AdminV2Layout>
  );
  if (!order) return (
    <AdminV2Layout backHref="/admin/v2/outsource-orders" backLabel="接单订单">
      <div className="text-center py-16 text-slate-400">订单不存在</div>
    </AdminV2Layout>
  );

  const cfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-slate-100 text-slate-500", icon: null };
  const canUploadContract   = order.status === "pending_contract" && !!contract?.opcConfirmedAt;
  const canApproveDeliv     = order.status === "executing";
  const canAdminVerify      = order.status === "executing";
  const opcConfirmed        = !!contract?.opcConfirmedAt;
  const canCreateSettlement = order.status !== "cancelled" && !opcConfirmed;
  const canCreateTicket     = order.status === "warranty";
  const openTickets         = tickets.filter(t => t.status === "open");
  const stageIdx = ORDER_STAGE_KEYS.indexOf(order.status as typeof ORDER_STAGE_KEYS[number]);

  const visibleTabs = [
    { key: "demand"   as const, label: "需求详情", icon: FileText,  badge: null as number | null, show: true },
    { key: "contract" as const, label: "合同",     icon: FileSignature, badge: null, show: true },
    { key: "delivery" as const, label: "交付",     icon: Package,
      badge: deliverables.length > 0 ? deliverables.length : null,
      show: ["executing", "warranty", "completed"].includes(order.status) },
    { key: "ticket"   as const, label: "工单",     icon: Wrench,
      badge: openTickets.length > 0 ? openTickets.length : null,
      show: ["warranty", "completed"].includes(order.status) },
  ].filter(t => t.show);

  return (
    <AdminV2Layout
      backHref="/admin/v2/outsource-orders"
      backLabel="接单订单"
    >
      <div className="mt-6 space-y-4">

        {/* ── 基本信息卡 ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
                {cfg.icon} {cfg.label}
              </span>
              <span className="text-xs font-mono text-slate-400">{order.orderNo}</span>
              {canAdminVerify && (
                <button
                  onClick={() => setShowVerifyModal(true)}
                  disabled={acting}
                  className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle2 size={13} /> 验收通过
                </button>
              )}
            </div>
            <h2 className="text-base font-extrabold text-slate-800 mb-3">
              {order.demandTitle ?? `外包需求 #${order.outsourceDemandId}`}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">服务商</p>
                <p className="font-semibold text-slate-700">{order.opcNickname ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">关联外包需求</p>
                <p className="font-semibold text-slate-700 truncate">{order.demandTitle ?? `需求 #${order.outsourceDemandId}`}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">创建时间</p>
                <p className="font-semibold text-slate-700">{new Date(order.createdAt).toLocaleDateString("zh-CN")}</p>
              </div>
              {tender?.totalPrice != null && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">OPC 报价</p>
                  <p className="font-bold text-primary">¥{tender.totalPrice.toLocaleString()}</p>
                </div>
              )}
              {settlements.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">结算进度</p>
                  <p className="font-semibold text-slate-700">
                    {settlements.filter(s => s.status === "paid").length}/{settlements.length} 期已付
                    <span className="ml-1 text-slate-400">
                      ¥{settlements.filter(s => s.status === "paid").reduce((acc, s) => acc + s.amount, 0).toLocaleString()}
                      / ¥{settlements.reduce((acc, s) => acc + s.amount, 0).toLocaleString()}
                    </span>
                  </p>
                </div>
              )}
              {order.warrantyEndDate && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">质保截止</p>
                  <p className="font-semibold text-slate-700">{new Date(order.warrantyEndDate).toLocaleDateString("zh-CN")}</p>
                </div>
              )}
              {order.cancelledReason && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">取消原因</p>
                  <p className="font-semibold text-red-600">{order.cancelledReason}</p>
                </div>
              )}
            </div>
            {/* 状态轴 */}
            {order.status !== "cancelled" && stageIdx >= 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center">
                  {ORDER_STAGE_KEYS.map((k, i) => (
                    <div key={k} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center">
                        <div className={`w-2.5 h-2.5 rounded-full transition-all ${
                          i < stageIdx ? "bg-primary" : i === stageIdx ? "bg-primary ring-4 ring-primary/15" : "bg-slate-200"
                        }`} />
                        <span className={`text-[9px] mt-1 leading-none font-medium whitespace-nowrap ${
                          i === stageIdx ? "text-primary font-bold" : i < stageIdx ? "text-slate-400" : "text-slate-300"
                        }`}>
                          {ORDER_STAGE_LABELS[k]}
                        </span>
                      </div>
                      {i < ORDER_STAGE_KEYS.length - 1 && (
                        <div className={`flex-1 h-px mx-1 mb-3 ${i < stageIdx ? "bg-primary/40" : "bg-slate-200"}`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {order.cancelledReason && (
              <div className="mt-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-bold text-slate-500">取消原因</p>
                <p className="text-sm text-slate-600 mt-0.5">{order.cancelledReason}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Tab 栏（只有多个 tab 时才显示） ── */}
        {visibleTabs.length > 1 && (
        <div className="flex gap-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-1">
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-xl transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
              {tab.badge != null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? "bg-white/20" : "bg-slate-100 text-slate-600"
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        )}

        {/* ══ 需求详情 Tab ══ */}
        {activeTab === "demand" && (
          <div className="space-y-4">
            {!demand ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 size={16} className="animate-spin mr-2" /> 加载中…
              </div>
            ) : (
              <>
                <Section title="需求说明" icon={FileText}>
                  {demand.latestVersion?.detail ? (
                    <div className="prose prose-sm max-w-none">
                      <MarkdownContent content={demand.latestVersion.detail} />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">暂无需求描述</p>
                  )}
                </Section>

                <Section title={`里程碑${demand.milestones?.length ? `（${demand.milestones.length}）` : ""}`} icon={Flag}>
                  {demand.milestones && demand.milestones.length > 0 ? (
                    <div className="space-y-1">
                      {demand.milestones.map((m, i) => (
                        <div key={i} className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
                          <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700">{m.name}</p>
                            {m.deadline && (
                              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Calendar size={10} />
                                截止 {new Date(m.deadline).toLocaleDateString("zh-CN")}
                              </p>
                            )}
                            {m.description && (
                              <p className="text-xs text-slate-500 mt-1">{m.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">暂无里程碑</p>
                  )}
                </Section>

                {demand.latestVersion?.attachments && demand.latestVersion.attachments.length > 0 && (
                  <Section title="附件" icon={Paperclip}>
                    <div className="space-y-2">
                      {demand.latestVersion.attachments.map((att, i) => (
                        <a key={i} href={att.url} target="_blank" rel="noreferrer"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/40 transition-colors group">
                          <Paperclip size={13} className="text-slate-400 shrink-0 group-hover:text-blue-500" />
                          <span className="text-sm text-slate-700 truncate flex-1">{att.name}</span>
                          <ExternalLink size={12} className="text-slate-400 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ 合同 Tab ══ */}
        {activeTab === "contract" && (
          <div className="space-y-4">

            {/* 合同区 */}
            {(() => {
              const CONTRACT_STATUS_MAP: Record<string, { label: string; color: string }> = {
                draft:                    { label: "草稿",       color: "bg-slate-100 text-slate-500" },
                pending_publisher_confirm:{ label: "待OPC确认",  color: "bg-amber-100 text-amber-700" },
                publisher_rejected:       { label: "OPC已驳回",  color: "bg-red-100 text-red-600" },
                pending_sign:             { label: "待签约",     color: "bg-orange-100 text-orange-700" },
                signed:                   { label: "已签约",     color: "bg-green-100 text-green-700" },
              };
              const cs = contract ? (CONTRACT_STATUS_MAP[contract.status] ?? { label: contract.status, color: "bg-slate-100 text-slate-500" }) : null;
              const canEditContent = !!contract && ["draft", "pending_contract"].includes(order.status) && !opcConfirmed;
              return (
                <Section
                  title="合同"
                  icon={FileSignature}
                  collapsible={false}
                  actions={
                    <div className="flex items-center gap-2">
                      {!contract && (
                        <button onClick={handleCreateContract} disabled={contractActing}
                          className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50">
                          <Plus size={12} /> 创建合同
                        </button>
                      )}
                      {canEditContent && !editingContract && (
                        <button
                          onClick={() => { setContractEditContent(contract.content ?? ""); setEditingContract(true); }}
                          className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <Edit2 size={11} /> 编辑内容
                        </button>
                      )}
                      {contract && ["draft", "publisher_rejected"].includes(contract.status) && !editingContract && (
                        <button
                          onClick={handleFinalizeContract}
                          disabled={contractActing}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
                          <Send size={11} /> 发送给OPC确认
                        </button>
                      )}
                      {canUploadContract && (
                        <button onClick={() => setShowUploadContract(true)}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                          <Upload size={11} /> 上传合同文件
                        </button>
                      )}
                    </div>
                  }
                >
                  <div className="mt-3 space-y-3">

                    {/* 内联编辑器 */}
                    {editingContract ? (
                      <div className="space-y-3">
                        <MarkdownEditor
                          key={`contract-edit-${contract?.id}`}
                          value={contractEditContent}
                          onChange={setContractEditContent}
                          placeholder="填写合同正文，支持 Markdown…"
                        />
                        <div className="flex gap-2">
                          <button onClick={handleSaveContractContent} disabled={contractActing}
                            className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 hover:bg-primary/90">
                            {contractActing ? "保存中…" : "保存"}
                          </button>
                          <button onClick={() => setEditingContract(false)}
                            className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* 待签约状态提示 */}
                        {order.status === "pending_contract" && contract && !contract.opcConfirmedAt && (
                          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
                            <Clock size={15} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm font-bold text-amber-800">等待 OPC 查阅合同内容并确认</p>
                          </div>
                        )}
                        {order.status === "pending_contract" && contract?.opcConfirmedAt && !contract.signedFileUrl && (
                          <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 rounded-xl border border-blue-200">
                            <CheckCircle2 size={15} className="text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-sm font-bold text-blue-800">OPC 已确认合同内容，请安排线下 / 电子签约后上传已签合同文件</p>
                          </div>
                        )}
                        {contract?.status === "pending_publisher_confirm" && (
                          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
                            <Clock size={15} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm font-bold text-amber-800">合同已定稿，等待 OPC 确认</p>
                          </div>
                        )}
                        {/* 合同正文 Markdown */}
                        {contract?.content ? (
                          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 max-h-72 overflow-y-auto prose prose-sm max-w-none">
                            <MarkdownContent content={contract.content} />
                          </div>
                        ) : contract ? (
                          <p className="text-sm text-slate-400">合同正文尚未填写，点击「编辑内容」填写。</p>
                        ) : (
                          <div className="text-center py-8 text-slate-400">
                            <FileText size={24} className="mx-auto mb-2 text-slate-300" />
                            <p className="text-sm">暂无合同</p>
                            <button onClick={handleCreateContract} disabled={contractActing}
                              className="mt-2 text-xs text-primary hover:underline disabled:opacity-50">
                              点击创建合同草稿
                            </button>
                          </div>
                        )}
                        {/* 已签约合同文件下载 */}
                        {order.signedFileUrl && (
                          <a href={order.signedFileUrl} target="_blank" rel="noreferrer"
                            className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 hover:bg-green-100 transition-colors group">
                            <div className="w-8 h-8 rounded-lg bg-green-100 group-hover:bg-green-200 transition-colors flex items-center justify-center shrink-0">
                              <FileSignature size={15} className="text-green-700" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-green-700">已签约合同文件</p>
                              <p className="text-xs text-green-600">点击下载</p>
                            </div>
                            <ExternalLink size={14} className="text-green-500 shrink-0" />
                          </a>
                        )}
                      </>
                    )}
                  </div>
                </Section>
              );
            })()}

            {/* 结算付款计划 */}
            <Section
              title={`结算付款计划（${settlements.length} 项）`}
              icon={DollarSign}
              collapsible={false}
              actions={canCreateSettlement ? (
                <button
                  onClick={() => { setShowAddSettlement(v => !v); setEditSettleId(null); }}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Plus size={12} /> 添加
                </button>
              ) : undefined}
            >
              <div className="mt-3 space-y-2">
                {/* 内联添加表单 */}
                {showAddSettlement && (
                  <div className="border border-amber-300 rounded-xl p-3 bg-amber-50/50 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="描述（可选）"
                        value={addSettleForm.description}
                        onChange={e => setAddSettleForm(f => ({ ...f, description: e.target.value }))}
                        className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="金额（元）*"
                        value={addSettleForm.amount}
                        onChange={e => setAddSettleForm(f => ({ ...f, amount: e.target.value }))}
                        className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <input
                        type="date"
                        value={addSettleForm.dueDate}
                        onChange={e => setAddSettleForm(f => ({ ...f, dueDate: e.target.value }))}
                        className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input type="checkbox" checked={addSettleForm.isLastItem} onChange={e => setAddSettleForm(f => ({ ...f, isLastItem: e.target.checked }))} />
                      尾款（触发阻断工单检查）
                    </label>
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleAddSettlement} disabled={settleActing}
                        className="bg-primary text-white rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                        {settleActing ? "提交中…" : "确认添加"}
                      </button>
                      <button onClick={() => setShowAddSettlement(false)}
                        className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">取消</button>
                    </div>
                  </div>
                )}

                {settlements.length === 0 && !showAddSettlement && (
                  <p className="text-sm text-slate-400 py-2">尚未创建结算计划</p>
                )}

                {settlements.map(s => (
                  <div key={s.id}>
                    {editSettleId === s.id ? (
                      /* 内联编辑表单 */
                      <div className="border border-amber-300 rounded-xl p-3 bg-amber-50/50 space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="描述（可选）"
                            value={editSettleForm.description}
                            onChange={e => setEditSettleForm(f => ({ ...f, description: e.target.value }))}
                            className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            placeholder="金额（元）*"
                            value={editSettleForm.amount}
                            onChange={e => setEditSettleForm(f => ({ ...f, amount: e.target.value }))}
                            className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                          <input
                            type="date"
                            value={editSettleForm.dueDate}
                            onChange={e => setEditSettleForm(f => ({ ...f, dueDate: e.target.value }))}
                            className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                          <input type="checkbox" checked={editSettleForm.isLastItem} onChange={e => setEditSettleForm(f => ({ ...f, isLastItem: e.target.checked }))} />
                          尾款（触发阻断工单检查）
                        </label>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => handleSaveSettlement(s.id)} disabled={settleActing}
                            className="bg-primary text-white rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                            {settleActing ? "保存中…" : "保存"}
                          </button>
                          <button onClick={() => setEditSettleId(null)}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">取消</button>
                        </div>
                      </div>
                    ) : (
                      /* 展示行 */
                      (() => {
                        const contractSigned = !!(contract?.signedAt);
                        const goPayment = () => inlineNav ? inlineNav.push(`/admin/v2/payments-b/${s.id}`) : navigate(`/admin/v2/payments-b/${s.id}`);
                        return (
                          <div
                            onClick={contractSigned ? goPayment : undefined}
                            className={`border rounded-xl p-3 transition-colors ${
                              contractSigned ? "cursor-pointer hover:border-primary/40 hover:shadow-sm" : "cursor-default"
                            } ${
                              s.isOverdue && s.status !== "paid" && contractSigned ? "border-red-300 bg-red-50/30" : "border-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  {contractSigned ? (
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                      s.status === "paid" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                                    }`}>{s.status === "paid" ? "已付款" : "待付款"}</span>
                                  ) : (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">待签约</span>
                                  )}
                                  {contractSigned && s.isOverdue && s.status !== "paid" && (
                                    <span className="text-xs font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">逾期</span>
                                  )}
                                  <span className="text-xs text-slate-400">第 {s.itemNo ?? 1} 期</span>
                                  {s.isLastItem && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">尾款</span>}

                                </div>
                                {s.description && <p className="text-xs text-slate-500 mt-0.5">{s.description}</p>}
                              </div>
                              <div className="text-right flex-shrink-0 ml-3">
                                <p className="font-black text-slate-800">¥{s.amount.toLocaleString()}</p>
                                {s.dueDate && <p className="text-xs text-slate-400">{new Date(s.dueDate).toLocaleDateString("zh-CN")}</p>}
                                {s.status === "pending" && !opcConfirmed && (
                                  <div className="flex items-center gap-2 justify-end mt-1" onClick={e => e.stopPropagation()}>
                                    <button
                                      onClick={() => {
                                        setEditSettleId(s.id);
                                        setShowAddSettlement(false);
                                        setEditSettleForm({
                                          description: s.description ?? "",
                                          amount: String(s.amount),
                                          dueDate: s.dueDate ? s.dueDate.slice(0, 10) : "",
                                          isLastItem: s.isLastItem,
                                        });
                                      }}
                                      className="text-xs text-primary hover:underline"
                                    >编辑</button>
                                    <button
                                      onClick={() => handleDeleteSettlement(s.id)}
                                      disabled={settleActing}
                                      className="text-xs text-red-500 hover:underline disabled:opacity-50"
                                    >删除</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                ))}
              </div>
            </Section>

            {/* OPC 报价信息 */}
            {tender && tender.totalPrice != null && (
              <Section title="OPC 报价" icon={DollarSign} collapsible={false}>
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-primary">¥{tender.totalPrice.toLocaleString()}</span>
                    {tender.quotedAt && (
                      <span className="text-xs text-slate-400">
                        {new Date(tender.quotedAt).toLocaleDateString("zh-CN")} 报价
                      </span>
                    )}
                  </div>
                  {Array.isArray(tender.priceBreakdown) && tender.priceBreakdown.length > 0 && (
                    <BreakdownDisplay bd={tender.priceBreakdown} totalPrice={tender.totalPrice} />
                  )}
                </div>
              </Section>
            )}

          </div>
        )}

        {/* ══ 交付 Tab ══ */}
        {activeTab === "delivery" && (
          <div className="space-y-3">
            {deliverables.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <Package size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">暂无交付记录</p>
              </div>
            ) : deliverables.map(d => {
              const ds = { pending: ["待审核", "bg-amber-100 text-amber-700"], approved: ["已通过", "bg-green-100 text-green-700"], revision: ["需修改", "bg-red-100 text-red-600"] }[d.status] ?? [d.status, "bg-slate-100 text-slate-500"];
              const isExpanded = expandedDelivId === d.id;
              return (
                <div key={d.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <button
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                    onClick={() => setExpandedDelivId(isExpanded ? null : d.id)}
                  >
                    <CheckCircle2 size={15} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{d.title}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(d.createdAt).toLocaleDateString("zh-CN")}
                        {d.createdByNickname && ` · ${d.createdByNickname}`}
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${ds[1]}`}>{ds[0]}</span>
                    {canApproveDeliv && d.status === "pending" && (
                      <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleApproveDeliverable(d.id)} disabled={acting}
                          className="text-xs bg-green-600 text-white rounded-lg px-2.5 py-1 hover:bg-green-700 disabled:opacity-50">
                          通过
                        </button>
                        <button onClick={() => handleRejectDeliverable(d.id)} disabled={acting}
                          className="text-xs border border-red-200 text-red-500 rounded-lg px-2.5 py-1 hover:bg-red-50 disabled:opacity-50">
                          驳回
                        </button>
                      </div>
                    )}
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
                      {d.attachments && d.attachments.length > 0 && (
                        <div className={d.content ? "" : "pt-4"}>
                          <p className="text-xs font-bold text-slate-500 mb-2">附件</p>
                          <div className="flex flex-wrap gap-2">
                            {d.attachments.map((att, i) => (
                              <a key={i} href={att.url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors">
                                <Paperclip size={11} /> {att.name || `附件${i + 1}`}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-bold text-slate-500 mb-3">交付讨论</p>
                        <DiscussionThread
                          parentType="deliverable_b"
                          parentId={d.id}
                          placeholder="与OPC沟通此交付物…"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ 工单 Tab ══ */}
        {activeTab === "ticket" && (
          <div className="space-y-3">
            {canCreateTicket && (
              <button onClick={() => setShowTicketModal(true)}
                className="w-full flex items-center gap-2 justify-center border-2 border-dashed border-primary/30 text-primary rounded-2xl py-3 text-sm font-bold hover:border-primary hover:bg-primary/5 transition-colors">
                <Wrench size={15} /> 向OPC发工单
              </button>
            )}
            {tickets.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <Wrench size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">暂无工单</p>
              </div>
            ) : tickets.map(t => {
              const isExpanded = expandedTicketId === t.id;
              return (
                <div key={t.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}>
                    <Wrench size={15} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{t.title}</p>
                      <p className="text-xs text-slate-400">
                        #{t.id} · {new Date(t.createdAt).toLocaleDateString("zh-CN")}
                        {t.createdByNickname && ` · ${t.createdByNickname}`}
                      </p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      t.status === "open" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {t.status === "open" ? "开放中" : "已关闭"}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); inlineNav ? inlineNav.push(`/admin/v2/tickets-b/${t.id}`) : navigate(`/admin/v2/tickets-b/${t.id}`); }}
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
                      {t.attachments && t.attachments.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-2">附件</p>
                          <ul className="space-y-1.5">
                            {t.attachments.map((att, i) => (
                              <li key={i}>
                                <a href={att.url} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                                  📎 {att.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-bold text-slate-500 mb-3">工单讨论</p>
                        <DiscussionThread
                          parentType="ticket_b"
                          parentId={t.id}
                          placeholder="与OPC沟通此工单…"
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

      {/* ── 上传合同 Modal ── */}
      {showUploadContract && (
        <Modal title="上传合同文件" onClose={() => setShowUploadContract(false)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">上传后将通知OPC确认签署。</p>
            <FilePickerZone
              variant="zone"
              file={contractFile}
              onChange={setContractFile}
              onClear={() => setContractFile(null)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.md,.jpg,.jpeg,.png"
              hint="支持 PDF、Word、Excel、图片、Markdown"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowUploadContract(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleUploadContract} disabled={uploadingContract || !contractFile}
                className="px-4 py-2 text-sm bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50">
                {uploadingContract ? "上传中…" : "上传合同"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 运营验收 Modal ── */}
      {showVerifyModal && (
        <Modal title="运营验收确认" onClose={() => setShowVerifyModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">确认运营验收后，订单将进入质保期，并通知 OPC。</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowVerifyModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleAdminVerify} disabled={acting}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50">
                {acting ? "处理中…" : "确认验收"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 向OPC发工单 Modal ── */}
      {showTicketModal && (
        <Modal title="向OPC发工单" onClose={() => setShowTicketModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">工单标题</label>
              <input value={ticketTitle} onChange={e => setTicketTitle(e.target.value)} placeholder="工单主题"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">描述（可选）</label>
              <textarea value={ticketDesc} onChange={e => setTicketDesc(e.target.value)} rows={3}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">附件（可选，支持图片/文档）</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
                <input type="file" multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.zip,.txt,.md"
                  onChange={e => setTicketFiles(Array.from(e.target.files ?? []))}
                  className="w-full text-sm text-slate-600" />
                {ticketFiles.length > 0 && (
                  <ul className="mt-2 text-left space-y-1">
                    {ticketFiles.map((f, i) => (
                      <li key={i} className="text-xs text-slate-500 truncate">📎 {f.name}</li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-[11px] text-amber-600 mt-1">⚠ 此工单创建后将自动阻断尾款支付，直至关闭</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowTicketModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleCreateTicket} disabled={acting}
                className="px-4 py-2 text-sm bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50">
                {acting ? "创建中…" : "发送工单"}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </AdminV2Layout>
  );
}
