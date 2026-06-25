import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import {
  Loader2, AlertCircle, CheckCircle2,
  DollarSign, Plus, Trash2, Send, FileText, History, X,
  ChevronDown, ChevronUp, Paperclip, ArrowRight,
  Hash, Tag, CalendarDays, Globe, Mail, Flag,
} from "lucide-react";
import { v2Get, v2Post } from "@/lib/v2api";
import { useDemandTypeLabel } from "@/lib/catCategories";
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

interface QuoteTierData {
  id: number; tier: string; tierLabel: string;
  basePrice: number; coefficient?: number | null;
  description?: string | null; sortOrder: number;
}
interface QuoteDimData {
  id: number; code: string; label: string;
  sortOrder: number; tiers: QuoteTierData[];
}
interface QuoteCategoryConfig {
  category: string;
  base: QuoteDimData[];
  adjustment: QuoteDimData[];
  optional: QuoteDimData[];
}
const V2_DEMAND_CATEGORY_MAP: Record<string, string | null> = {
  content: "content", education: "education", software: "software", marketing: "marketing",
  CG: "content", SA: "software", TK: "education", BO: "marketing",
  cg: "content", sa: "software", tk: "education", bo: "marketing",
  OTHER: null, other: null,
};
const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

interface Milestone {
  name: string;
  deadline?: string;
  description?: string;
}

interface DemandInfo {
  id: number;
  demandNo: string | null;
  title: string;
  demandType: string | null;
  isUrgent: boolean;
  mode: "public" | "invited";
  expectedPriceMin: number | null;
  expectedPriceMax: number | null;
  milestones: Milestone[];
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
  const { resolveDemandType } = useDemandTypeLabel();
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
    markRead("tender", tenderId);
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

  // 报价卡
  const [showQuoteOverlay, setShowQuoteOverlay] = useState(false);
  const [quoteSelections, setQuoteSelections] = useState<Record<string, string>>({});
  const [adjustmentPercent, setAdjustmentPercent] = useState(0);
  const [maintenancePackage, setMaintenancePackage] = useState("none");
  const [quoteConfig, setQuoteConfig] = useState<QuoteCategoryConfig | null>(null);
  const [quoteConfigLoading, setQuoteConfigLoading] = useState(false);
  const [quoteNote, setQuoteNote] = useState("");
  const pendingRestoreRef = useRef<PriceBreakdownItem[] | null>(null);

  const baseDims = quoteConfig?.base ?? [];
  const adjustDims = quoteConfig?.adjustment ?? [];
  const hasQuoteCard = baseDims.length > 0 || adjustDims.length > 0;
  const maintTiers = (quoteConfig?.optional ?? []).find(d => d.code === "MAINT")?.tiers ?? [];
  const selectedMaintTier = maintTiers.find(t => t.tier === maintenancePackage);

  const quoteTotals = useMemo(() => {
    const rawBase = baseDims.reduce((sum, dim) => {
      const tier = dim.tiers.find(t => t.tier === quoteSelections[dim.code]);
      return sum + (tier?.basePrice ?? 0);
    }, 0);
    const clampedAdj = Math.max(-20, Math.min(20, adjustmentPercent || 0));
    const calibratedBase = Math.round(rawBase * (1 + clampedAdj / 100));
    const factorProduct = adjustDims.reduce((prod, dim) => {
      const tier = dim.tiers.find(t => t.tier === quoteSelections[dim.code]);
      return prod * (tier?.coefficient ?? 1);
    }, 1);
    const adjustedPrice = Math.round(calibratedBase * factorProduct);
    const maintRate = selectedMaintTier?.coefficient ?? 0;
    const maintenanceFee = Math.round(adjustedPrice * maintRate);
    const finalPrice = adjustedPrice + maintenanceFee;
    return { rawBase, clampedAdj, calibratedBase, factorProduct, adjustedPrice, maintenanceFee, finalPrice };
  }, [quoteSelections, quoteConfig, adjustmentPercent, maintenancePackage, baseDims, adjustDims, selectedMaintTier]);

  /* 从 breakdown 反推并回填报价卡选项（定义在 useEffect 之前，避免 undefined 引用） */
  const applyBreakdownRestore = useCallback((cfg: QuoteCategoryConfig, bd: PriceBreakdownItem[]) => {
    const noteItem = bd.find(b => b.item === "备注");
    if (noteItem?.note) setQuoteNote(noteItem.note);

    const adjItem = bd.find(b => b.item.startsWith("综合调整"));
    if (adjItem) {
      const m = adjItem.item.match(/([+-]?\d+)%/);
      if (m) setAdjustmentPercent(parseInt(m[1], 10));
    }

    const maintTiers = (cfg.optional ?? []).find(d => d.code === "MAINT")?.tiers ?? [];
    const maintItem = bd.find(b => b.item.startsWith("维护包"));
    if (maintItem) {
      const matched = maintTiers.find(t => maintItem.item.includes(t.tierLabel));
      if (matched) setMaintenancePackage(matched.tier);
    }

    const allDims = [...(cfg.base ?? []), ...(cfg.adjustment ?? [])];
    const selections: Record<string, string> = {};
    for (const dim of allDims) {
      for (const tier of dim.tiers) {
        if (bd.some(b => b.item === `${dim.label}（${tier.tierLabel}）`)) {
          selections[dim.code] = tier.tier;
          break;
        }
      }
    }
    setQuoteSelections(selections);
  }, []);

  useEffect(() => {
    if (!showQuoteOverlay) return;
    const category = V2_DEMAND_CATEGORY_MAP[demand?.demandType ?? ""] ?? null;
    if (!category) { setQuoteConfig(null); return; }
    setQuoteConfigLoading(true);
    fetch(`${API_BASE}/api/quote-card/config?category=${category}`)
      .then(r => r.json())
      .then((cfg: QuoteCategoryConfig) => {
        setQuoteConfig(cfg);
        const bd = pendingRestoreRef.current;
        if (bd?.length) {
          pendingRestoreRef.current = null;
          applyBreakdownRestore(cfg, bd);
        }
      })
      .catch(() => setQuoteConfig(null))
      .finally(() => setQuoteConfigLoading(false));
  }, [showQuoteOverlay, demand?.demandType, applyBreakdownRestore]);

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

  async function handleSubmitQuoteCard() {
    if (quoteTotals.finalPrice <= 0) {
      toast({ title: "请先完成报价卡各项选择", variant: "destructive" });
      return;
    }
    const totalPrice = quoteTotals.finalPrice;
    const bd: PriceBreakdownItem[] = [];
    baseDims.filter(d => quoteSelections[d.code]).forEach(dim => {
      const tier = dim.tiers.find(t => t.tier === quoteSelections[dim.code]);
      if (tier) bd.push({ item: `${dim.label}（${tier.tierLabel}）`, amount: tier.basePrice });
    });
    if (quoteTotals.clampedAdj !== 0) {
      const delta = quoteTotals.calibratedBase - quoteTotals.rawBase;
      bd.push({ item: `综合调整（${quoteTotals.clampedAdj > 0 ? "+" : ""}${quoteTotals.clampedAdj}%）`, amount: delta });
    }
    if (quoteTotals.factorProduct !== 1) {
      const impact = quoteTotals.adjustedPrice - quoteTotals.calibratedBase;
      bd.push({ item: `调整系数（×${quoteTotals.factorProduct.toFixed(2)}）`, amount: impact });
    }
    if (quoteTotals.maintenanceFee > 0 && selectedMaintTier) {
      bd.push({ item: `维护包（${selectedMaintTier.tierLabel}）`, amount: quoteTotals.maintenanceFee });
    }
    if (quoteNote.trim()) bd.push({ item: "备注", amount: 0, note: quoteNote.trim() });
    setSubmitting(true);
    try {
      await v2Post(`/tenders/${tenderId}/submit-quote`, {
        totalPrice,
        priceBreakdown: bd,
      });
      toast({ title: "报价已提交", description: "平台收到后将安排审核" });
      setShowQuoteOverlay(false);
      setQuoteSelections({}); setAdjustmentPercent(0); setMaintenancePackage("none"); setQuoteNote("");
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
                  {resolveDemandType(demand.demandType)}
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

        {/* ── Milestones ── */}
        {demand && demand.milestones && demand.milestones.length > 0 && (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <Flag size={15} className="text-primary" />
              <h3 className="font-bold text-foreground text-sm">里程碑计划</h3>
              <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                {demand.milestones.length} 个节点
              </span>
            </div>
            <div className="divide-y divide-border">
              {demand.milestones.map((ms, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  <div className="flex flex-col items-center shrink-0 mt-0.5">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                    {i < demand.milestones.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" style={{ minHeight: "12px" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-sm font-bold text-foreground">{ms.name}</p>
                    {ms.deadline && (
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                        <CalendarDays size={11} />
                        截止 {new Date(ms.deadline).toLocaleDateString("zh-CN")}
                      </p>
                    )}
                    {ms.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{ms.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quote block */}
        {(tender.priceBreakdown?.length > 0 || canSubmitQuote) && (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <DollarSign size={15} className="text-primary" />
              <h3 className="font-bold text-foreground text-sm">我的报价</h3>
              {tender.totalPrice && (
                <span className="ml-auto font-black text-emerald-600">¥{tender.totalPrice.toLocaleString()}</span>
              )}
              {canSubmitQuote && !showForm && (
                <button
                  onClick={() => {
                    const category = V2_DEMAND_CATEGORY_MAP[demand?.demandType ?? ""] ?? null;
                    if (category) {
                      const bd = tender.priceBreakdown;
                      if (tender.totalPrice && bd?.length) {
                        if (quoteConfig) {
                          applyBreakdownRestore(quoteConfig, bd);
                        } else {
                          pendingRestoreRef.current = bd;
                        }
                      }
                      setShowQuoteOverlay(true);
                    } else {
                      if (tender.totalPrice) {
                        setTotalPrice(String(tender.totalPrice));
                        setBreakdown(tender.priceBreakdown?.length > 0 ? tender.priceBreakdown : [{ item: "", amount: 0, note: "" }]);
                      }
                      setShowForm(true);
                    }
                  }}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  {tender.totalPrice ? "修改报价" : "填写报价"}
                </button>
              )}
            </div>

            {tender.priceBreakdown && tender.priceBreakdown.length > 0 ? (
              <div className="px-5 py-4 space-y-2">
                {tender.priceBreakdown.map((row, i) => (
                  <div key={i} className="flex items-start justify-between text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="text-foreground">{row.item}</span>
                      {row.note && <p className="text-xs text-muted-foreground mt-0.5">{row.note}</p>}
                    </div>
                    {row.amount !== 0 && (
                      <span className="font-semibold text-foreground ml-4 shrink-0">¥{row.amount.toLocaleString()}</span>
                    )}
                  </div>
                ))}
                {tender.quotedAt && (
                  <p className="text-xs text-muted-foreground pt-1">提交于 {new Date(tender.quotedAt).toLocaleDateString("zh-CN")}</p>
                )}
              </div>
            ) : canSubmitQuote && !showForm ? (
              <div className="px-5 py-4 text-sm text-muted-foreground">
                💡 在下方讨论区与平台确认方案后，提交报价才算正式投标。
              </div>
            ) : null}

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
            <DiscussionThread parentType="v2_tender" parentId={tenderId} readOnly={isLost} onAfterPost={() => { if (tender) markRead("outsource", tender.outsourceDemandId); markRead("tender", tenderId); }} />
            {isLost && (
              <p className="mt-3 text-xs text-slate-400 italic text-center">未中标的投标仅供查看，无法继续回复</p>
            )}
          </div>
        </div>
      </div>
      {/* ── Quote Card Overlay ── */}
      {showQuoteOverlay && (
        <div className="fixed inset-0 z-[100] bg-[#f3f4f6] flex flex-col animate-in fade-in duration-200">
          <header className="shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-xs font-black text-white bg-emerald-700 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">OPC</span>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-slate-900 leading-none">报价卡</h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate">需求：{tender.demandTitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button"
                onClick={() => { setQuoteSelections({}); setAdjustmentPercent(0); setMaintenancePackage("none"); setQuoteNote(""); }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors">重置</button>
              <button type="button" onClick={() => setShowQuoteOverlay(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5">
                <X size={14} /> 关闭
              </button>
              <button type="button" onClick={handleSubmitQuoteCard} disabled={submitting}
                className="px-5 py-2 rounded-lg bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 disabled:opacity-50 transition-colors">
                {submitting ? "提交中…" : (tender.totalPrice ? "更新报价" : "提交报价")}
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            {quoteConfigLoading ? (
              <div className="flex justify-center items-center py-20"><Loader2 size={28} className="animate-spin text-emerald-700" /></div>
            ) : (
              <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6 items-start">
                <div className="flex-1 space-y-5 min-w-0">
                  {baseDims.length > 0 && (() => {
                    const baseTotal = baseDims.reduce((sum, dim) => {
                      const tier = dim.tiers.find(t => t.tier === quoteSelections[dim.code]);
                      return sum + (tier?.basePrice ?? 0);
                    }, 0);
                    return (
                      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">01</span>
                            <h3 className="font-black text-slate-900">基准层</h3>
                          </div>
                          <span className="font-bold text-slate-700 text-sm">{baseTotal > 0 ? `${baseTotal.toLocaleString()} 元` : "—"}</span>
                        </div>
                        <div className="divide-y divide-slate-50">
                          {baseDims.map(dim => {
                            const sel = quoteSelections[dim.code];
                            const selRow = dim.tiers.find(t => t.tier === sel);
                            return (
                              <div key={dim.code} className="px-6 py-4 flex items-center gap-4">
                                <div className="w-44 shrink-0">
                                  <p className="text-sm font-bold text-slate-800 leading-tight">{dim.code} {dim.label}</p>
                                </div>
                                <div className="flex gap-1.5 flex-1">
                                  {dim.tiers.map(t => (
                                    <button key={t.tier} type="button"
                                      title={`${t.tierLabel}${t.basePrice > 0 ? ` · ¥${t.basePrice.toLocaleString()}` : ""}`}
                                      onClick={() => setQuoteSelections(prev => ({ ...prev, [dim.code]: t.tier }))}
                                      className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold border transition-all leading-tight ${sel === t.tier ? "bg-emerald-700 text-white border-emerald-700 shadow-sm" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-500/50 hover:bg-emerald-50"}`}>
                                      <span className="block">{t.tierLabel}</span>
                                    </button>
                                  ))}
                                </div>
                                <div className="w-28 text-right shrink-0">
                                  <span className={`text-sm font-bold ${sel ? "text-emerald-700" : "text-slate-300"}`}>
                                    {selRow ? (selRow.basePrice > 0 ? `${selRow.basePrice.toLocaleString()} 元` : "0 元") : "— 元"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })()}
                  {baseDims.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                        <span className="text-xs font-black text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md">±%</span>
                        <h3 className="font-black text-slate-900">微调</h3>
                        <span className="text-xs text-slate-400">基准层 ±20% 范围内</span>
                      </div>
                      <div className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-slate-500 w-16 shrink-0">调整幅度</span>
                          <input type="range" min={-20} max={20} step={1} value={adjustmentPercent}
                            onChange={e => setAdjustmentPercent(parseInt(e.target.value))}
                            className="flex-1 accent-violet-600" />
                          <div className="relative w-24 shrink-0">
                            <input type="number" min={-20} max={20} step={1} value={adjustmentPercent}
                              onChange={e => setAdjustmentPercent(Math.max(-20, Math.min(20, parseInt(e.target.value) || 0)))}
                              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-right pr-7 outline-none focus:border-violet-400" />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">%</span>
                          </div>
                          <div className="w-36 text-right shrink-0">
                            {adjustmentPercent !== 0 ? (
                              <span className={`text-sm font-bold ${adjustmentPercent > 0 ? "text-red-500" : "text-green-600"}`}>
                                {adjustmentPercent > 0 ? "+" : ""}{adjustmentPercent}% → {quoteTotals.calibratedBase.toLocaleString()} 元
                              </span>
                            ) : <span className="text-sm text-slate-400">不调整</span>}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                  {adjustDims.length > 0 && (() => {
                    const cFactor = adjustDims.reduce((prod, dim) => {
                      const tier = dim.tiers.find(t => t.tier === quoteSelections[dim.code]);
                      return prod * (tier?.coefficient ?? 1);
                    }, 1);
                    return (
                      <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">02</span>
                            <h3 className="font-black text-slate-900">调整层</h3>
                            <span className="text-xs text-slate-400">各项系数相乘作用于基准层</span>
                          </div>
                          <span className="font-bold text-amber-700 text-sm">×{cFactor.toFixed(2)}</span>
                        </div>
                        <div className="divide-y divide-slate-50">
                          {adjustDims.map(dim => {
                            const sel = quoteSelections[dim.code];
                            const selRow = dim.tiers.find(t => t.tier === sel);
                            return (
                              <div key={dim.code} className="px-6 py-4 flex items-center gap-4">
                                <div className="w-44 shrink-0">
                                  <p className="text-sm font-bold text-slate-800 leading-tight">{dim.code} {dim.label}</p>
                                </div>
                                <div className="flex gap-1.5 flex-1">
                                  {dim.tiers.map(t => (
                                    <button key={t.tier} type="button"
                                      title={`${t.tierLabel}（×${(t.coefficient ?? 1).toFixed(2)}）`}
                                      onClick={() => setQuoteSelections(prev => ({ ...prev, [dim.code]: t.tier }))}
                                      className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold border transition-all leading-tight ${sel === t.tier ? "bg-amber-500 text-white border-amber-500 shadow-sm" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-amber-400/50 hover:bg-amber-50"}`}>
                                      <span className="block">{t.tierLabel}</span>
                                    </button>
                                  ))}
                                </div>
                                <div className="w-20 text-right shrink-0">
                                  <span className={`text-sm font-bold ${sel ? "text-amber-600" : "text-slate-300"}`}>
                                    {selRow?.coefficient != null ? `×${selRow.coefficient.toFixed(2)}` : "—"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })()}
                  {hasQuoteCard && maintTiers.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                        <span className="text-xs font-black text-green-700 bg-green-100 px-2 py-0.5 rounded-md">03</span>
                        <h3 className="font-black text-slate-900">可选层</h3>
                        <span className="text-xs text-slate-400">叠加至最终报价</span>
                      </div>
                      <div className="px-6 py-5">
                        <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide">维护包</p>
                        <div className="grid grid-cols-4 gap-3">
                          {maintTiers.map(t => {
                            const rate = t.coefficient ?? 0;
                            const fee = rate > 0 ? Math.round(quoteTotals.adjustedPrice * rate) : 0;
                            return (
                              <button key={t.tier} type="button"
                                onClick={() => setMaintenancePackage(t.tier)}
                                title={t.description ?? ""}
                                className={`py-3.5 px-2 rounded-xl border text-center transition-all ${maintenancePackage === t.tier ? "bg-green-600 text-white border-green-600 shadow-md" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-green-400/60 hover:bg-green-50/50"}`}>
                                <p className="text-xs font-black leading-none">{t.tierLabel}</p>
                                {rate > 0 ? (
                                  <>
                                    <p className={`text-xs mt-1 ${maintenancePackage === t.tier ? "text-white/80" : "text-slate-400"}`}>+{Math.round(rate * 100)}%</p>
                                    {quoteTotals.adjustedPrice > 0 && (
                                      <p className={`text-xs font-bold mt-0.5 ${maintenancePackage === t.tier ? "text-white/90" : "text-green-600"}`}>+{fee.toLocaleString()} 元</p>
                                    )}
                                  </>
                                ) : (
                                  <p className={`text-xs mt-1 ${maintenancePackage === t.tier ? "text-white/80" : "text-slate-400"}`}>不叠加</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                  )}
                  {!quoteConfigLoading && !hasQuoteCard && (
                    <section className="bg-amber-50 rounded-2xl border border-amber-200 px-6 py-5">
                      <p className="text-sm font-bold text-amber-700">此需求类型暂无报价卡模板</p>
                      <p className="text-xs text-amber-600 mt-1">请联系平台运营配置对应类别的报价维度后再使用报价卡功能。</p>
                    </section>
                  )}
                  <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                      <span className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">04</span>
                      <h3 className="font-black text-slate-900">备注说明（选填）</h3>
                    </div>
                    <div className="px-6 py-5">
                      <textarea rows={3} placeholder="报价备注、特殊说明等…" value={quoteNote}
                        onChange={e => setQuoteNote(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all outline-none resize-none" />
                    </div>
                  </section>
                </div>
                <aside className="w-72 shrink-0 sticky top-6">
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-5 bg-emerald-700 text-white">
                      <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">最终报价</p>
                      <p className="text-3xl font-black">{quoteTotals.finalPrice > 0 ? `${quoteTotals.finalPrice.toLocaleString()} 元` : "—"}</p>
                    </div>
                    <div className="px-6 py-4 space-y-2">
                      {demand?.expectedPriceMin || demand?.expectedPriceMax ? (
                        <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 mb-3">
                          参考预算：{formatBudgetRange(demand.expectedPriceMin, demand.expectedPriceMax)}
                        </div>
                      ) : null}
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">基准层合计</span>
                        <span className="font-bold text-slate-800">{quoteTotals.rawBase > 0 ? `${quoteTotals.rawBase.toLocaleString()} 元` : "—"}</span>
                      </div>
                      {quoteTotals.clampedAdj !== 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">微调</span>
                          <span className={`font-bold ${quoteTotals.clampedAdj > 0 ? "text-red-500" : "text-green-600"}`}>
                            {quoteTotals.clampedAdj > 0 ? "+" : ""}{quoteTotals.clampedAdj}% → {quoteTotals.calibratedBase.toLocaleString()} 元
                          </span>
                        </div>
                      )}
                      {quoteTotals.factorProduct !== 1 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">调整层系数</span>
                          <span className="font-bold text-amber-600">×{quoteTotals.factorProduct.toFixed(2)} = {quoteTotals.adjustedPrice.toLocaleString()} 元</span>
                        </div>
                      )}
                      {quoteTotals.maintenanceFee > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">维护包</span>
                          <span className="font-bold text-green-600">+{quoteTotals.maintenanceFee.toLocaleString()} 元</span>
                        </div>
                      )}
                      <div className="border-t border-slate-100 pt-2 mt-2 flex justify-between">
                        <span className="text-sm font-black text-slate-700">合计</span>
                        <span className="text-sm font-black text-emerald-700">{quoteTotals.finalPrice > 0 ? `${quoteTotals.finalPrice.toLocaleString()} 元` : "—"}</span>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </main>
        </div>
      )}

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
