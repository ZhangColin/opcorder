import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { FileSignature, Loader2, AlertCircle, CheckCircle2, XCircle, ExternalLink, Clock } from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { v2Get, v2Post } from "@/lib/v2api";
import { markRead } from "@/lib/demandRead";
import { useToast } from "@/hooks/use-toast";

interface Contract {
  id: number;
  contractNo: string;
  channel: string;
  clientDemandId: number | null;
  content: string | null;
  status: string;
  signedFileUrl: string | null;
  publisherConfirmedAt: string | null;
  publisherRejectedAt: string | null;
  publisherRejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:                    { label: "草稿",     color: "bg-slate-100 text-slate-500" },
  pending_publisher_confirm:{ label: "待您确认", color: "bg-amber-100 text-amber-700" },
  publisher_rejected:       { label: "您已退回", color: "bg-red-100 text-red-600" },
  pending_sign:             { label: "待签约",   color: "bg-orange-100 text-orange-700" },
  signed:                   { label: "已签约",   color: "bg-green-100 text-green-700" },
};

export default function PubContractDetail() {
  const params = useParams<{ id: string }>();
  const contractId = parseInt(params.id ?? "0", 10);
  const { toast } = useToast();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await v2Get<Contract>(`/contracts/${contractId}`);
      setContract(data);
      markRead("contract", contractId);
    } catch {
      setContract(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (contractId > 0) load(); }, [contractId]);

  const handleConfirm = async () => {
    setActing(true);
    try {
      await v2Post(`/contracts/${contractId}/publisher-confirm`);
      toast({ title: "已确认合同，等待运营方签署" });
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({ title: "请填写退回说明", variant: "destructive" });
      return;
    }
    setActing(true);
    try {
      await v2Post(`/contracts/${contractId}/publisher-reject`, { reason: rejectReason.trim() });
      toast({ title: "已退回合同，运营方将重新修订" });
      setShowRejectModal(false);
      setRejectReason("");
      await load();
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <PubLayout title="合同详情" backHref="/pub/contracts" backLabel="合同列表">
        <div className="flex items-center justify-center py-24 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> 加载中…
        </div>
      </PubLayout>
    );
  }

  if (!contract) {
    return (
      <PubLayout title="合同详情" backHref="/pub/contracts" backLabel="合同列表">
        <div className="flex flex-col items-center py-24 text-slate-400">
          <AlertCircle size={36} className="mb-3 text-slate-300" />
          <p>合同不存在</p>
        </div>
      </PubLayout>
    );
  }

  const cfg = STATUS_CONFIG[contract.status] ?? { label: contract.status, color: "bg-slate-100 text-slate-500" };
  const canAct = contract.status === "pending_publisher_confirm";

  return (
    <PubLayout title={`合同 ${contract.contractNo}`} backHref="/pub/contracts" backLabel="合同列表">
      <div className="mt-6 space-y-5">
        {/* Status card */}
        <div className={`rounded-2xl border p-5 flex items-center gap-4 ${
          canAct ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"
        }`}>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <FileSignature size={18} className="text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
              <span className="text-xs text-slate-400 font-mono">{contract.contractNo}</span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Clock size={11} />
              更新于 {new Date(contract.updatedAt).toLocaleDateString("zh-CN")}
            </p>
          </div>
          {contract.status === "signed" && (
            <CheckCircle2 size={20} className="text-green-500 shrink-0" />
          )}
        </div>

        {/* Action banner for pending confirm */}
        {canAct && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <p className="text-sm font-bold text-amber-800 mb-1">运营方已完成合同定稿，请您仔细阅读后操作</p>
            <p className="text-xs text-amber-600 mb-4">确认后合同将进入签约流程；如有异议请退回并说明原因</p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={acting}
                className="flex items-center gap-2 bg-green-600 text-white rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {acting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                确认合同
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={acting}
                className="flex items-center gap-2 bg-white border border-red-200 text-red-600 rounded-xl px-5 py-2.5 text-sm font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <XCircle size={14} /> 退回修改
              </button>
            </div>
          </div>
        )}

        {/* Reject reason shown if rejected */}
        {contract.status === "publisher_rejected" && contract.publisherRejectedReason && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <p className="text-xs font-bold text-red-700 mb-1">您的退回说明</p>
            <p className="text-sm text-red-800">{contract.publisherRejectedReason}</p>
            <p className="text-xs text-red-400 mt-2">运营方正在修订合同内容</p>
          </div>
        )}

        {/* Signed file */}
        {contract.signedFileUrl && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3">已签约合同文件</h3>
            <a
              href={contract.signedFileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink size={14} /> 查看 / 下载签约文件
            </a>
          </div>
        )}

        {/* Contract content */}
        {contract.content && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">合同正文</h3>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap border border-slate-100 rounded-xl p-4 bg-slate-50 max-h-[600px] overflow-y-auto">
              {contract.content}
            </div>
          </div>
        )}

        {!contract.content && contract.status === "draft" && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
            <FileSignature size={32} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium">合同内容正在起草中</p>
            <p className="text-xs mt-1">运营方完成定稿后将通知您确认</p>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-extrabold text-slate-800 mb-2">退回合同</h3>
            <p className="text-sm text-slate-500 mb-4">请说明退回原因，运营方将据此修订合同内容</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="例如：合同条款第3条与商定内容不符，请修改付款周期…"
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 resize-none mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(""); }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                onClick={handleReject}
                disabled={acting || !rejectReason.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {acting && <Loader2 size={14} className="animate-spin" />}
                确认退回
              </button>
            </div>
          </div>
        </div>
      )}
    </PubLayout>
  );
}
