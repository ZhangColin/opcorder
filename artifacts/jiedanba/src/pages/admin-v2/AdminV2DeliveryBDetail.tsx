import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, PackageCheck, Clock, CheckCircle2, XCircle, X } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post } from "@/lib/v2api";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { useToast } from "@/hooks/use-toast";
import { markRead } from "@/lib/demandRead";

interface DeliveryB {
  id: number;
  outsourceOrderId: number;
  title: string;
  content: string | null;
  attachments: Array<{ name: string; url: string }> | null;
  status: string;
  submittedByNickname: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  orderNo: string | null;
  outsourceDemandId: number | null;
  demandTitle: string | null;
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:  { label: "待审核", color: "bg-orange-100 text-orange-700", icon: Clock },
  approved: { label: "已通过", color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  revision: { label: "已驳回", color: "bg-red-100 text-red-700",      icon: XCircle },
};

function RejectModal({ onClose, onConfirm, acting }: { onClose: () => void; onConfirm: (reason: string) => void; acting: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-blue-900">驳回交付</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="请填写驳回原因"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none mb-4" />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
          <button onClick={() => onConfirm(reason)} disabled={acting || !reason.trim()}
            className="px-4 py-2 text-sm bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50">
            {acting ? "提交中…" : "确认驳回"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminV2DeliveryBDetail({ inlineId }: { inlineId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [delivery, setDelivery] = useState<DeliveryB | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<DeliveryB>(`/deliverables-b/${id}`);
      setDelivery(d);
    } catch {
      setDelivery(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id > 0) load(); }, [id]);
  useEffect(() => { if (id > 0 && delivery) markRead("delivery_b", id); }, [id, delivery]);

  const act = async (endpoint: string, body?: Record<string, string>, successMsg?: string) => {
    setActing(true);
    try {
      await v2Post(`/deliverables-b/${id}/${endpoint}`, body);
      toast({ title: successMsg ?? "操作成功" });
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  if (loading) return <AdminV2Layout><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!delivery) return <AdminV2Layout><div className="text-center py-16 text-slate-400">交付记录不存在</div></AdminV2Layout>;

  const cfg = STATUS_MAP[delivery.status] ?? { label: delivery.status, color: "bg-slate-100 text-slate-500", icon: Clock };
  const StatusIcon = cfg.icon;
  const isPending = delivery.status === "pending";

  return (
    <AdminV2Layout title={delivery.title}>
      <div className="mt-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <PackageCheck size={18} className="text-violet-500" />
            </div>
            <div className="flex-1 min-w-0">
              {delivery.demandTitle ? (
                <p className="text-xs text-slate-500 mb-0.5">
                  <button
                    onClick={() => navigate(`/admin/v2/outsource-demands/${delivery.outsourceDemandId}`)}
                    className="hover:underline text-primary"
                  >
                    {delivery.demandTitle}
                  </button>
                  {delivery.orderNo && ` · ${delivery.orderNo}`}
                </p>
              ) : delivery.orderNo ? (
                <p className="text-xs text-slate-500 mb-0.5">订单 {delivery.orderNo}</p>
              ) : null}
              <div className="flex items-center gap-2 mb-1">
                <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                  <StatusIcon size={11} /> {cfg.label}
                </span>
                {!delivery.demandTitle && (
                  <span className="text-xs text-slate-400 font-mono">#{delivery.id}</span>
                )}
              </div>
              <h2 className="text-lg font-extrabold text-blue-900 mb-1">{delivery.title}</h2>
              {delivery.content && <p className="text-sm text-slate-600 whitespace-pre-wrap">{delivery.content}</p>}
              {delivery.attachments && delivery.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {delivery.attachments.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5">
                      {a.name}
                    </a>
                  ))}
                </div>
              )}
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <Clock size={11} /> {new Date(delivery.createdAt).toLocaleString("zh-CN")}
                {delivery.submittedByNickname && <span>· 提交人：{delivery.submittedByNickname}</span>}
              </p>
              {delivery.rejectedReason && (
                <div className="mt-3 bg-red-50 rounded-xl p-3">
                  <p className="text-xs font-bold text-red-600 mb-0.5">驳回原因</p>
                  <p className="text-sm text-red-700">{delivery.rejectedReason}</p>
                </div>
              )}
            </div>
          </div>

          {isPending && (
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setShowReject(true)} disabled={acting}
                className="px-4 py-2 text-sm border border-red-200 text-red-500 rounded-xl font-bold hover:bg-red-50 disabled:opacity-50 transition-colors">
                驳回
              </button>
              <button onClick={() => act("approve", undefined, "已审核通过")} disabled={acting}
                className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 disabled:opacity-50 transition-colors">
                {acting ? "处理中…" : "审核通过"}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-700 mb-4">沟通记录</h3>
          <DiscussionThread parentType="deliverable_b" parentId={id} placeholder="回复 OPC…" />
        </div>
      </div>

      {showReject && (
        <RejectModal
          onClose={() => setShowReject(false)}
          acting={acting}
          onConfirm={async (reason) => {
            await act("reject", { reason }, "已驳回交付");
            setShowReject(false);
          }}
        />
      )}
    </AdminV2Layout>
  );
}
