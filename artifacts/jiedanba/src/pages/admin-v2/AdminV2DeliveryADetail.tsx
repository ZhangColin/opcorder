import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { Loader2, PackageCheck, Clock, CheckCircle2, XCircle, Link2, X, Pencil, Paperclip, Upload } from "lucide-react";
import { AdminV2Layout } from "@/components/admin-v2/AdminV2Layout";
import { v2Get, v2Post, uploadFile } from "@/lib/v2api";
import { DiscussionThread } from "@/components/pub/DiscussionThread";
import { useToast } from "@/hooks/use-toast";

interface DeliveryA {
  id: number;
  clientDemandId: number;
  title: string;
  url: string | null;
  content: string | null;
  attachments: Array<{ name: string; url: string }> | null;
  status: string;
  createdByNickname: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  demandTitle: string | null;
  demandNo: string | null;
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: "待确认", color: "bg-orange-100 text-orange-700", icon: Clock },
  confirmed: { label: "已确认", color: "bg-green-100 text-green-700",  icon: CheckCircle2 },
  rejected:  { label: "已驳回", color: "bg-red-100 text-red-700",      icon: XCircle },
  revision:  { label: "修改中", color: "bg-yellow-100 text-yellow-700", icon: Clock },
};

function EditModal({
  delivery,
  onClose,
  onSave,
  saving,
}: {
  delivery: DeliveryA;
  onClose: () => void;
  onSave: (data: { title: string; url: string; content: string; attachments: Array<{ name: string; url: string }> }) => void;
  saving: boolean;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle]   = useState(delivery.title);
  const [url, setUrl]       = useState(delivery.url ?? "");
  const [content, setContent] = useState(delivery.content ?? "");
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string }>>(
    delivery.attachments ?? []
  );
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(
        files.map(async f => {
          const fileUrl = await uploadFile(f);
          return { name: f.name, url: fileUrl };
        })
      );
      setAttachments(prev => [...prev, ...uploaded]);
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeAttachment = (idx: number) =>
    setAttachments(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-extrabold text-blue-900">编辑交付物</h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-slate-600" /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">标题</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">交付链接</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">交付说明</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wide">附件</label>
            {attachments.length > 0 && (
              <div className="mb-2 space-y-1.5">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                    <Paperclip size={13} className="text-slate-400 shrink-0" />
                    <a href={a.url} target="_blank" rel="noreferrer"
                      className="flex-1 text-sm text-primary truncate hover:underline">
                      {a.name}
                    </a>
                    <button type="button" onClick={() => removeAttachment(i)}
                      className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFileChange} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold border border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50 w-full justify-center">
              {uploading
                ? <><Loader2 size={13} className="animate-spin" />上传中…</>
                : <><Upload size={13} />点击上传附件</>}
            </button>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">取消</button>
          <button onClick={() => onSave({ title, url, content, attachments })}
            disabled={saving || uploading || !title.trim()}
            className="px-4 py-2 text-sm bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminV2DeliveryADetail({ inlineId }: { inlineId?: number } = {}) {
  const params = useParams<{ id: string }>();
  const id = inlineId ?? parseInt(params.id ?? "0", 10);
  const { toast } = useToast();

  const [delivery, setDelivery] = useState<DeliveryA | null>(null);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await v2Get<DeliveryA>(`/deliverables-a/${id}`);
      setDelivery(d);
    } catch {
      setDelivery(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id > 0) load(); }, [id]);

  const handleEdit = async (data: { title: string; url: string; content: string; attachments: Array<{ name: string; url: string }> }) => {
    setActing(true);
    try {
      await v2Post(`/deliverables-a/${id}/admin-edit`, data);
      toast({ title: "交付物已更新" });
      setShowEdit(false);
      await load();
    } catch (err: any) {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  if (loading) return <AdminV2Layout><div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-primary" /></div></AdminV2Layout>;
  if (!delivery) return <AdminV2Layout><div className="text-center py-16 text-slate-400">交付记录不存在</div></AdminV2Layout>;

  const cfg = STATUS_MAP[delivery.status] ?? { label: delivery.status, color: "bg-slate-100 text-slate-500", icon: Clock };
  const StatusIcon = cfg.icon;
  const isConfirmed = delivery.status === "confirmed";

  return (
    <>
      <AdminV2Layout
        title={delivery.title}
        actions={
          !isConfirmed ? (
            <button onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
              <Pencil size={14} /> 编辑交付物
            </button>
          ) : undefined
        }
      >
        <div className="mt-6 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <PackageCheck size={18} className="text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                {delivery.demandTitle && (
                  <p className="text-xs text-slate-500 mb-0.5">
                    {delivery.demandTitle}{delivery.demandNo && ` · ${delivery.demandNo}`}
                  </p>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                    <StatusIcon size={11} /> {cfg.label}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">#{delivery.id}</span>
                </div>
                <h2 className="text-lg font-extrabold text-blue-900 mb-1">{delivery.title}</h2>
                {delivery.content && (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{delivery.content}</p>
                )}
                {delivery.url && (
                  <a href={delivery.url} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5">
                    <Link2 size={12} /> 交付链接
                  </a>
                )}
                {delivery.attachments && delivery.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {delivery.attachments.map((a, i) => (
                      <a key={i} href={a.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-primary border border-primary/20 rounded-lg px-2.5 py-1 hover:bg-primary/5">
                        <Paperclip size={11} /> {a.name}
                      </a>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                  <Clock size={11} /> {new Date(delivery.createdAt).toLocaleString("zh-CN")}
                  {delivery.createdByNickname && <span>· 提交人：{delivery.createdByNickname}</span>}
                </p>
                {delivery.rejectedReason && (
                  <div className="mt-3 bg-red-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-red-600 mb-0.5">驳回原因</p>
                    <p className="text-sm text-red-700">{delivery.rejectedReason}</p>
                  </div>
                )}
                {isConfirmed && delivery.confirmedAt && (
                  <div className="mt-3 bg-green-50 rounded-xl p-3">
                    <p className="text-xs font-bold text-green-600">
                      发单方已于 {new Date(delivery.confirmedAt).toLocaleString("zh-CN")} 确认交付
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">沟通记录</h3>
            <DiscussionThread parentType="deliverable_a" parentId={id} placeholder="回复发单方…" />
          </div>
        </div>
      </AdminV2Layout>

      {showEdit && delivery && (
        <EditModal
          delivery={delivery}
          onClose={() => setShowEdit(false)}
          onSave={handleEdit}
          saving={acting}
        />
      )}
    </>
  );
}
