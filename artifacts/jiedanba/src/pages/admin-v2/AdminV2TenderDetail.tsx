import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import { Loader2, X, CheckCircle2, DollarSign, Clock } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post } from "@/lib/v2api";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useToast } from "@/hooks/use-toast";

interface Tender {
  id: number;
  outsourceDemandId: number;
  demandTitle: string | null;
  opcId: number;
  opcNickname: string | null;
  status: string;
  totalPrice: number | null;
  priceBreakdown: Array<{ item: string; amount: number; note?: string }> | null;
  quotedAt: string | null;
  selectedAt: string | null;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  negotiating: { label: "待报价", color: "bg-slate-100 text-slate-500" },
  quoted:      { label: "已报价", color: "bg-blue-100 text-blue-700" },
  won:         { label: "已中标", color: "bg-green-100 text-green-700" },
  lost:        { label: "已取消", color: "bg-red-100 text-red-500" },
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

export default function AdminV2TenderDetail({ inlineId }: { inlineId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const { toast } = useToast();

  const [tender, setTender] = useState<Tender | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelNote, setCancelNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<Tender>(`/tenders/${id}`);
      setTender(d);
    } catch {
      setTender(null);
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

  const handleSelectWinner = () => act(
    () => v2Post(`/tenders/${id}/select-winner`, {}),
    "已选定中标，订单已生成"
  );

  const handleCancel = async () => {
    await act(
      () => v2Post(`/tenders/${id}/cancel`, { reason: cancelNote.trim() || undefined }),
      "投标已取消，已通知OPC"
    );
    setShowCancelModal(false);
    setCancelNote("");
  };

  if (loading) return <AdminV2Layout backHref="/admin/v2/tenders" backLabel="投标管理"><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!tender) return <AdminV2Layout backHref="/admin/v2/tenders" backLabel="投标管理"><div className="text-center py-16 text-slate-400">投标不存在</div></AdminV2Layout>;

  const cfg = STATUS_CONFIG[tender.status] ?? { label: tender.status, color: "bg-slate-100 text-slate-500" };

  return (
    <AdminV2Layout
      title={`投标详情 — ${tender.opcNickname ?? "OPC"}`}
      backHref="/admin/v2/tenders"
      backLabel="投标管理"
    >
      <div className="mt-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
              </div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 font-bold text-sm flex items-center justify-center shrink-0">
                  {(tender.opcNickname ?? "?")[0]}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{tender.opcNickname ?? "OPC"}</p>
                  <p className="text-xs text-slate-400">
                    外包需求：
                    <button onClick={() => inlineNav ? inlineNav.push(`/admin/v2/outsource-demands/${tender.outsourceDemandId}`) : navigate(`/admin/v2/outsource-demands/${tender.outsourceDemandId}`)}
                      className="text-primary hover:underline">{tender.demandTitle ?? `#${tender.outsourceDemandId}`}</button>
                  </p>
                </div>
              </div>
              {tender.totalPrice != null && (
                <div className="flex items-center gap-1 text-xl font-bold text-primary">
                  <DollarSign size={16} />¥{tender.totalPrice.toLocaleString()}
                </div>
              )}
              <div className="text-xs text-slate-400 flex gap-3 mt-1 flex-wrap">
                {tender.quotedAt && <span className="flex items-center gap-1"><Clock size={11} />报价于 {new Date(tender.quotedAt).toLocaleString("zh-CN")}</span>}
                {tender.selectedAt && <span>中标于 {new Date(tender.selectedAt).toLocaleString("zh-CN")}</span>}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {tender.status === "quoted" && (
                <>
                  <button onClick={handleSelectWinner} disabled={acting}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50">
                    <CheckCircle2 size={14} /> 选定中标
                  </button>
                  <button onClick={() => setShowCancelModal(true)} disabled={acting}
                    className="px-4 py-2 border border-red-200 text-red-500 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                    取消投标
                  </button>
                </>
              )}
              {tender.status === "negotiating" && (
                <button onClick={() => setShowCancelModal(true)} disabled={acting}
                  className="px-4 py-2 border border-red-200 text-red-500 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
                  取消投标
                </button>
              )}
            </div>
          </div>

          {tender.priceBreakdown && tender.priceBreakdown.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold text-slate-500 mb-2">报价明细</h4>
              <div className="space-y-1">
                {tender.priceBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{item.item}</span>
                    <span className="font-semibold text-slate-800">¥{item.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <h3 className="text-sm font-bold text-slate-700 mb-4">与 {tender.opcNickname ?? "OPC"} 的私密讨论</h3>
          <DiscussionThread parentType="tender" parentId={id} placeholder="与OPC私密沟通…" />
        </div>
      </div>

      {showCancelModal && (
        <Modal title="取消投标" onClose={() => setShowCancelModal(false)}>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">确认取消该 OPC 的投标？操作后将通知 OPC。</p>
            <textarea value={cancelNote} onChange={e => setCancelNote(e.target.value)} rows={3} placeholder="取消原因（可选）"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleCancel} disabled={acting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 disabled:opacity-50">
                {acting ? "处理中…" : "确认取消"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AdminV2Layout>
  );
}
