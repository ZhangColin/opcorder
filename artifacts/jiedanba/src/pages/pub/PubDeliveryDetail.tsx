import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PackageCheck, Loader2, AlertCircle, Clock, CheckCircle2, XCircle,
  ExternalLink, ThumbsUp, ThumbsDown, FileText,
} from "lucide-react";
import { v2Get, v2Post } from "@/lib/v2api";
import { PubLayout } from "@/components/pub/PubLayout";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { toast } from "sonner";

interface DeliveryItem {
  id: number;
  clientDemandId: number;
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
  updatedAt: string;
  demandTitle: string | null;
  demandNo: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "待我确认", color: "bg-amber-100 text-amber-700",  icon: Clock },
  confirmed: { label: "已确认",   color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  revision:  { label: "已驳回（修改中）", color: "bg-orange-100 text-orange-700", icon: XCircle },
  rejected:  { label: "已驳回",   color: "bg-red-100 text-red-700",      icon: XCircle },
};

function RejectModal({ onConfirm, onCancel, loading }: {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading?: boolean;
}) {
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
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 border border-slate-200 rounded-xl py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={loading}
            className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            确认驳回
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <Icon size={15} className="text-primary" />
        <h3 className="text-sm font-extrabold text-slate-700">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export default function PubDeliveryDetail() {
  const { id } = useParams<{ id: string }>();
  const delivId = parseInt(id ?? "0");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const qc = useQueryClient();

  const { data: item, isLoading, isError, refetch } = useQuery<DeliveryItem>({
    queryKey: ["pub-delivery-a", delivId],
    queryFn: () => v2Get(`/deliverables-a/${delivId}`),
    enabled: !!delivId,
  });

  const confirmMut = useMutation({
    mutationFn: () => v2Post(`/deliverables-a/${delivId}/publisher-confirm`),
    onSuccess: () => {
      toast.success("已确认交付");
      qc.invalidateQueries({ queryKey: ["pub-delivery-a", delivId] });
      qc.invalidateQueries({ queryKey: ["pub-deliveries-a"] });
      qc.invalidateQueries({ queryKey: ["delivery-badge-counts"] });
    },
    onError: () => toast.error("操作失败，请重试"),
  });

  const rejectMut = useMutation({
    mutationFn: (reason: string) => v2Post(`/deliverables-a/${delivId}/publisher-reject`, { reason }),
    onSuccess: () => {
      toast.success("已驳回，运营方将重新提交");
      setShowRejectModal(false);
      qc.invalidateQueries({ queryKey: ["pub-delivery-a", delivId] });
      qc.invalidateQueries({ queryKey: ["pub-deliveries-a"] });
      qc.invalidateQueries({ queryKey: ["delivery-badge-counts"] });
    },
    onError: () => toast.error("操作失败，请重试"),
  });

  if (isLoading) {
    return (
      <PubLayout backHref="/pub/deliveries" backLabel="交付确认">
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" /> 加载中…
        </div>
      </PubLayout>
    );
  }

  if (isError || !item) {
    return (
      <PubLayout backHref="/pub/deliveries" backLabel="交付确认">
        <div className="flex flex-col items-center py-20 text-slate-400">
          <AlertCircle size={32} className="mb-3 text-red-400" />
          <p className="text-sm">加载失败</p>
          <button onClick={() => refetch()} className="mt-3 text-xs text-primary underline">重试</button>
        </div>
      </PubLayout>
    );
  }

  const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: "bg-slate-100 text-slate-500", icon: Clock };
  const StatusIcon = cfg.icon;
  const isPending = item.status === "pending";

  return (
    <PubLayout backHref="/pub/deliveries" backLabel="交付确认">
      <div className="py-6 space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
                <StatusIcon size={12} /> {cfg.label}
              </span>
              {item.demandTitle && (
                <span className="text-xs text-slate-400 truncate max-w-[200px]">📋 {item.demandTitle}</span>
              )}
            </div>
            <h2 className="text-xl font-extrabold text-blue-900 leading-snug">{item.title}</h2>
            <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-2">
              <span className="flex items-center gap-1">
                <Clock size={11} />
                {new Date(item.createdAt).toLocaleDateString("zh-CN")} 提交
              </span>
              {item.createdByNickname && <span>提交人：{item.createdByNickname}</span>}
              {item.demandNo && <span className="font-mono">{item.demandNo}</span>}
            </div>
          </div>
        </div>

        {/* Delivery Content */}
        <Section title="交付内容" icon={PackageCheck}>
          <div className="space-y-4">
            {item.content && (
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.content}</p>
            )}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl text-sm font-bold transition-colors"
              >
                <ExternalLink size={14} /> 查看交付链接
              </a>
            )}
            {item.attachments && item.attachments.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">附件</p>
                {item.attachments.map((att: any, i: number) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors text-sm text-primary font-medium"
                  >
                    <FileText size={14} className="text-slate-400 shrink-0" />
                    {att.name || att.url}
                  </a>
                ))}
              </div>
            )}
            {!item.content && !item.url && (!item.attachments || item.attachments.length === 0) && (
              <p className="text-sm text-slate-400 italic">（运营方未填写交付说明）</p>
            )}
          </div>

          {/* Rejection info */}
          {(item.status === "revision" || item.status === "rejected") && item.rejectedReason && (
            <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100">
              <p className="text-xs font-bold text-red-600 mb-1">驳回原因</p>
              <p className="text-sm text-red-700">{item.rejectedReason}</p>
            </div>
          )}
        </Section>

        {/* Action Buttons – only for pending */}
        {isPending && (
          <div className="flex gap-3">
            <button
              disabled={confirmMut.isPending}
              onClick={() => confirmMut.mutate()}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-2xl py-3.5 text-sm font-extrabold hover:bg-green-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {confirmMut.isPending
                ? <Loader2 size={16} className="animate-spin" />
                : <ThumbsUp size={16} />}
              确认交付
            </button>
            <button
              disabled={rejectMut.isPending}
              onClick={() => setShowRejectModal(true)}
              className="flex-1 flex items-center justify-center gap-2 border-2 border-red-200 text-red-600 rounded-2xl py-3.5 text-sm font-extrabold hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <ThumbsDown size={16} /> 驳回，要求修改
            </button>
          </div>
        )}

        {/* Discussion Thread */}
        <Section title="沟通留言" icon={FileText}>
          <DiscussionThread
            parentType="deliverable_a"
            parentId={delivId}
            placeholder="对此交付物留言或提问…"
          />
        </Section>
      </div>

      {showRejectModal && (
        <RejectModal
          loading={rejectMut.isPending}
          onConfirm={reason => rejectMut.mutate(reason)}
          onCancel={() => setShowRejectModal(false)}
        />
      )}
    </PubLayout>
  );
}
