import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  Loader2, AlertCircle, CheckCircle2,
  DollarSign, Plus, Trash2, Send, FileText, History, X,
  ChevronDown, ChevronUp, Paperclip, ArrowRight,
  Hash, Tag, CalendarDays, Globe, Mail,
} from "lucide-react";
import { v2Get, v2Post } from "@/lib/v2api";
import { useToast } from "@/hooks/use-toast";
import { markRead } from "@/lib/demandRead";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { MarkdownContent } from "@/components/MarkdownContent";
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

interface DemandVersion {
  id: number;
  versionNo: number;
  detail: string | null;
  attachments: Array<{ name: string; url: string }>;
  editedByNickname: string | null;
  editedByRole: "publisher" | "opc" | "admin" | null;
  editComment: string | null;
  createdAt: string;
}

const VERSION_ROLE_LABEL: Record<string, string> = {
  publisher: "发单方",
  opc: "OPC",
  admin: "运营方",
};

interface DemandInfo {
  id: number;
  demandNo: string | null;
  title: string;
  demandType: string | null;
  isUrgent: boolean;
  mode: "public" | "invited";
  expectedPriceMin: number | null;
  expectedPriceMax: number | null;
  status: string;
  detail: string | null;
  latestVersion: DemandVersion | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; guidance: string }> = {
  negotiating: {
    label: "洽谈中",
    color: "bg-blue-100 text-blue-700",
    guidance: "✍️ 请与平台沟通方案、提疑问，确定方案后提交报价才算正式投标。",
  },
  quoted: {
    label: "已报价",
    color: "bg-amber-100 text-amber-700",
    guidance: "⏳ 报价已提交，等待平台评选。如需求有变动，可修改报价后重新提交。",
  },
  won: {
    label: "已中标",
    color: "bg-green-100 text-green-700",
    guidance: "🎉 恭喜中标！请前往「我的订单」确认合同并签约，开始执行。",
  },
  lost: {
    label: "未中标",
    color: "bg-slate-100 text-slate-500",
    guidance: "😔 这次没有中标。需求详情仍可查看。加油，下次机会更好！",
  },
};

const DEMAND_TYPE_LABELS: Record<string, string> = {
  education: "教育培训",
  software: "软件开发",
  marketing: "营销",
  content: "内容设计",
  other: "其他",
};

function formatBudgetRange(min: number | null, max: number | null) {
  if (!min && !max) return "面议";
  if (min && max) return `¥${min.toLocaleString()} ~ ¥${max.toLocaleString()}`;
  if (min) return `¥${min.toLocaleString()} 起`;
  if (max) return `最高 ¥${max.toLocaleString()}`;
  return "面议";
}

export default function OpcV2TenderDetail() {
  const { id } = useParams<{ id: string }>();
  const tenderId = parseInt(id ?? "0");
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: tender, isLoading, isError, refetch, dataUpdatedAt: tenderDataUpdatedAt } = useQuery<TenderDetail>({
    queryKey: ["v2-opc-tender", tenderId],
    queryFn: () => v2Get(`/tenders/${tenderId}`),
    enabled: !!tenderId,
  });

  const { data: demand } = useQuery<DemandInfo>({
    queryKey: ["v2-demand-detail", tender?.outsourceDemandId],
    queryFn: () => v2Get(`/outsource-demands/${tender!.outsourceDemandId}`),
    enabled: !!tender?.outsourceDemandId,
  });

  useEffect(() => {
    if (!tender?.outsourceDemandId) return;
    markRead("outsource", tender.outsourceDemandId);
  }, [tender?.outsourceDemandId, tenderDataUpdatedAt]);

  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
  const { data: versions = [] } = useQuery<DemandVersion[]>({
    queryKey: ["v2-demand-versions", tender?.outsourceDemandId],
    queryFn: () => v2Get(`/outsource-demands/${tender!.outsourceDemandId}/versions`),
    enabled: showVersions && !!tender?.outsourceDemandId,
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

  const cfg = STATUS_CONFIG[tender.status] ?? { label: tender.status, color: "bg-slate-100 text-slate-500", guidance: "" };
  const isLost = tender.status === "lost";
  const canSubmitQuote = !isLost && (tender.status === "negotiating" || tender.status === "quoted");

  return (
    <OpcV2Layout
      title={tender.demandTitle ?? `投标 #${tender.id}`}
      backHref="/opc/tenders"
      backLabel="我的投标"
    >
      <div className="py-6 space-y-6">

        {/* Status + guidance */}
        <div className={`flex items-start gap-3 px-5 py-4 rounded-2xl border ${
          tender.status === "won" ? "bg-green-50 border-green-200" :
          tender.status === "lost" ? "bg-slate-50 border-slate-200" :
          "bg-blue-50 border-blue-200"
        }`}>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
              <span className="text-xs text-slate-400">
                报名于 {new Date(tender.createdAt).toLocaleDateString("zh-CN")}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-700">{cfg.guidance}</p>
            {tender.status === "won" && (
              <button
                onClick={() => navigate("/opc/orders")}
                className="mt-2 flex items-center gap-1.5 text-sm font-bold text-green-700 hover:text-green-900"
              >
                前往我的订单 <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* ── Basic info block ── */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <Tag size={15} className="text-primary" />
            <h3 className="font-bold text-foreground text-sm">需求基本信息</h3>
          </div>
          {demand ? (
            <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {demand.demandNo && (
                <div className="col-span-2 flex items-center gap-2">
                  <Hash size={13} className="text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground text-xs">编号</span>
                  <span className="font-mono text-xs font-bold text-foreground">{demand.demandNo}</span>
                </div>
              )}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">需求类型</p>
                <p className="font-bold text-foreground text-sm">
                  {demand.demandType ? (DEMAND_TYPE_LABELS[demand.demandType] ?? demand.demandType) : "—"}
                  {demand.isUrgent && (
                    <span className="ml-1.5 text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">紧急</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">来源</p>
                <p className="flex items-center gap-1 font-bold text-sm">
                  {demand.mode === "invited"
                    ? <><Mail size={13} className="text-violet-500" /><span className="text-violet-700">邀请</span></>
                    : <><Globe size={13} className="text-sky-500" /><span className="text-sky-700">大厅公开</span></>
                  }
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">平台参考价</p>
                <p className="font-black text-primary text-base">
                  {formatBudgetRange(demand.expectedPriceMin, demand.expectedPriceMax)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">报价应在此区间内</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">发布时间</p>
                <p className="flex items-center gap-1 text-foreground text-sm">
                  <CalendarDays size={12} className="text-muted-foreground" />
                  {new Date(demand.createdAt).toLocaleDateString("zh-CN")}
                </p>
              </div>
            </div>
          ) : (
            <div className="px-5 py-4 flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 size={14} className="animate-spin" /> 加载中…
            </div>
          )}
        </div>

        {/* ── Demand detail ── */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText size={15} className="text-primary" />
              <h3 className="font-bold text-foreground text-sm">需求详情</h3>
              {demand?.latestVersion && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  v{demand.latestVersion.versionNo}
                </span>
              )}
            </div>
          </div>

          <div className="px-5 py-4 space-y-3">
            {demand ? (
              <>
                {(demand.latestVersion?.detail || demand.detail) ? (
                  <div className="bg-muted/40 rounded-xl p-4 border border-border">
                    <MarkdownContent content={demand.latestVersion?.detail ?? demand.detail ?? ""} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">需求详情待补充</p>
                )}

                {demand.latestVersion?.attachments && demand.latestVersion.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {demand.latestVersion.attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-muted text-foreground text-xs font-medium rounded-lg hover:bg-muted/80 transition-colors"
                      >
                        <Paperclip size={11} /> {att.name}
                      </a>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 size={14} className="animate-spin" /> 加载需求详情…
              </div>
            )}
          </div>

          <div className="px-5 pb-4">
            <button
              onClick={() => setShowVersions(v => !v)}
              className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-primary transition-colors"
            >
              <History size={13} />
              {showVersions ? "收起历史版本" : "查看历史版本"}
              {showVersions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        {/* My quote */}
        {tender.priceBreakdown && tender.priceBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
              <DollarSign size={16} className="text-emerald-600" />
              <h3 className="font-bold text-slate-800">我的报价明细</h3>
              {tender.totalPrice && (
                <span className="ml-auto text-base font-black text-emerald-700">总计 ¥{tender.totalPrice.toLocaleString()}</span>
              )}
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
            </div>
            {tender.quotedAt && (
              <div className="px-5 py-3 bg-slate-50 text-xs text-slate-400">
                提交于 {new Date(tender.quotedAt).toLocaleDateString("zh-CN")}
              </div>
            )}
          </div>
        )}

        {/* Quote form */}
        {canSubmitQuote && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Send size={16} className="text-emerald-600" />
                <h3 className="font-bold text-slate-800">
                  {tender.totalPrice ? "修改报价" : "提交报价"}
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

            {!showForm && !tender.totalPrice && (
              <div className="px-5 py-4 text-sm text-slate-500">
                💡 在下方讨论区与平台确认方案后，提交报价才算正式投标。
              </div>
            )}

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
                  {demand?.expectedPriceMin || demand?.expectedPriceMax ? (
                    <p className="text-[11px] text-emerald-600 mt-1">
                      参考区间：{formatBudgetRange(demand.expectedPriceMin, demand.expectedPriceMax)}
                    </p>
                  ) : null}
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
          </div>
        )}

        {/* Discussion */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">沟通讨论</h3>
            <p className="text-xs text-slate-400 mt-0.5">与平台就此投标的讨论（仅本人和运营可见）</p>
          </div>
          <div className="p-5">
            <DiscussionThread parentType="v2_tender" parentId={tenderId} readOnly={isLost} onAfterPost={() => tender && markRead("outsource", tender.outsourceDemandId)} />
            {isLost && (
              <p className="mt-3 text-xs text-slate-400 italic text-center">未中标的投标仅供查看，无法继续回复</p>
            )}
          </div>
        </div>
      </div>
      {/* ── Version Diff Modal ── */}
      {showVersions && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col" style={{ maxHeight: "90vh" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <History size={15} className="text-emerald-600" />
                <span className="text-sm font-extrabold text-slate-800">历史版本对比</span>
                {demand?.latestVersion && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">当前 v{demand.latestVersion.versionNo}</span>}
              </div>
              <button onClick={() => setShowVersions(false)} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
            </div>
            {versions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">
                <Loader2 size={16} className="animate-spin mr-2" /> 加载中…
              </div>
            ) : versions.length <= 1 ? (
              <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">暂无更早的历史版本</div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 overflow-x-auto shrink-0">
                  <span className="text-xs text-slate-400 shrink-0 mr-1">选择历史版本：</span>
                  {versions.slice(1).map((v, i) => (
                    <button key={v.id} onClick={() => setSelectedVersionIdx(i)}
                      className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors border ${selectedVersionIdx === i ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-500 border-slate-200 hover:border-emerald-500 hover:text-emerald-600"}`}>
                      v{v.versionNo}{v.editedByRole ? ` · ${VERSION_ROLE_LABEL[v.editedByRole] ?? v.editedByRole}` : ""}
                    </button>
                  ))}
                </div>
                {(() => {
                  const hist = versions.slice(1)[selectedVersionIdx] ?? versions[1];
                  const curr = versions[0];
                  const renderPanel = (v: DemandVersion, isCurrent: boolean) => (
                    <div className={`overflow-y-auto min-h-0 p-5 ${isCurrent ? "bg-emerald-50/20" : ""}`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCurrent ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          v{v.versionNo} {isCurrent ? "当前" : "历史"}
                        </span>
                        <span className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleDateString("zh-CN")}</span>
                      </div>
                      {(v.editedByRole || v.editedByNickname) && (
                        <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                          <span className="bg-slate-200 text-slate-600 rounded px-1 py-0.5 font-medium">{v.editedByRole ? VERSION_ROLE_LABEL[v.editedByRole] ?? v.editedByRole : ""}</span>
                          {v.editedByNickname && <span>{v.editedByNickname}</span>}
                          <span className="text-slate-400">修改</span>
                        </p>
                      )}
                      <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {v.detail ?? ""}
                      </div>
                      {v.attachments?.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {v.attachments.map((a, i) => (
                            <a key={i} href={a.url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1.5 text-xs text-emerald-600 hover:underline">
                              <Paperclip size={11} /> {a.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                  return (
                    <div className="flex-1 grid grid-cols-2 min-h-0 divide-x divide-slate-100" style={{ overflow: "hidden" }}>
                      {renderPanel(hist, false)}
                      {renderPanel(curr, true)}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}
    </OpcV2Layout>
  );
}
