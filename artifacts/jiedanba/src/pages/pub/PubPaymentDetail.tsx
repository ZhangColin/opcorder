import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import {
  CreditCard, Upload, Loader2, CheckCircle2, Clock, AlertCircle,
  ExternalLink, QrCode, X, RefreshCw,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { PubLayout } from "@/components/pub/PubLayout";
import { v2Get, v2Post, uploadFile } from "@/lib/v2api";
import { useToast } from "@/hooks/use-toast";

interface PaymentPlan {
  id: number;
  clientDemandId: number;
  itemNo: number;
  description: string | null;
  amount: number;
  dueDate: string;
  status: string;
  voucherUrl: string | null;
  voucherNote: string | null;
  demandTitle: string | null;
  demandNo: string | null;
  isLastItem: boolean;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
}

interface OnlinePaymentInfo {
  qrCodeUrl: string;
  paymentOrderNo: string;
  amount: number;
  expiredAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:        { label: "待付款", color: "text-orange-700 bg-orange-100", icon: Clock },
  awaiting_review:{ label: "审核中", color: "text-amber-700 bg-amber-100", icon: Clock },
  paid:           { label: "已付款", color: "text-green-700 bg-green-100", icon: CheckCircle2 },
};

export default function PubPaymentDetail() {
  const params = useParams<{ id: string }>();
  const planId = parseInt(params.id ?? "0", 10);
  const { toast } = useToast();

  const [plan, setPlan] = useState<PaymentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [voucherNote, setVoucherNote] = useState("");
  const [pendingVoucherUrl, setPendingVoucherUrl] = useState<string | null>(null);

  const [creatingPayment, setCreatingPayment] = useState(false);
  const [onlinePayment, setOnlinePayment] = useState<OnlinePaymentInfo | null>(null);
  const [payStatus, setPayStatus] = useState<"pending" | "paid" | "failed">("pending");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await v2Get<PaymentPlan>(`/payment-plans/${planId}`);
      setPlan(data);
    } catch {
      setPlan(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (planId > 0) load(); }, [planId]);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const result = await v2Post<{ status: string; statusName?: string }>(`/payment-plans/${planId}/query-online-payment`);
        if (result.status === "paid") {
          setPayStatus("paid");
          stopPolling();
          setTimeout(() => {
            setOnlinePayment(null);
            setPayStatus("pending");
            load();
          }, 2000);
        } else if (result.status === "failed") {
          setPayStatus("failed");
          stopPolling();
        }
      } catch {
        // silently ignore polling errors
      }
    }, 3000);
  };

  useEffect(() => () => stopPolling(), []);

  const handleStartOnlinePayment = async () => {
    setCreatingPayment(true);
    try {
      const result = await v2Post<OnlinePaymentInfo>(`/payment-plans/${planId}/create-online-payment`);
      setOnlinePayment(result);
      setPayStatus("pending");
      startPolling();
    } catch (err: any) {
      toast({ title: "创建支付订单失败", description: err.message, variant: "destructive" });
    } finally {
      setCreatingPayment(false);
    }
  };

  const handleClosePayment = () => {
    stopPolling();
    setOnlinePayment(null);
    setPayStatus("pending");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file);
      setPendingVoucherUrl(url);
      toast({ title: "凭证已上传，请点击提交" });
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSubmitVoucher = async () => {
    if (!pendingVoucherUrl) {
      toast({ title: "请先上传付款凭证", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await v2Post(`/payment-plans/${planId}/upload-voucher`, {
        voucherUrl: pendingVoucherUrl,
        voucherNote: voucherNote.trim() || undefined,
      });
      toast({ title: "凭证已提交，等待运营方审核" });
      await load();
      setPendingVoucherUrl(null);
      setVoucherNote("");
    } catch (err: any) {
      toast({ title: "提交失败", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PubLayout title="付款详情" backHref="/pub/payments" backLabel="付款列表">
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
        </div>
      </PubLayout>
    );
  }

  if (!plan) {
    return (
      <PubLayout title="付款详情" backHref="/pub/payments" backLabel="付款列表">
        <div className="flex flex-col items-center py-24 text-slate-400">
          <AlertCircle size={36} className="mb-3 text-slate-300" />
          <p>付款记录不存在</p>
        </div>
      </PubLayout>
    );
  }

  const cfg = STATUS_CONFIG[plan.status] ?? { label: plan.status, color: "text-slate-600 bg-slate-100", icon: Clock };
  const StatusIcon = cfg.icon;
  const canPay = plan.status === "pending";

  return (
    <PubLayout title={`付款详情 · 第 ${plan.itemNo} 期`} backHref="/pub/payments" backLabel="付款列表">
      <div className="mt-6 space-y-5">

        {/* Status card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <CreditCard size={22} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-full ${cfg.color}`}>
                  <StatusIcon size={14} /> {cfg.label}
                </span>
                {plan.isOverdue && plan.status === "pending" && (
                  <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">已逾期</span>
                )}
                {plan.isLastItem && (
                  <span className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">最后一期</span>
                )}
              </div>
              <p className="text-3xl font-black text-slate-800 mb-1">¥{plan.amount.toLocaleString()}</p>
              {plan.description && <p className="text-sm text-slate-500">{plan.description}</p>}
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-400 mb-1">应付日期</p>
              <p className={`font-bold ${plan.isOverdue && plan.status === "pending" ? "text-red-600" : "text-slate-800"}`}>
                {new Date(plan.dueDate).toLocaleDateString("zh-CN")}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">关联需求</p>
              <p className="font-bold text-slate-800">{plan.demandTitle ?? `需求 #${plan.clientDemandId}`}</p>
              {plan.demandNo && <p className="text-xs text-slate-400 mt-0.5">{plan.demandNo}</p>}
            </div>
          </div>
        </div>

        {/* Voucher / paid section */}
        {plan.status === "paid" && plan.voucherUrl && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-green-800 mb-3">付款凭证</h3>
            <a href={plan.voucherUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 underline">
              <ExternalLink size={14} /> 查看凭证
            </a>
            {plan.voucherNote && <p className="text-xs text-green-700 mt-2">{plan.voucherNote}</p>}
          </div>
        )}

        {plan.status === "awaiting_review" && plan.voucherUrl && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-amber-800 mb-2">凭证已提交，等待审核</h3>
            <a href={plan.voucherUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 text-sm text-amber-700 hover:text-amber-900 underline">
              <ExternalLink size={14} /> 查看已上传凭证
            </a>
            {plan.voucherNote && <p className="text-xs text-amber-700 mt-2">{plan.voucherNote}</p>}
          </div>
        )}

        {/* Payment section */}
        {canPay && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <h3 className="text-sm font-bold text-slate-800">付款方式</h3>

            {/* Online payment */}
            <div className="border border-primary/20 bg-primary/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <QrCode size={16} className="text-primary" />
                <p className="text-sm font-bold text-primary">在线支付（推荐）</p>
              </div>
              <p className="text-xs text-slate-500 mb-3">通过平台支付系统扫码完成付款，实时到账确认，无需人工审核</p>
              <button
                onClick={handleStartOnlinePayment}
                disabled={creatingPayment}
                className="flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {creatingPayment ? <Loader2 size={14} className="animate-spin" /> : <QrCode size={14} />}
                {creatingPayment ? "生成支付码…" : "立即在线支付"}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">或</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Voucher upload */}
            <div>
              <p className="text-sm font-bold text-slate-700 mb-1">上传付款凭证（线下转账）</p>
              <p className="text-xs text-slate-500 mb-3">请线下完成付款后上传转账截图或收据，运营方审核后将更新状态</p>

              {pendingVoucherUrl ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
                  <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                  <span className="text-sm text-green-700 flex-1">凭证已选择，请补充备注后提交</span>
                  <button onClick={() => setPendingVoucherUrl(null)} className="text-xs text-slate-400 hover:text-red-500">重选</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl text-sm font-medium text-primary hover:bg-blue-100 transition-colors cursor-pointer justify-center mb-3">
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? "上传中…" : "点击上传凭证（截图或PDF）"}
                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleFileUpload} disabled={uploading} />
                </label>
              )}

              <textarea
                value={voucherNote}
                onChange={e => setVoucherNote(e.target.value)}
                placeholder="备注说明（可选）：如转账时间、银行流水号等"
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none mb-3"
              />

              <button
                onClick={handleSubmitVoucher}
                disabled={!pendingVoucherUrl || submitting}
                className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white rounded-xl py-2.5 text-sm font-bold hover:bg-slate-700 transition-colors disabled:opacity-40"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                提交凭证
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Online payment QR modal */}
      {onlinePayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative">

            {/* Close button */}
            {payStatus !== "paid" && (
              <button
                onClick={handleClosePayment}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            )}

            {payStatus === "paid" ? (
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <p className="text-xl font-extrabold text-slate-800">支付成功！</p>
                <p className="text-sm text-slate-500">¥{onlinePayment.amount.toLocaleString()} 已确认到账</p>
              </div>
            ) : payStatus === "failed" ? (
              <div className="flex flex-col items-center py-4 gap-3">
                <AlertCircle size={40} className="text-red-400" />
                <p className="text-base font-bold text-slate-700">支付已取消或超时</p>
                <p className="text-xs text-slate-400 text-center">可关闭后重新发起支付</p>
                <button
                  onClick={() => { handleClosePayment(); handleStartOnlinePayment(); }}
                  className="flex items-center gap-2 bg-primary text-white rounded-xl px-5 py-2 text-sm font-bold mt-2"
                >
                  <RefreshCw size={14} /> 重新支付
                </button>
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <p className="text-sm font-bold text-slate-700">扫码完成支付</p>
                  <p className="text-2xl font-black text-primary mt-1">¥{onlinePayment.amount.toLocaleString()}</p>
                </div>

                <div className="flex justify-center mb-4">
                  <div className="p-3 border-2 border-slate-200 rounded-xl bg-white">
                    <QRCodeSVG value={onlinePayment.qrCodeUrl} size={176} />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-3">
                  <Loader2 size={12} className="animate-spin" />
                  等待支付确认…
                </div>

                {onlinePayment.expiredAt && (
                  <p className="text-center text-xs text-slate-400">
                    二维码有效期至 {new Date(onlinePayment.expiredAt).toLocaleTimeString("zh-CN")}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </PubLayout>
  );
}
