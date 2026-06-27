import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  Loader2, Zap, ExternalLink, CheckCircle2, DollarSign, Edit2, X,
  Calendar, AlertTriangle, History, FileText, ChevronDown, ChevronUp, PlayCircle,
  Link2, Paperclip, Plus, RotateCcw, Wrench, Send, Upload, Bot, Check,
} from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { AgentChatPanel } from "@/components/agent/AgentChatPanel";
import type { FormSuggestion } from "@/components/agent/AgentChatPanel";
import { BreakdownDisplay } from "@/components/shared/BreakdownDisplay";
import { FilePickerZone } from "@/components/shared/FilePickerZone";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import { v2Get, v2Post, v2Patch, v2Delete, uploadFile } from "@/lib/v2api";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { useToast } from "@/hooks/use-toast";
import { markRead } from "@/lib/demandRead";

interface DemandType { id: number; code: string; name: string; }

function CustomSelect({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);
  const close = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
  }, []);
  useEffect(() => {
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [close]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-2 border rounded-xl px-3 py-2.5 text-sm bg-white outline-none transition-all
          ${open ? "ring-2 ring-primary/20 border-primary" : "border-slate-200 hover:border-slate-300"}`}>
        <span className={selected ? "text-slate-800" : "text-slate-400"}>
          {selected ? selected.label : (placeholder ?? "请选择")}
        </span>
        <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {options.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors
                ${value === o.value ? "bg-primary/8 text-primary font-bold" : "text-slate-700 hover:bg-slate-50"}`}>
              {o.label}
              {value === o.value && <Check size={14} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InlinePanel({
  title, color = "bg-slate-50 border-slate-200", onClose, children,
}: { title: string; color?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-5 ${color}`}>
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        <button onClick={onClose}><X size={16} className="text-slate-400 hover:text-slate-600" /></button>
      </div>
      {children}
    </div>
  );
}

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

interface ContractItem {
  id: number;
  contractNo: string;
  status: string;
  content: string | null;
  signedFileUrl: string | null;
  publisherRejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PaymentPlan {
  id: number;
  itemNo: number;
  description: string | null;
  amount: number;
  dueDate: string | null;
  status: string;
  isLastItem: boolean;
}

interface Deliverable {
  id: number;
  title: string;
  url: string | null;
  content: string | null;
  attachments: Array<{ name: string; url: string }>;
  status: string;
  createdByNickname: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
}

interface TicketItem {
  id: number;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface TicketFull {
  id: number;
  title: string;
  description: string | null;
  status: string;
  attachments: Array<{ name: string; url: string }> | null;
  closedNote: string | null;
  closedAt: string | null;
  createdByNickname: string | null;
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

const STAGE_KEYS = ["draft", "negotiating", "quoting", "pending_contract", "executing", "warranty", "completed"] as const;
const STAGE_LABELS: Record<string, string> = {
  draft: "草稿", negotiating: "沟通", quoting: "报价",
  pending_contract: "签约", executing: "执行", warranty: "质保", completed: "完成",
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
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-slate-50 transition-colors"
      >
        <Icon size={16} className="text-primary shrink-0" />
        <span className="font-bold text-slate-800 flex-1">{title}</span>
        {headerRight && (
          <div className="shrink-0" onClick={e => e.stopPropagation()}>{headerRight}</div>
        )}
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && <div className="px-6 pt-4 pb-6 border-t border-slate-100">{children}</div>}
    </div>
  );
}

type ActionPanel = "quote" | "deliverable" | "close" | "contract" | null;

export default function AdminV2ClientDemandDetail({ inlineId, initialTab, initialItemId }: { inlineId?: number; initialTab?: string; initialItemId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const inlineNav = useAdminInlineNav();

  const [demand, setDemand] = useState<ClientDemand | null>(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<PaymentPlan[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [quotation, setQuotation] = useState<QuotationCard | null>(null);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [acting, setActing] = useState(false);
  const [activePanel, setActivePanel] = useState<ActionPanel>(null);

  // Detail inline edit
  const [editMode, setEditMode] = useState(false);
  const [editDetail, setEditDetail] = useState("");
  const [editAttachments, setEditAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [editComment, setEditComment] = useState("");
  const [editUploading, setEditUploading] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("");
  const [editBudgetMin, setEditBudgetMin] = useState("");
  const [editBudgetMax, setEditBudgetMax] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editIsUrgent, setEditIsUrgent] = useState(false);
  const [demandTypes, setDemandTypes] = useState<DemandType[]>([]);

  // Agent panel (edit mode)
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentSessionKey] = useState(() => `v2_client_detail_${id ?? Date.now()}`);

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
  const pendingRestoreRef = useRef<Array<{ item: string; amount: number; note?: string }> | null>(null);

  // Tab — prefer prop (from inlineNav), fall back to URL search param
  const [activeTab, setActiveTab] = useState<"needs" | "contract" | "delivery" | "ticket">(() => {
    const t = initialTab ?? new URLSearchParams(window.location.search).get("tab") ?? "";
    return (["needs", "contract", "delivery", "ticket"] as const).includes(t as any) ? (t as "needs" | "contract" | "delivery" | "ticket") : "needs";
  });
  const initialId: number | null = initialItemId ?? (() => {
    const raw = new URLSearchParams(window.location.search).get("id");
    return raw ? parseInt(raw, 10) : null;
  })();
  const didAutoExpand = useRef(false);

  // Deliverable form
  const [delivTitle, setDelivTitle] = useState("");
  const [delivDesc, setDelivDesc] = useState("");
  const [delivUrl, setDelivUrl] = useState("");
  const [delivAttachments, setDelivAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [delivAttachUploading, setDelivAttachUploading] = useState(false);

  // Tickets
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [ticketFull, setTicketFull] = useState<Record<number, TicketFull>>({});
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null);
  const [closingTicketId, setClosingTicketId] = useState<number | null>(null);
  const [closeTicketNote, setCloseTicketNote] = useState("");

  // Deliverable expand / resubmit
  const [expandedDelivId, setExpandedDelivId] = useState<number | null>(null);
  const [resubmitId, setResubmitId] = useState<number | null>(null);
  const [resubmitUrl, setResubmitUrl] = useState("");
  const [resubmitContent, setResubmitContent] = useState("");
  const [resubmitAttachments, setResubmitAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [resubmitAttachUploading, setResubmitAttachUploading] = useState(false);

  // Close form
  const [closeReason, setCloseReason] = useState("");

  // Payment plan CRUD
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [addPaymentForm, setAddPaymentForm] = useState({ itemNo: "", description: "", amount: "", dueDate: "", isLastItem: false });
  const [editPaymentId, setEditPaymentId] = useState<number | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState({ itemNo: "", description: "", amount: "", dueDate: "", isLastItem: false });
  const [paymentActing, setPaymentActing] = useState(false);

  // Contract inline edit / finalize / upload state
  const [contractEditOpen, setContractEditOpen] = useState(false);
  const [contractEditContent, setContractEditContent] = useState("");
  const [contractFinalizeOpen, setContractFinalizeOpen] = useState(false);
  const [contractUploadOpen, setContractUploadOpen] = useState(false);
  const [contractUploadFile, setContractUploadFile] = useState<File | null>(null);
  const [contractActingInline, setContractActingInline] = useState(false);
  const [contractUploading, setContractUploading] = useState(false);

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

  const applyBreakdownRestore = useCallback((cfg: QuoteCategoryConfig, bd: Array<{ item: string; amount: number; note?: string }>) => {
    const noteItem = bd.find(b => b.item === "备注");
    if (noteItem?.note) setQuoteNote(noteItem.note);

    const adjItem = bd.find(b => b.item.startsWith("综合调整"));
    if (adjItem) {
      const m = adjItem.item.match(/([+-]?\d+)%/);
      if (m) setAdjustmentPercent(parseInt(m[1], 10));
    }

    const maintTiersLocal = (cfg.optional ?? []).find(d => d.code === "MAINT")?.tiers ?? [];
    const maintItem = bd.find(b => b.item.startsWith("维护包"));
    if (maintItem) {
      const matched = maintTiersLocal.find(t => maintItem.item.includes(t.tierLabel));
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

  const load = async () => {
    setLoading(true);
    try {
      const [d, qData, pData, delData, cData, tData] = await Promise.all([
        v2Get<ClientDemand>(`/client-demands/${id}`),
        v2Get<QuotationCard[]>(`/quotation-cards?clientDemandId=${id}`).catch(() => [] as QuotationCard[]),
        v2Get<PaymentPlan[]>(`/payment-plans?clientDemandId=${id}`).catch(() => [] as PaymentPlan[]),
        v2Get<Deliverable[]>(`/deliverables-a?clientDemandId=${id}`).catch(() => [] as Deliverable[]),
        v2Get<ContractItem[]>(`/contracts?clientDemandId=${id}&channel=a`).catch(() => [] as ContractItem[]),
        v2Get<TicketItem[]>(`/tickets-a?clientDemandId=${id}`).catch(() => [] as TicketItem[]),
      ]);
      setDemand(d);
      markRead("client", id);
      setQuotation(Array.isArray(qData) ? qData[0] ?? null : null);
      setPayments(Array.isArray(pData) ? pData : []);
      setDeliverables(Array.isArray(delData) ? delData : []);
      setContracts(Array.isArray(cData) ? cData : []);
      setTickets(Array.isArray(tData) ? tData : []);
    } catch {
      setDemand(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id > 0) load(); }, [id]);
  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/cat-categories`)
      .then(r => r.ok ? r.json() : [])
      .then((data: DemandType[]) => setDemandTypes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (didAutoExpand.current) return;
    if (activeTab === "delivery" && initialId && deliverables.length > 0) {
      const found = deliverables.find(d => d.id === initialId);
      if (found) {
        didAutoExpand.current = true;
        setExpandedDelivId(initialId);
        setTimeout(() => {
          document.querySelector(`[data-deliv-id="${initialId}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 150);
      }
    } else if (activeTab === "ticket" && initialId && tickets.length > 0) {
      const found = tickets.find(t => t.id === initialId);
      if (found) {
        didAutoExpand.current = true;
        handleExpandTicket(initialId).then(() => {
          setTimeout(() => {
            document.querySelector(`[data-ticket-id="${initialId}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 400);
        });
      }
    }
  }, [deliverables, tickets]);

  const handleExpandTicket = async (ticketId: number) => {
    setExpandedTicketId(prev => prev === ticketId ? null : ticketId);
    if (!ticketFull[ticketId]) {
      try {
        const full = await v2Get<TicketFull>(`/tickets-a/${ticketId}`);
        setTicketFull(prev => ({ ...prev, [ticketId]: full }));
        markRead("ticket_a", ticketId);
      } catch { /* ignore */ }
    }
  };

  const handleCloseTicket = async (ticketId: number) => {
    try {
      await v2Post(`/tickets-a/${ticketId}/close`, { note: closeTicketNote.trim() || undefined });
      setClosingTicketId(null);
      setCloseTicketNote("");
      const fresh = await v2Get<TicketFull>(`/tickets-a/${ticketId}`);
      setTicketFull(prev => ({ ...prev, [ticketId]: fresh }));
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: "closed" } : t));
      toast({ title: "工单已关闭" });
    } catch (err: any) {
      toast({ title: "关闭失败", description: err.message, variant: "destructive" });
    }
  };

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
    // 1b. 调整层各项（系数选项，amount 记为 0，供回填还原用）
    adjustDims.filter(d => quoteSelections[d.code]).forEach(dim => {
      const tier = dim.tiers.find(t => t.tier === quoteSelections[dim.code]);
      if (tier) breakdown.push({ item: `${dim.label}（${tier.tierLabel}）`, amount: 0 });
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

  const handleCreateContract = () => act(async () => {
    await v2Post("/contracts", { channel: "a", clientDemandId: id });
    await load();
  }, "合同草稿已创建");

  const handleSaveContractContent = async (contractId: number) => {
    setContractActingInline(true);
    try {
      await v2Patch(`/contracts/${contractId}/content`, { content: contractEditContent });
      toast({ title: "合同内容已保存" });
      setContractEditOpen(false);
      setContracts(prev => prev.map(c => c.id === contractId ? { ...c, content: contractEditContent } : c));
    } catch (err: any) {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    } finally { setContractActingInline(false); }
  };

  const handleFinalizeContract = async (contractId: number) => {
    setContractActingInline(true);
    try {
      await v2Post(`/contracts/${contractId}/finalize`, {});
      toast({ title: "合同已定稿，通知发单方确认" });
      setContractFinalizeOpen(false);
      await load();
    } catch (err: any) {
      toast({ title: "定稿失败", description: err.message, variant: "destructive" });
    } finally { setContractActingInline(false); }
  };

  const handleUploadSignedContract = async (contractId: number) => {
    if (!contractUploadFile) { toast({ title: "请选择文件", variant: "destructive" }); return; }
    setContractUploading(true);
    try {
      const url = await uploadFile(contractUploadFile);
      await v2Post(`/contracts/${contractId}/upload-signed`, { signedFileUrl: url });
      toast({ title: "已签合同已上传，需求进入执行中" });
      setContractUploadOpen(false);
      setContractUploadFile(null);
      await load();
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally { setContractUploading(false); }
  };

  const handleCreateDeliverable = () => act(async () => {
    if (!delivTitle.trim()) throw new Error("请填写交付标题");
    await v2Post("/deliverables-a", {
      clientDemandId: id,
      title: delivTitle.trim(),
      url: delivUrl.trim() || null,
      content: delivDesc.trim() || null,
      attachments: delivAttachments,
    });
    setDelivTitle(""); setDelivDesc(""); setDelivUrl(""); setDelivAttachments([]);
    setActivePanel(null);
    await load();
  }, "交付记录已创建");

  const handleAddPayment = async () => {
    if (!addPaymentForm.amount || !addPaymentForm.dueDate) {
      toast({ title: "请填写金额和到期日", variant: "destructive" }); return;
    }
    setPaymentActing(true);
    try {
      const created = await v2Post<PaymentPlan>("/payment-plans", {
        clientDemandId: id,
        itemNo: addPaymentForm.itemNo ? parseInt(addPaymentForm.itemNo) : payments.length + 1,
        description: addPaymentForm.description.trim() || null,
        amount: parseFloat(addPaymentForm.amount),
        dueDate: addPaymentForm.dueDate,
        isLastItem: addPaymentForm.isLastItem,
      });
      setPayments(prev => [...prev, created].sort((a, b) => a.itemNo - b.itemNo));
      setShowAddPayment(false);
      setAddPaymentForm({ itemNo: "", description: "", amount: "", dueDate: "", isLastItem: false });
      toast({ title: "收款计划已添加" });
    } catch (err: any) {
      toast({ title: "添加失败", description: err.message, variant: "destructive" });
    } finally {
      setPaymentActing(false);
    }
  };

  const handleSavePayment = async (planId: number) => {
    if (!editPaymentForm.amount || !editPaymentForm.dueDate) {
      toast({ title: "请填写金额和到期日", variant: "destructive" }); return;
    }
    setPaymentActing(true);
    try {
      const updated = await v2Patch<PaymentPlan>(`/payment-plans/${planId}`, {
        ...(editPaymentForm.itemNo ? { itemNo: parseInt(editPaymentForm.itemNo) } : {}),
        description: editPaymentForm.description.trim() || null,
        amount: parseFloat(editPaymentForm.amount),
        dueDate: editPaymentForm.dueDate,
        isLastItem: editPaymentForm.isLastItem,
      });
      setPayments(prev => prev.map(p => p.id === planId ? updated : p).sort((a, b) => a.itemNo - b.itemNo));
      setEditPaymentId(null);
      toast({ title: "收款计划已更新" });
    } catch (err: any) {
      toast({ title: "更新失败", description: err.message, variant: "destructive" });
    } finally {
      setPaymentActing(false);
    }
  };

  const handleDeletePayment = async (planId: number) => {
    if (!confirm("确认删除此收款计划项？")) return;
    setPaymentActing(true);
    try {
      await v2Delete(`/payment-plans/${planId}`);
      setPayments(prev => prev.filter(p => p.id !== planId));
      toast({ title: "已删除" });
    } catch (err: any) {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    } finally {
      setPaymentActing(false);
    }
  };

  const handleDelivAttachUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDelivAttachUploading(true);
    try {
      const fileUrl = await uploadFile(file);
      setDelivAttachments(prev => [...prev, { name: file.name, url: fileUrl }]);
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setDelivAttachUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleResubmit = () => act(async () => {
    if (!resubmitId) return;
    await v2Post(`/deliverables-a/${resubmitId}/resubmit`, {
      url: resubmitUrl.trim() || null,
      content: resubmitContent.trim() || null,
      attachments: resubmitAttachments,
    });
    setResubmitId(null); setResubmitUrl(""); setResubmitContent(""); setResubmitAttachments([]);
    await load();
  }, "已重新提交交付记录");

  const handleResubmitAttachUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResubmitAttachUploading(true);
    try {
      const fileUrl = await uploadFile(file);
      setResubmitAttachments(prev => [...prev, { name: file.name, url: fileUrl }]);
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setResubmitAttachUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleClose = () => act(async () => {
    if (!closeReason.trim()) throw new Error("请填写关闭原因");
    await v2Post(`/client-demands/${id}/close`, { reason: closeReason.trim() });
    setCloseReason("");
  }, "需求已关闭");

  const handleSubmitEdit = async () => {
    if (!editDetail.trim()) { toast({ title: "需求详情不能为空", variant: "destructive" }); return; }
    setActing(true);
    try {
      await Promise.all([
        v2Patch(`/client-demands/${id}`, {
          title: editTitle.trim() || undefined,
          demandType: editType || undefined,
          budgetMin: editBudgetMin ? parseInt(editBudgetMin) : undefined,
          budgetMax: editBudgetMax ? parseInt(editBudgetMax) : undefined,
          hopeDeliveryDate: editDeadline || undefined,
          isUrgent: editIsUrgent,
        }),
        v2Post(`/client-demands/${id}/update-detail`, {
          detail: editDetail.trim(),
          attachments: editAttachments,
          editComment: editComment.trim() || undefined,
        }),
      ]);
      toast({ title: "需求已更新，通知已发送" });
      setEditMode(false);
      setEditComment("");
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally { setActing(false); }
  };

  const cancelEdit = () => { setEditMode(false); setEditComment(""); };

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
  const canCreateDeliverable = demand.status === "executing";
  const canClose = ["draft", "negotiating", "quoting", "pending_contract"].includes(demand.status);
  const aContract = contracts[0] ?? null;
  const canCreateContract = demand.status === "pending_contract" && !aContract;
  const stageIdx = STAGE_KEYS.indexOf(demand.status as typeof STAGE_KEYS[number]);
  const isPast = (s: string) => stageIdx >= 0 && stageIdx >= STAGE_KEYS.indexOf(s as typeof STAGE_KEYS[number]);
  const canEditPayments = aContract?.status === "draft" || aContract?.status === "publisher_rejected";
  const visibleTabs: Array<"needs" | "contract" | "delivery" | "ticket"> = [
    "needs",
    ...(isPast("quoting")   ? ["contract" as const] : []),
    ...(isPast("executing") ? ["delivery" as const] : []),
    ...(isPast("warranty")  ? ["ticket"   as const] : []),
  ];
  const TAB_LABELS: Record<string, string> = { needs: "需求详情", contract: "报价与合同", delivery: "交付", ticket: "工单" };


  return (
    <AdminV2Layout
      backHref="/admin/v2/client-demands"
      backLabel="客户需求"
    >
      <div className="mt-6 space-y-4">

        {/* ── 基本信息卡（始终显示，Tab 上方）── */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
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
            <div className="flex items-center gap-1.5 shrink-0">
              {canStartNegotiating && (
                <button
                  onClick={handleStartNegotiating}
                  disabled={acting}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border border-blue-300 text-blue-700 rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <PlayCircle size={12} /> 启动沟通
                </button>
              )}
              {(canInitiateQuote || canReQuote) && (
                <button
                  onClick={() => {
                    if (canReQuote && quotation?.breakdown?.length) {
                      if (quoteConfig) {
                        applyBreakdownRestore(quoteConfig, quotation.breakdown);
                      } else {
                        pendingRestoreRef.current = quotation.breakdown;
                      }
                    }
                    if (canReQuote && quotation?.note) setQuoteNote(quotation.note);
                    setShowQuoteOverlay(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border rounded-xl transition-colors border-primary/30 text-primary hover:bg-primary/5"
                >
                  <DollarSign size={12} /> {canReQuote ? "更新报价" : "发起报价"}
                </button>
              )}
              {canCreateContract && (
                <button
                  onClick={() => setActivePanel(prev => prev === "contract" ? null : "contract")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border rounded-xl transition-colors ${activePanel === "contract" ? "bg-blue-600 text-white border-blue-600" : "border-blue-300 text-blue-700 hover:bg-blue-50"}`}
                >
                  <FileText size={12} /> 创建合同
                </button>
              )}
              {canEditDetail && !editMode && (
                <button
                  onClick={() => {
                    setEditTitle(demand.title);
                    setEditType(demand.demandType ?? "");
                    setEditBudgetMin(demand.budgetMin?.toString() ?? "");
                    setEditBudgetMax(demand.budgetMax?.toString() ?? "");
                    setEditDeadline(demand.hopeDeliveryDate ? demand.hopeDeliveryDate.split("T")[0] : "");
                    setEditIsUrgent(demand.isUrgent);
                    setEditDetail(demand.latestVersion?.detail ?? "");
                    setEditAttachments(demand.latestVersion?.attachments?.map(a => ({ name: a.name, url: a.url })) ?? []);
                    setActiveTab("needs");
                    setEditMode(true);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <Edit2 size={12} /> 编辑
                </button>
              )}
              {canClose && (
                <button
                  onClick={() => setActivePanel(prev => prev === "close" ? null : "close")}
                  className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border rounded-xl transition-colors ${activePanel === "close" ? "bg-red-500 text-white border-red-500" : "border-red-200 text-red-500 hover:bg-red-50"}`}
                >
                  关闭需求
                </button>
              )}
            </div>
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
          {/* ── 阶段进度条 ── */}
          {demand.status !== "closed" && stageIdx >= 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center">
                {STAGE_KEYS.map((k, i) => (
                  <div key={k} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full transition-all ${i < stageIdx ? "bg-primary" : i === stageIdx ? "bg-primary ring-4 ring-primary/15" : "bg-slate-200"}`} />
                      <span className={`text-[9px] mt-1 leading-none font-medium ${i === stageIdx ? "text-primary font-bold" : i < stageIdx ? "text-slate-400" : "text-slate-300"}`}>
                        {STAGE_LABELS[k]}
                      </span>
                    </div>
                    {i < STAGE_KEYS.length - 1 && (
                      <div className={`flex-1 h-px mx-1 mb-3 ${i < stageIdx ? "bg-primary/40" : "bg-slate-200"}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>


        {/* ── 操作面板 ── */}
        {activePanel === "contract" && (
          <InlinePanel title="创建合同草稿" color="bg-blue-50 border-blue-200" onClose={() => setActivePanel(null)}>
            <p className="text-sm text-slate-500 mb-4">为该需求创建一份 A 通道合同草稿，创建后可在合同详情页编辑正文、定稿并通知发单方确认。</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setActivePanel(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleCreateContract} disabled={acting}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                {acting ? "创建中…" : "确认创建"}
              </button>
            </div>
          </InlinePanel>
        )}

        {activePanel === "close" && (
          <InlinePanel title="关闭需求" color="bg-red-50 border-red-200" onClose={() => setActivePanel(null)}>
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

        {/* ── Tab 导航（两个及以上 tab 才显示） ── */}
        {visibleTabs.length > 1 && (
          <div className="flex gap-1 bg-white rounded-2xl border border-slate-200 p-1">
            {visibleTabs.map(tab => {
              const openTickets = tickets.filter(t => t.status === "open").length;
              const badge = tab === "delivery" ? (deliverables.length > 0 ? deliverables.length : null)
                : tab === "ticket" ? (openTickets > 0 ? openTickets : null)
                : null;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-colors ${
                    activeTab === tab ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {TAB_LABELS[tab]}
                  {badge != null && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab ? "bg-white/20" : "bg-slate-200 text-slate-600"}`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── 需求详情 Tab ── */}
        {activeTab === "needs" && <>

        {/* ── 需求详情区块（查看/编辑内联切换）── */}
        <Section
          title="需求详情"
          icon={FileText}
          headerRight={
            !editMode && demand.latestVersion ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">v{demand.latestVersion.versionNo}</span>
                <button
                  onClick={loadVersions}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition-colors"
                >
                  <History size={11} /> 历史版本
                </button>
              </div>
            ) : undefined
          }
        >
          {editMode ? (
            <div className="space-y-4 mt-2">
              <div className="flex justify-end">
                <button
                  onClick={() => setAgentOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border border-violet-300 text-violet-600 rounded-xl hover:bg-violet-50 transition-colors"
                >
                  <Bot size={12} /> 需求分析助手
                </button>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">需求标题</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">需求类型</label>
                  <CustomSelect
                    value={editType}
                    onChange={setEditType}
                    options={demandTypes.map(t => ({ value: t.code, label: t.name }))}
                    placeholder="请选择需求类型"
                  />
                </div>
                <div className="flex items-center mt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editIsUrgent} onChange={e => setEditIsUrgent(e.target.checked)} className="w-4 h-4" />
                    <span className="text-sm text-slate-700">紧急需求</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">最低预算（元）</label>
                  <input type="number" value={editBudgetMin} onChange={e => setEditBudgetMin(e.target.value)}
                    placeholder="如 5000" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">最高预算（元）</label>
                  <input type="number" value={editBudgetMax} onChange={e => setEditBudgetMax(e.target.value)}
                    placeholder="如 10000" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">期望交付日期</label>
                <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="border-t border-slate-100 pt-3">
                <label className="text-xs text-slate-500 mb-2 block">需求详情</label>
                <MarkdownEditor
                  key={`client-detail-edit-${id}`}
                  value={editDetail}
                  onChange={setEditDetail}
                  placeholder="编辑需求详情，支持 Markdown 富文本…"
                />
              </div>
              <FilePickerZone
                variant="inline"
                uploading={editUploading}
                onChange={f => handleEditFileUpload({ target: { files: [f] } } as any)}
                files={editAttachments}
                onRemove={i => setEditAttachments(prev => prev.filter((_, j) => j !== i))}
              />
              <input
                value={editComment}
                onChange={e => setEditComment(e.target.value)}
                placeholder="修改说明（可选）"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <div className="flex gap-2">
                <button onClick={handleSubmitEdit} disabled={acting}
                  className="bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50 hover:bg-primary/90">
                  {acting ? "提交中…" : "保存并通知"}
                </button>
                <button onClick={cancelEdit}
                  className="border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                  取消
                </button>
              </div>
            </div>
          ) : demand.latestVersion ? (
            <div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-4 prose prose-sm max-w-none">
                <MarkdownContent content={demand.latestVersion.detail} />
              </div>
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

        {/* ── 沟通讨论 ── */}
        <Section title="沟通讨论" icon={FileText}>
          <DiscussionThread parentType="client_demand" parentId={id} placeholder="与发单方沟通…" onAfterPost={() => markRead("client", id)} />
        </Section>
        </>}

        {/* ── 报价与合同 Tab ── */}
        {activeTab === "contract" && (() => {
          const CONTRACT_STATUS_MAP: Record<string, { label: string; color: string }> = {
            draft:                     { label: "草稿",        color: "bg-slate-100 text-slate-500" },
            pending_publisher_confirm: { label: "待发单方确认", color: "bg-amber-100 text-amber-700" },
            publisher_rejected:        { label: "已退回",       color: "bg-red-100 text-red-600" },
            pending_sign:              { label: "待签约",       color: "bg-orange-100 text-orange-700" },
            signed:                    { label: "已签约",       color: "bg-green-100 text-green-700" },
          };
          return (
            <>

        {/* 合同 */}
        {contracts.length > 0 && (() => {
          const c = contracts[0];
          const canEdit     = c.status === "draft" || c.status === "publisher_rejected";
          const canFinalize = canEdit && !!c.content?.trim() && payments.length > 0;
          const finalizeBlocked = canEdit && !!c.content?.trim() && payments.length === 0;
          const canUpload   = c.status === "pending_sign";
          const headerRight = (
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => {
                    setContractEditContent(c.content ?? "");
                    setContractFinalizeOpen(false);
                    setContractUploadOpen(false);
                    setContractEditOpen(v => !v);
                  }}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <Edit2 size={12} /> {contractEditOpen ? "取消编辑" : "编辑正文"}
                </button>
              )}
              {canFinalize && !contractEditOpen && (
                <button
                  onClick={() => { setContractEditOpen(false); setContractUploadOpen(false); setContractFinalizeOpen(v => !v); }}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
                >
                  <Send size={12} /> 定稿通知
                </button>
              )}
              {finalizeBlocked && !contractEditOpen && (
                <div title="请先添加收款计划，再发送定稿通知" className="cursor-not-allowed">
                  <button
                    disabled
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-200 text-slate-400 cursor-not-allowed"
                  >
                    <Send size={12} /> 定稿通知
                  </button>
                </div>
              )}
              {canUpload && (
                <button
                  onClick={() => { setContractEditOpen(false); setContractFinalizeOpen(false); setContractUploadOpen(v => !v); }}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors shadow-sm"
                >
                  <Upload size={12} /> 上传签约文件
                </button>
              )}
              {c.signedFileUrl && (
                <a href={c.signedFileUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-bold text-green-700 hover:underline">
                  <ExternalLink size={11} /> 已签合同
                </a>
              )}
            </div>
          );
          return (
            <Section title="合同" icon={FileText} headerRight={headerRight}>
              {contractEditOpen ? (
                <div className="space-y-3">
                  <MarkdownEditor value={contractEditContent} onChange={setContractEditContent} minHeight={200} />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setContractEditOpen(false)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">取消</button>
                    <button
                      onClick={() => handleSaveContractContent(c.id)}
                      disabled={contractActingInline}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {contractActingInline ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} 保存
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {c.content ? (
                    <div className="prose prose-sm max-w-none">
                      <MarkdownContent content={c.content} />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">暂无合同正文，点击右上角「编辑正文」开始起草。</p>
                  )}
                  {contractFinalizeOpen && (
                    <div className="border border-amber-200 rounded-xl p-3 bg-amber-50 space-y-2">
                      <p className="text-xs font-bold text-amber-700">确认定稿并通知发单方？</p>
                      <p className="text-xs text-amber-600">定稿后发单方将收到合同确认通知，你可继续修改直到对方确认。</p>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setContractFinalizeOpen(false)} className="text-xs px-3 py-1.5 rounded-lg border border-amber-200 hover:bg-amber-100">取消</button>
                        <button
                          onClick={() => handleFinalizeContract(c.id)}
                          disabled={contractActingInline}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                        >
                          {contractActingInline ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} 确认定稿
                        </button>
                      </div>
                    </div>
                  )}
                  {contractUploadOpen && (
                    <div className="border border-green-200 rounded-xl p-3 bg-green-50 space-y-2">
                      <p className="text-xs font-bold text-green-700">上传已签约合同文件</p>
                      <FilePickerZone
                        variant="button"
                        file={contractUploadFile}
                        onChange={setContractUploadFile}
                        onClear={() => setContractUploadFile(null)}
                        accept=".pdf,.doc,.docx,.docm,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.md,.markdown"
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setContractUploadOpen(false); setContractUploadFile(null); }} className="text-xs px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-100">取消</button>
                        <button
                          onClick={() => handleUploadSignedContract(c.id)}
                          disabled={contractUploading || !contractUploadFile}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {contractUploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} 上传并完成签约
                        </button>
                      </div>
                    </div>
                  )}
                  {c.publisherRejectedReason && (
                    <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      <p className="text-xs font-bold text-red-600 mb-1">发单方驳回原因</p>
                      <p className="text-xs text-red-500">{c.publisherRejectedReason}</p>
                    </div>
                  )}
                </div>
              )}
            </Section>
          );
        })()}

        {/* 收款计划 — 合同草拟阶段起显示 */}
        {isPast("pending_contract") && (
          <Section
            title={payments.length > 0 ? `收款计划（${payments.length} 项）` : "收款计划"}
            icon={DollarSign}
            headerRight={canEditPayments ? (
              <button
                onClick={() => { setShowAddPayment(v => !v); setEditPaymentId(null); }}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus size={12} /> 添加
              </button>
            ) : undefined}
          >
            <div className="mt-3 space-y-2">
              {/* 内联添加表单 */}
              {showAddPayment && (
                <div className="border border-primary/40 rounded-xl p-4 bg-white shadow-sm space-y-3">
                  <p className="text-xs font-bold text-primary">新增收款项</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="描述（如：首付款、尾款…）"
                      value={addPaymentForm.description}
                      onChange={e => setAddPaymentForm(f => ({ ...f, description: e.target.value }))}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="金额（元）*"
                      value={addPaymentForm.amount}
                      onChange={e => setAddPaymentForm(f => ({ ...f, amount: e.target.value }))}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <input
                      type="date"
                      value={addPaymentForm.dueDate}
                      onChange={e => setAddPaymentForm(f => ({ ...f, dueDate: e.target.value }))}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddPayment} disabled={paymentActing} className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50">
                      {paymentActing ? "提交中…" : "确认添加"}
                    </button>
                    <button onClick={() => setShowAddPayment(false)} className="border border-slate-200 rounded-lg px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">取消</button>
                  </div>
                </div>
              )}

              {payments.length === 0 && !showAddPayment && (
                <p className="text-sm text-slate-400 py-2">暂无收款计划</p>
              )}

              {payments.map(p => (
                <div key={p.id}>
                  {editPaymentId === p.id ? (
                    /* 内联编辑表单 */
                    <div className="border border-primary/40 rounded-xl p-4 bg-white shadow-sm space-y-3">
                      <p className="text-xs font-bold text-primary">编辑收款项</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="描述（如：首付款、尾款…）"
                          value={editPaymentForm.description}
                          onChange={e => setEditPaymentForm(f => ({ ...f, description: e.target.value }))}
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="金额（元）*"
                          value={editPaymentForm.amount}
                          onChange={e => setEditPaymentForm(f => ({ ...f, amount: e.target.value }))}
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <input
                          type="date"
                          value={editPaymentForm.dueDate}
                          onChange={e => setEditPaymentForm(f => ({ ...f, dueDate: e.target.value }))}
                          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSavePayment(p.id)} disabled={paymentActing} className="bg-primary text-white rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50">
                          {paymentActing ? "保存中…" : "保存"}
                        </button>
                        <button onClick={() => setEditPaymentId(null)} className="border border-slate-200 rounded-lg px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50">取消</button>
                      </div>
                    </div>
                  ) : (
                    /* 普通展示行（与发单方同款卡片样式） */
                    <div className="border border-slate-200 rounded-xl p-3 flex items-center justify-between hover:border-slate-300 transition-colors">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <PayStatusBadge status={p.status} />
                          <span className="text-xs text-slate-400">第 {p.itemNo} 期</span>
                          {p.isLastItem && <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">末期</span>}
                        </div>
                        {p.description && <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>}
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="font-black text-slate-800">¥{p.amount.toLocaleString()}</p>
                        {p.dueDate && <p className="text-xs text-slate-400">{new Date(p.dueDate).toLocaleDateString("zh-CN")}</p>}
                        {canEditPayments && p.status !== "paid" && (
                          <div className="flex items-center gap-2 justify-end mt-1">
                            <button
                              onClick={() => {
                                setEditPaymentId(p.id);
                                setShowAddPayment(false);
                                setEditPaymentForm({
                                  itemNo: String(p.itemNo),
                                  description: p.description ?? "",
                                  amount: String(p.amount),
                                  dueDate: p.dueDate ? p.dueDate.slice(0, 10) : "",
                                  isLastItem: p.isLastItem,
                                });
                              }}
                              className="text-xs text-primary hover:underline"
                            >编辑</button>
                            <button
                              onClick={() => handleDeletePayment(p.id)}
                              disabled={paymentActing}
                              className="text-xs text-red-500 hover:underline disabled:opacity-40"
                            >删除</button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 报价单（移至底部）*/}
        <Section title="报价单" icon={DollarSign}>
          {quotation ? (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-4">
                <p className="text-2xl font-black text-primary">¥{quotation.totalPrice.toLocaleString()}</p>
                <span className="text-xs text-slate-400">由 {quotation.createdByNickname ?? "运营方"} 出具</span>
              </div>
              <BreakdownDisplay bd={quotation.breakdown ?? []} note={quotation.note} totalPrice={quotation.totalPrice} quoteConfig={quoteConfig} />
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4">报价单尚未生成，请点击右上角「发起报价」。</p>
          )}
        </Section>

            </>
          );
        })()}

        {/* ── 交付 Tab ── */}
        {activeTab === "delivery" && (
          <div className="space-y-4">
            {/* 新建按钮 + 内联表单 */}
            {canCreateDeliverable && (
              activePanel === "deliverable" ? (
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-teal-800">新建交付记录</span>
                    <button onClick={() => setActivePanel(null)}><X size={16} className="text-slate-400 hover:text-slate-600" /></button>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">交付标题 *</label>
                    <input value={delivTitle} onChange={e => setDelivTitle(e.target.value)} placeholder="本次交付内容简述"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">交付链接（可选）</label>
                    <input value={delivUrl} onChange={e => setDelivUrl(e.target.value)} placeholder="https://…"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">说明（可选）</label>
                    <textarea value={delivDesc} onChange={e => setDelivDesc(e.target.value)} rows={3} placeholder="补充说明"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none bg-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1 block">附件</label>
                    <div className="flex flex-wrap gap-2 items-center">
                      <FilePickerZone
                        variant="inline"
                        uploading={delivAttachUploading}
                        onChange={f => handleDelivAttachUpload({ target: { files: [f] } } as any)}
                        files={delivAttachments}
                        onRemove={i => setDelivAttachments(prev => prev.filter((_, j) => j !== i))}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setActivePanel(null)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
                    <button onClick={handleCreateDeliverable} disabled={acting}
                      className="px-4 py-2 text-sm bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-700 disabled:opacity-50">
                      {acting ? "创建中…" : "创建交付"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    onClick={() => { setActivePanel("deliverable"); setDelivTitle(""); setDelivUrl(""); setDelivDesc(""); setDelivAttachments([]); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-xl border border-teal-300 text-teal-700 hover:bg-teal-50 transition-colors"
                  >
                    <Plus size={14} /> 新建交付记录
                  </button>
                </div>
              )
            )}

            {/* 空态 */}
            {deliverables.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <CheckCircle2 size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">暂无交付记录</p>
                {canCreateDeliverable && <p className="text-xs text-slate-300 mt-1">点击右上角「新建交付记录」开始提交</p>}
              </div>
            )}

            {/* 交付卡片列表 */}
            {deliverables.map(d => {
              const isExpanded = expandedDelivId === d.id;
              const isResubmitting = resubmitId === d.id;
              const statusCfg: Record<string, { label: string; color: string }> = {
                pending:   { label: "待确认", color: "bg-amber-100 text-amber-700" },
                confirmed: { label: "已确认", color: "bg-green-100 text-green-700" },
                revision:  { label: "已驳回", color: "bg-red-100 text-red-600" },
                approved:  { label: "已通过", color: "bg-emerald-100 text-emerald-700" },
              };
              const sc = statusCfg[d.status] ?? { label: d.status, color: "bg-slate-100 text-slate-500" };
              return (
                <div key={d.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {/* Card header */}
                  <button
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                    onClick={() => setExpandedDelivId(isExpanded ? null : d.id)}
                  >
                    <CheckCircle2 size={16} className="text-teal-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{d.title}</p>
                      <p className="text-xs text-slate-400">{d.createdByNickname ?? "运营方"} · {new Date(d.createdAt).toLocaleDateString("zh-CN")}</p>
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${sc.color}`}>{sc.label}</span>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                  </button>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
                      {/* URL */}
                      {d.url && (
                        <div className="pt-4">
                          <p className="text-xs font-bold text-slate-500 mb-2">交付链接</p>
                          <a href={d.url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 hover:bg-primary/10 transition-colors group">
                            <Link2 size={13} className="text-primary shrink-0" />
                            <span className="text-sm text-primary break-all flex-1 leading-snug">{d.url}</span>
                            <ExternalLink size={12} className="text-primary/50 shrink-0 group-hover:text-primary transition-colors" />
                          </a>
                        </div>
                      )}
                      {/* Content */}
                      {d.content && (
                        <div>
                          <p className="text-xs font-bold text-slate-500 mb-2">交付说明</p>
                          <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 prose prose-sm max-w-none">
                            <MarkdownContent content={d.content} />
                          </div>
                        </div>
                      )}
                      {/* Attachments */}
                      {d.attachments?.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {d.attachments.map((a, i) => (
                            <a key={i} href={a.url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors">
                              <Paperclip size={11} /> {a.name}
                            </a>
                          ))}
                        </div>
                      )}
                      {/* Rejected reason */}
                      {d.status === "revision" && d.rejectedReason && (
                        <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                          <p className="text-xs font-bold text-red-600 mb-1">驳回原因</p>
                          <p className="text-xs text-red-500">{d.rejectedReason}</p>
                        </div>
                      )}
                      {/* Resubmit form */}
                      {d.status === "revision" && !isResubmitting && (
                        <button
                          onClick={() => {
                            setResubmitId(d.id);
                            setResubmitUrl(d.url ?? "");
                            setResubmitContent(d.content ?? "");
                            setResubmitAttachments(d.attachments ?? []);
                          }}
                          className="flex items-center gap-1.5 text-xs font-bold text-amber-700 border border-amber-200 rounded-xl px-3 py-1.5 hover:bg-amber-50 transition-colors"
                        >
                          <RotateCcw size={12} /> 重新提交
                        </button>
                      )}
                      {isResubmitting && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                          <p className="text-xs font-bold text-amber-800">修改并重新提交</p>
                          <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">交付链接</label>
                            <input value={resubmitUrl} onChange={e => setResubmitUrl(e.target.value)} placeholder="https://…"
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">说明</label>
                            <textarea value={resubmitContent} onChange={e => setResubmitContent(e.target.value)} rows={3} placeholder="修改说明"
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none resize-none bg-white" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600 mb-1 block">附件</label>
                            <div className="flex flex-wrap gap-2 items-center">
                              <FilePickerZone
                                variant="inline"
                                uploading={resubmitAttachUploading}
                                onChange={f => handleResubmitAttachUpload({ target: { files: [f] } } as any)}
                                files={resubmitAttachments}
                                onRemove={i => setResubmitAttachments(prev => prev.filter((_, j) => j !== i))}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setResubmitId(null)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
                            <button onClick={handleResubmit} disabled={acting}
                              className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 disabled:opacity-50">
                              {acting ? "提交中…" : "重新提交"}
                            </button>
                          </div>
                        </div>
                      )}
                      {/* Discussion thread */}
                      <div className="border-t border-slate-100 pt-4">
                        <p className="text-xs font-bold text-slate-500 mb-3">交付讨论</p>
                        <DiscussionThread parentType="deliverable_a" parentId={d.id} placeholder="对此交付记录提问或备注…" readOnly={d.status === "confirmed"} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── 工单 Tab ── */}
        {activeTab === "ticket" && (
          <div className="space-y-3">
            {tickets.length === 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                <Wrench size={32} className="mx-auto mb-3 text-slate-200" />
                <p className="text-sm text-slate-400">暂无工单</p>
              </div>
            )}
            {tickets.map(t => {
              const isExpanded = expandedTicketId === t.id;
              const full = ticketFull[t.id];
              const isOpen = t.status === "open";
              return (
                <div key={t.id} data-ticket-id={t.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <div
                    className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => handleExpandTicket(t.id)}
                  >
                    <Wrench size={16} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{t.title}</p>
                      <p className="text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString("zh-CN")}</p>
                    </div>
                    {isOpen && (
                      <button
                        onClick={e => { e.stopPropagation(); setClosingTicketId(t.id); setCloseTicketNote(""); }}
                        className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
                      >
                        关闭
                      </button>
                    )}
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isOpen ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                      {isOpen ? "处理中" : "已关闭"}
                    </span>
                    {isExpanded ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
                      {!full ? (
                        <div className="flex items-center justify-center py-6 text-slate-400">
                          <Loader2 size={16} className="animate-spin mr-2" /> 加载中…
                        </div>
                      ) : (
                        <>
                          {full.createdByNickname && (
                            <p className="text-xs text-slate-400 pt-3">发起人：{full.createdByNickname}</p>
                          )}
                          {full.description && (
                            <div>
                              <p className="text-xs font-bold text-slate-500 mb-2">问题描述</p>
                              <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 prose prose-sm max-w-none">
                                <MarkdownContent content={full.description} />
                              </div>
                            </div>
                          )}
                          {full.attachments && full.attachments.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-slate-500 mb-2">附件</p>
                              <div className="flex flex-wrap gap-2">
                                {full.attachments.map((a, i) => (
                                  <a key={i} href={a.url} target="_blank" rel="noreferrer"
                                    className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-colors">
                                    <Paperclip size={11} /> {a.name}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                          {!isOpen && full.closedNote && (
                            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                              <p className="text-xs font-bold text-slate-500 mb-1">关闭备注</p>
                              <p className="text-xs text-slate-600">{full.closedNote}</p>
                              {full.closedAt && (
                                <p className="text-xs text-slate-400 mt-1">关闭于 {new Date(full.closedAt).toLocaleDateString("zh-CN")}</p>
                              )}
                            </div>
                          )}
                          <div className="border-t border-slate-100 pt-4">
                            <p className="text-xs font-bold text-slate-500 mb-3">工单讨论</p>
                            <DiscussionThread
                              parentType="ticket_a"
                              parentId={t.id}
                              placeholder="回复客户或记录处理进展…"
                              readOnly={!isOpen}
                              onAfterPost={() => markRead("ticket_a", t.id)}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ── 关闭工单 Modal ── */}
      {closingTicketId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-blue-900">关闭工单</h3>
              <button onClick={() => { setClosingTicketId(null); setCloseTicketNote(""); }}>
                <X size={18} className="text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <p className="text-sm text-slate-500">关闭后工单进入「已关闭」状态，不可再回复。确认关闭？</p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => handleCloseTicket(closingTicketId)}
                className="flex-1 py-2 text-sm bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors"
              >确认关闭</button>
              <button
                onClick={() => { setClosingTicketId(null); setCloseTicketNote(""); }}
                className="flex-1 py-2 text-sm border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"
              >取消</button>
            </div>
          </div>
        </div>
      )}

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
              <div className="min-w-0">
                <h2 className="text-sm font-black text-slate-900 leading-none">报价卡</h2>
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

      {/* Agent chat panel — edit mode */}
      {demand && (
        <AgentChatPanel
          open={agentOpen}
          onClose={() => setAgentOpen(false)}
          sessionKey={agentSessionKey}
          sceneKey="v2_demand_analysis"
          agentMode="edit"
          existingDemandData={{
            title: demand.title,
            type: demand.demandType ?? undefined,
            description: editDetail || demand.latestVersion?.detail || undefined,
            budgetMin: demand.budgetMin,
            budgetMax: demand.budgetMax,
            hopeDeliveryDate: demand.hopeDeliveryDate ?? null,
          }}
          onFillForm={(suggestion: FormSuggestion) => {
            if (suggestion.title) setEditTitle(suggestion.title);
            if (suggestion.type) setEditType(suggestion.type);
            if (suggestion.description) setEditDetail(suggestion.description);
            if (suggestion.budgetMin != null) setEditBudgetMin(suggestion.budgetMin.toString());
            if (suggestion.budgetMax != null) setEditBudgetMax(suggestion.budgetMax.toString());
            if (suggestion.deadline) setEditDeadline(suggestion.deadline);
            if (!editMode) {
              setEditAttachments(demand.latestVersion?.attachments?.map((a: { name: string; url: string }) => ({ name: a.name, url: a.url })) ?? []);
              setEditMode(true);
            }
            setAgentOpen(false);
          }}
        />
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
