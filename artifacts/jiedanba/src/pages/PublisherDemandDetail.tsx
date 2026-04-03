import { useCurrentUser } from "@/hooks/use-current-user";
import { clearSession } from "@/lib/auth";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  Search, Bell, Star, BadgeCheck, Calendar,
  Zap, ArrowLeft, User, ChevronRight, CheckCircle2, Clock,
  XCircle, ExternalLink, AlertCircle, Timer, Trophy,
  FileText, Download, FileImage, FileSpreadsheet, FileArchive, File,
  Menu,
} from "lucide-react";
import {
  useGetDemandById,
  useListBidsForDemand,
  useUpdateBidStatus,
} from "@workspace/api-client-react";
import { useParams } from "wouter";
import { PublisherSidebar } from "@/components/publisher/PublisherSidebar";
import { PublisherHeaderUser } from '@/components/publisher/PublisherHeaderUser';
import { useQueryClient } from "@tanstack/react-query";

const DEMAND_TYPE_LABELS: Record<string, string> = {
  ai_education: "AI 教育",
  gov_training: "政企培训",
  ai_research: "AI 研究",
  ai_tool_dev: "AI 工具开发",
  party_building: "党建数字化",
  livestream_media: "直播媒体",
  other: "综合",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:              { label: "草稿",   color: "bg-slate-100 text-slate-600" },
  pending_review:     { label: "待审核", color: "bg-amber-100 text-amber-700" },
  published:          { label: "招募中", color: "bg-blue-100 text-blue-700" },
  matched:            { label: "已匹配", color: "bg-purple-100 text-purple-700" },
  in_progress:        { label: "进行中", color: "bg-green-100 text-green-700" },
  pending_acceptance: { label: "待验收", color: "bg-orange-100 text-orange-700" },
  completed:          { label: "已完成", color: "bg-emerald-100 text-emerald-700" },
  closed:             { label: "已关闭", color: "bg-red-100 text-red-600" },
};

const OPC_LEVEL_COLOR: Record<string, string> = {
  C: "bg-slate-100 text-slate-600",
  B: "bg-blue-100 text-blue-700",
  A: "bg-amber-100 text-amber-700",
};

function AttachmentIcon({ type }: { type: string }) {
  if (type?.startsWith("image") || type === "image") return <FileImage size={18} className="text-blue-500" />;
  if (type?.includes("sheet") || type === "spreadsheet") return <FileSpreadsheet size={18} className="text-green-600" />;
  if (type?.includes("zip") || type?.includes("rar") || type === "archive") return <FileArchive size={18} className="text-yellow-600" />;
  return <File size={18} className="text-slate-400" />;
}

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={12}
          className={s <= Math.round(score) ? "fill-amber-400 text-amber-400" : "text-slate-200"}
        />
      ))}
      <span className="text-xs text-slate-500 ml-1">{score.toFixed(1)}</span>
    </div>
  );
}

export default function PublisherDemandDetail() {
  const [, navigate] = useLocation();
  // useCurrentUser() destructure removed
  const params = useParams<{ id: string }>();
  const demandId = parseInt(params.id ?? "0", 10);
  const qc = useQueryClient();

  const [confirmingBidId, setConfirmingBidId] = useState<number | null>(null);
  const [rejectingBidId, setRejectingBidId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: demand, isLoading: demandLoading } = useGetDemandById(demandId, {
    query: { enabled: demandId > 0 },
  });

  const { data: bids = [], isLoading: bidsLoading } = useListBidsForDemand(demandId, {
    query: { enabled: demandId > 0 },
  });

  const updateBidStatus = useUpdateBidStatus();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  const handleConfirm = async (bidId: number) => {
    setActionError(null);
    try {
      await updateBidStatus.mutateAsync({ bidId, data: { status: "accepted" } });
      await qc.invalidateQueries({ queryKey: [`/api/demands/${demandId}/bids`] });
      await qc.invalidateQueries({ queryKey: [`/api/demands/${demandId}`] });
      setConfirmingBidId(null);
    } catch {
      setActionError("操作失败，请稍后重试");
    }
  };

  const handleReject = async (bidId: number) => {
    setActionError(null);
    try {
      await updateBidStatus.mutateAsync({ bidId, data: { status: "rejected" } });
      await qc.invalidateQueries({ queryKey: [`/api/demands/${demandId}/bids`] });
      setRejectingBidId(null);
      setRejectReason("");
    } catch {
      setActionError("操作失败，请稍后重试");
    }
  };

  const typeLabel = demand?.type ? (DEMAND_TYPE_LABELS[demand.type] ?? demand.type) : "综合";
  const statusCfg = demand?.status ? (STATUS_CONFIG[demand.status] ?? STATUS_CONFIG.draft) : STATUS_CONFIG.draft;

  const pendingBids = (bids as any[]).filter((b: any) => b.status === "pending");
  const processedBids = (bids as any[]).filter((b: any) => b.status !== "pending");

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
              onClick={() => navigate("/publisher/demands")}
              className="flex items-center gap-2 text-slate-500 hover:text-primary text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} /> 返回需求列表
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
          {demandLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : !demand ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <AlertCircle size={48} className="mb-4 text-slate-300" />
              <p className="text-lg font-medium">需求不存在或已被删除</p>
              <button onClick={() => navigate("/publisher/demands")} className="mt-4 text-primary text-sm hover:underline">
                返回需求列表
              </button>
            </div>
          ) : (
            <>
              {/* ── Demand Header ── */}
              <div className="mb-8 bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-widest bg-slate-100 px-2 py-1 rounded text-slate-600">
                        {typeLabel}
                      </span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                      {demand.isUrgent && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-600 flex items-center gap-1">
                          <Zap size={10} /> 紧急
                        </span>
                      )}
                      <span className="text-xs text-slate-400 font-mono">{demand.demandNo}</span>
                    </div>
                    <h1 className="text-2xl font-extrabold text-primary tracking-tight mb-3 font-display leading-tight">
                      {demand.title}
                    </h1>
                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-4">{demand.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-400 mb-1">预算区间</p>
                    <p className="text-2xl font-extrabold text-primary">
                      ¥{demand.budgetMin.toLocaleString()} – ¥{demand.budgetMax.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center justify-end gap-1">
                      <Calendar size={12} />
                      截止 {new Date(demand.deadline).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                </div>

                {/* Skills */}
                {demand.skillTags && demand.skillTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-100">
                    {demand.skillTags.map((tag) => (
                      <span key={tag} className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {actionError && (
                <div className="mb-6 flex items-center gap-3 bg-red-50 text-red-700 rounded-xl p-4 border border-red-200">
                  <AlertCircle size={18} />
                  <span className="text-sm font-medium">{actionError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Content + Bid Applications */}
                <div className="lg:col-span-2 space-y-8">

                  {/* ── 需求详细说明 ── */}
                  <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                    <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2 font-display">
                      <FileText size={16} /> 需求详细说明
                    </h3>
                    <div className="text-sm text-slate-600 leading-relaxed space-y-2">
                      {(demand.description || "").split('\n').map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>
                  </section>

                  {/* ── 附件资料 ── */}
                  {(() => {
                    const attachments: Array<{ name: string; size: string; type: string; url: string }> =
                      (demand as any).attachments?.length ? (demand as any).attachments : [];
                    return (
                      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                        <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2 font-display">
                          <Download size={16} /> 附件资料
                        </h3>
                        {attachments.length === 0 ? (
                          <p className="text-sm text-slate-400">暂无上传附件</p>
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
                                      className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-all group cursor-pointer"
                                    >
                                      <AttachmentIcon type={file.type} />
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-slate-700 truncate group-hover:text-primary transition-colors">{file.name}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{file.size}</p>
                                      </div>
                                      <Download size={14} className="text-slate-400 group-hover:text-primary transition-colors shrink-0" />
                                    </a>
                                  ) : (
                                    <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed">
                                      <AttachmentIcon type={file.type} />
                                      <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-slate-700 truncate">{file.name}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{file.size} · 文件暂不可下载</p>
                                      </div>
                                      <Download size={14} className="text-slate-300 shrink-0" />
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </section>
                    );
                  })()}

                  {/* Pending Bids */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-primary font-display flex items-center gap-2">
                        <User size={18} /> 抢单申请
                        {pendingBids.length > 0 && (
                          <span className="bg-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {pendingBids.length}
                          </span>
                        )}
                      </h2>
                    </div>

                    {bidsLoading ? (
                      <div className="flex items-center justify-center h-32 bg-white rounded-2xl border border-slate-100">
                        <div className="w-6 h-6 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                      </div>
                    ) : pendingBids.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400">
                        <User size={40} className="mx-auto mb-3 text-slate-200" />
                        <p className="font-medium">暂无待审核的抢单申请</p>
                        <p className="text-xs mt-1">
                          {demand.status === "published"
                            ? "需求已发布，等待 OPC 提交申请"
                            : "需求尚未发布或招募已结束"}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {pendingBids.map((bid: any) => (
                          <div
                            key={bid.id}
                            className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6"
                          >
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-bold text-primary">
                                  {bid.opcAvatar ? (
                                    <img src={bid.opcAvatar} alt={bid.opcNickname} className="w-full h-full rounded-full object-cover" />
                                  ) : (
                                    (bid.opcNickname?.[0] ?? "O")
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground">{bid.opcNickname ?? `OPC #${bid.opcId}`}</span>
                                    {bid.opcLevel && (
                                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${OPC_LEVEL_COLOR[bid.opcLevel] ?? "bg-slate-100 text-slate-600"}`}>
                                        {bid.opcLevel}级
                                      </span>
                                    )}
                                  </div>
                                  {bid.opcCreditScore !== undefined && (
                                    <div className="mt-1">
                                      <StarRating score={bid.opcCreditScore} />
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                {bid.estimatedDays && (
                                  <div className="flex items-center gap-1 text-slate-500 text-sm">
                                    <Timer size={14} />
                                    <span>预计 {bid.estimatedDays} 天完成</span>
                                  </div>
                                )}
                                <p className="text-xs text-slate-400 mt-1">
                                  申请时间：{new Date(bid.createdAt).toLocaleDateString("zh-CN")}
                                </p>
                              </div>
                            </div>

                            {/* Proposal */}
                            <div className="bg-slate-50 rounded-xl p-4 mb-4">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">接单方案描述</p>
                              <p className="text-sm text-slate-700 leading-relaxed">{bid.proposal}</p>
                            </div>

                            {/* Portfolio Links */}
                            {bid.portfolioLinks && bid.portfolioLinks.length > 0 && (
                              <div className="mb-4">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">作品集链接</p>
                                <div className="flex flex-wrap gap-2">
                                  {bid.portfolioLinks.map((link: string, idx: number) => (
                                    <a
                                      key={idx}
                                      href={link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded-full"
                                    >
                                      <ExternalLink size={10} /> 查看作品 {idx + 1}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            {confirmingBidId === bid.id ? (
                              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <p className="text-sm font-bold text-blue-800 mb-3">
                                  确认选择 <span className="text-primary">{bid.opcNickname}</span> 接单？
                                </p>
                                <p className="text-xs text-blue-600 mb-4">
                                  确认后将自动生成交易订单，其余申请将自动婉拒。
                                </p>
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => handleConfirm(bid.id)}
                                    disabled={updateBidStatus.isPending}
                                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                                  >
                                    <CheckCircle2 size={14} />
                                    {updateBidStatus.isPending ? "处理中…" : "确认接单"}
                                  </button>
                                  <button
                                    onClick={() => setConfirmingBidId(null)}
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : rejectingBidId === bid.id ? (
                              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <p className="text-sm font-bold text-red-700 mb-3">
                                  婉拒 <span className="font-bold">{bid.opcNickname}</span> 的申请
                                </p>
                                <textarea
                                  value={rejectReason}
                                  onChange={(e) => setRejectReason(e.target.value)}
                                  placeholder="请填写婉拒原因（选填）"
                                  rows={2}
                                  className="w-full text-sm rounded-lg border border-red-200 bg-white px-3 py-2 mb-3 focus:ring-2 focus:ring-red-200 outline-none resize-none"
                                />
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => handleReject(bid.id)}
                                    disabled={updateBidStatus.isPending}
                                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                                  >
                                    <XCircle size={14} />
                                    {updateBidStatus.isPending ? "处理中…" : "确认婉拒"}
                                  </button>
                                  <button
                                    onClick={() => { setRejectingBidId(null); setRejectReason(""); }}
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-3">
                                <button
                                  onClick={() => setConfirmingBidId(bid.id)}
                                  className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
                                >
                                  <CheckCircle2 size={14} /> 确认接单
                                </button>
                                <button
                                  onClick={() => setRejectingBidId(bid.id)}
                                  className="flex items-center gap-2 border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                                >
                                  <XCircle size={14} /> 婉拒
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Already processed bids */}
                  {processedBids.length > 0 && (
                    <section>
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">已处理申请</h3>
                      <div className="space-y-3">
                        {processedBids.map((bid: any) => (
                          <div
                            key={bid.id}
                            className="bg-white rounded-xl border border-slate-100 px-5 py-4 flex items-center gap-4"
                          >
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm">
                              {bid.opcNickname?.[0] ?? "O"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground text-sm">{bid.opcNickname ?? `OPC #${bid.opcId}`}</span>
                                {bid.opcLevel && (
                                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${OPC_LEVEL_COLOR[bid.opcLevel] ?? "bg-slate-100 text-slate-600"}`}>
                                    {bid.opcLevel}级
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{bid.proposal}</p>
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              bid.status === "accepted"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-600"
                            }`}>
                              {bid.status === "accepted" ? "已确认" : "已婉拒"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Milestone Roadmap */}
                  {demand.milestones && demand.milestones.length > 0 && (
                    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
                      <h3 className="text-base font-bold text-primary mb-6 flex items-center gap-2 font-display">
                        <Zap size={16} /> 里程碑计划
                      </h3>
                      <div className="space-y-4">
                        {demand.milestones.map((m: any, i: number) => (
                          <div key={i} className="flex items-start gap-4">
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                                {i + 1}
                              </div>
                              {i < (demand.milestones?.length ?? 0) - 1 && (
                                <div className="w-px h-8 bg-slate-200 mt-2" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pb-4">
                              <p className="font-bold text-foreground text-sm">{m.name}</p>
                              <p className="text-xs text-slate-500 mt-0.5">截止：{new Date(m.deadline).toLocaleDateString("zh-CN")}</p>
                              {m.deliverableDesc && (
                                <p className="text-xs text-slate-400 mt-1">{m.deliverableDesc}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                {/* Right Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Demand Meta */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-5">需求详情</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">需求编号</span>
                        <span className="font-mono text-xs font-bold text-slate-700">{demand.demandNo}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">派单模式</span>
                        <span className="font-semibold">{demand.mode === "open" ? "公开抢单" : "定向派单"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">OPC等级要求</span>
                        <span className="font-semibold">{demand.opcLevel === "any" ? "不限" : `${demand.opcLevel}级及以上`}</span>
                      </div>
                      {demand.bidDeadline && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">抢单截止</span>
                          <span className="font-semibold">{new Date(demand.bidDeadline).toLocaleDateString("zh-CN")}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">已收申请</span>
                        <span className="font-bold text-primary">{(bids as any[]).length} 份</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">待审核</span>
                        <span className={`font-bold ${pendingBids.length > 0 ? "text-amber-600" : "text-slate-400"}`}>
                          {pendingBids.length} 份
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Info */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">当前状态</h3>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${statusCfg.color}`}>
                      {demand.status === "published" && <Clock size={14} />}
                      {demand.status === "matched" && <CheckCircle2 size={14} />}
                      {demand.status === "in_progress" && <Trophy size={14} />}
                      {statusCfg.label}
                    </div>

                    {demand.status === "matched" && (
                      <div className="mt-4">
                        <Link href={`/publisher/orders`}>
                          <button className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-4 py-3 text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">
                            查看关联订单 <ChevronRight size={16} />
                          </button>
                        </Link>
                      </div>
                    )}
                    {demand.status === "in_progress" && (
                      <div className="mt-4">
                        <Link href={`/publisher/orders`}>
                          <button className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-4 py-3 text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">
                            进入订单管理 <ChevronRight size={16} />
                          </button>
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Publisher Info */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">关于发单方</h3>
                    <div className="flex items-center gap-3">
                      {(demand as any).publisherAvatar ? (
                        <img
                          src={(demand as any).publisherAvatar}
                          alt={(demand as any).publisherName || "发单方"}
                          className="w-12 h-12 rounded-xl object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-extrabold text-lg shrink-0">
                          {((demand as any).publisherName ?? "发")?.[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-foreground">{(demand as any).publisherName || "发单方"}</p>
                        {(demand as any).publisherTitle && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <BadgeCheck size={12} className="text-secondary" />
                            <span className="text-xs text-secondary font-medium">{(demand as any).publisherTitle}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">发布日期：{new Date(demand.createdAt).toLocaleDateString("zh-CN")}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
