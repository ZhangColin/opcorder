import { useState } from "react";
import { useLocation } from "wouter";
import {
  ClipboardList, Clock, CheckCircle2, XCircle, Undo2,
  ChevronRight, AlertCircle, Loader2, Trophy, CalendarDays,
  DollarSign,
} from "lucide-react";
import { useGetMyBids, useWithdrawBid } from "@workspace/api-client-react";
import type { MyBidItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "申请中",  color: "bg-amber-100 text-amber-700",   icon: <Clock size={12} /> },
  accepted:  { label: "已中标",  color: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 size={12} /> },
  rejected:  { label: "已婉拒",  color: "bg-red-100 text-red-600",       icon: <XCircle size={12} /> },
  withdrawn: { label: "已撤消",  color: "bg-slate-100 text-slate-500",   icon: <Undo2 size={12} /> },
};

const DEMAND_STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  pending_review: "审核中",
  pending_payment: "待缴费",
  published: "已发布",
  matched: "已匹配",
  in_progress: "进行中",
  pending_acceptance: "待验收",
  completed: "已完成",
  closed: "已关闭",
};

function BidCard({
  bid,
  onWithdraw,
}: {
  bid: MyBidItem;
  onWithdraw: (bid: MyBidItem) => void;
}) {
  const [, navigate] = useLocation();
  const cfg = STATUS_CONFIG[bid.status] ?? { label: bid.status, color: "bg-slate-100 text-slate-500", icon: null };
  const canView = bid.status === "pending" || bid.status === "accepted";
  const canWithdraw = bid.status === "pending";

  function handleRowClick() {
    if (!canView) return;
    navigate(`/demands/${bid.demandId}`);
  }

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden ${canView ? "cursor-pointer hover:shadow-md hover:border-primary/20 transition-all" : ""}`}
      onClick={handleRowClick}
    >
      <div className="px-5 py-4 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.color}`}>
              {cfg.icon}
              {cfg.label}
            </span>
            {bid.demandStatus && (
              <span className="text-[10px] text-slate-400 font-medium">
                需求状态：{DEMAND_STATUS_LABEL[bid.demandStatus] ?? bid.demandStatus}
              </span>
            )}
          </div>

          <h3 className={`font-bold text-base leading-snug mb-1.5 ${canView ? "text-slate-800 group-hover:text-primary" : "text-slate-500"}`}>
            {bid.demandTitle || `需求 #${bid.demandId}`}
          </h3>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <DollarSign size={11} />
              预算 ¥{bid.demandBudget?.toLocaleString() ?? "—"}
            </span>
            {bid.demandDeadline && (
              <span className="flex items-center gap-1">
                <CalendarDays size={11} />
                截止 {new Date(bid.demandDeadline).toLocaleDateString("zh-CN")}
              </span>
            )}
            {bid.estimatedDays && (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                预计 {bid.estimatedDays} 天完成
              </span>
            )}
            <span className="text-slate-400">
              申请于 {new Date(bid.createdAt).toLocaleDateString("zh-CN")}
            </span>
          </div>

          {bid.proposal && (
            <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
              {bid.proposal}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {canView && (
            <ChevronRight size={16} className="text-slate-300 mt-1" />
          )}
          {!canView && bid.status === "rejected" && (
            <AlertCircle size={16} className="text-red-300 mt-1" />
          )}
        </div>
      </div>

      {(canWithdraw || bid.status === "accepted") && (
        <div className="border-t border-slate-50 px-5 py-3 flex items-center justify-between bg-slate-50/50">
          {bid.status === "accepted" && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
              <Trophy size={12} />
              恭喜中标！请在"我的订单"中查看并开始工作。
            </div>
          )}
          {canWithdraw && (
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); onWithdraw(bid); }}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors border border-slate-200 hover:border-red-200"
              >
                <Undo2 size={12} />
                撤消申请
              </button>
              <span className="text-xs text-slate-400">（撤消后记录仍保留）</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const FILTER_TABS = [
  { key: "all",       label: "全部" },
  { key: "pending",   label: "申请中" },
  { key: "accepted",  label: "已中标" },
  { key: "rejected",  label: "已婉拒" },
  { key: "withdrawn", label: "已撤消" },
] as const;

export default function OpcMyBids() {
  const { data: bids = [], isLoading, refetch } = useGetMyBids();
  const withdrawBidMutation = useWithdrawBid();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [filterTab, setFilterTab] = useState<"all" | "pending" | "accepted" | "rejected" | "withdrawn">("all");
  const [withdrawTarget, setWithdrawTarget] = useState<MyBidItem | null>(null);

  const filtered = filterTab === "all" ? bids : bids.filter(b => b.status === filterTab);

  async function handleConfirmWithdraw() {
    if (!withdrawTarget) return;
    try {
      await withdrawBidMutation.mutateAsync({ bidId: withdrawTarget.id });
      qc.invalidateQueries({ queryKey: ["getMyBids"] });
      toast({ title: "申请已撤消", description: "申请记录已标记为已撤消" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "请稍后重试";
      toast({ title: "撤消失败", description: msg, variant: "destructive" });
    } finally {
      setWithdrawTarget(null);
    }
  }

  const pendingCount = bids.filter(b => b.status === "pending").length;
  const acceptedCount = bids.filter(b => b.status === "accepted").length;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList size={22} className="text-primary" />
            我的申请
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            共 {bids.length} 条申请记录
            {pendingCount > 0 && <span className="ml-2 text-amber-600 font-medium">· {pendingCount} 个审核中</span>}
            {acceptedCount > 0 && <span className="ml-2 text-emerald-600 font-medium">· {acceptedCount} 个已中标</span>}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs text-slate-400 hover:text-primary px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
        >
          刷新
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map(tab => {
          const count = tab.key === "all" ? bids.length : bids.filter(b => b.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setFilterTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                filterTab === tab.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-primary/40"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 text-[11px] font-bold ${filterTab === tab.key ? "opacity-75" : "text-slate-400"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-slate-400">
          <ClipboardList size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {filterTab === "all" ? "暂无申请记录，去订单大厅抢单吧！" : `暂无${FILTER_TABS.find(t => t.key === filterTab)?.label}记录`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(bid => (
            <BidCard
              key={bid.id}
              bid={bid}
              onWithdraw={setWithdrawTarget}
            />
          ))}
        </div>
      )}

      {/* Withdraw confirm dialog */}
      <ConfirmDialog
        open={!!withdrawTarget}
        title="确认撤消申请"
        description={`您将撤消对「${withdrawTarget?.demandTitle || `需求 #${withdrawTarget?.demandId}`}」的申请。撤消后记录仍保留，但无法恢复为"申请中"状态。`}
        confirmLabel="确认撤消"
        cancelLabel="再想想"
        confirmVariant="destructive"
        onConfirm={handleConfirmWithdraw}
        onCancel={() => setWithdrawTarget(null)}
      />
    </div>
  );
}
