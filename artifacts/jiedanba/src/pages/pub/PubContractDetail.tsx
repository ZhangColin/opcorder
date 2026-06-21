import { useState, useEffect } from "react";
import { useParams } from "wouter";
import {
  FileSignature, Loader2, AlertCircle, CheckCircle2, XCircle, ExternalLink,
  Clock, DollarSign, ChevronDown, ChevronUp, Zap, Calendar, Receipt,
} from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { v2Get, v2Post } from "@/lib/v2api";
import { markRead } from "@/lib/demandRead";
import { useToast } from "@/hooks/use-toast";
import { MarkdownContent } from "@/components/MarkdownContent";

interface Contract {
  id: number;
  contractNo: string;
  channel: string;
  clientDemandId: number | null;
  content: string | null;
  status: string;
  signedFileUrl: string | null;
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
  latestVersion: { detail: string; attachments: Array<{ name: string; url: string }> } | null;
}

interface QuotationCard {
  id: number;
  totalPrice: number;
  breakdown: Array<{ item: string; amount: number; note?: string }>;
  note: string | null;
  createdAt: string;
}

interface PaymentPlan {
  id: number;
  itemNo: number;
  description: string | null;
  amount: number;
  dueDate: string;
  status: string;
}

const PAY_STATUS: Record<string, { label: string; color: string }> = {
  pending:         { label: "待付款", color: "text-amber-700 bg-amber-50" },
  awaiting_review: { label: "待审核", color: "text-blue-700 bg-blue-50" },
  paid:            { label: "已付款", color: "text-green-700 bg-green-50" },
  overdue:         { label: "已逾期", color: "text-red-700 bg-red-50" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:                    { label: "草稿",     color: "bg-slate-100 text-slate-500" },
  pending_publisher_confirm:{ label: "待您确认", color: "bg-amber-100 text-amber-700" },
  publisher_rejected:       { label: "您已退回", color: "bg-red-100 text-red-600" },
  pending_sign:             { label: "待签约",   color: "bg-orange-100 text-orange-700" },
  signed:                   { label: "已签约",   color: "bg-green-100 text-green-700" },
};

export default function PubContractDetail() {
  const params = useParams<{ id: string }>();
  const contractId = parseInt(params.id ?? "0", 10);
  const { toast } = useToast();

  const [contract, setContract] = useState<Contract | null>(null);
  const [demand, setDemand] = useState<Demand | null>(null);
  const [quotes, setQuotes] = useState<QuotationCard[]>([]);
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDemandDetail, setShowDemandDetail] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await v2Get<Contract>(`/contracts/${contractId}`);
      setContract(data);
      markRead("contract", contractId);
      if (data.clientDemandId) {
        const [dem, qs, ps] = await Promise.all([
          v2Get<Demand>(`/client-demands/${data.clientDemandId}`).catch(() => null),
          v2Get<QuotationCard[]>(`/quotation-cards?clientDemandId=${data.clientDemandId}`).catch(() => [] as QuotationCard[]),
          v2Get<PaymentPlan[]>(`/payment-plans?clientDemandId=${data.clientDemandId}&contractId=${contractId}`).catch(() => [] as PaymentPlan[]),
        ]);
        setDemand(dem);
        setQuotes(Array.isArray(qs) ? qs.slice(0, 1) : []); // 只取最新一条
        setPlans(Array.isArray(ps) ? ps : []);
      }
    } catch {
      setContract(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (contractId > 0) load(); }, [contractId]);

  const handleConfirm = async () => {
    setActing(true);
    try {
      await v2Post(`/contracts/${contractId}/publisher-confirm`);
      toast({ title: "已确认合同，等待运营方签署" });
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({ title: "请填写退回说明", variant: "destructive" });
      return;
    }
    setActing(true);
    try {
      await v2Post(`/contracts/${contractId}/publisher-reject`, { reason: rejectReason.trim() });
      toast({ title: "已退回合同，运营方将重新修订" });
      setShowRejectModal(false);
      setRejectReason("");
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <PubLayout title="合同详情" backHref="/pub/contracts" backLabel="合同列表">
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
        </div>
      </PubLayout>
    );
  }

  if (!contract) {
    return (
      <PubLayout title="合同详情" backHref="/pub/contracts" backLabel="合同列表">
        <div className="flex flex-col items-center py-24 text-slate-400">
          <AlertCircle size={36} className="mb-3 text-slate-300" />
          <p>合同不存在</p>
        </div>
      </PubLayout>
    );
  }

  const cfg = STATUS_CONFIG[contract.status] ?? { label: contract.status, color: "bg-slate-100 text-slate-500" };
  const canAct = contract.status === "pending_publisher_confirm";
  const quote = quotes[0] ?? null;

  return (
    <PubLayout title={demand?.title ?? `合同 ${contract.contractNo}`} backHref="/pub/contracts" backLabel="合同列表">
      <div className="mt-6 space-y-5">

        {/* ── 状态卡片 ── */}
        <div className={`rounded-2xl border p-5 flex items-center gap-4 ${
          canAct ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"
        }`}>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileSignature size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
              <span className="text-xs text-slate-400 font-mono">{contract.contractNo}</span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Clock size={11} />
              更新于 {new Date(contract.updatedAt).toLocaleDateString("zh-CN")}
            </p>
          </div>
          {contract.status === "signed" && (
            <CheckCircle2 size={20} className="text-green-500 shrink-0" />
          )}
        </div>

        {/* ── 关联需求信息 ── */}
        {demand && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3">需求信息</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
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
              {demand.isUrgent && (
                <div className="flex items-center gap-1 col-span-2">
                  <Zap size={12} className="text-orange-500" />
                  <span className="text-xs font-bold text-orange-600">加急需求</span>
                </div>
              )}
            </div>
            {demand.latestVersion?.detail && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <button
                  onClick={() => setShowDemandDetail(v => !v)}
                  className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 transition-colors"
                >
                  {showDemandDetail ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {showDemandDetail ? "收起需求详情" : "展开需求详情"}
                </button>
                {showDemandDetail && (
                  <div className="mt-3">
                    <MarkdownContent content={demand.latestVersion.detail} />
                  </div>
                )}
              </div>
            )}
            {demand.latestVersion?.attachments?.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3 flex flex-wrap gap-2">
                {demand.latestVersion.attachments.map((att, i) => (
                  <a key={i} href={att.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-700 border border-blue-100 bg-blue-50 hover:bg-blue-100 rounded-xl px-2.5 py-1 transition-colors">
                    <ExternalLink size={11} /> {att.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 报价 ── */}
        {quote && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <Receipt size={14} className="text-slate-400" /> 报价
            </h3>
            <div className="space-y-1.5 mb-3">
              {quote.breakdown.map((b, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-slate-500">{b.item}</span>
                  <span className="font-semibold text-slate-700">¥{Number(b.amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-700">合计</span>
              <span className="text-lg font-extrabold text-primary">¥{Number(quote.totalPrice).toLocaleString()}</span>
            </div>
            {quote.note && (
              <p className="text-xs text-slate-400 mt-2">{quote.note}</p>
            )}
          </div>
        )}

        {/* ── 付款计划 ── */}
        {plans.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
              <DollarSign size={14} className="text-slate-400" /> 付款计划
            </h3>
            <div className="space-y-0">
              {plans.map(p => {
                const ps = PAY_STATUS[p.status] ?? PAY_STATUS.pending;
                return (
                  <div key={p.id} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        第 {p.itemNo} 期{p.description ? `·${p.description}` : ""}
                      </p>
                      {p.dueDate && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          应付：{new Date(p.dueDate).toLocaleDateString("zh-CN")}
                        </p>
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
          </div>
        )}

        {/* ── 操作 banner（待确认） ── */}
        {canAct && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-amber-800 mb-1">运营方已完成合同定稿，请您仔细阅读后操作</p>
            <p className="text-xs text-amber-600 mb-4">确认后合同将进入签约流程；如有异议请退回并说明原因</p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={acting}
                className="flex items-center gap-2 bg-green-600 text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                确认合同
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={acting}
                className="flex items-center gap-2 bg-white border border-red-200 text-red-600 rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <XCircle size={14} /> 退回修改
              </button>
            </div>
          </div>
        )}

        {/* ── 退回说明 ── */}
        {contract.status === "publisher_rejected" && contract.publisherRejectedReason && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <p className="text-xs font-bold text-red-700 mb-1">您的退回说明</p>
            <p className="text-sm text-red-800">{contract.publisherRejectedReason}</p>
            <p className="text-xs text-red-400 mt-2">运营方正在修订合同内容</p>
          </div>
        )}

        {/* ── 已签约文件 ── */}
        {contract.signedFileUrl && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">已签约合同文件</h3>
            <a href={contract.signedFileUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline">
              <ExternalLink size={14} /> 查看 / 下载签约文件
            </a>
          </div>
        )}

        {/* ── 合同正文 ── */}
        {contract.content && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">合同正文</h3>
            <MarkdownContent content={contract.content} />
          </div>
        )}

        {!contract.content && contract.status === "draft" && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
            <FileSignature size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">合同内容正在起草中</p>
            <p className="text-xs mt-1">运营方完成定稿后将通知您确认</p>
          </div>
        )}
      </div>

      {/* ── 退回合同 Modal ── */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-extrabold text-slate-800 mb-2">退回合同</h3>
            <p className="text-sm text-slate-500 mb-4">请说明退回原因，运营方将据此修订合同内容</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="例如：合同条款第3条与商定内容不符，请修改付款周期…"
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(""); }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={acting || !rejectReason.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {acting && <Loader2 size={14} className="animate-spin" />}
                确认退回
              </button>
            </div>
          </div>
        </div>
      )}
    </PubLayout>
  );
}
