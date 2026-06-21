import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Loader2, X, CheckCircle2, Clock, Package, AlertTriangle } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post } from "@/lib/v2api";
import { markRead } from "@/lib/demandRead";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { useToast } from "@/hooks/use-toast";

interface TicketB {
  id: number;
  outsourceOrderId: number;
  title: string;
  description: string | null;
  status: string;
  isBlockingPayment: boolean;
  closedAt: string | null;
  closedNote: string | null;
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

export default function AdminV2TicketBDetail({ inlineId }: { inlineId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const { toast } = useToast();

  const [ticket, setTicket] = useState<TicketB | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeNote, setCloseNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<TicketB>(`/tickets-b/${id}`);
      setTicket(d);
      markRead("ticket_b", id);
    } catch {
      setTicket(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id > 0) load(); }, [id]);

  const handleClose = async () => {
    setActing(true);
    try {
      await v2Post(`/tickets-b/${id}/close`, { note: closeNote.trim() || undefined });
      toast({ title: "工单已关闭" + (ticket?.isBlockingPayment ? "，尾款阻断已解除" : "") });
      setShowCloseModal(false);
      setCloseNote("");
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  if (loading) return <AdminV2Layout backHref="/admin/v2/tickets-b" backLabel="工单 (B)"><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!ticket) return <AdminV2Layout backHref="/admin/v2/tickets-b" backLabel="工单 (B)"><div className="text-center py-16 text-slate-400">工单不存在</div></AdminV2Layout>;

  const isOpen = ticket.status === "open";

  return (
    <AdminV2Layout
      title={ticket.title}
      backHref="/admin/v2/tickets-b"
      backLabel="工单 (B)"
      actions={
        isOpen ? (
          <button onClick={() => setShowCloseModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-red-200 rounded-xl text-red-500 hover:bg-red-50 transition-colors">
            关闭工单
          </button>
        ) : undefined
      }
    >
      <div className="mt-6 space-y-4">
        {ticket.isBlockingPayment && isOpen && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700">此工单正在阻断尾款支付</p>
              <p className="text-xs text-red-500 mt-0.5">关闭工单后，尾款将解除阻断，可正常支付。</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <Package size={18} className="text-violet-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isOpen ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                  {isOpen ? "开放中" : "已关闭"}
                </span>
                {ticket.isBlockingPayment && (
                  <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">阻断付款</span>
                )}
                <span className="text-xs text-slate-400 font-mono">#{ticket.id}</span>
              </div>
              <h2 className="text-lg font-extrabold text-blue-900 mb-1">{ticket.title}</h2>
              {ticket.description && <p className="text-sm text-slate-600">{ticket.description}</p>}
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                <Clock size={11} /> 创建于 {new Date(ticket.createdAt).toLocaleString("zh-CN")}
              </p>
            </div>
          </div>
          {!isOpen && (
            <div className="mt-3 bg-slate-50 rounded-xl p-3 text-center">
              <CheckCircle2 size={20} className="text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-500">工单已关闭</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">与OPC的讨论</h3>
          <DiscussionThread parentType="ticket_b" parentId={id} placeholder="回复OPC…" readOnly={!isOpen} onAfterPost={() => markRead("ticket_b", id)} />
        </div>
      </div>

      {showCloseModal && (
        <Modal title="关闭工单" onClose={() => setShowCloseModal(false)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              确认工单问题已处理完毕？
              {ticket.isBlockingPayment && <span className="text-red-500 font-bold"> 关闭后将解除对尾款的阻断。</span>}
            </p>
            <textarea value={closeNote} onChange={e => setCloseNote(e.target.value)} rows={3} placeholder="关闭说明（可选）"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCloseModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleClose} disabled={acting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50">
                {acting ? "关闭中…" : "确认关闭"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AdminV2Layout>
  );
}
