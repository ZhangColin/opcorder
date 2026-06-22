import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { markRead } from "@/lib/demandRead";
import { useParams, useLocation } from "wouter";
import {
  Loader2, AlertCircle, Clock, CheckCircle2, Lock, Package,
} from "lucide-react";
import { v2Get } from "@/lib/v2api";
import { OpcV2Layout } from "./OpcV2Layout";

interface TicketDetail {
  id: number;
  outsourceOrderId: number;
  title: string;
  description: string | null;
  status: string;
  isBlockingPayment: boolean;
  createdByNickname: string | null;
  closedAt: string | null;
  closedNote: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open:   { label: "处理中", color: "bg-amber-100 text-amber-700" },
  closed: { label: "已关闭", color: "bg-green-100 text-green-700" },
};

export default function OpcV2TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const ticketId = parseInt(id ?? "0");
  const [, navigate] = useLocation();

  const { data: ticket, isLoading, isError, dataUpdatedAt } = useQuery<TicketDetail>({
    queryKey: ["v2-opc-ticket", ticketId],
    queryFn: () => v2Get(`/tickets-b/${ticketId}`),
    enabled: !!ticketId,
  });

  useEffect(() => { if (ticketId > 0 && ticket) markRead("ticket_b", ticketId); }, [ticketId, dataUpdatedAt]);

  if (isLoading) {
    return (
      <OpcV2Layout title="工单详情" backHref="/opc/tickets" backLabel="工单">
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 size={24} className="animate-spin mr-2" /> 加载中…
        </div>
      </OpcV2Layout>
    );
  }

  if (isError || !ticket) {
    return (
      <OpcV2Layout title="工单详情" backHref="/opc/tickets" backLabel="工单">
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 mt-6">
          <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
          <p className="text-sm text-red-500 font-medium">加载失败，请返回重试</p>
        </div>
      </OpcV2Layout>
    );
  }

  const cfg = STATUS_CONFIG[ticket.status] ?? { label: ticket.status, color: "bg-slate-100 text-slate-500" };

  return (
    <OpcV2Layout
      title={ticket.title}
      backHref="/opc/tickets"
      backLabel="工单"
    >
      <div className="py-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${cfg.color}`}>
                {ticket.status === "open" ? <Clock size={14} /> : <CheckCircle2 size={14} />}
                {cfg.label}
              </span>
              {ticket.isBlockingPayment && ticket.status === "open" && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-bold bg-red-100 text-red-600">
                  <Lock size={12} /> 阻款工单
                </span>
              )}
            </div>
            <h2 className="text-xl font-black text-slate-800">{ticket.title}</h2>
          </div>

          {ticket.description && (
            <div className="px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-sm text-slate-600 leading-relaxed">{ticket.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">发起方</p>
              <p className="text-sm font-bold text-slate-700">{ticket.createdByNickname ?? "平台"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">创建时间</p>
              <p className="text-sm font-bold text-slate-700">{new Date(ticket.createdAt).toLocaleDateString("zh-CN")}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">关联订单</p>
              <button
                onClick={() => navigate(`/opc/orders/${ticket.outsourceOrderId}`)}
                className="text-sm font-bold text-emerald-700 hover:underline flex items-center gap-1"
              >
                <Package size={13} /> 订单 #{ticket.outsourceOrderId}
              </button>
            </div>
            {ticket.closedAt && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">关闭时间</p>
                <p className="text-sm font-bold text-slate-700">{new Date(ticket.closedAt).toLocaleDateString("zh-CN")}</p>
              </div>
            )}
          </div>

          {ticket.isBlockingPayment && ticket.status === "open" && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 rounded-xl border border-red-200">
              <Lock size={16} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700">此工单正在阻止付款释放</p>
                <p className="text-xs text-red-500 mt-0.5">
                  请积极与平台沟通，待工单关闭后款项将继续处理。
                </p>
              </div>
            </div>
          )}

          {ticket.closedNote && (
            <div className="flex items-start gap-3 px-4 py-3 bg-green-50 rounded-xl border border-green-200">
              <CheckCircle2 size={16} className="text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-green-700">工单关闭说明</p>
                <p className="text-xs text-green-600 mt-0.5">{ticket.closedNote}</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </OpcV2Layout>
  );
}
