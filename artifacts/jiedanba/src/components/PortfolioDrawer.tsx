import { useState, useRef, useCallback, useEffect } from "react";
import {
  X, Upload, Link2, Camera, Save, Trash2, CheckCircle2,
  AlertCircle, ChevronDown, Image as ImageIcon,
} from "lucide-react";
import {
  useCreatePortfolio,
  useUpdatePortfolio,
  useDeletePortfolio,
  type Portfolio,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

/* ─── Constants ──────────────────────────────── */

const _API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export const TYPE_LABEL: Record<string, string> = {
  education: "教育培训",
  software:  "软件开发",
  marketing: "营销",
  content:   "内容设计",
  other:     "其他",
};

/* ─── Image compression helper ──────────────── */

function compressImage(file: File, maxPx = 900, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
          else                { width = Math.round(width * maxPx / height);  height = maxPx; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ─── Props ──────────────────────────────────── */

interface PortfolioDrawerProps {
  open:          boolean;
  onClose:       () => void;
  initial?:      Portfolio | null;
}

/* ─── Component ──────────────────────────────── */

export function PortfolioDrawer({ open, onClose, initial }: PortfolioDrawerProps) {
  const [title,       setTitle]       = useState(initial?.title       ?? "");
  const [type,        setType]        = useState(initial?.type        ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [projectUrl,  setProjectUrl]  = useState(initial?.projectUrl  ?? "");
  const [coverImage,  setCoverImage]  = useState(initial?.coverImage  ?? "");
  const [imgMode,     setImgMode]     = useState<"upload" | "url">("upload");
  const [status,      setStatus]      = useState<"idle" | "saving" | "saved" | "error" | "deleting" | "confirmDelete">("idle");

  const [categories, setCategories] = useState<Array<{id: number; name: string}>>([]);
  useEffect(() => {
    fetch(`${_API_BASE}/api/cat-categories`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setCategories(d); })
      .catch(() => {});
  }, []);

  const fileRef = useRef<HTMLInputElement>(null);
  const qc      = useQueryClient();

  const { mutateAsync: create } = useCreatePortfolio();
  const { mutateAsync: update } = useUpdatePortfolio();
  const { mutateAsync: remove } = useDeletePortfolio();

  /* Reset form when initial changes (opening for different item) */
  useEffect(() => {
    if (open) {
      setTitle(initial?.title       ?? "");
      setType(initial?.type         ?? "");
      setDescription(initial?.description ?? "");
      setProjectUrl(initial?.projectUrl   ?? "");
      setCoverImage(initial?.coverImage   ?? "");
      setStatus("idle");
      /* Auto-detect mode from existing coverImage */
      if (initial?.coverImage?.startsWith("data:")) setImgMode("upload");
      else if (initial?.coverImage)                 setImgMode("url");
      else                                          setImgMode("upload");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id]);

  /* ── File upload ── */
  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("图片不能超过 10 MB"); return; }
    try {
      const compressed = await compressImage(file);
      setCoverImage(compressed);
    } catch { alert("图片处理失败，请重试"); }
    e.target.value = "";
  }, []);

  /* ── Save ── */
  const handleSave = async () => {
    if (!title.trim() || !description.trim()) {
      alert("请填写项目名称和简介");
      return;
    }
    setStatus("saving");
    const payload = {
      title:         title.trim(),
      type,
      description:   description.trim(),
      coverImage:    coverImage || undefined,
      projectUrl:    projectUrl.trim() || undefined,
    };
    try {
      if (initial?.id) {
        await update({ portfolioId: initial.id, data: payload });
      } else {
        await create({ data: payload });
      }
      await qc.invalidateQueries({ queryKey: ["/api/portfolios"] });
      setStatus("saved");
      setTimeout(() => { setStatus("idle"); onClose(); }, 700);
    } catch (err: unknown) {
      const apiMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? (err as { message?: string })?.message;
      if (apiMsg && typeof apiMsg === "string" && apiMsg.includes("已持有")) {
        setStatus("idle");
        alert(apiMsg);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 2500);
      }
    }
  };

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!initial?.id) return;
    setStatus("deleting");
    try {
      await remove({ portfolioId: initial.id });
      await qc.invalidateQueries({ queryKey: ["/api/portfolios"] });
      onClose();
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2500);
    }
  };

  if (!open) return null;

  const isEditing = !!initial?.id;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-xl h-full bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-blue-900 font-display">
              {isEditing ? "编辑案例" : "添加案例"}
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">完善的案例信息更容易获得发单方信赖</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">

          {/* ── 封面图 ── */}
          <section>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">封面图</label>
            {/* Preview */}
            {coverImage && (
              <div className="relative mb-3 rounded-xl overflow-hidden h-44 bg-slate-100">
                <img src={coverImage} alt="cover" className="w-full h-full object-cover" />
                <button
                  onClick={() => setCoverImage("")}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-lg px-2 py-1 text-[11px] font-bold hover:bg-black/70">
                  移除
                </button>
              </div>
            )}
            {!coverImage && (
              <div className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center bg-slate-50 mb-3">
                <ImageIcon size={32} className="text-slate-300" />
              </div>
            )}
            {/* Mode tabs */}
            <div className="flex gap-1 mb-3 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setImgMode("upload")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${imgMode === "upload" ? "bg-white shadow text-primary" : "text-slate-500"}`}>
                <Camera size={12} className="inline mr-1" />上传图片
              </button>
              <button
                onClick={() => setImgMode("url")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${imgMode === "url" ? "bg-white shadow text-primary" : "text-slate-500"}`}>
                <Link2 size={12} className="inline mr-1" />输入链接
              </button>
            </div>
            {imgMode === "upload" ? (
              <>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 rounded-xl py-3 text-sm font-bold text-primary transition-colors">
                  <Upload size={16} /> 点击上传
                </button>
                <p className="text-[11px] text-slate-400 text-center mt-1.5">JPG / PNG / WebP，最大 10 MB，自动压缩</p>
              </>
            ) : (
              <input type="url" value={imgMode === "url" && !coverImage?.startsWith("data:") ? coverImage : ""}
                onChange={e => setCoverImage(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
            )}
          </section>

          {/* ── 基本信息 ── */}
          <section className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">项目名称 *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                placeholder="例：海创元政企 AI 培训平台开发"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                <span className="flex items-center gap-1"><ChevronDown size={12} />项目类型 *</span>
              </label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none bg-white appearance-none">
                {categories.length === 0 && <option value="">加载中…</option>}
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

          </section>

          {/* ── 项目简介 ── */}
          <section>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">项目简介 *</label>
            <textarea rows={5} value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="描述项目背景、您的贡献、最终成果与客户反馈…"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none leading-relaxed" />
            <p className="text-right text-[10px] text-slate-400 mt-1">{description.length} 字</p>
          </section>

          {/* ── 项目链接 ── */}
          <section>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">
              <Link2 size={11} className="inline mr-1" />项目链接 / 演示地址（可选）
            </label>
            <input type="url" value={projectUrl} onChange={e => setProjectUrl(e.target.value)}
              placeholder="https://demo.yourproject.com"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
          </section>

          {/* ── Delete confirm ── */}
          {isEditing && status === "confirmDelete" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-bold text-red-700 mb-3">确认删除这个案例？此操作不可撤销。</p>
              <div className="flex gap-2">
                <button onClick={() => setStatus("idle")}
                  className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50">
                  取消
                </button>
                <button onClick={handleDelete}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700">
                  确认删除
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-slate-100 shrink-0 bg-white space-y-2">
          {isEditing && status !== "confirmDelete" && (
            <button
              onClick={() => setStatus("confirmDelete")}
              className="w-full py-2.5 flex items-center justify-center gap-2 text-sm font-bold text-destructive hover:bg-red-50 rounded-xl transition-colors">
              <Trash2 size={15} /> 删除此案例
            </button>
          )}
          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={status === "saving" || status === "deleting"}
              className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                status === "saved"  ? "bg-secondary text-white" :
                status === "error"  ? "bg-destructive text-white" :
                status === "saving" ? "bg-primary/70 text-white cursor-not-allowed" :
                "bg-primary text-white hover:bg-primary/90"
              }`}>
              {status === "saving" ? "保存中…" :
               status === "saved"  ? <><CheckCircle2 size={16} />已保存</> :
               status === "error"  ? <><AlertCircle size={16} />失败，请重试</> :
               <><Save size={16} />{isEditing ? "保存修改" : "添加案例"}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
