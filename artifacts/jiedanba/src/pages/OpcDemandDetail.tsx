import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, AlertCircle, ChevronLeft, Tag, Hash, Globe, Mail,
  CalendarDays, FileText, Paperclip, Flag, Lock, CheckCircle2, Zap, Copy, Check,
} from "lucide-react";
import { v2Get, v2Post } from "@/lib/v2api";
import { useDemandTypeLabel } from "@/lib/catCategories";
import { useToast } from "@/hooks/use-toast";
import { getAccessToken, getStoredUser } from "@/lib/auth";
import { MarkdownContent } from "@/components/MarkdownContent";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const LEVEL_ORDER: Record<string, number> = { any: 0, C: 1, B: 2, A: 3 };
const LEVEL_LABEL: Record<string, string> = { any: "不限", C: "C级·基础", B: "B级·进阶", A: "A级·专家" };

interface Milestone { name: string; deadline?: string; description?: string }

interface DemandVersion {
  id: number; versionNo: number;
  detail: string | null;
  attachments: Array<{ name: string; url: string }>;
  editComment: string | null;
  createdAt: string;
}

interface DemandDetail {
  id: number;
  demandNo: string | null;
  title: string;
  demandType: string | null;
  isUrgent: boolean;
  mode: "public" | "invited";
  opcLevel: string | null;
  expectedPriceMin: number | null;
  expectedPriceMax: number | null;
  milestones: Milestone[];
  status: string;
  detail: string | null;
  latestVersion: DemandVersion | null;
  createdAt: string;
  tenders: Array<{ id: number; status: string; opcId: number }>;
}

function formatBudgetRange(min: number | null, max: number | null) {
  if (!min && !max) return "面议";
  if (min && max) return `¥${min.toLocaleString()} ~ ¥${max.toLocaleString()}`;
  if (min) return `¥${min.toLocaleString()} 起`;
  if (max) return `最高 ¥${max.toLocaleString()}`;
  return "面议";
}

export default function OpcDemandDetail() {
  const { id } = useParams<{ id: string }>();
  const demandId = parseInt(id ?? "0");
  const [currentPath, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [applying, setApplying] = useState(false);
  const [copiedDemand, setCopiedDemand] = useState(false);
  const { resolveDemandType } = useDemandTypeLabel();

  const { data: demand, isLoading, isError } = useQuery<DemandDetail>({
    queryKey: ["v2-demand-detail-hall", demandId],
    queryFn: () => v2Get(`/outsource-demands/${demandId}`),
    enabled: !!demandId,
  });

  const { data: trackCerts = [] } = useQuery<Array<{ level: string; cat_category_id: number }>>({
    queryKey: ["opc-track-certs-demand-detail"],
    queryFn: async () => {
      const token = getAccessToken();
      const r = await fetch(`${API_BASE}/api/opc/track-certs`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return r.ok ? r.json() : [];
    },
  });

  const isGuest = !getStoredUser() || !getAccessToken();

  async function handleApply() {
    if (!demand) return;
    setApplying(true);
    try {
      const created = await v2Post<{ id: number }>(`/outsource-demands/${demandId}/apply`);
      toast({ title: "报名成功", description: `已报名「${demand.title}」，正在跳转…` });
      qc.invalidateQueries({ queryKey: ["v2-opc-demand-hall-main"] });
      navigate(`/opc/tenders/${created.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "请稍后重试";
      toast({ title: "报名失败", description: msg, variant: "destructive" });
      setApplying(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 size={24} className="animate-spin mr-2" /> 加载中…
      </div>
    );
  }

  if (isError || !demand) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertCircle size={32} className="mb-3 text-red-400" />
        <p className="text-sm text-red-500 font-medium mb-4">加载失败</p>
        <button
          onClick={() => navigate("/order-hall")}
          className="px-5 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary hover:text-white transition-colors text-sm"
        >
          返回需求大厅
        </button>
      </div>
    );
  }

  const myTender = demand.tenders?.[0];
  const alreadyApplied = !!myTender;

  const requiredLevel = demand.opcLevel ?? "any";
  const myMaxLevel = trackCerts.reduce((max, c) => {
    return (LEVEL_ORDER[c.level] ?? 0) > (LEVEL_ORDER[max] ?? 0) ? c.level : max;
  }, "any");
  const levelEligible = isGuest || requiredLevel === "any" || (LEVEL_ORDER[myMaxLevel] ?? 0) >= (LEVEL_ORDER[requiredLevel] ?? 0);

  const canBid = demand.mode === "public" && demand.status === "negotiating" && levelEligible;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Back */}
      <button
        onClick={() => navigate("/order-hall")}
        className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
      >
        <ChevronLeft size={16} /> 返回需求大厅
      </button>

      {/* Title header */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
        <div className="flex flex-wrap gap-2 mb-3">
          {demand.isUrgent && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-destructive text-white text-xs font-bold rounded-lg">
              <Zap size={11} /> 紧急
            </span>
          )}
          {demand.mode === "invited" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg">
              <Mail size={11} /> 邀请制
            </span>
          )}
          {demand.mode === "public" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-100 text-sky-700 text-xs font-bold rounded-lg">
              <Globe size={11} /> 公开竞标
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary/15 text-secondary text-xs font-bold rounded-lg">
            <Tag size={11} /> {resolveDemandType(demand.demandType)}
          </span>
        </div>

        <h1 className="text-2xl font-extrabold text-foreground font-display mb-1 leading-snug">
          {demand.title}
        </h1>
        {demand.demandNo && (
          <p className="text-xs font-mono text-muted-foreground">{demand.demandNo}</p>
        )}
      </div>

      {/* Key info */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Tag size={15} className="text-primary" />
          <h3 className="font-bold text-foreground text-sm">需求信息</h3>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">平台参考价格</p>
            <p className="font-black text-primary text-xl">
              {formatBudgetRange(demand.expectedPriceMin, demand.expectedPriceMax)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">报价请参考此区间</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">OPC 等级要求</p>
            <p className="font-bold text-foreground">
              {LEVEL_LABEL[requiredLevel] ?? requiredLevel}
            </p>
            {!isGuest && requiredLevel !== "any" && !levelEligible && (
              <p className="text-[10px] text-destructive mt-0.5 flex items-center gap-1">
                <Lock size={10} /> 您当前等级不符合要求
              </p>
            )}
            {!isGuest && requiredLevel !== "any" && levelEligible && (
              <p className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
                <CheckCircle2 size={10} /> 等级符合
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">发布时间</p>
            <p className="flex items-center gap-1 text-foreground">
              <CalendarDays size={12} className="text-muted-foreground" />
              {new Date(demand.createdAt).toLocaleDateString("zh-CN")}
            </p>
          </div>
          {demand.demandNo && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">需求编号</p>
              <p className="flex items-center gap-1 font-mono text-xs text-foreground">
                <Hash size={11} className="text-muted-foreground" />
                {demand.demandNo}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detail content */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <FileText size={15} className="text-primary" />
          <h3 className="font-bold text-foreground text-sm flex-1">需求详情</h3>
          {demand.latestVersion && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              v{demand.latestVersion.versionNo}
            </span>
          )}
          <button
            onClick={() => {
              const text = `# ${demand.title}\n\n${demand.latestVersion?.detail ?? demand.detail ?? ""}`.trim();
              navigator.clipboard.writeText(text).then(() => { setCopiedDemand(true); setTimeout(() => setCopiedDemand(false), 2000); });
            }}
            title="复制需求文档"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors ml-1"
          >
            {copiedDemand ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
            {copiedDemand ? "已复制" : "复制"}
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
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
        </div>
      </div>

      {/* Milestones */}
      {demand.milestones && demand.milestones.length > 0 && (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
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
                    <p className="text-xs text-muted-foreground mt-0.5">{ms.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action area */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
        {alreadyApplied ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle2 size={16} /> 您已报名此需求
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">点击右侧按钮查看投标进度和报价详情</p>
            </div>
            <button
              onClick={() => navigate(`/opc/tenders/${myTender.id}`)}
              className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors text-sm"
            >
              查看我的投标
            </button>
          </div>
        ) : demand.mode === "invited" ? (
          <div className="flex items-start gap-3">
            <Lock size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-700">邀请制需求</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                此需求为邀请制，您已被邀请查看详情，但无法主动报名投标。如有意向，请联系平台运营。
              </p>
            </div>
          </div>
        ) : !canBid ? (
          <div className="flex items-start gap-3">
            <Lock size={18} className="text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-foreground">暂无法报名</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {!levelEligible
                  ? `此需求要求 ${LEVEL_LABEL[requiredLevel] ?? requiredLevel} 认证，您当前等级不符合要求。`
                  : "此需求当前不在报名期。"}
              </p>
            </div>
          </div>
        ) : isGuest ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Lock size={18} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-foreground">登录后即可报价</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  登录您的 OPC 账号，报名参与此需求竞标
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                sessionStorage.setItem("returnTo", currentPath);
                navigate("/login");
              }}
              className="shrink-0 flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors text-sm shadow-md hover:shadow-primary/30"
            >
              登录后报价
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-foreground">确认报名此需求</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                报名后将进入洽谈阶段，您可与平台沟通方案并提交报价
              </p>
            </div>
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-60 text-sm shadow-md hover:shadow-primary/30"
            >
              {applying && <Loader2 size={14} className="animate-spin" />}
              立即报名投标
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
