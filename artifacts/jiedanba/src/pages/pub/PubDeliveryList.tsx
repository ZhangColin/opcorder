import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PackageCheck, Loader2, AlertCircle, ChevronRight, Clock,
  CheckCircle2, XCircle, RotateCcw, ThumbsUp, ThumbsDown,
} from "lucide-react";
import { v2Get, v2Post } from "@/lib/v2api";
import { PubLayout } from "@/components/pub/PubLayout";
import { toast } from "sonner";

interface DeliveryItem {
  id: number;
  clientDemandId: number;
  title: string;
  url: string | null;
  content: string | null;
  attachments: any[];
  status: string;
  createdByNickname: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
  demandTitle: string | null;
  demandNo: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "待我确认", color: "bg-amber-100 text-amber-700",  icon: <Clock size={12} /> },
  confirmed: { label: "已确认",   color: "bg-green-100 text-green-700",  icon: <CheckCircle2 size={12} /> },
  revision:  { label: "已驳回",   color: "bg-red-100 text-red-700",      icon: <XCircle size={12} /> },
  rejected:  { label: "已驳回",   color: "bg-red-100 text-red-700",      icon: <XCircle size={12} /> },
};

const FILTER_TABS = [
  { key: "all",      label: "全部" },
  { key: "pending",  label: "待确认" },
  { key: "confirmed", label: "已确认" },
  { key: "revision", label: "已驳回" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function RejectModal({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 className="font-extrabold text-slate-800">填写驳回原因</h3>
        <textarea
          className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:ring-2 focus:ring-primary/30 outline-none"
          rows={3}
          placeholder="请填写驳回原因（可选）"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50">取消</button>
          <button onClick={() => onConfirm(reason)} className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-red-700">确认驳回</button>
        </div>
      </div>
    </div>
  );
}

export default function PubDeliveryList() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data = [], isLoading, isError, refetch } = useQuery<DeliveryItem[]>({
    queryKey: ["pub-deliveries-a"],
    queryFn: () => v2Get("/deliverables-a"),
  });

  const confirmMut = useMutation({
    mutationFn: (id: number) => v2Post(`/deliverables-a/${id}/publisher-confirm`),
    onSuccess: () => { toast.success("已确认交付"); qc.invalidateQueries({ queryKey: ["pub-deliveries-a"] }); qc.invalidateQueries({ queryKey: ["delivery-badge-counts"] }); },
    onError: () => toast.error("操作失败，请重试"),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      v2Post(`/deliverables-a/${id}/publisher-reject`, { reason }),
    onSuccess: () => { toast.success("已驳回交付物"); qc.invalidateQueries({ queryKey: ["pub-deliveries-a"] }); qc.invalidateQueries({ queryKey: ["delivery-badge-counts"] }); },
    onError: () => toast.error("操作失败，请重试"),
  });

  const filtered = filter === "all" ? data : data.filter(d => d.status === filter);
  const counts = FILTER_TABS.reduce((acc, tab) => {
    acc[tab.key] = tab.key === "all" ? data.length : data.filter(d => d.status === tab.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <PubLayout>
      <div className="py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-black text-blue-900 mb-1">交付确认</h2>
          <p className="text-sm text-slate-500">运营方提交的交付物，请查阅并确认</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                filter === tab.key
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-primary/40"
              }`}
            >
              {tab.label}
              {counts[tab.key] > 0 && (
                <span className={`ml-1.5 text-[11px] font-bold ${filter === tab.key ? "opacity-75" : tab.key === "pending" ? "text-amber-500" : "text-slate-400"}`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
          <button onClick={() => refetch()} className="ml-auto text-xs text-slate-400 hover:text-primary px-3 py-2 hover:bg-slate-50 rounded-xl transition-colors">刷新</button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
          </div>
        ) : isError ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
            <p className="text-sm text-red-500 font-medium">加载失败</p>
            <button onClick={() => refetch()} className="mt-3 text-xs text-primary underline">重试</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <PackageCheck size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">
              {filter === "all" ? "暂无交付记录" : "暂无此状态的交付记录"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => {
              const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: "bg-slate-100 text-slate-500", icon: null };
              const isPending = item.status === "pending";
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.color}`}>
                          {cfg.icon}{cfg.label}
                        </span>
                        {item.demandTitle && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[180px]">📋 {item.demandTitle}</span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-800 mb-1">{item.title}</h3>
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline break-all mb-1 block">
                          🔗 {item.url}
                        </a>
                      )}
                      {item.content && <p className="text-xs text-slate-500 line-clamp-3 mb-1">{item.content}</p>}
                      {item.status === "revision" && item.rejectedReason && (
                        <p className="text-xs text-red-500 mb-1">驳回原因：{item.rejectedReason}</p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-2">
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {new Date(item.createdAt).toLocaleDateString("zh-CN")} 提交
                        </span>
                        {item.demandNo && <span className="font-mono">{item.demandNo}</span>}
                        {item.createdByNickname && <span>提交人：{item.createdByNickname}</span>}
                      </div>
                    </div>
                  </div>

                  {isPending && (
                    <div className="flex gap-3 pt-3 border-t border-slate-100">
                      <button
                        disabled={confirmMut.isPending}
                        onClick={() => confirmMut.mutate(item.id)}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        <ThumbsUp size={14} /> 确认交付
                      </button>
                      <button
                        disabled={rejectMut.isPending}
                        onClick={() => setRejectTarget(item.id)}
                        className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-600 rounded-xl py-2.5 text-sm font-bold hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        <ThumbsDown size={14} /> 驳回
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rejectTarget !== null && (
        <RejectModal
          onConfirm={reason => { rejectMut.mutate({ id: rejectTarget, reason }); setRejectTarget(null); }}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </PubLayout>
  );
}
