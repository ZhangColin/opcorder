import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import {
  Loader2, X, Upload, CheckCircle2, XCircle, Clock, ExternalLink, PlusCircle, Wrench,
} from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post, v2Patch, uploadFile } from "@/lib/v2api";
import { markRead } from "@/lib/demandRead";
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
  createdAt: string;
  updatedAt: string;
}

interface SettlementPlan {
  id: number;
  itemNo: number | null;
  description: string | null;
  amount: number;
  dueDate: string | null;
  status: string;
  isLastItem: boolean;
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
  status: string;
  isBlockingPayment: boolean | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending_contract:  { label: "待签约", color: "bg-orange-100 text-orange-700" },
  executing:     { label: "执行中", color: "bg-green-100 text-green-700" },
  warranty:      { label: "质保中", color: "bg-teal-100 text-teal-700" },
  completed:     { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
  cancelled:     { label: "已取消", color: "bg-red-100 text-red-500" },
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-blue-900">{title}</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function AdminV2OutsourceOrderDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [order, setOrder] = useState<OutsourceOrder | null>(null);
  const [settlements, setSettlements] = useState<SettlementPlan[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableB[]>([]);
  const [tickets, setTickets] = useState<TicketB[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

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

  if (loading) return <AdminV2Layout backHref="/admin/v2/outsource-orders" backLabel="接单订单"><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!order) return <AdminV2Layout backHref="/admin/v2/outsource-orders" backLabel="接单订单"><div className="text-center py-16 text-slate-400">订单不存在</div></AdminV2Layout>;

  const cfg = STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-slate-100 text-slate-500" };
  const canUploadContract = order.status === "pending_contract";
  const canApproveDeliverable = order.status === "executing";
  const canAdminVerify = order.status === "executing";
  const canCreateSettlement = ["executing","warranty","completed"].includes(order.status);
  const canCreateTicket = order.status === "warranty";

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
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
            <span className="text-xs text-slate-400 font-mono">{order.orderNo}</span>
          </div>
          <h2 className="text-lg font-extrabold text-blue-900 mb-1">{order.demandTitle ?? `外包需求 #${order.outsourceDemandId}`}</h2>
          <div className="text-xs text-slate-400 flex gap-4 flex-wrap">
            <span>OPC：{order.opcNickname ?? "—"}</span>
            {order.warrantyEndDate && <span>质保至：{new Date(order.warrantyEndDate).toLocaleDateString("zh-CN")}</span>}
            {order.signedFileUrl && (
              <a href={order.signedFileUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-primary hover:underline">
                <ExternalLink size={11} /> 查看合同
              </a>
            )}
          </div>
        </div>

        <Section title={`结算付款计划（${settlements.length} 项）`}>
          <div className="flex items-center justify-between mb-3">
            <span />
            {canCreateSettlement && (
              <button onClick={() => setShowSettlementModal(true)}
                className="flex items-center gap-1.5 text-xs text-primary font-bold hover:text-primary/80 transition-colors">
                <PlusCircle size={13} /> 新增付款项
              </button>
            )}
          </div>
          {settlements.length === 0 ? (
            <p className="text-sm text-slate-400">尚未创建结算计划</p>
          ) : (
            <div className="space-y-2">
              {settlements.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      {s.description ?? `第${s.itemNo ?? 1}期结算款`}
                      {s.isLastItem && <span className="ml-1 text-xs text-violet-600 font-bold">尾款</span>}
                    </p>
                    {s.dueDate && <p className="text-xs text-slate-400">应付日期：{new Date(s.dueDate).toLocaleDateString("zh-CN")}</p>}
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">¥{s.amount.toLocaleString()}</p>
                      <SettleStatusBadge status={s.status} />
                    </div>
                    {s.status === "pending" && (
                      <button onClick={() => openEditPlan(s)}
                        className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50">
                        编辑
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title={`OPC交付（${deliverables.length} 项）`}>
          {deliverables.length === 0 ? (
            <p className="text-sm text-slate-400">暂无交付记录</p>
          ) : (
            <div className="space-y-3">
              {deliverables.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{d.title}</p>
                    {d.content && <p className="text-xs text-slate-400 line-clamp-2">{d.content}</p>}
                    {d.attachments && d.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {d.attachments.map((att, i) => (
                          <a key={i} href={att.url} target="_blank" rel="noreferrer"
                            className="text-xs text-primary flex items-center gap-1 hover:underline">
                            <ExternalLink size={11} /> {att.name || `附件${i + 1}`}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <DelivBStatusBadge status={d.status} />
                    {canApproveDeliverable && d.status === "pending" && (
                      <>
                        <button onClick={() => handleApproveDeliverable(d.id)} disabled={acting}
                          className="text-xs bg-green-600 text-white rounded-lg px-2.5 py-1 hover:bg-green-700 disabled:opacity-50">
                          通过
                        </button>
                        <button onClick={() => handleRejectDeliverable(d.id)} disabled={acting}
                          className="text-xs border border-red-200 text-red-500 rounded-lg px-2.5 py-1 hover:bg-red-50 disabled:opacity-50">
                          驳回
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title={`质保工单（${tickets.length} 项）`}>
          <div className="flex items-center justify-between mb-3">
            <span />
            {canCreateTicket && (
              <button onClick={() => setShowTicketModal(true)}
                className="flex items-center gap-1.5 text-xs text-primary font-bold hover:text-primary/80 transition-colors">
                <Wrench size={13} /> 向OPC发工单
              </button>
            )}
          </div>
          {tickets.length === 0 ? (
            <p className="text-sm text-slate-400">暂无工单</p>
          ) : (
            <div className="space-y-2">
              {tickets.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{t.title}</p>
                    <p className="text-xs text-slate-400">#{t.id} · {new Date(t.createdAt).toLocaleDateString("zh-CN")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.isBlockingPayment && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">阻断付款</span>}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === "open" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                      {t.status === "open" ? "开放中" : "已关闭"}
                    </span>
                    <button onClick={() => navigate(`/admin/v2/tickets-b/${t.id}`)}
                      className="text-xs text-primary font-bold border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5">
                      详情
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="与OPC沟通">
          <DiscussionThread parentType="outsource_order" parentId={id} placeholder="与OPC沟通…" onAfterPost={() => markRead("order", id)} />
        </Section>
      </div>

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

function SettleStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    pending: ["待付款", "bg-slate-100 text-slate-500"],
    paid: ["已支付", "bg-green-100 text-green-700"],
  };
  const [label, color] = map[status] ?? [status, "bg-slate-100 text-slate-500"];
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
}

function DelivBStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    pending:  ["待审核", "bg-amber-100 text-amber-700"],
    approved: ["已通过", "bg-green-100 text-green-700"],
    revision: ["需修改", "bg-red-100 text-red-600"],
  };
  const [label, color] = map[status] ?? [status, "bg-slate-100 text-slate-500"];
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>{label}</span>;
}
