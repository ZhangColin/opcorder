import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, CheckCircle2, Clock, XCircle, UploadCloud, AlertCircle,
  ChevronDown, ChevronUp, FileText, ExternalLink, RotateCcw, Flag, Star, Send, Loader2,
  Building2, MapPin, Globe, Mail, Users, CalendarDays, ChevronRight, Link2,
} from "lucide-react";

import {
  useGetOrderById,
  useSubmitDeliverable,
} from "@workspace/api-client-react";
import type { Milestone, Deliverable } from "@workspace/api-client-react";
import { ORDER_STATUSES } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function extractUrls(text: string): { urls: string[]; plainText: string } {
  if (!text) return { urls: [], plainText: "" };
  const urlRegex = /https?:\/\/[^\s|,，]+/g;
  const urls: string[] = [];
  const plainText = text
    .replace(urlRegex, (match) => { urls.push(match.trim()); return ""; })
    .replace(/\|/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { urls, plainText };
}

const MS_STATUS_CFG = {
  pending:   { label: "待提交", icon: Clock,       cls: "bg-amber-100 text-amber-700" },
  submitted: { label: "审核中", icon: Clock,       cls: "bg-blue-100  text-blue-700"  },
  approved:  { label: "已通过", icon: CheckCircle2, cls: "bg-green-100 text-green-700" },
  rejected:  { label: "已打回", icon: XCircle,     cls: "bg-red-100   text-red-700"   },
} as const;

const DELIV_STATUS_CFG = {
  submitted: { label: "待审核", cls: "bg-amber-100 text-amber-700" },
  approved:  { label: "已通过", cls: "bg-green-100 text-green-700" },
  rejected:  { label: "已打回", cls: "bg-red-100   text-red-700"   },
} as const;

function EmptyDelivForm({
  milestoneId,
  milestoneLabel,
  orderId,
  onSuccess,
}: {
  milestoneId?: number;
  milestoneLabel: string;
  orderId: number;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", fileUrl: "" });
  const { mutate: submit, isPending } = useSubmitDeliverable();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(
      {
        orderId,
        data: {
          title: form.title,
          description: form.description,
          fileUrl: form.fileUrl || undefined,
          milestoneId,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "交付物已提交", description: "等待发单方审核。" });
          setForm({ title: "", description: "", fileUrl: "" });
          setOpen(false);
          onSuccess();
        },
        onError: () => {
          toast({ title: "提交失败", variant: "destructive" });
        },
      }
    );
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
      >
        <UploadCloud size={15} /> 提交{milestoneLabel}交付物
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 border border-primary/20 rounded-xl p-4 bg-primary/5 space-y-3">
      <p className="text-sm font-bold text-primary mb-1">提交「{milestoneLabel}」交付物</p>
      <div>
        <label className="block text-xs font-bold mb-1 text-foreground">交付物名称 *</label>
        <input
          required
          className="w-full bg-background border border-border rounded-lg p-2.5 text-sm focus:border-primary outline-none"
          placeholder="例：第一阶段需求分析报告"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
        />
      </div>
      <div>
        <label className="block text-xs font-bold mb-1 text-foreground">交付说明</label>
        <textarea
          rows={2}
          className="w-full bg-background border border-border rounded-lg p-2.5 text-sm focus:border-primary outline-none resize-none"
          placeholder="简述交付内容及要点…"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />
      </div>
      <div>
        <label className="block text-xs font-bold mb-1 text-foreground">文件链接（网盘/代码仓库等）</label>
        <input
          className="w-full bg-background border border-border rounded-lg p-2.5 text-sm focus:border-primary outline-none"
          placeholder="https://..."
          value={form.fileUrl}
          onChange={(e) => setForm((p) => ({ ...p, fileUrl: e.target.value }))}
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "提交中…" : "确认提交"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          取消
        </button>
      </div>
    </form>
  );
}

function MilestoneCard({
  ms,
  index,
  deliverables,
  orderId,
  orderStatus,
  onRefetch,
}: {
  ms: Milestone;
  index: number;
  deliverables: Deliverable[];
  orderId: number;
  orderStatus: string;
  onRefetch: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  // Use 1-based index as the milestone ID (JSONB milestones don't have their own id)
  const msDelivs = deliverables.filter((d) => d.milestoneId === index + 1);

  // Derive milestone status from its deliverables, not from ms.status (which is undefined in JSONB)
  const status =
    msDelivs.some((d) => d.status === "approved") ? "completed" :
    msDelivs.some((d) => d.status === "submitted") ? "submitted" :
    msDelivs.some((d) => d.status === "rejected") ? "rejected" :
    "pending";

  const cfg = MS_STATUS_CFG[status as keyof typeof MS_STATUS_CFG] ?? MS_STATUS_CFG.pending;
  const Icon = cfg.icon;
  const canSubmit = orderStatus === "in_progress" && (status === "pending" || status === "rejected");
  const latestRejected = msDelivs.find((d) => d.status === "rejected");
  const rejectedCount = msDelivs.filter((d) => d.status === "rejected").length;
  const MAX_REVISIONS = 3;

  return (
    <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-sm">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-5 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground">{ms.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            截止：{ms.deadline}
            {ms.deliverableDesc && <> · {ms.deliverableDesc}</>}
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${cfg.cls}`}>
          <Icon size={12} /> {cfg.label}
        </span>
        {rejectedCount > 0 && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${rejectedCount >= MAX_REVISIONS ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
            返工 {rejectedCount}/{MAX_REVISIONS}
          </span>
        )}
        {expanded ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border">
          {latestRejected && (
            <div className="mt-4 flex gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700 mb-0.5">打回原因</p>
                <p className="text-sm text-red-600">{latestRejected.feedback || "请查阅沟通记录后重新提交。"}</p>
              </div>
            </div>
          )}

          {msDelivs.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">本节点交付记录</p>
              {msDelivs.map((d) => {
                const dc = DELIV_STATUS_CFG[d.status as keyof typeof DELIV_STATUS_CFG] ?? DELIV_STATUS_CFG.submitted;
                const { urls: descUrls, plainText } = extractUrls(d.description ?? "");
                const allUrls = d.fileUrl
                  ? [d.fileUrl, ...descUrls.filter(u => u !== d.fileUrl)]
                  : descUrls;
                return (
                  <div key={d.id} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-background border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">{d.title}</p>
                      {plainText && <p className="text-xs text-muted-foreground mt-0.5">{plainText}</p>}
                      {allUrls.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {allUrls.map((url, j) => {
                            const filename = url.split("/").pop()?.split("?")[0] ?? `文件${j + 1}`;
                            return (
                              <a key={j} href={url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
                                <Link2 size={10} />
                                {filename.length > 20 ? filename.slice(0, 18) + "…" : filename}
                              </a>
                            );
                          })}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(d.submittedAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${dc.cls}`}>{dc.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {canSubmit && (
            <EmptyDelivForm
              milestoneId={index + 1}
              milestoneLabel={ms.name}
              orderId={orderId}
              onSuccess={onRefetch}
            />
          )}

          {status === "rejected" && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <RotateCcw size={11} /> 请修改后重新提交本节点交付物
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star size={22} className={s <= (hover || value) ? "fill-amber-400 text-amber-400" : "text-slate-200"} />
        </button>
      ))}
      {value > 0 && (
        <span className="text-sm text-slate-500 ml-1">
          {["", "较差", "一般", "良好", "优秀", "完美"][value]}
        </span>
      )}
    </div>
  );
}

function OpcReviewPanel({ orderId, onDone }: { orderId: number; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) { toast({ title: "请选择评分", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/orders/${orderId}/opc-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rating, comment }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "评价已提交" });
      onDone();
    } catch {
      toast({ title: "提交失败，请重试", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-4">
      <p className="font-bold text-blue-800 flex items-center gap-2">
        <Star size={16} className="text-amber-400 fill-amber-400" /> 对此次合作的发单方进行评价
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <StarPicker value={rating} onChange={setRating} />
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={2}
          placeholder="分享您对发单方的合作体验（选填）…"
          className="w-full px-3 py-2 border border-blue-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none bg-white"
        />
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading || rating === 0}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} 提交评价
          </button>
        </div>
      </form>
    </div>
  );
}

interface PublisherProfileData {
  companyLogo: string | null;
  companyDesc: string | null;
  industry: string | null;
  location: string | null;
  teamSize: string | null;
  foundedYear: string | null;
  website: string | null;
  contactEmail: string | null;
}

function PublisherProfileModal({
  name,
  profile,
  onClose,
}: {
  name: string;
  profile: PublisherProfileData | null;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* 顶部 logo + 名称 */}
        <div className="bg-gradient-to-br from-blue-50 to-slate-100 px-6 py-6 flex items-center gap-4">
          {profile?.companyLogo ? (
            <img src={profile.companyLogo} alt="logo" className="w-16 h-16 rounded-2xl object-cover border border-white shadow-sm shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <Building2 size={28} className="text-slate-400" />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-black text-blue-900 leading-tight">{name}</h2>
            {profile?.industry && (
              <p className="text-sm text-slate-500 mt-0.5">{profile.industry}</p>
            )}
          </div>
        </div>

        {/* 详情信息 */}
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
                <MapPin size={14} className="text-slate-400 shrink-0" />
                <span>{profile.location}</span>
              </div>
            )}
            {profile?.teamSize && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Users size={14} className="text-slate-400 shrink-0" />
                <span>{profile.teamSize} 人</span>
              </div>
            )}
            {profile?.foundedYear && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarDays size={14} className="text-slate-400 shrink-0" />
                <span>成立于 {profile.foundedYear}</span>
              </div>
            )}
            {profile?.website && (
              <div className="flex items-center gap-2 text-sm">
                <Globe size={14} className="text-slate-400 shrink-0" />
                <a href={profile.website} target="_blank" rel="noreferrer"
                  className="text-primary underline truncate hover:text-primary/80 transition-colors">
                  {profile.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
            {profile?.contactEmail && (
              <div className="flex items-center gap-2 text-sm text-slate-600 col-span-2">
                <Mail size={14} className="text-slate-400 shrink-0" />
                <span>{profile.contactEmail}</span>
              </div>
            )}
          </div>

          {!profile && (
            <p className="text-sm text-slate-400 text-center py-4">该发单方暂未完善公司资料</p>
          )}
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 transition-colors">
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrderDetail() {
  const [, params] = useRoute("/orders/:id");
  const [, navigate] = useLocation();
  const id = parseInt(params?.id || "0", 10);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showPublisherModal, setShowPublisherModal] = useState(false);

  const { data: order, isLoading, refetch } = useGetOrderById(id);

  const onRefetch = () => {
    refetch();
    qc.invalidateQueries({ queryKey: ["/api/orders"] });
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded-lg w-32" />
        <div className="h-40 bg-muted rounded-2xl" />
        <div className="h-80 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20 text-muted-foreground">
        订单不存在或无权访问
      </div>
    );
  }

  const statusCfg = ORDER_STATUSES[order.status] ?? ORDER_STATUSES.in_progress;
  const hasMilestones = (order.milestones?.length ?? 0) > 0;
  const unlinkedDelivs = (order.deliverables ?? []).filter((d) => !d.milestoneId);
  const canSubmitGeneral = order.status === "in_progress" && !hasMilestones;

  const msCompletedCount = (order.milestones ?? []).filter((m) => m.status === "approved").length;
  const msTotal = (order.milestones ?? []).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/orders")}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold text-sm transition-colors"
      >
        <ArrowLeft size={16} /> 返回订单列表
      </button>

      {/* Publisher modal */}
      {showPublisherModal && (
        <PublisherProfileModal
          name={order.publisherName ?? "发单方"}
          profile={(order as any).publisherProfile ?? null}
          onClose={() => setShowPublisherModal(false)}
        />
      )}

      {/* Header */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col md:flex-row justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
              {order.orderNo}
            </span>
            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
          <h1 className="text-xl font-black font-display text-foreground mb-3">{order.demandTitle}</h1>
          <div className="flex flex-wrap gap-5 text-sm text-muted-foreground font-medium">
            {/* 发单方：logo + 名称，可点击查看详情 */}
            <button
              onClick={() => setShowPublisherModal(true)}
              className="flex items-center gap-2 hover:text-foreground transition-colors group">
              {(order as any).publisherLogo ? (
                <img
                  src={(order as any).publisherLogo}
                  alt="logo"
                  className="w-6 h-6 rounded-md object-cover border border-border group-hover:ring-2 group-hover:ring-primary/30 transition-all"
                />
              ) : (
                <div className="w-6 h-6 rounded-md bg-muted border border-border flex items-center justify-center">
                  <Building2 size={12} className="text-muted-foreground" />
                </div>
              )}
              <span>发单方: <span className="text-foreground font-semibold">{order.publisherName}</span></span>
              <ChevronRight size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
            <span>截止日期: <span className="text-foreground">{order.deadline ?? "—"}</span></span>
          </div>
        </div>
        <div className="bg-muted/50 rounded-xl border border-border p-5 text-left md:text-right min-w-[160px]">
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-1">我的分成</p>
          <p className="text-3xl font-black text-secondary">
            ¥{Math.round(order.amount * 0.9).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            订单总额 ¥{order.amount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Milestone progress summary */}
      {hasMilestones && (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <Flag size={16} className="text-primary" /> 里程碑进度
            </h2>
            <span className="text-sm font-bold text-muted-foreground">
              {msCompletedCount} / {msTotal} 已完成
            </span>
          </div>
          <div className="flex gap-1 h-2">
            {(order.milestones ?? []).map((m, i) => {
              const s = m.status ?? "pending";
              const bg = s === "approved" ? "bg-green-500" : s === "submitted" ? "bg-blue-400" : s === "rejected" ? "bg-red-400" : "bg-muted";
              return <div key={i} className={`flex-1 rounded-full ${bg} transition-all`} />;
            })}
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-muted-foreground">开始</span>
            <span className="text-xs text-muted-foreground">完成</span>
          </div>
        </div>
      )}

      {/* Milestone cards or generic form */}
      {hasMilestones ? (
        <div className="space-y-3">
          <h2 className="font-bold text-foreground text-sm uppercase tracking-wider text-muted-foreground px-1">
            里程碑节点详情
          </h2>
          {(order.milestones ?? []).map((ms, i) => (
            <MilestoneCard
              key={ms.id ?? i}
              ms={ms}
              index={i}
              deliverables={order.deliverables ?? []}
              orderId={id}
              orderStatus={order.status}
              onRefetch={onRefetch}
            />
          ))}

          {/* Show deliverables that were submitted without a milestone binding */}
          {unlinkedDelivs.length > 0 && (
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FileText size={13} /> 整体交付记录
              </p>
              <div className="space-y-2">
                {unlinkedDelivs.map((d) => {
                  const dc = DELIV_STATUS_CFG[d.status as keyof typeof DELIV_STATUS_CFG] ?? DELIV_STATUS_CFG.submitted;
                  const { urls: descUrls, plainText } = extractUrls(d.description ?? "");
                  const allUrls = d.fileUrl
                    ? [d.fileUrl, ...descUrls.filter(u => u !== d.fileUrl)]
                    : descUrls;
                  return (
                    <div key={d.id} className="flex items-start justify-between gap-3 p-4 rounded-xl bg-background border border-border">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-sm">{d.title}</p>
                        {plainText && <p className="text-xs text-muted-foreground mt-0.5">{plainText}</p>}
                        {d.feedback && d.status === "rejected" && (
                          <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                            打回原因：{d.feedback}
                          </div>
                        )}
                        {allUrls.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {allUrls.map((url, j) => {
                              const filename = url.split("/").pop()?.split("?")[0] ?? `文件${j + 1}`;
                              return (
                                <a key={j} href={url} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
                                  <Link2 size={10} />
                                  {filename.length > 22 ? filename.slice(0, 20) + "…" : filename}
                                </a>
                              );
                            })}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {new Date(d.submittedAt).toLocaleString("zh-CN")}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${dc.cls}`}>{dc.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
          <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <UploadCloud size={16} className="text-primary" /> 提交交付物
          </h2>

          {canSubmitGeneral ? (
            <EmptyDelivForm
              milestoneLabel="全部"
              orderId={id}
              onSuccess={onRefetch}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {order.status === "pending_acceptance"
                ? "交付物已提交，等待发单方验收。"
                : order.status === "completed"
                ? "订单已完成。"
                : "当前状态无法提交交付物。"}
            </p>
          )}

          {unlinkedDelivs.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">交付记录</p>
              {unlinkedDelivs.map((d) => {
                const dc = DELIV_STATUS_CFG[d.status as keyof typeof DELIV_STATUS_CFG] ?? DELIV_STATUS_CFG.submitted;
                return (
                  <div key={d.id} className="flex items-start justify-between gap-3 p-4 rounded-xl bg-background border border-border">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm">{d.title}</p>
                      {d.description && <p className="text-xs text-muted-foreground mt-0.5">{d.description}</p>}
                      {d.feedback && d.status === "rejected" && (
                        <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
                          打回原因：{d.feedback}
                        </div>
                      )}
                      {d.fileUrl && (
                        <a href={d.fileUrl} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary font-bold mt-1.5 hover:underline">
                          <ExternalLink size={11} /> 查看附件
                        </a>
                      )}
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {new Date(d.submittedAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${dc.cls}`}>{dc.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Completion status */}
      {order.status === "completed" && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-4">
            <CheckCircle2 size={28} className="text-green-600 shrink-0" />
            <div>
              <p className="font-bold text-green-800">订单已完成，结算已触发</p>
              <p className="text-sm text-green-700 mt-0.5">
                您的分成 ¥{Math.round(order.amount * 0.9).toLocaleString()} 将在 3 个工作日内到账。
              </p>
              {order.rating && (
                <div className="flex items-center gap-1 mt-1">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={12} className={s <= (order.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
                  ))}
                  <span className="text-xs text-green-600 ml-1">发单方评分：{order.rating} 分</span>
                </div>
              )}
              {order.reviewComment && (
                <p className="text-xs text-green-700 mt-0.5">评价：{order.reviewComment}</p>
              )}
              {(order as any).opcRating && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-green-600">您的评价：</span>
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={12} className={s <= ((order as any).opcRating ?? 0) ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {!(order as any).opcRating && (
            <OpcReviewPanel orderId={id} onDone={onRefetch} />
          )}
        </div>
      )}

      {order.status === "disputed" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center gap-4">
          <AlertCircle size={28} className="text-red-500 shrink-0" />
          <div>
            <p className="font-bold text-red-800">订单处于争议状态</p>
            <p className="text-sm text-red-700 mt-0.5">平台将在 48 小时内介入调解，请保持联系方式畅通。</p>
          </div>
        </div>
      )}
    </div>
  );
}
