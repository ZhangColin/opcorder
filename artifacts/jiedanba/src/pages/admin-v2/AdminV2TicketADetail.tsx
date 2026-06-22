import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Loader2, X, CheckCircle2, Clock, Wrench } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post } from "@/lib/v2api";
import { markRead } from "@/lib/demandRead";
import { useToast } from "@/hooks/use-toast";

interface Ticket {
  id: number;
  clientDemandId: number | null;
  title: string;
  description: string | null;
  status: string;
  attachments: Array<{ name: string; url: string }> | null;
  createdByNickname: string | null;
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

export default function AdminV2TicketADetail({ inlineId }: { inlineId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const { toast } = useToast();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeNote, setCloseNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<Ticket>(`/tickets-a/${id}`);
      setTicket(d);
      markRead("ticket_a", id);
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
      await v2Post(`/tickets-a/${id}/close`, { note: closeNote.trim() || undefined });
      toast({ title: "工单已关闭" });
      setShowCloseModal(false);
      setCloseNote("");
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  if (loading) return <AdminV2Layout backHref="/admin/v2/tickets-a" backLabel="工单 (A)"><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!ticket) return <AdminV2Layout backHref="/admin/v2/tickets-a" backLabel="工单 (A)"><div className="text-center py-16 text-slate-400">工单不存在</div></AdminV2Layout>;

  const isOpen = ticket.status === "open";

  return (
    <AdminV2Layout
      title={ticket.title}
      backHref="/admin/v2/tickets-a"
      backLabel="工单 (A)"
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
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Wrench size={18} className="text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isOpen ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                  {isOpen ? "开放中" : "已关闭"}
                </span>
                <span className="text-xs text-slate-400 font-mono">#{ticket.id}</span>
              </div>
              <h2 className="text-lg font-extrabold text-blue-900 mb-1">{ticket.title}</h2>
              {ticket.description && <p className="text-sm text-slate-600">{ticket.description}</p>}
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                <Clock size={11} /> 创建于 {new Date(ticket.createdAt).toLocaleString("zh-CN")}
              </p>
            </div>
          </div>
          {ticket.attachments && ticket.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ticket.attachments.map((a, i) => (
                <a key={i} href={a.url} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5">
                  {a.name}
                </a>
              ))}
            </div>
          )}
          {!isOpen && (
            <div className="mt-3 bg-slate-50 rounded-xl p-3 text-center">
              <CheckCircle2 size={20} className="text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-500">工单已关闭</p>
            </div>
          )}
        </div>

      </div>

      {showCloseModal && (
        <Modal title="关闭工单" onClose={() => setShowCloseModal(false)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">关闭工单后将不可继续回复，请确认问题已处理完毕。</p>
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
