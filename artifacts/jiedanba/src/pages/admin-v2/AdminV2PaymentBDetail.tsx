import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, X, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post } from "@/lib/v2api";
import { useToast } from "@/hooks/use-toast";

interface SettlementPlan {
  id: number;
  outsourceOrderId: number;
  itemNo: number | null;
  description: string | null;
  amount: number;
  dueDate: string | null;
  status: string;
  paymentVoucherUrl: string | null;
  paymentNote: string | null;
  paidAt: string | null;
  isLastItem: boolean;
  isOverdue?: boolean;
  createdAt: string;
}

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

interface TicketB {
  id: number;
  title: string;
  status: string;
  isBlockingPayment: boolean | null;
}

export default function AdminV2PaymentBDetail({ inlineId }: { inlineId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const { toast } = useToast();

  const [item, setItem] = useState<SettlementPlan | null>(null);
  const [blockingTickets, setBlockingTickets] = useState<TicketB[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payRef, setPayRef] = useState("");
  const [payNote, setPayNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<SettlementPlan>(`/settlement-plans/${id}`);
      setItem(d);
      const tickets = await v2Get<TicketB[]>(`/tickets-b?outsourceOrderId=${d.outsourceOrderId}`);
      setBlockingTickets(tickets.filter(t => t.status === "open" && t.isBlockingPayment));
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id > 0) load(); }, [id]);

  const handleMarkPaid = async () => {
    setActing(true);
    try {
      await v2Post(`/settlement-plans/${id}/mark-paid`, {
        paymentVoucherUrl: payRef.trim() || undefined,
        paymentNote: payNote.trim() || undefined,
      });
      toast({ title: "已标记为已打款" });
      setShowPayModal(false);
      setPayRef(""); setPayNote("");
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  if (loading) return <AdminV2Layout backHref="/admin/v2/payments-b" backLabel="结算付款 (B)"><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!item) return <AdminV2Layout backHref="/admin/v2/payments-b" backLabel="结算付款 (B)"><div className="text-center py-16 text-slate-400">付款项不存在</div></AdminV2Layout>;

  const isOvd = item.status === "pending" && !!item.dueDate && new Date(item.dueDate) < new Date();
  const displayName = item.description ?? `第${item.itemNo ?? 1}期结算款`;

  return (
    <AdminV2Layout title={displayName} backHref="/admin/v2/payments-b" backLabel="结算付款 (B)">
      <div className="mt-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isOvd ? "bg-red-100 text-red-600" : item.status === "paid" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                  {isOvd ? "已逾期" : item.status === "paid" ? "已支付" : "待付款"}
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-blue-900 mb-1">{displayName}</h2>
              <p className="text-2xl font-bold text-violet-600 mb-2">¥{item.amount.toLocaleString()}</p>
              <div className="text-xs text-slate-400 flex gap-4 flex-wrap">
                {item.dueDate && <span className="flex items-center gap-1"><Clock size={11} />应付日期：{new Date(item.dueDate).toLocaleDateString("zh-CN")}</span>}
                {item.paidAt && <span>实际支付：{new Date(item.paidAt).toLocaleDateString("zh-CN")}</span>}
                {item.paymentVoucherUrl && <span>支付凭证：<a href={item.paymentVoucherUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">查看凭证</a></span>}
                {item.paymentNote && <span>备注：{item.paymentNote}</span>}
              </div>
            </div>
            {item.status === "pending" && (
              <button
                onClick={() => {
                  if (item.isLastItem && blockingTickets.length > 0) {
                    toast({ title: "无法打款", description: `存在 ${blockingTickets.length} 个阻断付款的未关闭工单，请先处理工单`, variant: "destructive" });
                    return;
                  }
                  setShowPayModal(true);
                }}
                disabled={acting}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${
                  item.isLastItem && blockingTickets.length > 0
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-violet-600 text-white hover:bg-violet-700"
                }`}>
                <CheckCircle2 size={14} /> 标记已打款
              </button>
            )}
          </div>
        </div>

        {item.isLastItem && blockingTickets.length > 0 && item.status === "pending" && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-700 mb-1">付款被质保工单阻断</p>
                <p className="text-xs text-red-500 mb-2">以下工单关闭前无法打款：</p>
                <ul className="space-y-1">
                  {blockingTickets.map(t => (
                    <li key={t.id} className="text-xs text-red-600 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block shrink-0" />
                      {t.title}
                      <button
                        onClick={() => navigate(`/admin/v2/tickets-b/${t.id}`)}
                        className="ml-1 underline text-red-500 hover:text-red-700">
                        查看工单
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {item.status === "paid" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <CheckCircle2 size={24} className="text-green-500 mx-auto mb-2" />
            <p className="text-sm font-bold text-green-700">已打款完成</p>
            {item.paidAt && <p className="text-xs text-green-500">打款时间：{new Date(item.paidAt).toLocaleString("zh-CN")}</p>}
          </div>
        )}
      </div>

      {showPayModal && (
        <Modal title="标记已打款" onClose={() => setShowPayModal(false)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">填写支付凭证 URL 并确认，该结算项将标记为已打款。</p>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">支付凭证 URL（可选）</label>
              <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="凭证文件链接"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">备注（可选）</label>
              <input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="付款说明"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowPayModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleMarkPaid} disabled={acting}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 disabled:opacity-50">
                {acting ? "处理中…" : "确认打款"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AdminV2Layout>
  );
}
