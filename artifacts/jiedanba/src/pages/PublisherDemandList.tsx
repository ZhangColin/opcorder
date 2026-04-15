import { useState, useEffect } from "react";
import { clearSession, getAccessToken } from "@/lib/auth";
import { useLocation, Link } from "wouter";
import {
  Search, Bell, PlusCircle, Filter,
  Eye, Edit2, X, Zap, ChevronRight, Clock, CheckCircle2,
  FileText, MoreHorizontal, AlertCircle, RefreshCw,
  Menu, Undo2,
} from "lucide-react";
import { useListDemands, useUpdateDemandStatus } from "@workspace/api-client-react";
import { PublisherSidebar } from "@/components/publisher/PublisherSidebar";
import { PublisherHeaderUser } from '@/components/publisher/PublisherHeaderUser';
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/* ─── Constants ───────────────────────────────── */

const STATUS_TABS = [
  { key: "all",                label: "全部需求",  cls: "" },
  { key: "draft",              label: "草稿",      cls: "text-slate-500" },
  { key: "pending_review",     label: "待审核",    cls: "text-amber-600" },
  { key: "pending_payment",    label: "待缴保证金", cls: "text-orange-600" },
  { key: "published",          label: "招募中",    cls: "text-blue-600" },
  { key: "in_progress",        label: "进行中",    cls: "text-indigo-600" },
  { key: "pending_acceptance", label: "待验收",    cls: "text-purple-600" },
  { key: "completed",          label: "已完成",    cls: "text-green-600" },
  { key: "closed",             label: "已关闭",    cls: "text-slate-400" },
  { key: "refund_pending",     label: "退款审核中", cls: "text-rose-600" },
  { key: "refunding",          label: "退款中",    cls: "text-rose-700" },
  { key: "refunded",           label: "已退款",    cls: "text-emerald-600" },
];

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  draft:              { label: "草稿",   cls: "bg-slate-100 text-slate-500" },
  pending_review:     { label: "待审核", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  pending_payment:    { label: "待缴保证金", cls: "bg-orange-50 text-orange-700 border border-orange-200" },
  published:          { label: "招募中", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  open:               { label: "招募中", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  matched:            { label: "已匹配", cls: "bg-cyan-50 text-cyan-700 border border-cyan-200" },
  in_progress:        { label: "进行中", cls: "bg-indigo-50 text-indigo-700 border border-indigo-200" },
  pending_acceptance: { label: "待验收", cls: "bg-purple-50 text-purple-700 border border-purple-200" },
  completed:          { label: "已完成", cls: "bg-green-50 text-green-700 border border-green-200" },
  closed:             { label: "已关闭", cls: "bg-slate-100 text-slate-400" },
  refund_pending:     { label: "退款审核中", cls: "bg-rose-50 text-rose-700 border border-rose-200" },
  refunding:          { label: "退款中",    cls: "bg-rose-100 text-rose-800 border border-rose-200" },
  refunded:           { label: "已退款",   cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
};

const DEMAND_TYPE_LABELS: Record<string, string> = {
  ai_education:    "AI教育",
  gov_training:    "政企培训",
  ai_research:     "AI研学",
  party_building:  "党建AI",
  livestream_media:"直播媒体",
  ai_tool_dev:     "AI工具",
  other:           "其他",
};

/* ─── DemandCard ──────────────────────────────── */

function DemandCard({
  demand,
  onPublish,
  onWithdraw,
  onClose,
}: {
  demand: any;
  onPublish: (id: number) => void;
  onWithdraw: (id: number) => void;
  onClose: (id: number) => void;
}) {
  const [, navigate] = useLocation();
  const statusInfo = STATUS_BADGES[demand.status] ?? { label: demand.status, cls: "bg-slate-100 text-slate-500" };
  const typeLabel = DEMAND_TYPE_LABELS[demand.type] ?? demand.type;
  const budgetText = demand.budget ? `¥${Number(demand.budget).toLocaleString()}` : "面议";

  const isDraft = demand.status === "draft";
  const isPendingReview = demand.status === "pending_review";
  const canEdit = isDraft;
  const canPublish = isDraft;
  const canWithdraw = isPendingReview;
  const canClose = isDraft;

  const deadlineDate = demand.deadline ? new Date(demand.deadline) : null;
  const daysLeft = deadlineDate
    ? Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-transparent hover:border-primary/10 transition-all p-6">
      <div className="flex items-start gap-4">
        {/* Left */}
        <div className="flex-1 min-w-0">
          {/* Top row */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
              {demand.demandNo ?? `JDB-#${String(demand.id).padStart(4, "0")}`}
            </span>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
              {typeLabel}
            </span>
            {demand.isUrgent && (
              <span className="text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded flex items-center gap-0.5">
                <Zap size={10} /> 紧急
              </span>
            )}
            {demand.status === "draft" && (demand as any).rejectionReason ? (
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 flex items-center gap-1">
                <X size={9} /> 审核不通过
              </span>
            ) : (
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${statusInfo.cls}`}>
                {statusInfo.label}
              </span>
            )}
          </div>

          {/* Title */}
          <h3
            className="text-base font-extrabold text-blue-900 font-display hover:text-primary cursor-pointer transition-colors mb-2 line-clamp-2"
            onClick={() => navigate(`/publisher/demand/${demand.id}`)}
          >
            {demand.title}
          </h3>

          {/* Description preview */}
          <p className="text-sm text-slate-500 line-clamp-2 mb-3">
            {demand.description}
          </p>

          {/* Rejection reason hint */}
          {demand.status === "draft" && (demand as any).rejectionReason && (
            <div className="flex items-start gap-1.5 mb-3 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              <AlertCircle size={12} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 line-clamp-2">{(demand as any).rejectionReason}</p>
            </div>
          )}

          {/* Skill tags */}
          {(demand.skillTags as string[])?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(demand.skillTags as string[]).slice(0, 5).map((tag: string) => (
                <span key={tag} className="text-[10px] bg-primary/5 text-primary px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
              {(demand.skillTags as string[]).length > 5 && (
                <span className="text-[10px] text-slate-400">+{(demand.skillTags as string[]).length - 5}</span>
              )}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
            <span className="font-bold text-blue-900">{budgetText}</span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {deadlineDate
                ? daysLeft! > 0
                  ? `${daysLeft}天后截止`
                  : daysLeft === 0
                  ? "今日截止"
                  : "已超期"
                : "未设定截止日"}
            </span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1">
              {demand.mode === "directed" ? "定向派单" : "公开抢单"}
            </span>
            <span className="text-slate-300">|</span>
            <span>
              发布于 {new Date(demand.createdAt).toLocaleDateString("zh-CN")}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col gap-2 shrink-0 ml-4">
          <Link href={`/publisher/demand/${demand.id}`}>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 transition-colors whitespace-nowrap">
              <Eye size={13} /> 查看详情
            </button>
          </Link>
          {canEdit && (
            <Link href={`/publisher/demands/${demand.id}/edit`}>
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors whitespace-nowrap">
                <Edit2 size={13} /> 编辑
              </button>
            </Link>
          )}
          {canPublish && (
            <button
              onClick={() => onPublish(demand.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors whitespace-nowrap"
            >
              <CheckCircle2 size={13} /> 提交审核
            </button>
          )}
          {canWithdraw && (
            <button
              onClick={() => onWithdraw(demand.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors whitespace-nowrap border border-amber-200"
            >
              <Undo2 size={13} /> 撤回审核
            </button>
          )}
          {canClose && (
            <button
              onClick={() => onClose(demand.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-slate-400 bg-slate-50 hover:bg-red-50 hover:text-destructive transition-colors whitespace-nowrap"
            >
              <X size={13} /> 关闭需求
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main page ───────────────────────────────── */

export default function PublisherDemandList() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const { userId } = useCurrentUser();
  const updateStatus = useUpdateDemandStatus();

  const { data, isLoading, refetch } = useListDemands({
    status: activeTab === "all" ? undefined : activeTab as any,
    search: search || undefined,
    type: typeFilter || undefined,
    publisherId: userId || undefined,
    page,
    limit: 10,
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handlePublish = async (id: number) => {
    try {
      await updateStatus.mutateAsync({ demandId: id, data: { status: "pending_review" } });
      toast({ title: "已提交审核", description: "平台将在24小时内完成审核" });
      refetch();
    } catch {
      toast({ title: "操作失败", description: "请稍后重试", variant: "destructive" });
    }
  };

  const [pendingWithdrawId, setPendingWithdrawId] = useState<number | null>(null);
  const [pendingCloseId, setPendingCloseId] = useState<number | null>(null);

  const handleWithdraw = (id: number) => setPendingWithdrawId(id);
  const handleClose = (id: number) => setPendingCloseId(id);

  const doWithdraw = async () => {
    if (pendingWithdrawId == null) return;
    const id = pendingWithdrawId;
    setPendingWithdrawId(null);
    try {
      await updateStatus.mutateAsync({ demandId: id, data: { status: "draft" } });
      toast({ title: "已撤回", description: "需求已变回草稿，可重新编辑后提交审核" });
      refetch();
    } catch {
      toast({ title: "操作失败", description: "请稍后重试", variant: "destructive" });
    }
  };

  const doClose = async () => {
    if (pendingCloseId == null) return;
    const id = pendingCloseId;
    setPendingCloseId(null);
    try {
      await updateStatus.mutateAsync({ demandId: id, data: { status: "closed" } });
      toast({ title: "需求已关闭" });
      refetch();
    } catch {
      toast({ title: "操作失败", description: "请稍后重试", variant: "destructive" });
    }
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  const demands = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  // On list load, sync refund status for any "refunding" demands
  useEffect(() => {
    const refundingIds = demands.filter((d: any) => d.status === "refunding").map((d: any) => d.id);
    if (refundingIds.length === 0) return;
    let anyUpdated = false;
    Promise.all(
      refundingIds.map((id: number) =>
        fetch(`${BASE}/api/demands/${id}/sync-refund-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
        })
          .then(r => r.json())
          .then((r: any) => { if (r.synced) anyUpdated = true; })
          .catch(() => {})
      )
    ).then(() => { if (anyUpdated) refetch(); });
  }, [demands.map((d: any) => `${d.id}:${d.status}`).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

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

          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-400 font-medium">发单方门户</span>
            <ChevronRight size={14} className="text-slate-300" />
            <span className="text-blue-900 font-bold">需求管理</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="搜索需求标题…"
                className="w-full bg-slate-100 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
              />
            </div>
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors" onClick={() => navigate("/publisher/notifications")}>
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
            </button>
            <PublisherHeaderUser onLogout={logout} />
          </div>
        </header>

        {/* Body */}
        <div className="pt-24 px-8 pb-16">

          {/* Page header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-extrabold text-blue-900 font-display">需求管理</h1>
              <p className="text-sm text-slate-500 mt-1">管理所有发布的需求，跟踪进展</p>
            </div>
            <Link href="/publisher/demands/new">
              <button className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl px-5 py-3 font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all">
                <PlusCircle size={16} /> 发布新需求
              </button>
            </Link>
          </div>

          {/* Status tabs */}
          <div className="bg-white rounded-2xl shadow-sm mb-6">
            <div className="flex border-b border-slate-100 overflow-x-auto">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`px-5 py-4 text-sm font-bold whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-500 hover:text-primary"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Filter row */}
            <div className="px-5 py-3 flex items-center gap-3">
              <Filter size={14} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">需求类型：</span>
              <div className="flex gap-2 flex-wrap">
                {[{ value: "", label: "全部" }, ...Object.entries(DEMAND_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setTypeFilter(opt.value); setPage(1); }}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${
                      typeFilter === opt.value
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-500 hover:text-primary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
                <span>共 {total} 条需求</span>
                <button
                  onClick={() => refetch()}
                  className="p-1.5 hover:text-primary transition-colors rounded-lg hover:bg-slate-50"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Demand list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            </div>
          ) : demands.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl shadow-sm">
              <FileText size={48} className="text-slate-200 mb-4" />
              <p className="text-slate-400 font-bold mb-2">
                {search ? "未找到匹配的需求" : "暂无需求"}
              </p>
              <p className="text-slate-400 text-sm mb-6">
                {search ? "请尝试修改搜索关键词" : "点击右上角发布您的第一个需求"}
              </p>
              {!search && (
                <Link href="/publisher/demands/new">
                  <button className="flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-primary/90 transition-colors">
                    <PlusCircle size={16} /> 立即发布需求
                  </button>
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {demands.map(demand => (
                <DemandCard
                  key={demand.id}
                  demand={demand}
                  onPublish={handlePublish}
                  onWithdraw={handleWithdraw}
                  onClose={handleClose}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-8">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 text-slate-500 hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                上一页
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = i + Math.max(1, page - 2);
                  if (p > totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 rounded-xl text-sm font-bold transition-colors ${
                        page === p ? "bg-primary text-white" : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 text-slate-500 hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                下一页
              </button>
            </div>
          )}

          {/* Status guide */}
          <div className="mt-10 bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-sm font-extrabold text-blue-900 mb-4 flex items-center gap-2">
              <AlertCircle size={16} className="text-primary" />
              需求状态说明
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "草稿", desc: "已保存或审核不通过退回，可编辑后重新提交", cls: "bg-slate-100 text-slate-500" },
                { label: "待审核", desc: "已提交，等待平台审核（24h）", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
                { label: "招募中", desc: "审核通过，OPC可以抢单", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
                { label: "进行中", desc: "已匹配OPC，正在执行", cls: "bg-indigo-50 text-indigo-700 border border-indigo-200" },
                { label: "待验收", desc: "OPC已提交，等待验收", cls: "bg-purple-50 text-purple-700 border border-purple-200" },
                { label: "已完成", desc: "验收通过，结算完成", cls: "bg-green-50 text-green-700 border border-green-200" },
                { label: "已关闭", desc: "需求已主动关闭", cls: "bg-slate-100 text-slate-400" },
              ].map(s => (
                <div key={s.label} className="flex items-start gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 ${s.cls}`}>
                    {s.label}
                  </span>
                  <span className="text-xs text-slate-400">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <ConfirmDialog
        open={pendingWithdrawId !== null}
        title="确认撤回审核？"
        description="撤回后需求将变回草稿状态，可重新编辑后再次提交审核。"
        confirmLabel="确认撤回"
        cancelLabel="取消"
        onConfirm={doWithdraw}
        onCancel={() => setPendingWithdrawId(null)}
      />
      <ConfirmDialog
        open={pendingCloseId !== null}
        title="确认关闭需求？"
        description="关闭后该需求将无法恢复，OPC 无法再查看或报名。"
        confirmLabel="确认关闭"
        cancelLabel="取消"
        confirmVariant="destructive"
        onConfirm={doClose}
        onCancel={() => setPendingCloseId(null)}
      />
    </div>
  );
}
