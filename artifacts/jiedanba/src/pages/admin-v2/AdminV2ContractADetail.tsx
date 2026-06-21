import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Loader2, X, ExternalLink, Upload, FileText, PlusCircle, DollarSign, Edit2, Send, ChevronDown, ChevronUp, Zap, Calendar, User } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post, v2Patch, uploadFile } from "@/lib/v2api";
import { markRead } from "@/lib/demandRead";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { useToast } from "@/hooks/use-toast";

interface Contract {
  id: number;
  contractNo: string;
  channel: string;
  clientDemandId: number | null;
  demandTitle: string | null;
  content: string | null;
  status: string;
  signedFileUrl: string | null;
  signedAt: string | null;
  publisherConfirmedAt: string | null;
  publisherRejectedAt: string | null;
  publisherRejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

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
  publisherNickname: string | null;
  latestVersion: { detail: string; attachments: Array<{ name: string; url: string }> } | null;
}

interface QuotationCard {
  id: number;
  totalPrice: number;
  breakdown: Array<{ item: string; amount: number; note?: string }>;
  note: string | null;
  createdByNickname: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaymentPlan {
  id: number;
  itemNo: number;
  description: string | null;
  amount: number;
  dueDate: string;
  status: string;
  contractId: number | null;
}

const DEMAND_STATUS: Record<string, { label: string; color: string }> = {
  draft:            { label: "草稿",   color: "bg-slate-100 text-slate-500" },
  negotiating:      { label: "洽谈中", color: "bg-blue-100 text-blue-700" },
  quoting:          { label: "报价中", color: "bg-violet-100 text-violet-700" },
  pending_contract: { label: "待合同", color: "bg-amber-100 text-amber-700" },
  executing:        { label: "执行中", color: "bg-emerald-100 text-emerald-700" },
  warranty:         { label: "质保期", color: "bg-teal-100 text-teal-700" },
  completed:        { label: "已完成", color: "bg-green-100 text-green-700" },
  closed:           { label: "已关闭", color: "bg-red-100 text-red-600" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:                      { label: "草稿",       color: "bg-slate-100 text-slate-500" },
  pending_publisher_confirm:  { label: "待发单方确认", color: "bg-amber-100 text-amber-700" },
  publisher_rejected:         { label: "已退回",      color: "bg-red-100 text-red-600" },
  pending_sign:               { label: "待签约",      color: "bg-orange-100 text-orange-700" },
  signed:                     { label: "已签约",      color: "bg-green-100 text-green-700" },
};

const PAY_STATUS: Record<string, { label: string; color: string }> = {
  pending:        { label: "待付款", color: "text-amber-600 bg-amber-50" },
  awaiting_review:{ label: "待审核", color: "text-blue-600 bg-blue-50" },
  paid:           { label: "已付款", color: "text-green-700 bg-green-50" },
  overdue:        { label: "已逾期", color: "text-red-600 bg-red-50" },
};

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-1.5">
        {Icon && <Icon size={14} className="text-slate-400" />}
        {title}
      </h3>
      {children}
    </div>
  );
}

export default function AdminV2ContractADetail({ inlineId }: { inlineId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const { toast } = useToast();

  const [contract, setContract] = useState<Contract | null>(null);
  const [demand, setDemand] = useState<Demand | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [quotes, setQuotes] = useState<QuotationCard[]>([]);
  const [showDemandDetail, setShowDemandDetail] = useState(false);

  // 编辑正文面板
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editContent, setEditContent] = useState("");

  // 定稿通知确认面板
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [showAddPlan, setShowAddPlan] = useState(false);
  const [planDesc, setPlanDesc] = useState("");
  const [planAmount, setPlanAmount] = useState("");
  const [planDueDate, setPlanDueDate] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<Contract>(`/contracts/${id}`);
      setContract(d);
      markRead("contract", id);
      if (d.clientDemandId) {
        const [ps, dem, qs] = await Promise.all([
          v2Get<PaymentPlan[]>(`/payment-plans?clientDemandId=${d.clientDemandId}&contractId=${id}`).catch(() => [] as PaymentPlan[]),
          v2Get<Demand>(`/client-demands/${d.clientDemandId}`).catch(() => null),
          v2Get<QuotationCard[]>(`/quotation-cards?clientDemandId=${d.clientDemandId}`).catch(() => [] as QuotationCard[]),
        ]);
        setPlans(Array.isArray(ps) ? ps : []);
        setDemand(dem);
        setQuotes(Array.isArray(qs) ? qs : []);
      }
    } catch {
      setContract(null);
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

  // 保存正文（不改状态）
  const handleSaveContent = async () => {
    await act(async () => {
      await v2Patch(`/contracts/${id}/content`, { content: editContent });
      setShowEditPanel(false);
    }, "合同内容已保存");
  };

  // 定稿并通知（不再传 content，使用已保存的版本）
  const handleFinalize = async () => {
    await act(async () => {
      await v2Post(`/contracts/${id}/finalize`, {});
      setShowFinalizeConfirm(false);
    }, "合同已定稿，通知发单方确认");
  };

  const handleUploadSigned = async () => {
    if (!selectedFile) {
      toast({ title: "请选择文件", variant: "destructive" }); return;
    }
    setUploadingFile(true);
    try {
      const url = await uploadFile(selectedFile);
      await v2Post(`/contracts/${id}/upload-signed`, { signedFileUrl: url });
      toast({ title: "已签合同已上传，进入执行中" });
      setShowUploadModal(false);
      setSelectedFile(null);
      await load();
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleAddPlan = async () => {
    if (!planDesc.trim() || !planAmount || !planDueDate) {
      toast({ title: "请填写完整付款项信息", variant: "destructive" }); return;
    }
    if (!contract?.clientDemandId) {
      toast({ title: "此合同未关联需求", variant: "destructive" }); return;
    }
    await act(async () => {
      await v2Post("/payment-plans", {
        clientDemandId: contract.clientDemandId,
        contractId: id,
        itemNo: plans.length + 1,
        description: planDesc.trim(),
        amount: parseFloat(planAmount),
        dueDate: planDueDate,
      });
      setShowAddPlan(false);
      setPlanDesc("");
      setPlanAmount("");
      setPlanDueDate("");
    }, "付款项已添加");
  };

  if (loading) return (
    <AdminV2Layout backHref="/admin/v2/contracts-a" backLabel="合同 (A)">
      <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>
    </AdminV2Layout>
  );
  if (!contract) return (
    <AdminV2Layout backHref="/admin/v2/contracts-a" backLabel="合同 (A)">
      <div className="text-center py-16 text-slate-400">合同不存在</div>
    </AdminV2Layout>
  );

  const cfg = STATUS_CONFIG[contract.status] ?? { label: contract.status, color: "bg-slate-100 text-slate-500" };
  const canEdit = ["draft", "publisher_rejected"].includes(contract.status);
  const canFinalize = canEdit;
  const canUploadSigned = contract.status === "pending_sign";

  return (
    <AdminV2Layout title={contract.demandTitle ?? `合同 ${contract.contractNo}`} backHref="/admin/v2/contracts-a" backLabel="合同 (A)">
      <div className="mt-6 space-y-4">

        {/* ── 头部信息卡 ── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-slate-400 font-mono">{contract.contractNo}</span>
              </div>
              {contract.demandTitle && (
                <h2 className="text-lg font-extrabold text-blue-900 mb-2 truncate">{contract.demandTitle}</h2>
              )}
              <div className="text-xs text-slate-400 flex gap-3 flex-wrap">
                {contract.signedAt && <span>签约：{new Date(contract.signedAt).toLocaleDateString("zh-CN")}</span>}
                {contract.publisherConfirmedAt && <span>发单方确认：{new Date(contract.publisherConfirmedAt).toLocaleDateString("zh-CN")}</span>}
                {contract.publisherRejectedAt && <span className="text-red-500">发单方退回：{new Date(contract.publisherRejectedAt).toLocaleDateString("zh-CN")}</span>}
                <span>更新：{new Date(contract.updatedAt).toLocaleDateString("zh-CN")}</span>
              </div>
              {contract.publisherRejectedReason && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">
                  退回原因：{contract.publisherRejectedReason}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {canEdit && (
                <button
                  onClick={() => { setEditContent(contract.content ?? ""); setShowEditPanel(v => !v); setShowFinalizeConfirm(false); }}
                  disabled={acting}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${showEditPanel ? "bg-slate-200 text-slate-700" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}
                >
                  <Edit2 size={14} /> {showEditPanel ? "收起编辑" : "编辑正文"}
                </button>
              )}
              {canFinalize && (
                <button
                  onClick={() => { setShowFinalizeConfirm(v => !v); setShowEditPanel(false); }}
                  disabled={acting}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${showFinalizeConfirm ? "bg-primary/10 text-primary" : "bg-primary text-white hover:bg-primary/90"}`}
                >
                  <Send size={14} /> 定稿通知
                </button>
              )}
              {canUploadSigned && (
                <button onClick={() => setShowUploadModal(true)} disabled={acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors">
                  <Upload size={14} /> 上传已签合同
                </button>
              )}
              {contract.signedFileUrl && (
                <a href={contract.signedFileUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  <ExternalLink size={14} /> 查看签署合同
                </a>
              )}
            </div>
          </div>
        </div>

        {/* ── 关联需求信息 ── */}
        {demand && (() => {
          const ds = DEMAND_STATUS[demand.status] ?? { label: demand.status, color: "bg-slate-100 text-slate-500" };
          return (
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText size={14} className="text-slate-400" /> 关联需求
                </h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ds.color}`}>{ds.label}</span>
              </div>

              {/* 基本信息网格 */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-3">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">需求编号</p>
                  <p className="text-xs font-mono text-slate-600">{demand.demandNo}</p>
                </div>
                {demand.demandType && (
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">需求类型</p>
                    <p className="text-xs text-slate-700">{demand.demandType}</p>
                  </div>
                )}
                {(demand.budgetMin != null || demand.budgetMax != null) && (
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5">预算范围</p>
                    <p className="text-xs font-semibold text-slate-700">
                      {demand.budgetMin != null ? `¥${Number(demand.budgetMin).toLocaleString()}` : "—"}
                      {" ~ "}
                      {demand.budgetMax != null ? `¥${Number(demand.budgetMax).toLocaleString()}` : "—"}
                    </p>
                  </div>
                )}
                {demand.hopeDeliveryDate && (
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5 flex items-center gap-1"><Calendar size={11} /> 期望交付</p>
                    <p className="text-xs text-slate-700">{new Date(demand.hopeDeliveryDate).toLocaleDateString("zh-CN")}</p>
                  </div>
                )}
                {demand.publisherNickname && (
                  <div>
                    <p className="text-xs text-slate-400 mb-0.5 flex items-center gap-1"><User size={11} /> 发单方</p>
                    <p className="text-xs text-slate-700">{demand.publisherNickname}</p>
                  </div>
                )}
                {demand.isUrgent && (
                  <div className="flex items-center gap-1 col-span-2">
                    <Zap size={12} className="text-orange-500" />
                    <span className="text-xs font-bold text-orange-600">加急需求</span>
                  </div>
                )}
              </div>

              {/* 需求详情折叠 */}
              {demand.latestVersion?.detail && (
                <div className="border-t border-slate-50 pt-3">
                  <button
                    onClick={() => setShowDemandDetail(v => !v)}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                  >
                    {showDemandDetail ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {showDemandDetail ? "收起需求详情" : "展开需求详情"}
                  </button>
                  {showDemandDetail && (
                    <div className="mt-3 prose prose-sm max-w-none">
                      <MarkdownContent content={demand.latestVersion.detail} />
                    </div>
                  )}
                </div>
              )}

              {/* 附件 */}
              {demand.latestVersion?.attachments?.length > 0 && (
                <div className="mt-3 border-t border-slate-50 pt-3 flex flex-wrap gap-2">
                  {demand.latestVersion.attachments.map((att, i) => (
                    <a key={i} href={att.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-700 border border-blue-100 bg-blue-50 hover:bg-blue-100 rounded-xl px-2.5 py-1 transition-colors">
                      <ExternalLink size={11} /> {att.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 编辑正文面板 ── */}
        {showEditPanel && canEdit && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <p className="text-xs text-slate-500 mb-3">编辑合同正文，保存后不会通知发单方。支持 Markdown 格式。</p>
            <MarkdownEditor value={editContent} onChange={setEditContent} minHeight={280} />
            <div className="flex gap-2 justify-end mt-3">
              <button onClick={() => setShowEditPanel(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleSaveContent} disabled={acting}
                className="px-4 py-2 text-sm bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50">
                {acting ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        )}


        {/* ── 合同内容 ── */}
        {contract.content && !showEditPanel && (
          <Section title="合同内容" icon={FileText}>
            <MarkdownContent content={contract.content} />
          </Section>
        )}

        {/* ── 报价 ── */}
        {quotes.length > 0 && (() => {
          const latest = quotes[0];
          return (
            <Section title={`报价（最新）`} icon={DollarSign}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-2xl font-extrabold text-blue-900">
                  ¥{Number(latest.totalPrice).toLocaleString()}
                </p>
                <span className="text-xs text-slate-400">
                  {latest.createdByNickname && `${latest.createdByNickname} · `}
                  {new Date(latest.updatedAt).toLocaleDateString("zh-CN")}
                </span>
              </div>

              {latest.breakdown.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {latest.breakdown.map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b border-slate-50 pb-1.5 last:border-0">
                      <div>
                        <span className="text-slate-700">{b.item}</span>
                        {b.note && <span className="text-xs text-slate-400 ml-2">{b.note}</span>}
                      </div>
                      <span className="font-semibold text-slate-800">¥{Number(b.amount).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {latest.note && (
                <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-3 py-2">{latest.note}</p>
              )}

              {quotes.length > 1 && (
                <p className="text-xs text-slate-400 mt-2">共 {quotes.length} 个历史报价版本</p>
              )}
            </Section>
          );
        })()}

        {/* ── 付款计划 ── */}
        {contract.clientDemandId && (
          <Section title={`付款计划（${plans.length} 项）`} icon={DollarSign}>
            {plans.length > 0 && (
              <div className="space-y-2 mb-4">
                {plans.map(p => {
                  const ps = PAY_STATUS[p.status] ?? PAY_STATUS.pending;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">
                          #{p.itemNo} {p.description ?? "付款项"}
                        </p>
                        {p.dueDate && (
                          <p className="text-xs text-slate-400">应付：{new Date(p.dueDate).toLocaleDateString("zh-CN")}</p>
                        )}
                      </div>
                      <div className="text-right flex flex-col items-end gap-1">
                        <p className="text-sm font-bold text-slate-800">¥{Number(p.amount).toLocaleString()}</p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ps.color}`}>{ps.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!showAddPlan ? (
              <button
                onClick={() => setShowAddPlan(true)}
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded-xl px-3 py-1.5 transition-colors"
              >
                <PlusCircle size={13} /> 添加付款项
              </button>
            ) : (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-emerald-700">添加付款项</p>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">说明</label>
                  <input value={planDesc} onChange={e => setPlanDesc(e.target.value)} placeholder="如：首付款、尾款"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">金额 (¥)</label>
                    <input type="number" value={planAmount} onChange={e => setPlanAmount(e.target.value)} placeholder="0"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">应付日期</label>
                    <input type="date" value={planDueDate} onChange={e => setPlanDueDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200" />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowAddPlan(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
                  <button onClick={handleAddPlan} disabled={acting}
                    className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50">
                    {acting ? "添加中…" : "添加"}
                  </button>
                </div>
              </div>
            )}
          </Section>
        )}

      </div>

      {/* ── 定稿通知确认 Modal ── */}
      {showFinalizeConfirm && canFinalize && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-blue-900">定稿并通知发单方</h3>
              <button onClick={() => setShowFinalizeConfirm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-600 mb-3">操作后合同状态变为「待发单方确认」，发单方将立即收到通知。</p>
            <p className="text-xs text-slate-400 mb-4">请确保合同正文与付款计划均已准备好再发送。</p>
            {plans.length === 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
                <DollarSign size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 font-medium">尚未添加任何付款项，请先在付款计划中添加后再定稿。</p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowFinalizeConfirm(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleFinalize} disabled={acting || plans.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
                <Send size={13} /> {acting ? "发送中…" : "确认发送"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 上传已签合同 Modal ── */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-blue-900">上传已签合同 PDF</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-500">上传双方签署后的合同 PDF，上传后需求状态将进入执行中。</p>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                <input type="file" accept=".pdf,.jpg,.png" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-600" />
                {selectedFile && <p className="mt-2 text-xs text-slate-500">已选：{selectedFile.name}</p>}
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
                <button onClick={handleUploadSigned} disabled={uploadingFile || !selectedFile}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50">
                  {uploadingFile ? "上传中…" : "上传并标记已签"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminV2Layout>
  );
}
