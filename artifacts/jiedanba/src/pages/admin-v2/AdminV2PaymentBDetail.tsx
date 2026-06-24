import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAdminInlineNav } from "@/context/AdminInlineNavContext";
import { Loader2, X, CheckCircle2, Clock, AlertTriangle, Upload, Building2 } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post, uploadFile } from "@/lib/v2api";
import { useToast } from "@/hooks/use-toast";

interface BankAccountInfo {
  accountName: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankBranch: string | null;
  companyName: string | null;
}

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
  bankAccountSnapshot: string | null;
  currentBankAccount: BankAccountInfo | null;
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

interface OutsourceOrder {
  id: number;
  orderNo: string;
  demandTitle: string | null;
  status: string;
}

export default function AdminV2PaymentBDetail({ inlineId }: { inlineId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const inlineNav = useAdminInlineNav();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const { toast } = useToast();

  const [item, setItem] = useState<SettlementPlan | null>(null);
  const [order, setOrder] = useState<OutsourceOrder | null>(null);
  const [blockingTickets, setBlockingTickets] = useState<TicketB[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [payNote, setPayNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<SettlementPlan>(`/settlement-plans/${id}`);
      setItem(d);
      const [ord, tickets] = await Promise.all([
        v2Get<OutsourceOrder>(`/outsource-orders/${d.outsourceOrderId}`),
        v2Get<TicketB[]>(`/tickets-b?outsourceOrderId=${d.outsourceOrderId}`),
      ]);
      setOrder(ord);
      setBlockingTickets(tickets.filter(t => t.status === "open"));
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
      let voucherUrl: string | undefined;
      if (voucherFile) {
        voucherUrl = await uploadFile(voucherFile);
      }
      await v2Post(`/settlement-plans/${id}/mark-paid`, {
        paymentVoucherUrl: voucherUrl,
        paymentNote: payNote.trim() || undefined,
      });
      toast({ title: "打款凭证已上传，已标记为已打款" });
      setShowPayModal(false);
      setVoucherFile(null); setPayNote("");
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  if (loading) return <AdminV2Layout backHref="/admin/v2/payments-b" backLabel="结算付款"><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!item) return <AdminV2Layout backHref="/admin/v2/payments-b" backLabel="结算付款"><div className="text-center py-16 text-slate-400">付款项不存在</div></AdminV2Layout>;

  const isOvd = item.status === "pending" && !!item.dueDate && new Date(item.dueDate) < new Date();
  const displayName = item.description ?? `第${item.itemNo ?? 1}期结算款`;
  const contractNotSigned = order?.status === "pending_contract";
  const hasOpenTickets = blockingTickets.length > 0;
  const hasBlockingTickets = item.isLastItem && hasOpenTickets;
  const cannotPay = contractNotSigned || hasBlockingTickets;

  return (
    <AdminV2Layout title={displayName} backHref="/admin/v2/payments-b" backLabel="结算付款">
      <div className="mt-6 space-y-4">
        {/* 所属订单快捷跳转 */}
        {order && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>所属外包订单：</span>
            <button
              onClick={() => inlineNav ? inlineNav.push(`/admin/v2/outsource-orders/${order.id}`) : navigate(`/admin/v2/outsource-orders/${order.id}`)}
              className="text-primary hover:underline font-medium"
            >{order.orderNo}{order.demandTitle ? ` · ${order.demandTitle}` : ""}</button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
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
                  if (contractNotSigned) {
                    toast({ title: "无法打款", description: "合同尚未签订完成，请等待双方签约后再操作", variant: "destructive" });
                    return;
                  }
                  if (hasBlockingTickets) {
                    toast({ title: "无法打款", description: `存在 ${blockingTickets.length} 个阻断付款的未关闭工单，请先处理工单`, variant: "destructive" });
                    return;
                  }
                  setShowPayModal(true);
                }}
                disabled={acting}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${
                  cannotPay
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-violet-600 text-white hover:bg-violet-700"
                }`}>
                <Upload size={14} /> 上传打款凭证
              </button>
            )}
          </div>
        </div>

        {/* 收款账户信息 */}
        {(() => {
          const bankInfo: BankAccountInfo | null =
            item.status === "paid" && item.bankAccountSnapshot
              ? (() => { try { return JSON.parse(item.bankAccountSnapshot); } catch { return null; } })()
              : item.currentBankAccount;
          if (!bankInfo) return item.status !== "paid" ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 font-medium">OPC 尚未提交或审核通过收款账户，请提醒其补充。</p>
            </div>
          ) : null;
          return (
            <div className={`rounded-2xl border p-5 ${item.status === "paid" ? "bg-slate-50 border-slate-200" : "bg-white border-slate-200"}`}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 size={15} className="text-violet-500" />
                <h3 className="text-sm font-extrabold text-slate-700">
                  {item.status === "paid" ? "收款账户（打款时快照）" : "收款账户（当前已审核）"}
                </h3>
                {item.status === "paid" && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-200 text-slate-500 rounded">已固化</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                {bankInfo.companyName && (
                  <div><span className="text-slate-400">企业名称</span><p className="font-bold text-slate-700 mt-0.5">{bankInfo.companyName}</p></div>
                )}
                {bankInfo.accountName && (
                  <div><span className="text-slate-400">账户名称</span><p className="font-bold text-slate-700 mt-0.5">{bankInfo.accountName}</p></div>
                )}
                {bankInfo.bankName && (
                  <div><span className="text-slate-400">开户银行</span><p className="font-bold text-slate-700 mt-0.5">{bankInfo.bankName}</p></div>
                )}
                {bankInfo.bankBranch && (
                  <div><span className="text-slate-400">开户支行</span><p className="font-bold text-slate-700 mt-0.5">{bankInfo.bankBranch}</p></div>
                )}
                {bankInfo.bankAccount && (
                  <div className="col-span-2">
                    <span className="text-slate-400">银行账号</span>
                    <p className="font-mono font-bold text-slate-800 mt-0.5 text-sm tracking-widest">{bankInfo.bankAccount}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* 合同未签订警告 */}
        {contractNotSigned && item.status === "pending" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-700 mb-1">合同尚未签订</p>
                <p className="text-xs text-amber-600">双方合同签订完成后方可标记打款。请先完成合同签约流程。</p>
              </div>
            </div>
          </div>
        )}

        {hasOpenTickets && item.status === "pending" && (
          <div className={`rounded-2xl border p-4 ${hasBlockingTickets ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className={`shrink-0 mt-0.5 ${hasBlockingTickets ? "text-red-500" : "text-amber-500"}`} />
              <div>
                <p className={`text-sm font-bold mb-1 ${hasBlockingTickets ? "text-red-700" : "text-amber-700"}`}>
                  {hasBlockingTickets ? "尾款被未关闭工单阻断，暂不可打款" : "提醒：该订单存在未关闭工单，请确认后再打款"}
                </p>
                <p className={`text-xs mb-2 ${hasBlockingTickets ? "text-red-500" : "text-amber-600"}`}>
                  {hasBlockingTickets ? "以下工单关闭后方可打款尾款：" : "以下工单尚未处理完毕："}
                </p>
                <ul className="space-y-1">
                  {blockingTickets.map(t => (
                    <li key={t.id} className={`text-xs flex items-center gap-1 ${hasBlockingTickets ? "text-red-600" : "text-amber-700"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${hasBlockingTickets ? "bg-red-400" : "bg-amber-400"}`} />
                      {t.title}
                      <button
                        onClick={() => inlineNav ? inlineNav.push(`/admin/v2/tickets-b/${t.id}`) : navigate(`/admin/v2/tickets-b/${t.id}`)}
                        className={`ml-1 underline hover:opacity-70 ${hasBlockingTickets ? "text-red-500" : "text-amber-600"}`}>
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
        <Modal title="上传打款凭证" onClose={() => setShowPayModal(false)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">上传打款凭证文件后，该结算项将自动标记为已打款。</p>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">打款凭证文件（必填）</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.md"
                  onChange={e => setVoucherFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-600" />
                {voucherFile && <p className="mt-2 text-xs text-slate-500">已选：{voucherFile.name}</p>}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">备注（可选）</label>
              <input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="付款说明"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowPayModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600">取消</button>
              <button onClick={handleMarkPaid} disabled={acting || !voucherFile}
                className="px-4 py-2 text-sm bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 disabled:opacity-50">
                {acting ? "上传中…" : "确认打款"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AdminV2Layout>
  );
}
