import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import {
  Loader2, AlertCircle, ChevronRight, Zap, Clock, ExternalLink,
  CheckCircle2, FileText, DollarSign, Send, PlusCircle, Trash2, Edit2, X,
} from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post, v2Patch } from "@/lib/v2api";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useToast } from "@/hooks/use-toast";

interface ClientDemand {
  id: number;
  demandNo: string;
  publisherId: number;
  publisherNickname: string | null;
  title: string;
  demandType: string | null;
  isUrgent: boolean;
  budgetMin: number | null;
  budgetMax: number | null;
  detail: string | null;
  attachments: Array<{ name: string; url: string }> | null;
  status: string;
  quoteCardId: number | null;
  quoteTotal: number | null;
  createdAt: string;
  updatedAt: string;
}

interface PaymentPlan {
  id: number;
  title: string;
  amount: number;
  dueDate: string | null;
  status: string;
}

interface Deliverable {
  id: number;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:            { label: "草稿",     color: "bg-slate-100 text-slate-500" },
  negotiating:      { label: "沟通中",   color: "bg-blue-100 text-blue-700" },
  quoting:          { label: "报价中",   color: "bg-amber-100 text-amber-700" },
  pending_contract: { label: "待签约",   color: "bg-orange-100 text-orange-700" },
  executing:        { label: "执行中",   color: "bg-green-100 text-green-700" },
  warranty:         { label: "质保中",   color: "bg-teal-100 text-teal-700" },
  completed:        { label: "已完成",   color: "bg-emerald-100 text-emerald-700" },
  closed:           { label: "已关闭",   color: "bg-red-100 text-red-500" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function AdminV2ClientDemandDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [demand, setDemand] = useState<ClientDemand | null>(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentPlan[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [acting, setActing] = useState(false);

  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteTotal, setQuoteTotal] = useState("");
  const [quoteItems, setQuoteItems] = useState([{ name: "", amount: "" }]);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payTitle, setPayTitle] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDueDate, setPayDueDate] = useState("");

  const [showDeliverableModal, setShowDeliverableModal] = useState(false);
  const [delivTitle, setDelivTitle] = useState("");
  const [delivDesc, setDelivDesc] = useState("");

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  const [showUpdateDetailModal, setShowUpdateDetailModal] = useState(false);
  const [updateDetailText, setUpdateDetailText] = useState("");
  const [updateDetailComment, setUpdateDetailComment] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<ClientDemand>(`/client-demands/${id}`);
      setDemand(d);
      const pData = await v2Get<PaymentPlan[]>(`/payment-plans?clientDemandId=${id}`);
      setPayments(Array.isArray(pData) ? pData : []);
      const delData = await v2Get<Deliverable[]>(`/deliverables-a?clientDemandId=${id}`);
      setDeliverables(Array.isArray(delData) ? delData : []);
    } catch {
      setDemand(null);
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

  const handleInitiateQuote = async () => {
    if (!quoteTotal || parseFloat(quoteTotal) <= 0) {
      toast({ title: "请填写报价总额", variant: "destructive" }); return;
    }
    await act(async () => {
      await v2Post(`/client-demands/${id}/initiate-quote`, {
        totalAmount: parseFloat(quoteTotal),
        breakdown: quoteItems.filter(i => i.name && i.amount).map(i => ({ name: i.name, amount: parseFloat(i.amount) })),
      });
      setShowQuoteModal(false);
      setQuoteTotal(""); setQuoteItems([{ name: "", amount: "" }]);
    }, "报价已发起，通知发单方");
  };

  const handleCreatePayment = async () => {
    if (!payTitle.trim() || !payAmount) {
      toast({ title: "请填写收款项标题和金额", variant: "destructive" }); return;
    }
    await act(async () => {
      await v2Post("/payment-plans", {
        clientDemandId: id, title: payTitle.trim(),
        amount: parseFloat(payAmount), dueDate: payDueDate || null,
      });
      setShowPaymentModal(false);
      setPayTitle(""); setPayAmount(""); setPayDueDate("");
    }, "收款计划已创建");
  };

  const handleCreateDeliverable = async () => {
    if (!delivTitle.trim()) {
      toast({ title: "请填写交付标题", variant: "destructive" }); return;
    }
    await act(async () => {
      await v2Post("/deliverables-a", { clientDemandId: id, title: delivTitle.trim(), description: delivDesc.trim() || null });
      setShowDeliverableModal(false);
      setDelivTitle(""); setDelivDesc("");
    }, "交付记录已创建");
  };

  const handleClose = async () => {
    if (!closeReason.trim()) {
      toast({ title: "请填写关闭原因", variant: "destructive" }); return;
    }
    await act(async () => {
      await v2Post(`/client-demands/${id}/close`, { reason: closeReason.trim() });
      setShowCloseModal(false); setCloseReason("");
    }, "需求已关闭");
  };

  const handleUpdateDetail = async () => {
    if (!updateDetailText.trim()) {
      toast({ title: "需求详情不能为空", variant: "destructive" }); return;
    }
    await act(async () => {
      await v2Post(`/client-demands/${id}/update-detail`, {
        detail: updateDetailText.trim(),
        editComment: updateDetailComment.trim() || undefined,
      });
      setShowUpdateDetailModal(false);
      setUpdateDetailText(""); setUpdateDetailComment("");
    }, "需求详情已更新，通知已发送");
  };

  if (loading) return <AdminV2Layout backHref="/admin/v2/client-demands" backLabel="客户需求"><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!demand) return <AdminV2Layout backHref="/admin/v2/client-demands" backLabel="客户需求"><div className="text-center py-16 text-slate-400">需求不存在</div></AdminV2Layout>;

  const cfg = STATUS_CONFIG[demand.status] ?? { label: demand.status, color: "bg-slate-100 text-slate-500" };
  const canInitiateQuote = demand.status === "negotiating";
  const canReQuote = demand.status === "quoting";
  const canUpdateDetail = ["negotiating", "quoting"].includes(demand.status);
  const canCreatePayment = ["pending_contract","executing","warranty","completed"].includes(demand.status);
  const canCreateDeliverable = demand.status === "executing";
  const canClose = !["completed","closed"].includes(demand.status);
  const canViewOverview = demand.id > 0;

  return (
    <AdminV2Layout
      title={demand.title}
      backHref="/admin/v2/client-demands"
      backLabel="客户需求"
      actions={
        <div className="flex gap-2">
          {canViewOverview && (
            <button onClick={() => navigate(`/admin/v2/overview?clientDemandId=${id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
              <ExternalLink size={13} /> 关联总览
            </button>
          )}
          {canClose && (
            <button onClick={() => setShowCloseModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-red-200 rounded-xl text-red-500 hover:bg-red-50 transition-colors">
              关闭需求
            </button>
          )}
        </div>
      }
    >
      <div className="mt-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                {demand.isUrgent && <span className="text-xs font-bold text-red-500 flex items-center gap-0.5"><Zap size={10} />紧急</span>}
                <span className="text-xs text-slate-400 font-mono">{demand.demandNo}</span>
              </div>
              <h2 className="text-lg font-extrabold text-blue-900 mb-1">{demand.title}</h2>
              <div className="text-xs text-slate-400 flex gap-3 flex-wrap">
                <span>发单方：{demand.publisherNickname ?? "—"}</span>
                {demand.budgetMin != null && <span>预算：¥{demand.budgetMin.toLocaleString()}{demand.budgetMax ? `～¥${demand.budgetMax.toLocaleString()}` : "+"}</span>}
                {demand.demandType && <span>类型：{demand.demandType}</span>}
                <span>更新：{new Date(demand.updatedAt).toLocaleDateString("zh-CN")}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {(canInitiateQuote || canReQuote) && (
                <button onClick={() => setShowQuoteModal(true)} disabled={acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
                  <DollarSign size={14} /> {canReQuote ? "更新报价" : "发起报价"}
                </button>
              )}
              {canUpdateDetail && (
                <button onClick={() => { setUpdateDetailText(demand.detail ?? ""); setShowUpdateDetailModal(true); }} disabled={acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-600 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors">
                  <Edit2 size={14} /> 更新详情
                </button>
              )}
              {canCreatePayment && (
                <button onClick={() => setShowPaymentModal(true)} disabled={acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors">
                  <PlusCircle size={14} /> 创建收款项
                </button>
              )}
              {canCreateDeliverable && (
                <button onClick={() => setShowDeliverableModal(true)} disabled={acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors">
                  <CheckCircle2 size={14} /> 创建交付记录
                </button>
              )}
            </div>
          </div>
        </div>

        {demand.detail && (
          <Section title="需求详情">
            <MarkdownContent content={demand.detail} />
            {demand.attachments && demand.attachments.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {demand.attachments.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors">
                    <ExternalLink size={11} />{a.name}
                  </a>
                ))}
              </div>
            )}
          </Section>
        )}

        {payments.length > 0 && (
          <Section title={`收款计划（${payments.length} 项）`}>
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{p.title}</p>
                    {p.dueDate && <p className="text-xs text-slate-400">应收日期：{new Date(p.dueDate).toLocaleDateString("zh-CN")}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">¥{p.amount.toLocaleString()}</p>
                    <PayStatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {deliverables.length > 0 && (
          <Section title={`交付记录（${deliverables.length} 项）`}>
            <div className="space-y-2">
              {deliverables.map(d => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{d.title}</p>
                    {d.description && <p className="text-xs text-slate-400">{d.description}</p>}
                  </div>
                  <DelivStatusBadge status={d.status} />
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="沟通讨论">
          <DiscussionThread parentType="client_demand" parentId={id} placeholder="与发单方沟通…" />
        </Section>
      </div>

      {showQuoteModal && (
        <Modal title="发起报价" onClose={() => setShowQuoteModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">报价总额 (¥)</label>
              <input type="number" value={quoteTotal} onChange={e => setQuoteTotal(e.target.value)} placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-600">报价明细（可选）</label>
                <button onClick={() => setQuoteItems([...quoteItems, { name: "", amount: "" }])}
                  className="text-xs text-primary font-bold">+ 添加</button>
              </div>
              {quoteItems.map((item, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input placeholder="项目名称" value={item.name} onChange={e => { const arr = [...quoteItems]; arr[i].name = e.target.value; setQuoteItems(arr); }}
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  <input type="number" placeholder="金额" value={item.amount} onChange={e => { const arr = [...quoteItems]; arr[i].amount = e.target.value; setQuoteItems(arr); }}
                    className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                  {quoteItems.length > 1 && (
                    <button onClick={() => setQuoteItems(quoteItems.filter((_, j) => j !== i))}
                      className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowQuoteModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleInitiateQuote} disabled={acting}
                className="px-4 py-2 text-sm bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50">
                {acting ? "提交中…" : "发起报价"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showPaymentModal && (
        <Modal title="创建收款项" onClose={() => setShowPaymentModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">收款项名称</label>
              <input value={payTitle} onChange={e => setPayTitle(e.target.value)} placeholder="如：首付款、尾款"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">金额 (¥)</label>
              <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">应收日期（可选）</label>
              <input type="date" value={payDueDate} onChange={e => setPayDueDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowPaymentModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleCreatePayment} disabled={acting}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50">
                {acting ? "创建中…" : "创建"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showDeliverableModal && (
        <Modal title="创建交付记录" onClose={() => setShowDeliverableModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">交付标题</label>
              <input value={delivTitle} onChange={e => setDelivTitle(e.target.value)} placeholder="本次交付内容"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">说明（可选）</label>
              <textarea value={delivDesc} onChange={e => setDelivDesc(e.target.value)} rows={3} placeholder="补充说明"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowDeliverableModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleCreateDeliverable} disabled={acting}
                className="px-4 py-2 text-sm bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50">
                {acting ? "创建中…" : "创建"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showUpdateDetailModal && (
        <Modal title="更新需求详情" onClose={() => setShowUpdateDetailModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">详情内容（支持 Markdown）</label>
              <textarea value={updateDetailText} onChange={e => setUpdateDetailText(e.target.value)} rows={8}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">修改说明（可选）</label>
              <input value={updateDetailComment} onChange={e => setUpdateDetailComment(e.target.value)} placeholder="说明本次修改内容"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowUpdateDetailModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleUpdateDetail} disabled={acting}
                className="px-4 py-2 text-sm bg-slate-600 text-white rounded-xl font-bold hover:bg-slate-700 disabled:opacity-50">
                {acting ? "保存中…" : "保存并通知"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showCloseModal && (
        <Modal title="关闭需求" onClose={() => setShowCloseModal(false)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">关闭后需求将不可再操作，请填写关闭原因。</p>
            <textarea value={closeReason} onChange={e => setCloseReason(e.target.value)} rows={3} placeholder="关闭原因"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCloseModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleClose} disabled={acting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50">
                {acting ? "关闭中…" : "确认关闭"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AdminV2Layout>
  );
}

function PayStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-slate-100 text-slate-500",
    awaiting_review: "bg-amber-100 text-amber-700",
    paid: "bg-green-100 text-green-700",
    overdue: "bg-red-100 text-red-600",
  };
  const labels: Record<string, string> = { pending: "待付款", awaiting_review: "待审核", paid: "已支付", overdue: "已逾期" };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[status] ?? "bg-slate-100 text-slate-500"}`}>{labels[status] ?? status}</span>;
}

function DelivStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending_confirm: "bg-amber-100 text-amber-700",
    confirmed: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-600",
  };
  const labels: Record<string, string> = { pending_confirm: "待确认", confirmed: "已确认", rejected: "已驳回" };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[status] ?? "bg-slate-100 text-slate-500"}`}>{labels[status] ?? status}</span>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-blue-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
