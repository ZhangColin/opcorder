import { useState, useMemo, useEffect } from "react";
import { useRoute, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Clock, ShieldAlert, CheckCircle, FileText, Download, FileImage, FileSpreadsheet, FileArchive, File, Building2, MapPin, Globe, Users, CalendarDays, ChevronRight, X, CheckCircle2 } from "lucide-react";
import { useGetDemandById, useCreateBid } from "@workspace/api-client-react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { DEMAND_TYPES, DEMAND_STATUSES, OPC_LEVELS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { getAccessToken } from "@/lib/auth";
import { useCurrentUser } from "@/hooks/use-current-user";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const DEMAND_CATEGORY_MAP: Record<string, string | null> = {
  education: "education",
  software: "software",
  marketing: "marketing",
  content: "content",
  other: null,
};

interface QuoteTierData {
  id: number;
  tier: string;
  tierLabel: string;
  basePrice: number;
  coefficient?: number | null;
  description?: string | null;
  sortOrder: number;
}

interface QuoteDimData {
  id: number;
  code: string;
  label: string;
  sortOrder: number;
  tiers: QuoteTierData[];
}

interface QuoteCategoryConfig {
  category: string;
  base: QuoteDimData[];
  adjustment: QuoteDimData[];
  optional: QuoteDimData[];
}

function useQuoteCategoryConfig(category: string | null) {
  return useQuery<QuoteCategoryConfig>({
    queryKey: ["quote-category-config", category],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/quote-card/config?category=${category}`);
      if (!res.ok) throw new Error("获取报价卡配置失败");
      return res.json();
    },
    enabled: !!category,
    staleTime: 300_000,
  });
}

function AttachmentIcon({ type }: { type: string }) {
  if (type === "image") return <FileImage size={18} className="text-blue-500" />;
  if (type === "spreadsheet") return <FileSpreadsheet size={18} className="text-green-600" />;
  if (type === "archive") return <FileArchive size={18} className="text-yellow-600" />;
  return <File size={18} className="text-muted-foreground" />;
}

function PublisherModal({
  name,
  profile,
  onClose,
}: {
  name: string;
  profile: {
    companyLogo?: string | null;
    companyDesc?: string | null;
    industry?: string | null;
    location?: string | null;
    teamSize?: string | null;
    foundedYear?: string | null;
    website?: string | null;
  } | null;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-br from-blue-50 to-slate-100 px-6 py-6 flex items-center gap-4">
          {profile?.companyLogo ? (
            <img src={profile.companyLogo} alt="logo" className="w-16 h-16 rounded-2xl object-cover border border-white shadow-sm shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <Building2 size={28} className="text-slate-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-blue-900 leading-tight">{name}</h2>
            {profile?.industry && <p className="text-sm text-slate-500 mt-0.5">{profile.industry}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-black/10 transition-colors shrink-0">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {profile?.companyDesc && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">公司简介</p>
              <p className="text-sm text-slate-700 leading-relaxed">{profile.companyDesc}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {profile?.location && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin size={14} className="text-slate-400 shrink-0" /><span>{profile.location}</span>
              </div>
            )}
            {profile?.teamSize && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Users size={14} className="text-slate-400 shrink-0" /><span>{profile.teamSize} 人</span>
              </div>
            )}
            {profile?.foundedYear && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarDays size={14} className="text-slate-400 shrink-0" /><span>成立于 {profile.foundedYear}</span>
              </div>
            )}
            {profile?.website && (
              <div className="flex items-center gap-2 text-sm col-span-2">
                <Globe size={14} className="text-slate-400 shrink-0" />
                <a href={profile.website} target="_blank" rel="noreferrer"
                  className="text-primary underline truncate hover:text-primary/80 transition-colors">
                  {profile.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
          </div>
          {!profile && <p className="text-sm text-slate-400 text-center py-4">该发单方暂未完善公司资料</p>}
        </div>
        <div className="border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 transition-colors">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DemandDetail() {
  const [, params] = useRoute("/demands/:id");
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  
  const id = parseInt(params?.id || "0", 10);
  const draftKey = id > 0 ? `quote-draft-${id}` : null;
  const { data: demand, isLoading } = useGetDemandById(id);
  const { mutate: submitBid, isPending: isSubmitting } = useCreateBid();

  const { role } = useCurrentUser();

  const [showBidForm, setShowBidForm] = useState(false);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [bidForm, setBidForm] = useState({ proposal: "", estimatedDays: 7, portfolioLinks: "" });
  const [showPublisherModal, setShowPublisherModal] = useState(false);
  const [quoteSelections, setQuoteSelections] = useState<Record<string, string>>({});
  const [adjustmentPercent, setAdjustmentPercent] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [maintenancePackage, setMaintenancePackage] = useState<string>("none");
  const [draftRestored, setDraftRestored] = useState(false);
  const [fromInviteNotifId, setFromInviteNotifId] = useState<number | null>(null);

  useEffect(() => {
    if (!search) return;
    const p = new URLSearchParams(search);
    if (p.get("action") === "quote") {
      setShowBidForm(true);
      const notifId = p.get("notifId");
      if (notifId) setFromInviteNotifId(parseInt(notifId, 10));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [search, id]);

  useEffect(() => {
    if (!showBidForm || !draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      let restored = false;
      if (draft.quoteSelections && typeof draft.quoteSelections === "object") { setQuoteSelections(draft.quoteSelections); restored = true; }
      if (typeof draft.adjustmentPercent === "number") { setAdjustmentPercent(draft.adjustmentPercent); restored = true; }
      if (typeof draft.adjustmentReason === "string" && draft.adjustmentReason) { setAdjustmentReason(draft.adjustmentReason); restored = true; }
      if (typeof draft.maintenancePackage === "string") { setMaintenancePackage(draft.maintenancePackage); restored = true; }
      if (draft.bidForm && typeof draft.bidForm === "object") { setBidForm(draft.bidForm); restored = true; }
      if (restored) setDraftRestored(true);
    } catch {
      // ignore corrupt draft
    }
  }, [showBidForm]);

  useEffect(() => {
    if (!showBidForm || !draftKey) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ quoteSelections, adjustmentPercent, adjustmentReason, maintenancePackage, bidForm }));
    } catch {
      // ignore storage errors
    }
  }, [showBidForm, quoteSelections, adjustmentPercent, adjustmentReason, maintenancePackage, bidForm]);

  const category = demand ? (DEMAND_CATEGORY_MAP[demand.type] ?? null) : null;
  const { data: quoteConfig } = useQuoteCategoryConfig(category);

  const baseDims = quoteConfig?.base ?? [];
  const adjustDims = quoteConfig?.adjustment ?? [];
  const hasQuoteCard = baseDims.length > 0 || adjustDims.length > 0;
  const adjustDimIds = useMemo(() => new Set(adjustDims.map(d => d.id)), [adjustDims]);

  const maintDim = (quoteConfig?.optional ?? []).find(d => d.code === "MAINT");
  const maintTiers = maintDim?.tiers ?? [];
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
    const optMaintTier = ((quoteConfig?.optional ?? []).find(d => d.code === "MAINT")?.tiers ?? []).find(t => t.tier === maintenancePackage);
    const maintRate = optMaintTier?.coefficient ?? 0;
    const maintenanceFee = Math.round(adjustedPrice * maintRate);
    const finalPrice = adjustedPrice + maintenanceFee;
    return { rawBase, clampedAdj, calibratedBase, factorProduct, adjustedPrice, maintenanceFee, finalPrice };
  }, [quoteSelections, quoteConfig, adjustmentPercent, maintenancePackage, baseDims, adjustDims]);

  if (isLoading || !demand) {
    return <div className="animate-pulse h-96 bg-card rounded-3xl border border-border mt-8"></div>;
  }

  const typeLabel = DEMAND_TYPES[demand.type] || demand.type;
  const statusInfo = DEMAND_STATUSES[demand.status] || DEMAND_STATUSES.published;
  const levelInfo = OPC_LEVELS[demand.opcLevel] || OPC_LEVELS.any;

  const attachments: Array<{ name: string; size: string; type: string; url: string }> =
    (demand as any).attachments?.length
      ? (demand as any).attachments
      : [];

  const resetQuoteState = () => {
    setQuoteSelections({});
    setAdjustmentPercent(0);
    setAdjustmentReason("");
    setMaintenancePackage("none");
    if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* ignore */ } }
  };

  const handleAcceptOrder = async () => {
    if (role && role !== "opc") {
      setShowBidForm(true);
      return;
    }
    setIsCheckingEligibility(true);
    try {
      const res = await fetch(`${BASE}/api/demands/${id}/bid-eligibility`, {
        headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
      });
      const data = await res.json();
      if (data.eligible === false) {
        toast({
          title: "暂无资格接单",
          description: data.reason ?? "您不满足该需求的接单条件",
          variant: "destructive",
        });
        return;
      }
      setShowBidForm(true);
    } catch {
      setShowBidForm(true);
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const handleBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (adjustmentPercent !== 0 && !adjustmentReason.trim()) {
      toast({ title: "请填写微调原因", description: "OPC 自主微调非零时必须填写说明。", variant: "destructive" });
      return;
    }

    const hasSelections = Object.keys(quoteSelections).length > 0;
    let quoteCardSnapshot: Record<string, unknown> | undefined;
    if (hasSelections && quoteConfig && category) {
      const { rawBase, clampedAdj, calibratedBase, factorProduct, adjustedPrice, maintenanceFee, finalPrice } = quoteTotals;
      quoteCardSnapshot = {
        category,
        baseLayers: baseDims.filter(d => quoteSelections[d.code]).map(dim => {
          const tier = dim.tiers.find(t => t.tier === quoteSelections[dim.code]);
          return { code: dim.code, label: dim.label, tier: quoteSelections[dim.code], tierLabel: tier?.tierLabel ?? "", price: tier?.basePrice };
        }),
        adjustmentPercent: clampedAdj,
        adjustmentReason: adjustmentReason.trim(),
        rawBase,
        calibratedBase,
        adjustLayers: adjustDims.filter(d => quoteSelections[d.code]).map(dim => {
          const tier = dim.tiers.find(t => t.tier === quoteSelections[dim.code]);
          return { code: dim.code, label: dim.label, tier: quoteSelections[dim.code], tierLabel: tier?.tierLabel ?? "", coefficient: tier?.coefficient };
        }),
        factorProduct,
        adjustedPrice,
        maintenancePackage,
        maintenanceTierLabel: selectedMaintTier?.tierLabel ?? "",
        maintenanceFee,
        finalPrice,
      };
    }

    submitBid({
      demandId: id,
      data: {
        proposal: bidForm.proposal,
        estimatedDays: bidForm.estimatedDays,
        portfolioLinks: bidForm.portfolioLinks ? bidForm.portfolioLinks.split(",").map(s => s.trim()) : [],
        ...(hasSelections ? { quoteCardData: quoteSelections, quotedPrice: quoteTotals.finalPrice, quoteCardSnapshot } : {}),
      } as any
    }, {
      onSuccess: () => {
        toast({ title: "接单申请已提交", description: "发单方将尽快审核您的申请。" });
        if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* ignore */ } }
        if (fromInviteNotifId) {
          fetch(`${BASE}/api/notifications/${fromInviteNotifId}/invite-responded`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() ?? ""}` },
          }).catch(() => {/* best-effort */});
          setFromInviteNotifId(null);
        }
        setDraftRestored(false);
        setShowBidForm(false);
        resetQuoteState();
        setBidForm({ proposal: "", estimatedDays: 7, portfolioLinks: "" });
      },
      onError: (err: any) => {
        const msg = err?.data?.error ?? err?.message ?? "请稍后重试";
        toast({ title: "无法提交抢单申请", description: msg, variant: "destructive" });
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <button onClick={() => window.history.back()} className="flex items-center text-muted-foreground hover:text-foreground font-bold text-sm transition-colors w-max">
        <ArrowLeft size={16} className="mr-2" /> 返回列表
      </button>

      {/* Header Info */}
      <div className="bg-card rounded-3xl p-8 lg:p-10 border border-border shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-md uppercase tracking-wider">{typeLabel}</span>
              <span className={`px-3 py-1 font-bold text-xs rounded-md ${statusInfo.color}`}>{statusInfo.label}</span>
              <span className="text-muted-foreground text-sm font-medium">编号: {demand.demandNo}</span>
            </div>
            
            <h1 className="text-3xl font-black font-display text-foreground mb-6 leading-tight">{demand.title}</h1>
            
            <div className="flex flex-wrap gap-6 mb-8">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs uppercase font-bold tracking-widest">预算区间</span>
                {demand.budgetMin && demand.budgetMax && Number(demand.budgetMin) !== Number(demand.budgetMax) ? (
                  <span className="text-xl font-black text-secondary">
                    ¥{Number(demand.budgetMin).toLocaleString()}<span className="text-muted-foreground font-normal mx-1 text-base">~</span>¥{Number(demand.budgetMax).toLocaleString()}
                  </span>
                ) : (
                  <span className="text-2xl font-black text-secondary">¥{Number(demand.budgetMin ?? demand.budget).toLocaleString()}</span>
                )}
              </div>
              <div className="w-px bg-border"></div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs uppercase font-bold tracking-widest">要求等级</span>
                <span className={`w-max px-2 py-1 rounded text-xs font-bold ${levelInfo.color}`}>{levelInfo.label}</span>
              </div>
              {(demand as any).requiredTrackLevel && (demand as any).requiredTrackLevel !== "any" && (
                <>
                  <div className="w-px bg-border"></div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs uppercase font-bold tracking-widest">赛道认证要求</span>
                    <span className="w-max px-2 py-1 rounded text-xs font-bold bg-amber-100 text-amber-700">
                      {(demand as any).categoryName ? `${(demand as any).categoryName} · ` : ""}
                      {{ A: "A级·专家", B: "B级·进阶", C: "C级·基础" }[(demand as any).requiredTrackLevel] ?? (demand as any).requiredTrackLevel} 及以上认证
                    </span>
                  </div>
                </>
              )}
              <div className="w-px bg-border"></div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs uppercase font-bold tracking-widest">交付截止</span>
                <span className="text-base font-bold flex items-center"><Clock size={16} className="mr-1.5 text-muted-foreground"/> {format(new Date(demand.deadline), 'yyyy-MM-dd')}</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {demand.skillTags.map(tag => (
                <span key={tag} className="bg-muted px-4 py-1.5 rounded-full text-sm font-semibold text-foreground border border-border/50">{tag}</span>
              ))}
            </div>
          </div>

          {showPublisherModal && (
            <PublisherModal
              name={demand.publisherName || "发单方"}
              profile={(demand as any).publisherProfile ?? null}
              onClose={() => setShowPublisherModal(false)}
            />
          )}

          <div className="md:w-72 shrink-0 bg-background rounded-2xl p-6 border border-border shadow-inner">
            <button
              className="flex items-center gap-3 mb-6 pb-4 border-b border-border w-full text-left group hover:bg-slate-50 -mx-2 px-2 rounded-xl transition-colors"
              onClick={() => setShowPublisherModal(true)}
            >
              {(demand as any).publisherLogo ? (
                <img
                  src={(demand as any).publisherLogo}
                  alt={demand.publisherName || "发单方"}
                  className="w-12 h-12 rounded-xl object-cover shrink-0 ring-2 ring-transparent group-hover:ring-primary/30 transition-all"
                />
              ) : (demand as any).publisherAvatar ? (
                <img
                  src={(demand as any).publisherAvatar}
                  alt={demand.publisherName || "发单方"}
                  className="w-12 h-12 rounded-xl object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xl shrink-0">
                  {demand.publisherName?.[0] || '发'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-bold mb-1">发单方</p>
                <p className="font-bold text-foreground truncate">{demand.publisherName || '系统运营方'}</p>
                {(demand as any).publisherTitle && (
                  <p className="text-xs text-secondary font-medium mt-0.5 truncate">{(demand as any).publisherTitle}</p>
                )}
              </div>
              <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </button>
            
            {demand.status === 'published' && !(demand.bidDeadline && new Date(demand.bidDeadline) < new Date()) && (
              <button 
                onClick={handleAcceptOrder}
                disabled={isCheckingEligibility}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/25 active:scale-95 transition-all text-lg disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCheckingEligibility ? "资格验证中…" : "立即接单"}
              </button>
            )}
            {demand.status === 'published' && demand.bidDeadline && new Date(demand.bidDeadline) < new Date() && (
              <button disabled className="w-full bg-muted text-muted-foreground font-bold py-4 rounded-xl cursor-not-allowed text-lg">
                抢单已截止
              </button>
            )}
            {demand.status !== 'published' && (
              <button disabled className="w-full bg-secondary/20 text-secondary font-bold py-4 rounded-xl cursor-not-allowed text-lg">
                已成交
              </button>
            )}
            <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center">
              <ShieldAlert size={14} className="mr-1" /> 平台担保交易，资金安全无忧
            </p>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">

          {/* Demand Description */}
          <div className="bg-card rounded-3xl p-8 border border-border shadow-sm">
            <h3 className="text-xl font-bold font-display mb-6 flex items-center gap-2">
              <FileText className="text-primary" /> 需求详情
            </h3>
            <MarkdownContent content={demand.description} />
          </div>

          {/* Attachments */}
          <div className="bg-card rounded-3xl p-8 border border-border shadow-sm">
            <h3 className="text-xl font-bold font-display mb-6 flex items-center gap-2">
              <Download className="text-primary" /> 参考资料下载
            </h3>
            {attachments.length === 0 ? (
              <p className="text-muted-foreground text-sm">发单方暂未上传参考资料。</p>
            ) : (
              <ul className="space-y-3">
                {attachments.map((file, idx) => {
                  const hasUrl = file.url && file.url !== "#";
                  const downloadHref = hasUrl
                    ? `${file.url}?name=${encodeURIComponent(file.name)}`
                    : undefined;
                  return (
                    <li key={idx}>
                      {hasUrl ? (
                        <a
                          href={downloadHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={file.name}
                          className="flex items-center gap-4 p-4 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer"
                        >
                          <AttachmentIcon type={file.type} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">{file.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{file.size}</p>
                          </div>
                          <Download size={15} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                        </a>
                      ) : (
                        <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-muted/30 opacity-50 cursor-not-allowed">
                          <AttachmentIcon type={file.type} />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{file.size} · 文件暂不可下载</p>
                          </div>
                          <Download size={15} className="text-muted-foreground/40 shrink-0" />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-card rounded-3xl p-8 border border-border shadow-sm">
            <h3 className="text-xl font-bold font-display mb-6 flex items-center gap-2">
              <CheckCircle className="text-secondary" /> 交付里程碑
            </h3>
            <div className="space-y-6 relative before:absolute before:top-0 before:bottom-0 before:left-3 before:-translate-x-px before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {demand.milestones?.map((ms, idx) => (
                <div key={idx} className="relative flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-card border-4 border-primary flex items-center justify-center shrink-0 mt-1 relative z-10"></div>
                  <div>
                    <h4 className="font-bold text-foreground text-sm">{ms.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">期限: {format(new Date(ms.deadline), 'yyyy-MM-dd')}</p>
                    {ms.deliverableDesc && <p className="text-sm text-foreground/80 mt-2 bg-muted p-3 rounded-lg border border-border/50">{ms.deliverableDesc}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bid Form — full-screen overlay matching reference quote card design */}
      {showBidForm && (
        <div className="fixed inset-0 z-[100] bg-[#f3f4f6] flex flex-col animate-in fade-in duration-200">

          {/* ── Top bar ── */}
          <header className="shrink-0 bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-xs font-black text-white bg-primary px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">OPC</span>
              <div className="min-w-0">
                <h2 className="text-sm font-black text-slate-900 leading-none">报价卡</h2>
                <p className="text-xs text-slate-500 mt-0.5 truncate">需求：{demand.title}</p>
              </div>
              {draftRestored && (
                <span className="shrink-0 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  草稿已恢复
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => { resetQuoteState(); setBidForm({ proposal: "", estimatedDays: 7, portfolioLinks: "" }); setDraftRestored(false); }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
              >重置</button>
              <button
                type="button"
                onClick={() => { setShowBidForm(false); setDraftRestored(false); resetQuoteState(); }}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors flex items-center gap-1.5"
              ><X size={14} /> 关闭</button>
              <button
                form="bid-form"
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >{isSubmitting ? "提交中…" : "提交报价"}</button>
            </div>
          </header>

          {/* ── Main ── */}
          <main className="flex-1 overflow-y-auto">
            <form id="bid-form" onSubmit={handleBidSubmit}>
              <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6 items-start">

                {/* ── Left: panels ── */}
                <div className="flex-1 space-y-5 min-w-0">

                  {/* Panel 01: 基准层 */}
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
                                    <button
                                      key={t.tier}
                                      type="button"
                                      title={`${t.tierLabel}${t.basePrice > 0 ? ` · ¥${t.basePrice.toLocaleString()}` : ""}`}
                                      onClick={() => setQuoteSelections(prev => ({ ...prev, [dim.code]: t.tier }))}
                                      className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold border transition-all leading-tight ${
                                        sel === t.tier
                                          ? "bg-primary text-white border-primary shadow-sm"
                                          : "bg-slate-50 text-slate-600 border-slate-200 hover:border-primary/50 hover:bg-primary/5"
                                      }`}
                                    >
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

                  {/* OPC 自主微调 */}
                  {baseDims.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                        <span className="text-xs font-black text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md">±%</span>
                        <h3 className="font-black text-slate-900">OPC 自主微调</h3>
                        <span className="text-xs text-slate-400">基准层 ±20% 范围内调整；非零时必须填写原因</span>
                      </div>
                      <div className="px-6 py-5 space-y-4">
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-slate-500 w-16 shrink-0">调整幅度</span>
                          <input
                            type="range" min={-20} max={20} step={1}
                            value={adjustmentPercent}
                            onChange={e => setAdjustmentPercent(parseInt(e.target.value))}
                            className="flex-1 accent-violet-600"
                          />
                          <div className="relative w-24 shrink-0">
                            <input
                              type="number" min={-20} max={20} step={1}
                              value={adjustmentPercent}
                              onChange={e => setAdjustmentPercent(Math.max(-20, Math.min(20, parseInt(e.target.value) || 0)))}
                              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-right pr-7 outline-none focus:border-violet-400"
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">%</span>
                          </div>
                          <div className="w-36 text-right shrink-0">
                            {adjustmentPercent !== 0 ? (
                              <span className={`text-sm font-bold ${adjustmentPercent > 0 ? "text-red-500" : "text-green-600"}`}>
                                {adjustmentPercent > 0 ? "+" : ""}{adjustmentPercent}% → {quoteTotals.calibratedBase.toLocaleString()} 元
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">不调整</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1.5">
                            微调原因{adjustmentPercent !== 0 ? " *（必填）" : "（非零时必填）"}
                          </label>
                          <input
                            type="text"
                            placeholder="例：需求文档特别完备，定制化程度超出标准范围…"
                            value={adjustmentReason}
                            onChange={e => setAdjustmentReason(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-400/10 transition-all outline-none"
                          />
                        </div>
                      </div>
                    </section>
                  )}

                  {/* Panel 02: 调整层 (multiplicative coefficients) */}
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
                                    <button
                                      key={t.tier}
                                      type="button"
                                      title={`${t.tierLabel}（×${(t.coefficient ?? 1).toFixed(2)}）`}
                                      onClick={() => setQuoteSelections(prev => ({ ...prev, [dim.code]: t.tier }))}
                                      className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold border transition-all leading-tight ${
                                        sel === t.tier
                                          ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                                          : "bg-slate-50 text-slate-600 border-slate-200 hover:border-amber-400/50 hover:bg-amber-50"
                                      }`}
                                    >
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

                  {/* Panel 03: 可选层 */}
                  {hasQuoteCard && (
                    <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                        <span className="text-xs font-black text-green-700 bg-green-100 px-2 py-0.5 rounded-md">03</span>
                        <h3 className="font-black text-slate-900">可选层</h3>
                        <span className="text-xs text-slate-400">叠加至最终报价（维护包按调整后价格计算）</span>
                      </div>
                      <div className="px-6 py-5">
                        <p className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wide">维护包</p>
                        <div className="grid grid-cols-4 gap-3">
                          {maintTiers.map(t => {
                            const rate = t.coefficient ?? 0;
                            const fee = rate > 0 ? Math.round(quoteTotals.adjustedPrice * rate) : 0;
                            return (
                              <button
                                key={t.tier}
                                type="button"
                                onClick={() => setMaintenancePackage(t.tier)}
                                title={t.description ?? ""}
                                className={`py-3.5 px-2 rounded-xl border text-center transition-all ${
                                  maintenancePackage === t.tier
                                    ? "bg-green-600 text-white border-green-600 shadow-md"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:border-green-400/60 hover:bg-green-50/50"
                                }`}
                              >
                                <p className="text-xs font-black leading-none">{t.tierLabel}</p>
                                {rate > 0 ? (
                                  <>
                                    <p className={`text-xs mt-1 ${maintenancePackage === t.tier ? "text-white/80" : "text-slate-400"}`}>
                                      +{Math.round(rate * 100)}%
                                    </p>
                                    {quoteTotals.adjustedPrice > 0 && (
                                      <p className={`text-xs font-bold mt-0.5 ${maintenancePackage === t.tier ? "text-white/90" : "text-green-600"}`}>
                                        +{fee.toLocaleString()} 元
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p className={`text-xs mt-1 ${maintenancePackage === t.tier ? "text-white/80" : "text-slate-400"}`}>不叠加</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {selectedMaintTier && (selectedMaintTier.coefficient ?? 0) > 0 && selectedMaintTier.description && (
                          <p className="text-xs text-slate-500 mt-3 pl-1">{selectedMaintTier.description}</p>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Panel 04: 补充信息 */}
                  <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                      <span className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">04</span>
                      <h3 className="font-black text-slate-900">补充说明</h3>
                    </div>
                    <div className="px-6 py-5 space-y-5">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                          执行方案{hasQuoteCard ? "（选填）" : " *"}
                        </label>
                        <textarea
                          required={!hasQuoteCard}
                          rows={4}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none resize-none"
                          placeholder="请描述您对该需求的理解、具体执行步骤及技术路线…"
                          value={bidForm.proposal}
                          onChange={e => setBidForm(p => ({...p, proposal: e.target.value}))}
                        />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">预计交付天数 *</label>
                          <div className="relative">
                            <input
                              type="number" required min="1"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                              value={bidForm.estimatedDays}
                              onChange={e => setBidForm(p => ({...p, estimatedDays: parseInt(e.target.value)}))}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">天</span>
                          </div>
                        </div>
                        <div className="flex-[2]">
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">作品/案例链接（选填）</label>
                          <input
                            type="text"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                            placeholder="多个链接请用逗号分隔"
                            value={bidForm.portfolioLinks}
                            onChange={e => setBidForm(p => ({...p, portfolioLinks: e.target.value}))}
                          />
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                {/* ── Right: receipt sidebar ── */}
                <aside className="w-72 shrink-0 sticky top-6">
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-6 py-5 bg-primary text-white">
                      <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">最终报价</p>
                      <p className="text-3xl font-black">{quoteTotals.finalPrice > 0 ? `${quoteTotals.finalPrice.toLocaleString()} 元` : "—"}</p>
                    </div>
                    {/* Receipt breakdown */}
                    <div className="px-6 py-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">基准层合计</span>
                        <span className="font-bold text-slate-800">{quoteTotals.rawBase > 0 ? `${quoteTotals.rawBase.toLocaleString()} 元` : "—"}</span>
                      </div>
                      {quoteTotals.clampedAdj !== 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">OPC 微调</span>
                          <span className={`font-bold ${quoteTotals.clampedAdj > 0 ? "text-red-500" : "text-green-600"}`}>
                            {quoteTotals.clampedAdj > 0 ? "+" : ""}{quoteTotals.clampedAdj}% → {quoteTotals.calibratedBase.toLocaleString()} 元
                          </span>
                        </div>
                      )}
                      {adjustDims.length > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">风险系数</span>
                          <span className="font-bold text-amber-600">×{quoteTotals.factorProduct.toFixed(2)}</span>
                        </div>
                      )}
                      {(selectedMaintTier?.coefficient ?? 0) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">{selectedMaintTier!.tierLabel}</span>
                          <span className="font-bold text-green-600">+{quoteTotals.maintenanceFee.toLocaleString()} 元</span>
                        </div>
                      )}
                      <div className="border-t border-slate-100 pt-2">
                        <div className="flex justify-between text-sm font-black">
                          <span className="text-slate-800">最终报价</span>
                          <span className="text-primary">{quoteTotals.finalPrice > 0 ? `${quoteTotals.finalPrice.toLocaleString()} 元` : "—"}</span>
                        </div>
                      </div>
                    </div>
                    {/* Per-dimension detail */}
                    {Object.values(quoteSelections).some(Boolean) && (
                      <div className="border-t border-slate-100 px-6 py-3 space-y-1.5">
                        {[...baseDims, ...adjustDims].map(dim => {
                          const sel = quoteSelections[dim.code];
                          if (!sel) return null;
                          const tier = dim.tiers.find(t => t.tier === sel);
                          const isAdjust = adjustDimIds.has(dim.id);
                          return (
                            <div key={dim.code} className="flex justify-between text-xs">
                              <span className="text-slate-400">{dim.code} · {tier?.tierLabel ?? sel}</span>
                              <span className="font-medium text-slate-600">
                                {isAdjust
                                  ? (tier?.coefficient != null ? `×${tier.coefficient.toFixed(2)}` : "—")
                                  : (tier ? (tier.basePrice > 0 ? `${tier.basePrice.toLocaleString()} 元` : "0 元") : "—")}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="px-6 pb-5">
                      <button
                        form="bid-form"
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {isSubmitting ? "提交中…" : "提交报价"}
                      </button>
                      <p className="text-xs text-slate-400 text-center mt-2">发单方将收到您的结构化报价单</p>
                    </div>
                  </div>
                </aside>

              </div>
            </form>
          </main>
        </div>
      )}
    </div>
  );
}
