import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import {
  Loader2, Zap, ExternalLink, CheckCircle2, DollarSign, PlusCircle, Edit2, X,
  Calendar, AlertTriangle, History, FileText, ChevronDown, ChevronUp, PlayCircle,
} from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post, v2Patch, uploadFile } from "@/lib/v2api";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { useToast } from "@/hooks/use-toast";
import { markRead } from "@/lib/demandRead";

interface LatestVersion {
  id: number;
  versionNo: number;
  detail: string;
  attachments: Array<{ name: string; url: string; size?: number }>;
  editedByNickname?: string | null;
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

interface VersionItem {
  id: number;
  versionNo: number;
  detail: string;
  attachments: Array<{ name: string; url: string }>;
  editedByNickname: string | null;
  editedByRole: "publisher" | "opc" | "admin" | null;
  editComment: string | null;
  createdAt: string;
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

interface QuotationCard {
  id: number;
  totalPrice: number;
  breakdown: Array<{ item: string; amount: number; note?: string }>;
  note: string | null;
  createdByNickname: string | null;
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
  website: "网站建设", app: "App开发", miniprogram: "小程序",
  ecommerce: "电商运营", design: "设计制作", marketing: "营销推广", other: "其他",
  content: "内容设计", education: "教育培训", software: "软件开发",
  CG: "内容设计", SA: "软件开发", TK: "教育培训", BO: "营销推广", OTHER: "其他",
  cg: "内容设计", sa: "软件开发", tk: "教育培训", bo: "营销推广",
};

const ROLE_LABEL: Record<string, string> = {
  publisher: "发单方", opc: "OPC", admin: "运营方",
};

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

function Section({
  title, icon: Icon, defaultOpen = true, headerRight, children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-slate-100">
      <div className="flex items-center w-full px-5 py-4 border-b border-slate-100">
        <button onClick={() => setOpen(v => !v)} className="flex items-center gap-2 flex-1 text-left">
          <Icon size={15} className="text-primary shrink-0" />
          <span className="text-sm font-bold text-slate-700">{title}</span>
          {open ? <ChevronUp size={14} className="text-slate-300 ml-1" /> : <ChevronDown size={14} className="text-slate-300 ml-1" />}
        </button>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>
      {open && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

type ActionPanel = "quote" | "payment" | "deliverable" | "close" | null;

export default function AdminV2ClientDemandDetail({ inlineId }: { inlineId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [demand, setDemand] = useState<ClientDemand | null>(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentPlan[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [quotation, setQuotation] = useState<QuotationCard | null>(null);
  const [acting, setActing] = useState(false);
  const [activePanel, setActivePanel] = useState<ActionPanel>(null);

  // Detail inline edit
  const [editMode, setEditMode] = useState(false);
  const [editDetail, setEditDetail] = useState("");
  const [editAttachments, setEditAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [editComment, setEditComment] = useState("");
  const [editUploading, setEditUploading] = useState(false);

  // Version history
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);

  // OPC quote card
  const [showQuoteOverlay, setShowQuoteOverlay] = useState(false);
  const [quoteSelections, setQuoteSelections] = useState<Record<string, string>>({});
  const [adjustmentPercent, setAdjustmentPercent] = useState(0);
  const [maintenancePackage, setMaintenancePackage] = useState("none");
  const [quoteConfig, setQuoteConfig] = useState<QuoteCategoryConfig | null>(null);
  const [quoteConfigLoading, setQuoteConfigLoading] = useState(false);
  const [quoteNote, setQuoteNote] = useState("");

  // Payment form
  const [payTitle, setPayTitle] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDueDate, setPayDueDate] = useState("");

  // Deliverable form
  const [delivTitle, setDelivTitle] = useState("");
  const [delivDesc, setDelivDesc] = useState("");

  // Close form
  const [closeReason, setCloseReason] = useState("");

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

  useEffect(() => {
    if (!showQuoteOverlay) return;
    const category = V2_DEMAND_CATEGORY_MAP[demand?.demandType ?? ""] ?? null;
    if (!category) { setQuoteConfig(null); return; }
    setQuoteConfigLoading(true);
    fetch(`${API_BASE}/api/quote-card/config?category=${category}`)
      .then(r => r.json())
      .then((cfg: QuoteCategoryConfig) => setQuoteConfig(cfg))
      .catch(() => setQuoteConfig(null))
      .finally(() => setQuoteConfigLoading(false));
  }, [showQuoteOverlay, demand?.demandType]);

  const load = async () => {
    setLoading(true);
    try {
      const [d, qData, pData, delData] = await Promise.all([
        v2Get<ClientDemand>(`/client-demands/${id}`),
        v2Get<QuotationCard[]>(`/quotation-cards?clientDemandId=${id}`).catch(() => [] as QuotationCard[]),
        v2Get<PaymentPlan[]>(`/payment-plans?clientDemandId=${id}`).catch(() => [] as PaymentPlan[]),
        v2Get<Deliverable[]>(`/deliverables-a?clientDemandId=${id}`).catch(() => [] as Deliverable[]),
      ]);
      setDemand(d);
      markRead("client", id);
      setQuotation(Array.isArray(qData) ? qData[0] ?? null : null);
      setPayments(Array.isArray(pData) ? pData : []);
      setDeliverables(Array.isArray(delData) ? delData : []);
    } catch {
      setDemand(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id > 0) load(); }, [id]);

  const loadVersions = async () => {
    try {
      const v = await v2Get<VersionItem[]>(`/client-demands/${id}/versions`);
      setVersions(v);
      setShowVersions(true);
    } catch { setVersions([]); setShowVersions(true); }
  };

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

  const handleStartNegotiating = () => act(async () => {
    await v2Post(`/client-demands/${id}/submit`, {});
  }, "需求已启动沟通，现在可以发起报价");

  const handleInitiateQuote = () => act(async () => {
    if (quoteTotals.finalPrice <= 0) throw new Error("请先完成报价卡各项选择");
    const totalPrice = quoteTotals.finalPrice;
    const breakdown: Array<{ item: string; amount: number; note?: string }> = [];
    // 1. 基准层各项（原始价格）
    baseDims.filter(d => quoteSelections[d.code]).forEach(dim => {
      const tier = dim.tiers.find(t => t.tier === quoteSelections[dim.code]);
      if (tier) breakdown.push({ item: `${dim.label}（${tier.tierLabel}）`, amount: tier.basePrice });
    });
    // 2. ±% 综合调整（若非零）
    if (quoteTotals.clampedAdj !== 0) {
      const delta = quoteTotals.calibratedBase - quoteTotals.rawBase;
      breakdown.push({ item: `综合调整（${quoteTotals.clampedAdj > 0 ? "+" : ""}${quoteTotals.clampedAdj}%）`, amount: delta });
    }
    // 3. 调整层系数影响（若系数乘积 ≠ 1）
    if (quoteTotals.factorProduct !== 1) {
      const impact = quoteTotals.adjustedPrice - quoteTotals.calibratedBase;
      breakdown.push({ item: `调整系数（×${quoteTotals.factorProduct.toFixed(2)}）`, amount: impact });
    }
    // 4. 维护包
    if (quoteTotals.maintenanceFee > 0 && selectedMaintTier) {
      breakdown.push({ item: `维护包（${selectedMaintTier.tierLabel}）`, amount: quoteTotals.maintenanceFee });
    }
    const note = quoteNote.trim() || null;
    if (demand?.status === "quoting") {
      if (quotation) {
        await v2Patch(`/quotation-cards/${quotation.id}`, { totalPrice, breakdown, ...(note ? { note } : {}) });
      } else {
        await v2Post(`/quotation-cards`, { parentType: "client_demand", clientDemandId: id, totalPrice, breakdown, ...(note ? { note } : {}) });
      }
    } else {
      await v2Post(`/quotation-cards`, { parentType: "client_demand", clientDemandId: id, totalPrice, breakdown, ...(note ? { note } : {}) });
      await v2Post(`/client-demands/${id}/initiate-quote`, {});
    }
    setShowQuoteOverlay(false);
    setQuoteSelections({}); setAdjustmentPercent(0); setMaintenancePackage("none"); setQuoteNote("");
  }, demand?.status === "quoting" ? "报价已更新" : "报价已发起，通知发单方");

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

  const handleSubmitEdit = async () => {
    if (!editDetail.trim()) { toast({ title: "需求详情不能为空", variant: "destructive" }); return; }
    setActing(true);
    try {
      await v2Post(`/client-demands/${id}/update-detail`, {
        detail: editDetail.trim(),
        attachments: editAttachments,
        editComment: editComment.trim() || undefined,
      });
      toast({ title: "需求详情已更新，通知已发送" });
      setEditMode(false);
      setEditComment("");
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally { setActing(false); }
  };

  const handleEditFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditUploading(true);
    try {
      const url = await uploadFile(file);
      setEditAttachments(prev => [...prev, { name: file.name, url }]);
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setEditUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  if (loading) return <AdminV2Layout backHref="/admin/v2/client-demands" backLabel="客户需求"><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!demand) return <AdminV2Layout backHref="/admin/v2/client-demands" backLabel="客户需求"><div className="text-center py-16 text-slate-400">需求不存在</div></AdminV2Layout>;

  const cfg = STATUS_CONFIG[demand.status] ?? { label: demand.status, color: "bg-slate-100 text-slate-500" };
  const canStartNegotiating = demand.status === "draft";
  const canInitiateQuote = demand.status === "negotiating";
  const canReQuote = demand.status === "quoting";
  const canEditDetail = ["draft", "negotiating", "quoting"].includes(demand.status);
  const canCreatePayment = ["pending_contract", "executing", "warranty", "completed"].includes(demand.status);
  const canCreateDeliverable = demand.status === "executing";
  const canClose = !["completed", "closed"].includes(demand.status);

  const InlinePanel = ({
    title, color = "bg-slate-50 border-slate-200", children,
  }: { title: string; color?: string; children: React.ReactNode }) => (
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
    >
      <div className="mt-6 space-y-4">

        {/* ── 操作按钮栏（嵌入/独立模式均可见） ── */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/admin/v2/overview?clientDemandId=${id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ExternalLink size={13} /> 关联总览
          </button>
          {canStartNegotiating && (
            <button
              onClick={handleStartNegotiating}
              disabled={acting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-blue-300 text-blue-700 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              <PlayCircle size={13} /> 启动沟通
            </button>
          )}
          {(canInitiateQuote || canReQuote) && (
            <button
              onClick={() => setShowQuoteOverlay(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border rounded-xl transition-colors border-primary/30 text-primary hover:bg-primary/5"
            >
              <DollarSign size={13} /> {canReQuote ? "更新报价" : "发起报价"}
            </button>
          )}
          {canCreatePayment && (
            <button
              onClick={() => setActivePanel(prev => prev === "payment" ? null : "payment")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border rounded-xl transition-colors ${activePanel === "payment" ? "bg-emerald-600 text-white border-emerald-600" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}
            >
              <PlusCircle size={13} /> 收款项
            </button>
          )}
          {canCreateDeliverable && (
            <button
              onClick={() => setActivePanel(prev => prev === "deliverable" ? null : "deliverable")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border rounded-xl transition-colors ${activePanel === "deliverable" ? "bg-teal-600 text-white border-teal-600" : "border-teal-300 text-teal-700 hover:bg-teal-50"}`}
            >
              <CheckCircle2 size={13} /> 交付记录
            </button>
          )}
          {canClose && (
            <button
              onClick={() => setActivePanel(prev => prev === "close" ? null : "close")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border rounded-xl transition-colors ${activePanel === "close" ? "bg-red-500 text-white border-red-500" : "border-red-200 text-red-500 hover:bg-red-50"}`}
            >
              关闭需求
            </button>
          )}
        </div>

        {/* ── 基本信息卡 ── */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">发单方</p>
              <p className="font-semibold text-slate-700">{demand.publisherNickname ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">预算</p>
              <p className="font-semibold text-slate-700">
                {demand.budgetMin != null
                  ? `¥${demand.budgetMin.toLocaleString()}${demand.budgetMax ? ` ～ ¥${demand.budgetMax.toLocaleString()}` : "+"}`
                  : "面议"}
              </p>
            </div>
            {demand.hopeDeliveryDate && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5 flex items-center gap-1"><Calendar size={10} />期望交付</p>
                <p className="font-semibold text-slate-700">{new Date(demand.hopeDeliveryDate).toLocaleDateString("zh-CN")}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 mb-0.5">是否紧急</p>
              <p className={`font-semibold flex items-center gap-1 ${demand.isUrgent ? "text-red-500" : "text-slate-500"}`}>
                {demand.isUrgent ? <><Zap size={12} /> 紧急需求</> : "普通需求"}
              </p>
            </div>
            {quotation && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">报价总额</p>
                <p className="font-bold text-primary">¥{quotation.totalPrice.toLocaleString()}</p>
              </div>
            )}
            {demand.warrantyEndDate && (
              <div>
                <p className="text-xs text-slate-400 mb-0.5">质保到期</p>
                <p className="font-semibold text-teal-700">{new Date(demand.warrantyEndDate).toLocaleDateString("zh-CN")}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-slate-400 mb-0.5">创建时间</p>
              <p className="font-semibold text-slate-700">{new Date(demand.createdAt).toLocaleDateString("zh-CN")}</p>
            </div>
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
        </div>

        {/* ── 报价卡 ── */}
        {(quotation || demand.status === "quoting") && (
          <Section title="报价单" icon={DollarSign}>
            {quotation ? (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-2xl font-black text-primary">¥{quotation.totalPrice.toLocaleString()}</p>
                  <span className="text-xs text-slate-400">由 {quotation.createdByNickname ?? "运营方"} 出具</span>
                </div>
                {quotation.breakdown?.length > 0 && (
                  <div className="space-y-2 mb-4 border border-slate-100 rounded-xl p-3 bg-slate-50">
                    {quotation.breakdown.map((b, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-slate-600">{b.item}{b.note && <span className="text-slate-400 text-xs"> · {b.note}</span>}</span>
                        <span className="font-bold text-slate-800">¥{b.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                {quotation.note && (
                  <p className="text-xs text-slate-500 p-3 bg-slate-50 rounded-xl">{quotation.note}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-4">报价单尚未生成，请点击右上角「发起报价」。</p>
            )}
          </Section>
        )}

        {/* ── 操作面板 ── */}
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


        {activePanel === "payment" && (
          <InlinePanel title="创建收款项" color="bg-emerald-50 border-emerald-200">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">收款项名称</label>
                <input value={payTitle} onChange={e => setPayTitle(e.target.value)} placeholder="如：首付款、尾款"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">金额 (¥)</label>
                  <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">应收日期（可选）</label>
                  <input type="date" value={payDueDate} onChange={e => setPayDueDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
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

        {activePanel === "deliverable" && (
          <InlinePanel title="创建交付记录" color="bg-teal-50 border-teal-200">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">交付标题</label>
                <input value={delivTitle} onChange={e => setDelivTitle(e.target.value)} placeholder="本次交付内容"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">说明（可选）</label>
                <textarea value={delivDesc} onChange={e => setDelivDesc(e.target.value)} rows={3} placeholder="补充说明"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none" />
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

        {/* ── 需求详情区块（查看/编辑内联切换）── */}
        <Section
          title="需求详情"
          icon={FileText}
          headerRight={
            <div className="flex items-center gap-3">
              {demand.latestVersion && (
                <span className="text-xs text-slate-400">v{demand.latestVersion.versionNo}</span>
              )}
              {canEditDetail && !editMode && (
                <button
                  onClick={() => {
                    setEditDetail(demand.latestVersion?.detail ?? "");
                    setEditAttachments(demand.latestVersion?.attachments?.map(a => ({ name: a.name, url: a.url })) ?? []);
                    setEditMode(true);
                  }}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Edit2 size={11} /> 编辑
                </button>
              )}
              {demand.latestVersion && (
                <button
                  onClick={loadVersions}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition-colors"
                >
                  <History size={11} /> 历史版本
                </button>
              )}
            </div>
          }
        >
          {editMode ? (
            <div className="space-y-3">
              <MarkdownEditor
                key={`client-detail-edit-${id}`}
                value={editDetail}
                onChange={setEditDetail}
                placeholder="编辑需求详情，支持 Markdown 富文本…"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs text-primary cursor-pointer hover:underline">
                  {editUploading ? <Loader2 size={12} className="animate-spin" /> : "+ 添加附件"}
                  <input type="file" className="hidden" onChange={handleEditFileUpload} disabled={editUploading} />
                </label>
                {editAttachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-2 py-1">
                    {a.name}
                    <button onClick={() => setEditAttachments(prev => prev.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500 ml-1">✕</button>
                  </div>
                ))}
              </div>
              <div>
                <input
                  value={editComment}
                  onChange={e => setEditComment(e.target.value)}
                  placeholder="修改说明（可选）"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSubmitEdit} disabled={acting}
                  className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 hover:bg-primary/90">
                  {acting ? "提交中…" : "保存并通知"}
                </button>
                <button onClick={() => { setEditMode(false); setEditComment(""); }}
                  className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  取消
                </button>
              </div>
            </div>
          ) : demand.latestVersion ? (
            <div>
              <MarkdownContent content={demand.latestVersion.detail} />
              {demand.latestVersion.attachments?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-slate-50">
                  {demand.latestVersion.attachments.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors">
                      <ExternalLink size={11} />{a.name}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <FileText size={24} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm">暂无需求详情</p>
              {canEditDetail && (
                <button
                  onClick={() => { setEditDetail(""); setEditAttachments([]); setEditMode(true); }}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  点击填写
                </button>
              )}
            </div>
          )}
        </Section>

        {/* ── 收款计划 ── */}
        {payments.length > 0 && (
          <Section title={`收款计划（${payments.length} 项）`} icon={DollarSign}>
            <div className="space-y-2">
              {payments.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{p.title}</p>
                    {p.dueDate && <p className="text-xs text-slate-400">应收：{new Date(p.dueDate).toLocaleDateString("zh-CN")}</p>}
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

        {/* ── 交付记录 ── */}
        {deliverables.length > 0 && (
          <Section title={`交付记录（${deliverables.length} 项）`} icon={CheckCircle2}>
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

        <Section title="沟通讨论" icon={FileText}>
          <DiscussionThread parentType="client_demand" parentId={id} placeholder="与发单方沟通…" onAfterPost={() => markRead("client", id)} />
        </Section>

      </div>

      {/* ── 历史版本对比 Modal ── */}
      {showVersions && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col" style={{ maxHeight: "90vh" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <History size={15} className="text-primary" />
                <span className="text-sm font-extrabold text-slate-800">历史版本对比</span>
                {versions.length > 0 && (
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    当前 v{versions[0].versionNo}
                  </span>
                )}
              </div>
              <button onClick={() => setShowVersions(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>

            {versions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">
                <Loader2 size={16} className="animate-spin mr-2" /> 加载中…
              </div>
            ) : versions.length <= 1 ? (
              <div className="flex-1 flex items-center justify-center py-12 text-slate-400 text-sm">
                暂无更早的历史版本
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-100 overflow-x-auto shrink-0">
                  <span className="text-xs text-slate-400 shrink-0 mr-1">选择历史版本：</span>
                  {versions.slice(1).map((v, i) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVersionIdx(i)}
                      className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-colors border ${
                        selectedVersionIdx === i
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-slate-500 border-slate-200 hover:border-primary hover:text-primary"
                      }`}
                    >
                      v{v.versionNo}
                      {v.editedByRole ? ` · ${ROLE_LABEL[v.editedByRole] ?? v.editedByRole}` : ""}
                    </button>
                  ))}
                </div>
                {(() => {
                  const hist = versions.slice(1)[selectedVersionIdx] ?? versions[1];
                  const curr = versions[0];
                  const renderPanel = (v: VersionItem, isCurrent: boolean) => (
                    <div className={`overflow-y-auto min-h-0 p-5 ${isCurrent ? "bg-blue-50/30" : ""}`}>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isCurrent ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                          v{v.versionNo} {isCurrent ? "当前" : "历史"}
                        </span>
                        <span className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleDateString("zh-CN")}</span>
                        {v.editedByRole && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                            {ROLE_LABEL[v.editedByRole] ?? v.editedByRole}
                          </span>
                        )}
                        {v.editedByNickname && <span className="text-xs text-slate-500">{v.editedByNickname}</span>}
                        {v.editComment && <span className="text-xs text-slate-400 italic">「{v.editComment}」</span>}
                      </div>
                      <MarkdownContent content={v.detail} />
                      {v.attachments?.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                          {v.attachments.map((a, i) => (
                            <a key={i} href={a.url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5">
                              <ExternalLink size={11} />{a.name}
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
      {showQuoteOverlay && (
        <div className="fixed inset-0 z-[100] bg-[#f3f4f6] flex flex-col animate-in fade-in duration-200">
          <header className="shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-xs font-black text-white bg-primary px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">OPC</span>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-slate-900 leading-none">OPC 报价卡</h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate">需求：{demand?.title}</p>
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
              <button type="button" onClick={handleInitiateQuote} disabled={acting}
                className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                {acting ? "提交中…" : (demand?.status === "quoting" ? "更新报价" : "发起报价")}
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            {quoteConfigLoading ? (
              <div className="flex justify-center items-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div>
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
                            <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">01</span>
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
                                      className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold border transition-all leading-tight ${sel === t.tier ? "bg-primary text-white border-primary shadow-sm" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-primary/50 hover:bg-primary/5"}`}>
                                      <span className="block">{t.tierLabel}</span>
                                    </button>
                                  ))}
                                </div>
                                <div className="w-28 text-right shrink-0">
                                  <span className={`text-sm font-bold ${sel ? "text-primary" : "text-slate-300"}`}>
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
                      <p className="text-xs text-amber-600 mt-1">请在后台管理中配置对应类别的报价维度后再使用报价卡功能。</p>
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
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none resize-none" />
                    </div>
                  </section>
                </div>
                <aside className="w-72 shrink-0 sticky top-6">
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-5 bg-primary text-white">
                      <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">最终报价</p>
                      <p className="text-3xl font-black">{quoteTotals.finalPrice > 0 ? `${quoteTotals.finalPrice.toLocaleString()} 元` : "—"}</p>
                    </div>
                    <div className="px-6 py-4 space-y-2">
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
                        <span className="text-sm font-black text-primary">{quoteTotals.finalPrice > 0 ? `${quoteTotals.finalPrice.toLocaleString()} 元` : "—"}</span>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            )}
          </main>
        </div>
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
    pending: "bg-slate-100 text-slate-500",
    delivered: "bg-blue-100 text-blue-700",
    accepted: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-600",
  };
  const labels: Record<string, string> = { pending: "待交付", delivered: "已提交", accepted: "已验收", rejected: "已拒绝" };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[status] ?? "bg-slate-100 text-slate-500"}`}>{labels[status] ?? status}</span>;
}
