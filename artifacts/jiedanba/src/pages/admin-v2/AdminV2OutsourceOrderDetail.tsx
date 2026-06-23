import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import {
  Loader2, X, Upload, CheckCircle2, Clock, ExternalLink, PlusCircle, Wrench,
  FileSignature, Package, Shield, XCircle, CreditCard, ChevronDown, ChevronUp,
  Lock, Paperclip,
} from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post, v2Patch, uploadFile } from "@/lib/v2api";
import { markRead } from "@/lib/demandRead";
import { MarkdownContent } from "@/components/MarkdownContent";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { useToast } from "@/hooks/use-toast";

interface OutsourceOrder {
  id: number;
  orderNo: string;
  outsourceDemandId: number;
  demandTitle: string | null;
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

interface ContractDetail {
  id: number;
  contractNo: string;
  status: string;
  content: string | null;
  signedFileUrl: string | null;
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
  status: string;
  isBlockingPayment: boolean | null;
  createdByNickname: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_contract: { label: "待签约", color: "bg-amber-100 text-amber-700",   icon: <FileSignature size={13} /> },
  executing:        { label: "执行中", color: "bg-blue-100 text-blue-700",     icon: <Package size={13} /> },
  warranty:         { label: "质保中", color: "bg-violet-100 text-violet-700", icon: <Shield size={13} /> },
  completed:        { label: "已完成", color: "bg-green-100 text-green-700",   icon: <CheckCircle2 size={13} /> },
  cancelled:        { label: "已取消", color: "bg-slate-100 text-slate-500",   icon: <XCircle size={13} /> },
};
const ORDER_STAGE_KEYS = ["pending_contract", "executing", "warranty", "completed"] as const;
const ORDER_STAGE_LABELS: Record<string, string> = {
  pending_contract: "待签约", executing: "执行中", warranty: "质保期", completed: "已完成",
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
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [settlements, setSettlements] = useState<SettlementPlan[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableB[]>([]);
  const [tickets, setTickets] = useState<TicketB[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const [activeTab, setActiveTab] = useState<"contract" | "delivery" | "ticket">("contract");

  /* Accordion */
  const [expandedDelivId, setExpandedDelivId] = useState<number | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null);

  /* Modals */
  const [showUploadContract, setShowUploadContract] = useState(false);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [uploadingContract, setUploadingContract] = useState(false);

  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settleTitle, setSettleTitle] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDueDate, setSettleDueDate] = useState("");
  const [settleIsLast, setSettleIsLast] = useState(false);

  const [editingPlan, setEditingPlan] = useState<SettlementPlan | null>(null);
  const [editPlanDesc, setEditPlanDesc] = useState("");
  const [editPlanAmount, setEditPlanAmount] = useState("");
  const [editPlanDueDate, setEditPlanDueDate] = useState("");
  const [editPlanIsLast, setEditPlanIsLast] = useState(false);

  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketBlocking, setTicketBlocking] = useState(false);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyNote, setVerifyNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<OutsourceOrder>(`/outsource-orders/${id}`);
      setOrder(d);
      markRead("order", id);
      const contractList = await v2Get<ContractDetail[]>(`/contracts?outsourceOrderId=${id}`);
      setContract(Array.isArray(contractList) && contractList.length > 0 ? contractList[0] : null);
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

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setActing(true);
    try {
      await fn();
      toast({ title: msg });
      await load();
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
      await v2Post(`/outsource-orders/${id}/upload-signed-contract`, { signedFileUrl: url });
      toast({ title: "合同已上传，已通知OPC确认" });
      setShowUploadContract(false);
      setContractFile(null);
      await load();
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setUploadingContract(false);
    }
  };

  const handleAdminVerify = async () => {
    await act(
      () => v2Post(`/outsource-orders/${id}/admin-verify`, { note: verifyNote.trim() || undefined }),
      "运营验收完成，订单进入质保中"
    );
    setShowVerifyModal(false);
    setVerifyNote("");
  };

  const handleApproveDeliverable = (delivId: number) => act(
    () => v2Post(`/deliverables-b/${delivId}/approve`, {}),
    "交付已确认"
  );

  const handleRejectDeliverable = (delivId: number) => act(
    () => v2Post(`/deliverables-b/${delivId}/reject`, { reason: "运营驳回，请重新提交" }),
    "交付已驳回"
  );

  const handleCreateSettlement = async () => {
    if (!settleAmount || parseFloat(settleAmount) <= 0) {
      toast({ title: "请填写有效金额", variant: "destructive" }); return;
    }
    if (!settleDueDate) {
      toast({ title: "请选择应付日期", variant: "destructive" }); return;
    }
    await act(async () => {
      await v2Post("/settlement-plans", {
        outsourceOrderId: id,
        description: settleTitle.trim() || undefined,
        amount: parseFloat(settleAmount),
        dueDate: settleDueDate,
        itemNo: settlements.length + 1,
        isLastItem: settleIsLast,
      });
      setShowSettlementModal(false);
      setSettleTitle(""); setSettleAmount(""); setSettleDueDate(""); setSettleIsLast(false);
    }, "结算付款项已创建");
  };

  const handleEditSettlement = async () => {
    if (!editingPlan) return;
    if (!editPlanAmount || parseFloat(editPlanAmount) <= 0) {
      toast({ title: "请填写有效金额", variant: "destructive" }); return;
    }
    await act(async () => {
      await v2Patch(`/settlement-plans/${editingPlan.id}`, {
        description: editPlanDesc.trim() || undefined,
        amount: parseFloat(editPlanAmount),
        dueDate: editPlanDueDate || undefined,
        isLastItem: editPlanIsLast,
      });
      setEditingPlan(null);
    }, "结算计划已更新");
  };

  const openEditPlan = (s: SettlementPlan) => {
    setEditingPlan(s);
    setEditPlanDesc(s.description ?? "");
    setEditPlanAmount(String(s.amount));
    setEditPlanDueDate(s.dueDate ? s.dueDate.slice(0, 10) : "");
    setEditPlanIsLast(s.isLastItem);
  };

  const handleCreateTicket = async () => {
    if (!ticketTitle.trim()) { toast({ title: "请填写工单标题", variant: "destructive" }); return; }
    await act(async () => {
      await v2Post("/tickets-b", {
        outsourceOrderId: id, title: ticketTitle.trim(),
        description: ticketDesc.trim() || null, isBlockingPayment: ticketBlocking,
      });
      setShowTicketModal(false);
      setTicketTitle(""); setTicketDesc(""); setTicketBlocking(false);
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
  const canUploadContract   = order.status === "pending_contract";
  const canApproveDeliv     = order.status === "executing";
  const canAdminVerify      = order.status === "executing";
  const canCreateSettlement = ["executing", "warranty", "completed"].includes(order.status);
  const canCreateTicket     = order.status === "warranty";
  const openTickets         = tickets.filter(t => t.status === "open");
  const stageIdx = ORDER_STAGE_KEYS.indexOf(order.status as typeof ORDER_STAGE_KEYS[number]);

  const visibleTabs = [
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
    <AdminV2Layout
      title={order.orderNo}
      backHref="/admin/v2/outsource-orders"
      backLabel="接单订单"
      actions={
        <div className="flex gap-2">
          {canUploadContract && (
            <button onClick={() => setShowUploadContract(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">
              <Upload size={13} /> 上传合同
            </button>
          )}
          {canAdminVerify && (
            <button onClick={() => setShowVerifyModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors">
              <CheckCircle2 size={13} /> 运营验收
            </button>
          )}
        </div>
      }
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
            </div>
            <h2 className="text-base font-extrabold text-slate-800 mb-3">
              {order.demandTitle ?? `外包需求 #${order.outsourceDemandId}`}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">服务商</p>
                <p className="font-semibold text-slate-700">{order.opcNickname ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">创建时间</p>
                <p className="font-semibold text-slate-700">{new Date(order.createdAt).toLocaleDateString("zh-CN")}</p>
              </div>
              {order.warrantyEndDate && (
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">质保截止</p>
                  <p className="font-semibold text-slate-700">{new Date(order.warrantyEndDate).toLocaleDateString("zh-CN")}</p>
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

        {/* ══ 合同 Tab ══ */}
        {activeTab === "contract" && (
          <div className="space-y-4">

            <CardSection title="合同" icon={FileSignature}>
              {/* 待签约：上传操作区 */}
              {order.status === "pending_contract" && (
                order.signedFileUrl ? (
                  <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
                    <Clock size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">合同已上传，等待 OPC 确认签署</p>
                      <a href={order.signedFileUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900 mt-1 underline underline-offset-2">
                        <ExternalLink size={11} /> 查看已上传合同
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                    <FileSignature size={15} className="text-slate-400 shrink-0" />
                    <p className="text-sm text-slate-500 flex-1">尚未上传合同文件</p>
                    <button onClick={() => setShowUploadContract(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shrink-0">
                      <Upload size={12} /> 上传合同
                    </button>
                  </div>
                )
              )}

              {/* 已签约：合同文件下载 */}
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

              {/* 合同正文 Markdown */}
              {contract?.content ? (
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">合同正文</p>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 prose prose-sm max-w-none">
                    <MarkdownContent content={contract.content} />
                  </div>
                  {contract.contractNo && (
                    <p className="text-xs text-slate-400 mt-2">合同编号：{contract.contractNo}</p>
                  )}
                </div>
              ) : (
                !order.signedFileUrl && order.status === "pending_contract" && (
                  <p className="text-sm text-slate-400">暂无合同正文</p>
                )
              )}
            </CardSection>

            {/* 结算付款计划 */}
            <CardSection
              title="结算付款计划"
              icon={CreditCard}
              badge={
                <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
                  {settlements.length} 项
                </span>
              }
              actions={
                canCreateSettlement ? (
                  <button onClick={() => setShowSettlementModal(true)}
                    className="flex items-center gap-1 text-xs text-primary font-bold hover:text-primary/80 transition-colors">
                    <PlusCircle size={13} /> 新增
                  </button>
                ) : undefined
              }
            >
              {settlements.length === 0 ? (
                <p className="text-sm text-slate-400">尚未创建结算计划</p>
              ) : (
                <div className="space-y-2 -mx-1">
                  {settlements.map(s => {
                    const isPaid = s.status === "paid";
                    return (
                      <div key={s.id} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                        s.isOverdue && !isPaid ? "border-red-200 bg-red-50/30" : "border-slate-100 bg-white"
                      }`}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isPaid ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                            }`}>{isPaid ? "已付款" : "待付款"}</span>
                            {s.isLastItem && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">尾款</span>}
                            {s.isBlockingPayment && !isPaid && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded flex items-center gap-0.5">
                                <Lock size={9} /> 阻款
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-slate-700">
                            {s.description ?? `第${s.itemNo ?? 1}期结算款`}
                          </p>
                          {s.dueDate && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              应付 {new Date(s.dueDate).toLocaleDateString("zh-CN")}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <p className={`text-base font-black ${isPaid ? "text-green-700" : "text-slate-800"}`}>
                            ¥{s.amount.toLocaleString()}
                          </p>
                          {s.status === "pending" && (
                            <button onClick={() => openEditPlan(s)}
                              className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
                              编辑
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardSection>

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
                    {t.isBlockingPayment && t.status === "open" && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-red-100 text-red-600 rounded flex items-center gap-0.5 shrink-0">
                        <Lock size={9} /> 阻款
                      </span>
                    )}
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
        <Modal title="上传合同 PDF" onClose={() => setShowUploadContract(false)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">上传后将通知OPC确认签署。</p>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
              <input type="file" accept=".pdf,.jpg,.png" onChange={e => setContractFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-slate-600" />
              {contractFile && <p className="mt-2 text-xs text-slate-500">已选：{contractFile.name}</p>}
            </div>
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
          <div className="space-y-3">
            <p className="text-sm text-slate-500">确认运营验收后，订单将进入质保期。</p>
            <textarea value={verifyNote} onChange={e => setVerifyNote(e.target.value)} rows={3} placeholder="验收说明（可选）"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowVerifyModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleAdminVerify} disabled={acting}
                className="px-4 py-2 text-sm bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50">
                {acting ? "处理中…" : "确认验收"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 新增结算付款项 Modal ── */}
      {showSettlementModal && (
        <Modal title="新增结算付款项" onClose={() => setShowSettlementModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">付款项名称</label>
              <input value={settleTitle} onChange={e => setSettleTitle(e.target.value)} placeholder="如：首付款"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">金额 (¥)</label>
              <input type="number" value={settleAmount} onChange={e => setSettleAmount(e.target.value)} placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">应付日期（可选）</label>
              <input type="date" value={settleDueDate} onChange={e => setSettleDueDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input type="checkbox" checked={settleIsLast} onChange={e => setSettleIsLast(e.target.checked)} className="w-4 h-4 accent-violet-600" />
              标记为尾款（触发阻断付款工单检查）
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSettlementModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleCreateSettlement} disabled={acting}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 disabled:opacity-50">
                {acting ? "创建中…" : "创建"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── 编辑结算付款项 Modal ── */}
      {editingPlan && (
        <Modal title="编辑结算付款项" onClose={() => setEditingPlan(null)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">付款项名称</label>
              <input value={editPlanDesc} onChange={e => setEditPlanDesc(e.target.value)} placeholder="如：首付款"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">金额 (¥)</label>
              <input type="number" value={editPlanAmount} onChange={e => setEditPlanAmount(e.target.value)} placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">应付日期（可选）</label>
              <input type="date" value={editPlanDueDate} onChange={e => setEditPlanDueDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input type="checkbox" checked={editPlanIsLast} onChange={e => setEditPlanIsLast(e.target.checked)} className="w-4 h-4 accent-violet-600" />
              标记为尾款（触发阻断付款工单检查）
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingPlan(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleEditSettlement} disabled={acting}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 disabled:opacity-50">
                {acting ? "保存中…" : "保存"}
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
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={ticketBlocking} onChange={e => setTicketBlocking(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20" />
              阻断尾款支付（直到工单关闭）
            </label>
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
