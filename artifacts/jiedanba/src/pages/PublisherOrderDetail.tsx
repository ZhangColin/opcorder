import { useState } from "react";
import { clearSession } from "@/lib/auth";
import { useLocation } from "wouter";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Search, Bell, ArrowLeft, CheckCircle2, Clock,
  XCircle, Star, AlertCircle, Zap, FileText, Download,
  ChevronRight, Trophy, RefreshCw,
  Menu,
} from "lucide-react";
import {
  useGetOrderById,
  useAcceptOrder,
  useRejectDelivery,
} from "@workspace/api-client-react";
import { useParams } from "wouter";
import { PublisherSidebar } from "@/components/publisher/PublisherSidebar";
import { PublisherHeaderUser } from '@/components/publisher/PublisherHeaderUser';
import { useQueryClient } from "@tanstack/react-query";

/** 从文本中提取所有 URL，返回 { urls, textWithoutUrls } */
function extractUrls(text: string): { urls: string[]; plainText: string } {
  if (!text) return { urls: [], plainText: "" };
  const urlRegex = /https?:\/\/[^\s|,，]+/g;
  const urls: string[] = [];
  const plainText = text
    .replace(urlRegex, (match) => { urls.push(match.trim()); return ""; })
    .replace(/代码包:\s*—\s*\|?\s*/gi, "")
    .replace(/文档:\s*—\s*\|?\s*/gi, "")
    .replace(/\|/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { urls, plainText };
}

const ORDER_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  in_progress:        { label: "进行中",  color: "bg-green-100 text-green-700" },
  pending_acceptance: { label: "待验收",  color: "bg-orange-100 text-orange-700" },
  completed:          { label: "已完成",  color: "bg-emerald-100 text-emerald-700" },
  disputed:           { label: "争议中",  color: "bg-red-100 text-red-600" },
  closed:             { label: "已关闭",  color: "bg-slate-100 text-slate-500" },
};

const MILESTONE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "待提交", color: "text-slate-400",  icon: Clock },
  submitted: { label: "待审查", color: "text-amber-600",  icon: RefreshCw },
  approved:  { label: "已通过", color: "text-green-600",  icon: CheckCircle2 },
  rejected:  { label: "已打回", color: "text-red-500",    icon: XCircle },
};

const DELIVERABLE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  submitted: { label: "待审查", color: "bg-amber-100 text-amber-700" },
  approved:  { label: "已通过", color: "bg-green-100 text-green-700" },
  rejected:  { label: "已打回", color: "bg-red-100 text-red-600" },
};

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            size={22}
            className={
              s <= (hover || value)
                ? "fill-amber-400 text-amber-400"
                : "text-slate-200"
            }
          />
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

export default function PublisherOrderDetail() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const orderId = parseInt(params.id ?? "0", 10);
  const qc = useQueryClient();
  // useCurrentUser() destructure removed

  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { data: order, isLoading } = useGetOrderById(orderId, {
    query: { enabled: orderId > 0 },
  });

  const acceptOrder = useAcceptOrder();
  const rejectDelivery = useRejectDelivery();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });
    await qc.invalidateQueries({ queryKey: ["/api/orders"] });
  };

  const handleAccept = async () => {
    setActionError(null);
    try {
      await acceptOrder.mutateAsync({
        orderId,
        data: {
          ...(rating > 0 ? { rating } : {}),
          ...(reviewComment ? { comment: reviewComment } : {}),
        },
      });
      await invalidate();
      setShowAcceptModal(false);
      setActionSuccess("验收成功！结算流程已自动触发。");
    } catch {
      setActionError("操作失败，请稍后重试");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setActionError("请填写返工意见");
      return;
    }
    setActionError(null);
    try {
      await rejectDelivery.mutateAsync({ orderId, data: { reason: rejectReason } });
      await invalidate();
      setShowRejectModal(false);
      setRejectReason("");
      setActionSuccess("已要求 OPC 返工，返工意见已发送。");
    } catch {
      setActionError("操作失败，请稍后重试");
    }
  };

  const statusCfg = order?.status
    ? (ORDER_STATUS_CONFIG[order.status] ?? { label: order.status, color: "bg-slate-100 text-slate-500" })
    : { label: "", color: "" };

  const canAccept = order?.status === "pending_acceptance";

  const approvedMilestones = (order?.milestones ?? []).filter((m) => m.status === "approved").length;
  const totalMilestones = (order?.milestones ?? []).length;

  return (
    <div className="flex min-h-screen bg-[#f9f9fc] text-[#1a1c1e]">
      <PublisherSidebar onLogout={logout} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      <main className="flex-1 md:ml-64 min-h-screen">
        {/* Top bar */}
        <header className="fixed top-0 right-0 md:left-64 left-0 z-40 bg-white/80 backdrop-blur-md shadow-sm flex items-center px-4 md:px-8 py-3 gap-2">
          {/* Mobile hamburger */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden shrink-0 p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/publisher/orders")}
              className="flex items-center gap-2 text-slate-500 hover:text-primary text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} /> 返回订单列表
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="relative w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索…"
                className="w-full bg-slate-100 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
            </button>
            <PublisherHeaderUser onLogout={logout} />
          </div>
        </header>

        <div className="pt-20 pb-16 px-8 max-w-[1280px] mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : !order ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <AlertCircle size={48} className="mb-4 text-slate-300" />
              <p className="text-lg font-medium">订单不存在或已被删除</p>
              <button onClick={() => navigate("/publisher/orders")} className="mt-4 text-primary text-sm hover:underline">
                返回订单列表
              </button>
            </div>
          ) : (
            <>
              {/* Alerts */}
              {actionSuccess && (
                <div className="mb-6 flex items-center gap-3 bg-green-50 text-green-700 rounded-xl p-4 border border-green-200">
                  <CheckCircle2 size={18} />
                  <span className="text-sm font-medium">{actionSuccess}</span>
                  <button onClick={() => setActionSuccess(null)} className="ml-auto text-green-400 hover:text-green-600">
                    <XCircle size={16} />
                  </button>
                </div>
              )}
              {actionError && (
                <div className="mb-6 flex items-center gap-3 bg-red-50 text-red-700 rounded-xl p-4 border border-red-200">
                  <AlertCircle size={18} />
                  <span className="text-sm font-medium">{actionError}</span>
                  <button onClick={() => setActionError(null)} className="ml-auto text-red-400 hover:text-red-600">
                    <XCircle size={16} />
                  </button>
                </div>
              )}

              {/* Pending acceptance banner */}
              {order.status === "pending_acceptance" && (
                <div className="mb-6 bg-orange-50 border border-orange-200 rounded-2xl p-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <Zap size={18} className="text-orange-600" />
                    </div>
                    <div>
                      <p className="font-bold text-orange-800">OPC 已提交全部交付物，等待您确认验收</p>
                      <p className="text-xs text-orange-600 mt-0.5">若7个自然日内未操作，系统将自动确认验收</p>
                    </div>
                  </div>
                  <div className="flex gap-3 shrink-0">
                    <button
                      onClick={() => { setActionError(null); setShowAcceptModal(true); }}
                      className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <CheckCircle2 size={16} /> 确认验收
                    </button>
                    <button
                      onClick={() => { setActionError(null); setShowRejectModal(true); }}
                      className="flex items-center gap-2 border border-red-300 text-red-600 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
                    >
                      <XCircle size={16} /> 要求返工
                    </button>
                  </div>
                </div>
              )}

              {order.status === "completed" && (
                <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-3">
                  <Trophy size={20} className="text-emerald-600" />
                  <div>
                    <p className="font-bold text-emerald-800">订单已完成，结算流程已触发</p>
                    {order.rating && (
                      <div className="flex items-center gap-1 mt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={12} className={s <= order.rating! ? "fill-amber-400 text-amber-400" : "text-slate-300"} />
                        ))}
                        <span className="text-xs text-emerald-600 ml-1">您的评分：{order.rating} 分</span>
                      </div>
                    )}
                    {order.reviewComment && (
                      <p className="text-xs text-emerald-700 mt-0.5">评价：{order.reviewComment}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Main Content */}
                <div className="lg:col-span-2 space-y-8">

                  {/* Milestone Progress */}
                  {order.milestones && order.milestones.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-base font-bold text-primary font-display flex items-center gap-2">
                          <Zap size={16} /> 里程碑进度
                        </h2>
                        <span className="text-sm font-bold text-slate-600">
                          {approvedMilestones} / {totalMilestones} 已通过
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-8">
                        <div className="flex gap-1">
                          {order.milestones.map((m, i) => (
                            <div
                              key={i}
                              className={`h-2 flex-1 rounded-full ${
                                m.status === "approved"
                                  ? "bg-green-400"
                                  : m.status === "submitted"
                                  ? "bg-amber-400"
                                  : m.status === "rejected"
                                  ? "bg-red-300"
                                  : "bg-slate-200"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        {order.milestones.map((m, i) => {
                          const mCfg = MILESTONE_STATUS_CONFIG[m.status ?? "pending"] ?? MILESTONE_STATUS_CONFIG.pending;
                          const MIcon = mCfg.icon;
                          return (
                            <div
                              key={i}
                              className={`rounded-xl border p-5 ${
                                m.status === "submitted"
                                  ? "border-amber-200 bg-amber-50"
                                  : m.status === "approved"
                                  ? "border-green-100 bg-green-50"
                                  : m.status === "rejected"
                                  ? "border-red-100 bg-red-50"
                                  : "border-slate-100 bg-slate-50"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-sm ${mCfg.color}`}>
                                    <MIcon size={16} />
                                  </div>
                                  <div>
                                    <p className="font-bold text-foreground text-sm">{m.name}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                      截止：{new Date(m.deadline).toLocaleDateString("zh-CN")}
                                    </p>
                                  </div>
                                </div>
                                <span className={`text-xs font-bold ${mCfg.color}`}>{mCfg.label}</span>
                              </div>
                              {m.deliverableDesc && (
                                <p className="text-xs text-slate-500 mt-3 pl-11">{m.deliverableDesc}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Deliverables */}
                  {order.deliverables && order.deliverables.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                      <h2 className="text-base font-bold text-primary font-display flex items-center gap-2 mb-6">
                        <FileText size={16} /> 交付物列表
                      </h2>
                      <div className="space-y-3">
                        {order.deliverables.map((d) => {
                          const dCfg = DELIVERABLE_STATUS_CONFIG[d.status] ?? { label: d.status, color: "bg-slate-100 text-slate-500" };
                          const { urls: descUrls, plainText } = extractUrls(d.description ?? "");
                          // Deduplicate: fileUrl may already be in descUrls
                          const allUrls = d.fileUrl
                            ? [d.fileUrl, ...descUrls.filter(u => u !== d.fileUrl)]
                            : descUrls;
                          return (
                            <div
                              key={d.id}
                              className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100"
                            >
                              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                <FileText size={18} className="text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-bold text-sm text-foreground truncate">{d.title}</p>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${dCfg.color}`}>
                                    {dCfg.label}
                                  </span>
                                </div>
                                {plainText && (
                                  <p className="text-xs text-slate-500 leading-relaxed">{plainText}</p>
                                )}
                                {/* Clickable file links */}
                                {allUrls.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {allUrls.map((url, i) => {
                                      const filename = url.split("/").pop()?.split("?")[0] ?? `文件${i + 1}`;
                                      return (
                                        <a
                                          key={i}
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
                                        >
                                          <Download size={12} />
                                          {filename.length > 24 ? filename.slice(0, 21) + "…" : filename}
                                        </a>
                                      );
                                    })}
                                  </div>
                                )}
                                {allUrls.length === 0 && !plainText && (
                                  <p className="text-xs text-slate-400 italic">暂无附件</p>
                                )}
                                {d.feedback && (
                                  <p className="text-xs text-red-600 mt-2 flex items-start gap-1">
                                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                    反馈：{d.feedback}
                                  </p>
                                )}
                                <p className="text-xs text-slate-400 mt-1.5">
                                  提交于 {new Date(d.submittedAt).toLocaleDateString("zh-CN")}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Empty state when no milestones or deliverables */}
                  {(!order.milestones || order.milestones.length === 0) &&
                    (!order.deliverables || order.deliverables.length === 0) && (
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center text-slate-400">
                        <Clock size={44} className="mx-auto mb-3 text-slate-200" />
                        <p className="font-medium">项目正在推进中</p>
                        <p className="text-xs mt-1">OPC 提交里程碑交付物后将在此显示</p>
                      </div>
                  )}
                </div>

                {/* Right Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Order Summary */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">订单信息</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-slate-500 shrink-0">订单编号</span>
                        <span className="font-mono text-xs font-bold text-right text-slate-700">{order.orderNo}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-500">当前状态</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">OPC</span>
                        <span className="font-bold">{order.opcNickname ?? `#${order.opcId}`}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">订单金额</span>
                        <span className="font-extrabold text-primary text-base">¥{(order.amount ?? 0).toLocaleString()}</span>
                      </div>
                      {order.deadline && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">交付截止</span>
                          <span className="font-semibold">{new Date(order.deadline).toLocaleDateString("zh-CN")}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">创建时间</span>
                        <span className="text-slate-600">{new Date(order.createdAt).toLocaleDateString("zh-CN")}</span>
                      </div>
                    </div>
                  </div>

                  {/* Settlement Breakdown */}
                  {(order.opcShare != null || order.publisherShare != null) && (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">结算分配</h3>
                      <div className="space-y-3 text-sm">
                        {order.opcShare != null && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">OPC 接单方</span>
                            <span className="font-bold text-green-700">¥{order.opcShare.toLocaleString()}</span>
                          </div>
                        )}
                        {order.publisherShare != null && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">发单方</span>
                            <span className="font-bold text-blue-700">¥{order.publisherShare.toLocaleString()}</span>
                          </div>
                        )}
                        {order.platformFee != null && (
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500">平台服务费</span>
                            <span className="font-bold text-slate-500">¥{order.platformFee.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between items-center">
                          <span className="font-bold text-slate-700">合计</span>
                          <span className="font-extrabold text-primary">¥{order.amount.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {canAccept && (
                    <div className="bg-white rounded-2xl border border-orange-200 shadow-sm p-6 space-y-3">
                      <h3 className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                        <Zap size={12} /> 待处理操作
                      </h3>
                      <button
                        onClick={() => { setActionError(null); setShowAcceptModal(true); }}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-4 py-3 text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
                      >
                        <CheckCircle2 size={16} /> 确认验收
                      </button>
                      <button
                        onClick={() => { setActionError(null); setShowRejectModal(true); }}
                        className="w-full flex items-center justify-center gap-2 border border-red-300 text-red-600 rounded-xl px-4 py-3 text-sm font-bold hover:bg-red-50 transition-colors"
                      >
                        <XCircle size={16} /> 要求返工
                      </button>
                    </div>
                  )}

                  {/* Related Demand Link */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">关联需求</h3>
                    <button
                      onClick={() => navigate(`/publisher/demand/${order.demandId}`)}
                      className="w-full flex items-center justify-between text-sm font-medium text-slate-700 hover:text-primary transition-colors group"
                    >
                      <span className="line-clamp-2 text-left">{order.demandTitle}</span>
                      <ChevronRight size={16} className="shrink-0 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Accept Modal ── */}
              {showAcceptModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
                    <h3 className="text-xl font-extrabold text-primary mb-2 font-display">确认验收</h3>
                    <p className="text-slate-500 text-sm mb-6">
                      确认后结算流程将自动触发，OPC 将在 3 个工作日内收到分成款项。
                    </p>

                    <div className="mb-5">
                      <label className="block text-sm font-bold text-foreground mb-3">
                        评价本次交付（可选）
                      </label>
                      <StarPicker value={rating} onChange={setRating} />
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-bold text-foreground mb-2">
                        评价意见（可选）
                      </label>
                      <textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="对本次 OPC 服务的整体评价…"
                        rows={3}
                        className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                      />
                    </div>

                    {actionError && (
                      <div className="mb-4 flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle size={16} /> {actionError}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handleAccept}
                        disabled={acceptOrder.isPending}
                        className="flex-1 flex items-center justify-center gap-2 bg-primary text-white rounded-xl py-3 font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 size={16} />
                        {acceptOrder.isPending ? "处理中…" : "确认验收并结算"}
                      </button>
                      <button
                        onClick={() => { setShowAcceptModal(false); setActionError(null); }}
                        className="px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Reject Modal ── */}
              {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
                    <h3 className="text-xl font-extrabold text-red-700 mb-2 font-display">要求返工</h3>
                    <p className="text-slate-500 text-sm mb-6">
                      请说明需要返工的具体内容，该意见将直接发送给 OPC。
                    </p>

                    <div className="mb-6">
                      <label className="block text-sm font-bold text-foreground mb-2">
                        返工意见 <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => { setRejectReason(e.target.value); setActionError(null); }}
                        placeholder="请详细说明哪些内容需要修改、修改标准是什么…"
                        rows={4}
                        className="w-full text-sm rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus:ring-2 focus:ring-red-200 outline-none resize-none"
                      />
                    </div>

                    {actionError && (
                      <div className="mb-4 flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle size={16} /> {actionError}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handleReject}
                        disabled={rejectDelivery.isPending}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white rounded-xl py-3 font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        <XCircle size={16} />
                        {rejectDelivery.isPending ? "发送中…" : "发送返工意见"}
                      </button>
                      <button
                        onClick={() => { setShowRejectModal(false); setActionError(null); setRejectReason(""); }}
                        className="px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
