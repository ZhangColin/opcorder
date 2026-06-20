import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Wrench, Loader2, AlertCircle, CheckCircle2, Clock, ExternalLink } from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { v2Get } from "@/lib/v2api";
import { markRead } from "@/lib/demandRead";

interface Attachment { name: string; url: string; size?: string; type?: string; }

interface Ticket {
  id: number;
  clientDemandId: number;
  title: string;
  description: string | null;
  attachments: Attachment[];
  status: string;
  createdByNickname: string | null;
  closedAt: string | null;
  closedNote: string | null;
  createdAt: string;
}

export default function PubTicketDetail() {
  const params = useParams<{ id: string }>();
  const ticketId = parseInt(params.id ?? "0", 10);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (ticketId <= 0) return;
    v2Get<Ticket>(`/tickets-a/${ticketId}`)
      .then(data => { setTicket(data); markRead("ticket_a", ticketId); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [ticketId]);

  if (loading) {
    return (
      <PubLayout title="工单详情" backHref="/pub/tickets" backLabel="工单列表">
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
        </div>
      </PubLayout>
    );
  }

  if (notFound || !ticket) {
    return (
      <PubLayout title="工单详情" backHref="/pub/tickets" backLabel="工单列表">
        <div className="flex flex-col items-center py-24 text-slate-400">
          <AlertCircle size={36} className="mb-3 text-slate-300" />
          <p>工单不存在</p>
        </div>
      </PubLayout>
    );
  }

  const isOpen = ticket.status === "open";
  const attachments = Array.isArray(ticket.attachments) ? ticket.attachments : [];

  return (
    <PubLayout title={`工单 · ${ticket.title}`} backHref="/pub/tickets" backLabel="工单列表">
      <div className="mt-6 space-y-5">
        {/* Header card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Wrench size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {isOpen ? (
                  <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    <Clock size={11} /> 处理中
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                    <CheckCircle2 size={11} /> 已关闭
                  </span>
                )}
                <span className="text-xs text-slate-400">需求 #{ticket.clientDemandId}</span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-800">{ticket.title}</h2>
              <p className="text-xs text-slate-400 mt-1">
                由 {ticket.createdByNickname ?? "您"} 发起 · {new Date(ticket.createdAt).toLocaleDateString("zh-CN")}
              </p>
            </div>
          </div>

          {ticket.description && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 mb-1">问题描述</p>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 mb-2">附件</p>
              <div className="space-y-1.5">
                {attachments.map((a, i) => (
                  <a
                    key={i}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 hover:border-primary/40 transition-colors"
                  >
                    <ExternalLink size={12} className="text-slate-400 shrink-0" />
                    <span className="text-xs text-slate-700 flex-1 truncate">{a.name}</span>
                    {a.size && <span className="text-xs text-slate-400">{a.size}</span>}
                  </a>
                ))}
              </div>
            </div>
          )}

          {!isOpen && ticket.closedNote && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-bold text-slate-500 mb-1">关闭备注</p>
              <p className="text-sm text-slate-600">{ticket.closedNote}</p>
              {ticket.closedAt && (
                <p className="text-xs text-slate-400 mt-1">关闭于 {new Date(ticket.closedAt).toLocaleDateString("zh-CN")}</p>
              )}
            </div>
          )}
        </div>

        {/* Discussion */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-4">工单讨论</h3>
          <DiscussionThread
            parentType="v2_ticket_a"
            parentId={ticketId}
            placeholder="描述问题详情或回复运营方…"
            readOnly={!isOpen}
            onAfterPost={() => markRead("ticket_a", ticketId)}
          />
        </div>
      </div>
    </PubLayout>
  );
}
