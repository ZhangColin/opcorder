import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Loader2, X, ExternalLink, Upload } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post, uploadFile } from "@/lib/v2api";
import { markRead } from "@/lib/demandRead";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useToast } from "@/hooks/use-toast";

interface Contract {
  id: number;
  contractNo: string;
  channel: string;
  clientDemandId: number | null;
  content: string | null;
  status: string;
  signedFileUrl: string | null;
  signedAt: string | null;
  publisherConfirmedAt: string | null;
  publisherRejectedAt: string | null;
  publisherRejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:                      { label: "草稿",       color: "bg-slate-100 text-slate-500" },
  pending_publisher_confirm:  { label: "待发单方确认", color: "bg-amber-100 text-amber-700" },
  publisher_rejected:         { label: "已退回",      color: "bg-red-100 text-red-600" },
  pending_sign:               { label: "待签约",      color: "bg-orange-100 text-orange-700" },
  signed:                     { label: "已签约",      color: "bg-green-100 text-green-700" },
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-blue-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function AdminV2ContractADetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0", 10);
  const { toast } = useToast();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeContent, setFinalizeContent] = useState("");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<Contract>(`/contracts/${id}`);
      setContract(d);
    } catch {
      setContract(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id > 0) markRead("contract", id); }, [id]);
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

  const handleFinalize = async () => {
    if (!finalizeContent.trim()) {
      toast({ title: "请填写合同内容", variant: "destructive" }); return;
    }
    await act(async () => {
      await v2Post(`/contracts/${id}/finalize`, { content: finalizeContent.trim() });
      setShowFinalizeModal(false);
      setFinalizeContent("");
    }, "合同已定稿，通知发单方确认");
  };

  const handleUploadSigned = async () => {
    if (!selectedFile) {
      toast({ title: "请选择文件", variant: "destructive" }); return;
    }
    setUploadingFile(true);
    try {
      const url = await uploadFile(selectedFile);
      await v2Post(`/contracts/${id}/upload-signed`, { signedFileUrl: url });
      toast({ title: "已签合同已上传，进入执行中" });
      setShowUploadModal(false);
      setSelectedFile(null);
      await load();
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  if (loading) return <AdminV2Layout backHref="/admin/v2/contracts-a" backLabel="合同 (A)"><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!contract) return <AdminV2Layout backHref="/admin/v2/contracts-a" backLabel="合同 (A)"><div className="text-center py-16 text-slate-400">合同不存在</div></AdminV2Layout>;

  const cfg = STATUS_CONFIG[contract.status] ?? { label: contract.status, color: "bg-slate-100 text-slate-500" };
  const canFinalize = ["draft", "publisher_rejected"].includes(contract.status);
  const canUploadSigned = contract.status === "pending_sign";

  return (
    <AdminV2Layout title={`合同 ${contract.contractNo}`} backHref="/admin/v2/contracts-a" backLabel="合同 (A)">
      <div className="mt-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                <span className="text-xs text-slate-400 font-mono">{contract.contractNo}</span>
              </div>
              <div className="text-xs text-slate-400 flex gap-3 flex-wrap">
                {contract.signedAt && <span>签约：{new Date(contract.signedAt).toLocaleDateString("zh-CN")}</span>}
                {contract.publisherConfirmedAt && <span>发单方确认：{new Date(contract.publisherConfirmedAt).toLocaleDateString("zh-CN")}</span>}
                {contract.publisherRejectedAt && <span className="text-red-500">发单方退回：{new Date(contract.publisherRejectedAt).toLocaleDateString("zh-CN")}</span>}
                <span>更新：{new Date(contract.updatedAt).toLocaleDateString("zh-CN")}</span>
              </div>
              {contract.publisherRejectedReason && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">
                  退回原因：{contract.publisherRejectedReason}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {canFinalize && (
                <button onClick={() => { setFinalizeContent(contract.content ?? ""); setShowFinalizeModal(true); }} disabled={acting}
                  className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
                  编辑定稿 → 发给发单方
                </button>
              )}
              {canUploadSigned && (
                <button onClick={() => setShowUploadModal(true)} disabled={acting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors">
                  <Upload size={14} /> 上传已签合同
                </button>
              )}
              {contract.signedFileUrl && (
                <a href={contract.signedFileUrl} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  <ExternalLink size={14} /> 查看签署合同
                </a>
              )}
            </div>
          </div>
        </div>

        {contract.content && (
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">合同内容</h3>
            <MarkdownContent content={contract.content} />
          </div>
        )}
      </div>

      {showFinalizeModal && (
        <Modal title="编辑定稿合同" onClose={() => setShowFinalizeModal(false)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">编辑合同正文后，点击「定稿并通知」将发送给发单方确认。支持 Markdown 格式。</p>
            <textarea value={finalizeContent} onChange={e => setFinalizeContent(e.target.value)} rows={12}
              placeholder="在此输入合同正文（支持 Markdown）…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowFinalizeModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleFinalize} disabled={acting}
                className="px-4 py-2 text-sm bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50">
                {acting ? "提交中…" : "定稿并通知发单方"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showUploadModal && (
        <Modal title="上传已签合同 PDF" onClose={() => setShowUploadModal(false)}>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">上传双方签署后的合同 PDF，上传后需求状态将进入执行中。</p>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
              <input type="file" accept=".pdf,.jpg,.png" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-slate-600" />
              {selectedFile && <p className="mt-2 text-xs text-slate-500">已选：{selectedFile.name}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
              <button onClick={handleUploadSigned} disabled={uploadingFile || !selectedFile}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50">
                {uploadingFile ? "上传中…" : "上传并标记已签"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AdminV2Layout>
  );
}
