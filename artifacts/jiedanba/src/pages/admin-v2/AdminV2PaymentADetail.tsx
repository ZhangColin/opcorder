import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Loader2, ExternalLink, X, CheckCircle2, Clock } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post } from "@/lib/v2api";
import { useToast } from "@/hooks/use-toast";

interface PaymentPlan {
  id: number;
  clientDemandId: number | null;
  title: string;
  amount: number;
  dueDate: string | null;
  status: string;
  voucherUrl: string | null;
  voucherUploadedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:        { label: "待付款",   color: "bg-slate-100 text-slate-500" },
  awaiting_review: { label: "待审核",   color: "bg-amber-100 text-amber-700" },
  paid:           { label: "已支付",   color: "bg-green-100 text-green-700" },
  overdue:        { label: "已逾期",   color: "bg-red-100 text-red-600" },
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-blue-900">{title}</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminV2PaymentADetail({ inlineId }: { inlineId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const { toast } = useToast();

  const [item, setItem] = useState<PaymentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNote, setRejectNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<PaymentPlan>(`/payment-plans/${id}`);
      setItem(d);
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id > 0) load(); }, [id]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setActing(true);
    try {
      await fn();
      toast({ title: msg });
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const handleApprove = () => act(
    () => v2Post(`/payment-plans/${id}/approve`, { approved: true }),
    "凭证已审核通过，标记已支付"
  );

  const handleReject = async () => {
    await act(
      () => v2Post(`/payment-plans/${id}/approve`, { approved: false, note: rejectNote.trim() }),
      "凭证已驳回，请发单方重新上传"
    );
    setShowRejectModal(false);
    setRejectNote("");
  };

  if (loading) return <AdminV2Layout backHref="/admin/v2/payments-a" backLabel="收款管理 (A)"><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!item) return <AdminV2Layout backHref="/admin/v2/payments-a" backLabel="收款管理 (A)"><div className="text-center py-16 text-slate-400">收款项不存在</div></AdminV2Layout>;

  const cfg = STATUS_CONFIG[item.status] ?? { label: item.status, color: "bg-slate-100 text-slate-500" };

  return (
    <AdminV2Layout title={item.title} backHref="/admin/v2/payments-a" backLabel="收款管理 (A)">
      <div className="mt-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
              </div>
              <h2 className="text-xl font-extrabold text-blue-900 mb-1">{item.title}</h2>
              <p className="text-2xl font-bold text-primary mb-2">¥{item.amount.toLocaleString()}</p>
              <div className="text-xs text-slate-400 flex gap-4 flex-wrap">
                {item.dueDate && <span className="flex items-center gap-1"><Clock size={11} />应收日期：{new Date(item.dueDate).toLocaleDateString("zh-CN")}</span>}
                {item.paidAt && <span>实际支付：{new Date(item.paidAt).toLocaleDateString("zh-CN")}</span>}
                {item.notes && <span>备注：{item.notes}</span>}
              </div>
            </div>
            {item.status === "awaiting_review" && (
              <div className="flex gap-2 flex-col">
                <button onClick={handleApprove} disabled={acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50">
                  <CheckCircle2 size={14} /> 审核通过（标记已支付）
                </button>
                <button onClick={() => setShowRejectModal(true)} disabled={acting}
                  className="px-4 py-2 border border-red-200 text-red-500 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                  驳回凭证
                </button>
              </div>
            )}
          </div>
        </div>

        {item.voucherUrl && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-700 mb-3">发单方上传的支付凭证</h3>
            {item.voucherUploadedAt && (
              <p className="text-xs text-slate-400 mb-3">上传于 {new Date(item.voucherUploadedAt).toLocaleString("zh-CN")}</p>
            )}
            <a href={item.voucherUrl} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-bold hover:bg-primary/20 transition-colors">
              <ExternalLink size={14} /> 查看凭证
            </a>
          </div>
        )}

        {item.status === "paid" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <CheckCircle2 size={24} className="text-green-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-green-700">已支付</p>
            {item.paidAt && <p className="text-xs text-green-500">支付时间：{new Date(item.paidAt).toLocaleString("zh-CN")}</p>}
          </div>
        )}
      </div>

      {showRejectModal && (
        <Modal title="驳回凭证" onClose={() => setShowRejectModal(false)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">请填写驳回原因，发单方将收到通知并重新上传凭证。</p>
            <textarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={3} placeholder="驳回原因（可选）"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleReject} disabled={acting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50">
                {acting ? "提交中…" : "确认驳回"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AdminV2Layout>
  );
}
