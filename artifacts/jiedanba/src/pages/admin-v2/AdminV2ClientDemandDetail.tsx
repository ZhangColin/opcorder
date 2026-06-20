import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import {
  Loader2, Zap, ExternalLink, CheckCircle2, DollarSign, PlusCircle, Trash2, Edit2, X, Calendar, AlertTriangle,
} from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post } from "@/lib/v2api";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { useToast } from "@/hooks/use-toast";

interface LatestVersion {
  id: number;
  versionNo: number;
  detail: string;
  attachments: Array<{ name: string; url: string; size?: number }>;
  editComment: string | null;
  createdAt: string;
}

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
  hopeDeliveryDate: string | null;
  warrantyEndDate: string | null;
  closedReason: string | null;
  status: string;
  quoteCardId: number | null;
  quoteTotal: number | null;
  createdAt: string;
  updatedAt: string;
  latestVersion: LatestVersion | null;
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

const DEMAND_TYPE_LABEL: Record<string, string> = {
  website: "网站建设",
  app: "App开发",
  miniprogram: "小程序",
  ecommerce: "电商运营",
  design: "设计制作",
  marketing: "营销推广",
  other: "其他",
};

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-700">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

type Panel = "quote" | "payment" | "deliverable" | "close" | "update_detail" | null;

export default function AdminV2ClientDemandDetail({ inlineId }: { inlineId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [demand, setDemand] = useState<ClientDemand | null>(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentPlan[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [acting, setActing] = useState(false);
  const [activePanel, setActivePanel] = useState<Panel>(null);

  const [quoteTotal, setQuoteTotal] = useState("");
  const [quoteItems, setQuoteItems] = useState([{ name: "", amount: "" }]);

  const [payTitle, setPayTitle] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDueDate, setPayDueDate] = useState("");

  const [delivTitle, setDelivTitle] = useState("");
  const [delivDesc, setDelivDesc] = useState("");

  const [closeReason, setCloseReason] = useState("");

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
      setActivePanel(null);
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const openPanel = (p: Panel, extra?: () => void) => {
    extra?.();
    setActivePanel(prev => (prev === p ? null : p));
  };

  const handleInitiateQuote = () => act(async () => {
    if (!quoteTotal || parseFloat(quoteTotal) <= 0) throw new Error("请填写报价总额");
    await v2Post(`/client-demands/${id}/initiate-quote`, {
      totalAmount: parseFloat(quoteTotal),
      breakdown: quoteItems.filter(i => i.name && i.amount).map(i => ({ name: i.name, amount: parseFloat(i.amount) })),
    });
    setQuoteTotal(""); setQuoteItems([{ name: "", amount: "" }]);
  }, "报价已发起，通知发单方");

  const handleCreatePayment = () => act(async () => {
    if (!payTitle.trim() || !payAmount) throw new Error("请填写收款项标题和金额");
    await v2Post("/payment-plans", {
      clientDemandId: id, title: payTitle.trim(),
      amount: parseFloat(payAmount), dueDate: payDueDate || null,
    });
    setPayTitle(""); setPayAmount(""); setPayDueDate("");
  }, "收款计划已创建");

  const handleCreateDeliverable = () => act(async () => {
    if (!delivTitle.trim()) throw new Error("请填写交付标题");
    await v2Post("/deliverables-a", { clientDemandId: id, title: delivTitle.trim(), description: delivDesc.trim() || null });
    setDelivTitle(""); setDelivDesc("");
  }, "交付记录已创建");

  const handleClose = () => act(async () => {
    if (!closeReason.trim()) throw new Error("请填写关闭原因");
    await v2Post(`/client-demands/${id}/close`, { reason: closeReason.trim() });
    setCloseReason("");
  }, "需求已关闭");

  const handleUpdateDetail = () => act(async () => {
    if (!updateDetailText.trim()) throw new Error("需求详情不能为空");
    await v2Post(`/client-demands/${id}/update-detail`, {
      detail: updateDetailText.trim(),
      editComment: updateDetailComment.trim() || undefined,
    });
    setUpdateDetailComment("");
  }, "需求详情已更新，通知已发送");

  if (loading) return <AdminV2Layout backHref="/admin/v2/client-demands" backLabel="客户需求"><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!demand) return <AdminV2Layout backHref="/admin/v2/client-demands" backLabel="客户需求"><div className="text-center py-16 text-slate-400">需求不存在</div></AdminV2Layout>;

  const cfg = STATUS_CONFIG[demand.status] ?? { label: demand.status, color: "bg-slate-100 text-slate-500" };
  const canInitiateQuote = demand.status === "negotiating";
  const canReQuote = demand.status === "quoting";
  const canUpdateDetail = ["draft","negotiating", "quoting"].includes(demand.status);
  const canCreatePayment = ["pending_contract","executing","warranty","completed"].includes(demand.status);
  const canCreateDeliverable = demand.status === "executing";
  const canClose = !["completed","closed"].includes(demand.status);

  const currentDetail = demand.latestVersion?.detail ?? null;
  const currentAttachments = demand.latestVersion?.attachments ?? [];

  const InlinePanel = ({ title, color = "bg-slate-50 border-slate-200", children }: {
    title: string; color?: string; children: React.ReactNode;
  }) => (
    <div className={`rounded-2xl border p-5 ${color}`}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        <button onClick={() => setActivePanel(null)}><X size={16} className="text-slate-400 hover:text-slate-600" /></button>
      </div>
      {children}
    </div>
  );

  return (
    <AdminV2Layout
      title={demand.title}
      backHref="/admin/v2/client-demands"
      backLabel="客户需求"
      actions={
        <div className="flex gap-2">
          <button onClick={() => navigate(`/admin/v2/overview?clientDemandId=${id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
            <ExternalLink size={13} /> 关联总览
          </button>
          {canClose && (
            <button onClick={() => openPanel("close")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border rounded-xl transition-colors ${activePanel === "close" ? "bg-red-500 text-white border-red-500" : "border-red-200 text-red-500 hover:bg-red-50"}`}>
              关闭需求
            </button>
          )}
        </div>
      }
    >
      <div className="mt-6 space-y-4">

        {/* ── 基本信息卡 ── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                {demand.isUrgent && (
                  <span className="text-xs font-bold text-red-500 flex items-center gap-0.5 bg-red-50 px-2 py-0.5 rounded-full">
                    <Zap size={10} />紧急
                  </span>
                )}
                {demand.demandType && (
                  <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                    {DEMAND_TYPE_LABEL[demand.demandType] ?? demand.demandType}
                  </span>
                )}
                <span className="text-xs text-slate-400 font-mono">{demand.demandNo}</span>
              </div>
              <h2 className="text-lg font-extrabold text-blue-900 mb-3">{demand.title}</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-500">
                <div><span className="font-medium text-slate-400">发单方：</span>{demand.publisherNickname ?? "—"}</div>
                <div>
                  <span className="font-medium text-slate-400">预算：</span>
                  {demand.budgetMin != null
                    ? `¥${demand.budgetMin.toLocaleString()}${demand.budgetMax ? ` ～ ¥${demand.budgetMax.toLocaleString()}` : "+"}`
                    : "面议"}
                </div>
                {demand.hopeDeliveryDate && (
                  <div className="flex items-center gap-1">
                    <Calendar size={11} className="text-slate-400" />
                    <span className="font-medium text-slate-400">期望交付：</span>
                    {new Date(demand.hopeDeliveryDate).toLocaleDateString("zh-CN")}
                  </div>
                )}
                {demand.quoteTotal != null && (
                  <div><span className="font-medium text-primary">报价总额：</span>
                    <span className="font-bold text-primary">¥{demand.quoteTotal.toLocaleString()}</span>
                  </div>
                )}
                {demand.warrantyEndDate && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-slate-400">质保到期：</span>
                    {new Date(demand.warrantyEndDate).toLocaleDateString("zh-CN")}
                  </div>
                )}
                <div><span className="font-medium text-slate-400">更新时间：</span>{new Date(demand.updatedAt).toLocaleDateString("zh-CN")}</div>
                <div><span className="font-medium text-slate-400">创建时间：</span>{new Date(demand.createdAt).toLocaleDateString("zh-CN")}</div>
              </div>
              {demand.closedReason && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
                  <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-red-600 mb-0.5">关闭原因</p>
                    <p className="text-xs text-red-500">{demand.closedReason}</p>
                  </div>
                </div>
              )}
              {demand.latestVersion && (
                <p className="mt-2 text-xs text-slate-400">
                  需求详情版本 v{demand.latestVersion.versionNo}
                  {demand.latestVersion.editComment ? `（${demand.latestVersion.editComment}）` : ""}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {(canInitiateQuote || canReQuote) && (
                <button onClick={() => openPanel("quote")} disabled={acting}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activePanel === "quote" ? "bg-primary/80 text-white" : "bg-primary text-white hover:bg-primary/90"}`}>
                  <DollarSign size={14} /> {canReQuote ? "更新报价" : "发起报价"}
                </button>
              )}
              {canUpdateDetail && (
                <button onClick={() => openPanel("update_detail", () => setUpdateDetailText(currentDetail ?? ""))} disabled={acting}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activePanel === "update_detail" ? "bg-slate-700 text-white" : "bg-slate-600 text-white hover:bg-slate-700"}`}>
                  <Edit2 size={14} /> 更新需求详情
                </button>
              )}
              {canCreatePayment && (
                <button onClick={() => openPanel("payment")} disabled={acting}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activePanel === "payment" ? "bg-emerald-700 text-white" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
                  <PlusCircle size={14} /> 创建收款项
                </button>
              )}
              {canCreateDeliverable && (
                <button onClick={() => openPanel("deliverable")} disabled={acting}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activePanel === "deliverable" ? "bg-teal-700 text-white" : "bg-teal-600 text-white hover:bg-teal-700"}`}>
                  <CheckCircle2 size={14} /> 创建交付记录
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── 关闭需求面板 ── */}
        {activePanel === "close" && (
          <InlinePanel title="关闭需求" color="bg-red-50 border-red-200">
            <p className="text-sm text-slate-500 mb-3">关闭后需求将不可再操作，请填写关闭原因。</p>
            <textarea value={closeReason} onChange={e => setCloseReason(e.target.value)} rows={3} placeholder="关闭原因"
              className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none bg-white mb-3" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setActivePanel(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleClose} disabled={acting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50">
                {acting ? "关闭中…" : "确认关闭"}
              </button>
            </div>
          </InlinePanel>
        )}

        {/* ── 发起报价面板 ── */}
        {activePanel === "quote" && (
          <InlinePanel title={canReQuote ? "更新报价" : "发起报价"} color="bg-primary/5 border-primary/20">
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
                      className="w-28 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    {quoteItems.length > 1 && (
                      <button onClick={() => setQuoteItems(quoteItems.filter((_, j) => j !== i))}
                        className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setActivePanel(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
                <button onClick={handleInitiateQuote} disabled={acting}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50">
                  {acting ? "提交中…" : "发起报价"}
                </button>
              </div>
            </div>
          </InlinePanel>
        )}

        {/* ── 更新需求详情面板 ── */}
        {activePanel === "update_detail" && (
          <InlinePanel title="更新需求详情" color="bg-slate-50 border-slate-200">
            <div className="space-y-3">
              <MarkdownEditor
                key={`client-detail-${id}`}
                value={updateDetailText}
                onChange={setUpdateDetailText}
                placeholder="编辑需求详情，支持 Markdown 富文本…"
              />
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">修改说明（可选）</label>
                <input value={updateDetailComment} onChange={e => setUpdateDetailComment(e.target.value)} placeholder="说明本次修改内容"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setActivePanel(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
                <button onClick={handleUpdateDetail} disabled={acting}
                  className="px-4 py-2 text-sm bg-slate-600 text-white rounded-xl font-bold hover:bg-slate-700 disabled:opacity-50">
                  {acting ? "保存中…" : "保存并通知"}
                </button>
              </div>
            </div>
          </InlinePanel>
        )}

        {/* ── 需求详情内容 ── */}
        <Section
          title={`需求详情${demand.latestVersion ? ` (v${demand.latestVersion.versionNo})` : ""}`}
        >
          {currentDetail ? (
            <MarkdownContent content={currentDetail} />
          ) : (
            <p className="text-sm text-slate-400 italic py-2">暂无需求详情，可点击"更新需求详情"填写。</p>
          )}
          {currentAttachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-slate-50">
              {currentAttachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors">
                  <ExternalLink size={11} />{a.name}
                </a>
              ))}
            </div>
          )}
        </Section>

        {/* ── 创建收款项面板 ── */}
        {activePanel === "payment" && (
          <InlinePanel title="创建收款项" color="bg-emerald-50 border-emerald-200">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">收款项名称</label>
                <input value={payTitle} onChange={e => setPayTitle(e.target.value)} placeholder="如：首付款、尾款"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">金额 (¥)</label>
                  <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">应收日期（可选）</label>
                  <input type="date" value={payDueDate} onChange={e => setPayDueDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setActivePanel(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
                <button onClick={handleCreatePayment} disabled={acting}
                  className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50">
                  {acting ? "创建中…" : "创建"}
                </button>
              </div>
            </div>
          </InlinePanel>
        )}

        {/* ── 收款计划 ── */}
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

        {/* ── 创建交付记录面板 ── */}
        {activePanel === "deliverable" && (
          <InlinePanel title="创建交付记录" color="bg-teal-50 border-teal-200">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">交付标题</label>
                <input value={delivTitle} onChange={e => setDelivTitle(e.target.value)} placeholder="本次交付内容"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">说明（可选）</label>
                <textarea value={delivDesc} onChange={e => setDelivDesc(e.target.value)} rows={3} placeholder="补充说明"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 resize-none" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setActivePanel(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
                <button onClick={handleCreateDeliverable} disabled={acting}
                  className="px-4 py-2 text-sm bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50">
                  {acting ? "创建中…" : "创建"}
                </button>
              </div>
            </div>
          </InlinePanel>
        )}

        {/* ── 交付记录 ── */}
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
    pending: "bg-slate-100 text-slate-500",
    delivered: "bg-blue-100 text-blue-700",
    accepted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-600",
  };
  const labels: Record<string, string> = { pending: "待交付", delivered: "已提交", accepted: "已验收", rejected: "已拒绝" };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[status] ?? "bg-slate-100 text-slate-500"}`}>{labels[status] ?? status}</span>;
}
