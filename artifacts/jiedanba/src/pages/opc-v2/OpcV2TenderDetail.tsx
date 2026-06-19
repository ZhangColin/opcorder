import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "wouter";
import {
  Loader2, AlertCircle, CheckCircle2, XCircle, Clock,
  DollarSign, Plus, Trash2, Send,
} from "lucide-react";
import { v2Get, v2Post } from "@/lib/v2api";
import { useToast } from "@/hooks/use-toast";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { OpcV2Layout } from "./OpcV2Layout";

interface PriceBreakdownItem {
  item: string;
  amount: number;
  note?: string;
}

interface TenderDetail {
  id: number;
  outsourceDemandId: number;
  demandTitle: string | null;
  opcId: number;
  opcNickname: string | null;
  status: string;
  totalPrice: number | null;
  priceBreakdown: PriceBreakdownItem[];
  quotedAt: string | null;
  selectedAt: string | null;
  cancelledReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  negotiating: { label: "洽谈中·等待平台安排", color: "bg-blue-100 text-blue-700" },
  quoted:      { label: "已提交报价·等待审核", color: "bg-amber-100 text-amber-700" },
  won:         { label: "已中标",               color: "bg-green-100 text-green-700" },
  lost:        { label: "未中标",               color: "bg-slate-100 text-slate-500" },
};

export default function OpcV2TenderDetail() {
  const { id } = useParams<{ id: string }>();
  const tenderId = parseInt(id ?? "0");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: tender, isLoading, isError, refetch } = useQuery<TenderDetail>({
    queryKey: ["v2-opc-tender", tenderId],
    queryFn: () => v2Get(`/tenders/${tenderId}`),
    enabled: !!tenderId,
  });

  const [totalPrice, setTotalPrice] = useState("");
  const [breakdown, setBreakdown] = useState<PriceBreakdownItem[]>([{ item: "", amount: 0, note: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  function addBreakdownItem() {
    setBreakdown(prev => [...prev, { item: "", amount: 0, note: "" }]);
  }

  function removeBreakdownItem(idx: number) {
    setBreakdown(prev => prev.filter((_, i) => i !== idx));
  }

  function updateBreakdownItem(idx: number, field: keyof PriceBreakdownItem, value: string | number) {
    setBreakdown(prev => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  }

  async function handleSubmitQuote(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(totalPrice);
    if (!price || price <= 0) {
      toast({ title: "请输入有效的报价金额", variant: "destructive" });
      return;
    }
    const validBreakdown = breakdown.filter(b => b.item.trim() && b.amount > 0);
    setSubmitting(true);
    try {
      await v2Post(`/tenders/${tenderId}/submit-quote`, {
        totalPrice: price,
        priceBreakdown: validBreakdown,
      });
      toast({ title: "报价已提交", description: "平台收到后将安排审核" });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["v2-opc-tender", tenderId] });
      qc.invalidateQueries({ queryKey: ["v2-opc-tenders"] });
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "请稍后重试";
      toast({ title: "提交失败", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <OpcV2Layout title="投标详情" backHref="/opc/tenders" backLabel="我的投标">
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" /> 加载中…
        </div>
      </OpcV2Layout>
    );
  }

  if (isError || !tender) {
    return (
      <OpcV2Layout title="投标详情" backHref="/opc/tenders" backLabel="我的投标">
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 mt-6">
          <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
          <p className="text-sm text-red-500 font-medium">加载失败，请返回重试</p>
        </div>
      </OpcV2Layout>
    );
  }

  const cfg = STATUS_CONFIG[tender.status] ?? { label: tender.status, color: "bg-slate-100 text-slate-500" };
  const canSubmitQuote = tender.status === "negotiating" || tender.status === "quoted";

  return (
    <OpcV2Layout
      title={tender.demandTitle ?? `投标 #${tender.id}`}
      backHref="/opc/tenders"
      backLabel="我的投标"
    >
      <div className="py-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h2 className="text-xl font-black text-slate-800 mb-2">
                {tender.demandTitle ?? `需求 #${tender.outsourceDemandId}`}
              </h2>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${cfg.color}`}>
                {cfg.label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">报名时间</p>
              <p className="text-sm font-bold text-slate-700">{new Date(tender.createdAt).toLocaleDateString("zh-CN")}</p>
            </div>
            {tender.totalPrice && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">我的报价</p>
                <p className="text-sm font-bold text-emerald-700">¥{tender.totalPrice.toLocaleString()}</p>
              </div>
            )}
            {tender.quotedAt && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">报价时间</p>
                <p className="text-sm font-bold text-slate-700">{new Date(tender.quotedAt).toLocaleDateString("zh-CN")}</p>
              </div>
            )}
            {tender.selectedAt && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">中标时间</p>
                <p className="text-sm font-bold text-green-700">{new Date(tender.selectedAt).toLocaleDateString("zh-CN")}</p>
              </div>
            )}
          </div>

          {tender.status === "won" && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle2 size={18} className="text-green-600 shrink-0" />
              <p className="text-sm font-bold text-green-700">
                恭喜中标！请前往「我的订单」查看合同及执行详情。
              </p>
            </div>
          )}
          {tender.status === "lost" && (
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
              <XCircle size={18} className="text-slate-400 shrink-0" />
              <p className="text-sm text-slate-500">
                此次未能中标。{tender.cancelledReason && `原因：${tender.cancelledReason}`}
              </p>
            </div>
          )}
        </div>

        {tender.priceBreakdown && tender.priceBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <DollarSign size={16} className="text-emerald-600" />
              <h3 className="font-bold text-slate-800">报价明细</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {tender.priceBreakdown.map((row, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-700">{row.item}</p>
                    {row.note && <p className="text-xs text-slate-400 mt-0.5">{row.note}</p>}
                  </div>
                  <p className="font-bold text-slate-800">¥{row.amount.toLocaleString()}</p>
                </div>
              ))}
              {tender.totalPrice && (
                <div className="flex items-center justify-between px-5 py-3 bg-slate-50">
                  <p className="text-sm font-extrabold text-slate-800">总计</p>
                  <p className="text-base font-extrabold text-emerald-700">¥{tender.totalPrice.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {canSubmitQuote && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Send size={16} className="text-emerald-600" />
                <h3 className="font-bold text-slate-800">
                  {tender.totalPrice ? "更新报价" : "提交报价"}
                </h3>
              </div>
              {!showForm && (
                <button
                  onClick={() => {
                    if (tender.totalPrice) {
                      setTotalPrice(String(tender.totalPrice));
                      setBreakdown(tender.priceBreakdown?.length > 0 ? tender.priceBreakdown : [{ item: "", amount: 0, note: "" }]);
                    }
                    setShowForm(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-lg hover:bg-emerald-800 transition-colors"
                >
                  {tender.totalPrice ? "修改报价" : "填写报价"}
                </button>
              )}
            </div>

            {showForm && (
              <form onSubmit={handleSubmitQuote} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    总报价金额 (¥) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={totalPrice}
                    onChange={e => setTotalPrice(e.target.value)}
                    placeholder="例: 50000"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-600">报价明细（可选）</label>
                    <button
                      type="button"
                      onClick={addBreakdownItem}
                      className="flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 font-bold"
                    >
                      <Plus size={12} /> 添加项目
                    </button>
                  </div>
                  <div className="space-y-2">
                    {breakdown.map((b, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <input
                          type="text"
                          value={b.item}
                          onChange={e => updateBreakdownItem(idx, "item", e.target.value)}
                          placeholder="项目名称"
                          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                        <input
                          type="number"
                          min="0"
                          value={b.amount || ""}
                          onChange={e => updateBreakdownItem(idx, "amount", parseFloat(e.target.value) || 0)}
                          placeholder="金额"
                          className="w-28 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                        <input
                          type="text"
                          value={b.note ?? ""}
                          onChange={e => updateBreakdownItem(idx, "note", e.target.value)}
                          placeholder="备注"
                          className="w-28 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeBreakdownItem(idx)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-700 text-white text-sm font-bold rounded-xl hover:bg-emerald-800 transition-colors disabled:opacity-60"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    提交报价
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    取消
                  </button>
                </div>
              </form>
            )}

            {!showForm && !tender.totalPrice && (
              <div className="px-5 py-4 text-sm text-slate-500">
                报名成功后，平台会与您沟通洽谈，确认方案后请提交报价。
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">沟通记录</h3>
            <p className="text-xs text-slate-400 mt-0.5">与平台就此投标的讨论</p>
          </div>
          <div className="p-5">
            <DiscussionThread parentType="v2_tender" parentId={tenderId} />
          </div>
        </div>
      </div>
    </OpcV2Layout>
  );
}
