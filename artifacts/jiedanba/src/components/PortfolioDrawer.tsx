import { useState, useRef, useCallback, useEffect } from "react";
import {
  X, Upload, Link2, Camera, Save, Trash2, CheckCircle2,
  AlertCircle, ChevronDown, Image as ImageIcon, Trophy,
} from "lucide-react";
import {
  useCreatePortfolio,
  useUpdatePortfolio,
  useDeletePortfolio,
  type Portfolio,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessToken } from "@/lib/auth";

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
  userId:        number;
  initial?:      Portfolio | null;
  currentLevel?: string;
}

/* ─── Component ──────────────────────────────── */

const LEVEL_OPTIONS = [
  { value: "C", label: "C 级 — 入门认证（有真实项目经验）" },
  { value: "B", label: "B 级 — 进阶认证（独立负责完整项目）" },
  { value: "A", label: "A 级 — 专家认证（行业标杆项目）" },
];

const LEVEL_STATUS_LABEL: Record<string, { text: string; color: string }> = {
  pending:    { text: "审核中",   color: "text-amber-600 bg-amber-50 border-amber-200" },
  approved:   { text: "认证通过", color: "text-green-700 bg-green-50 border-green-200" },
  downgraded: { text: "降级通过", color: "text-blue-700  bg-blue-50  border-blue-200"  },
  rejected:   { text: "未通过",   color: "text-red-600   bg-red-50   border-red-200"   },
};

export function PortfolioDrawer({ open, onClose, userId, initial, currentLevel }: PortfolioDrawerProps) {
  const [title,       setTitle]       = useState(initial?.title       ?? "");
  const [type,        setType]        = useState(initial?.type        ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [projectUrl,  setProjectUrl]  = useState(initial?.projectUrl  ?? "");
  const [coverImage,  setCoverImage]  = useState(initial?.coverImage  ?? "");
  const [imgMode,     setImgMode]     = useState<"upload" | "url">("upload");
  const [status,      setStatus]      = useState<"idle" | "saving" | "saved" | "error" | "deleting" | "confirmDelete">("idle");
  const [applyForLevel, setApplyForLevel] = useState(!!initial?.applyLevel);
  const [applyLevel,    setApplyLevel]    = useState<string>(initial?.applyLevel ?? "C");

  const [categories, setCategories] = useState<Array<{id: number; name: string}>>([]);
  useEffect(() => {
    fetch(`${_API_BASE}/api/cat-categories`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setCategories(d); })
      .catch(() => {});
  }, []);

  const [trackCerts, setTrackCerts] = useState<Array<{cat_category_id: number; level: string}>>([]);
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch(`${_API_BASE}/api/opc/track-certs`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (Array.isArray(d)) setTrackCerts(d); })
      .catch(() => {});
  }, [userId]);

  const fileRef = useRef<HTMLInputElement>(null);
  const qc      = useQueryClient();

  const { mutateAsync: create } = useCreatePortfolio();
  const { mutateAsync: update } = useUpdatePortfolio();
  const { mutateAsync: remove } = useDeletePortfolio();

  /* Derived: level already held for the CURRENTLY selected track */
  const LEVEL_ORDER = ["C", "B", "A"] as const;
  const computedCatIdLive     = categories.find(c => c.name === type)?.id ?? null;
  const trackCurrentLevel     = computedCatIdLive
    ? (trackCerts.find(tc => tc.cat_category_id === computedCatIdLive)?.level ?? null)
    : null;
  const trackCurrentLevelIdx  = trackCurrentLevel ? LEVEL_ORDER.indexOf(trackCurrentLevel as typeof LEVEL_ORDER[number]) : -1;
  /* Only show levels strictly higher than what user already holds for this track */
  const availableLevelOptions = LEVEL_OPTIONS.filter(
    o => LEVEL_ORDER.indexOf(o.value as typeof LEVEL_ORDER[number]) > trackCurrentLevelIdx
  );

  /* If OPC has already reached max (A) for this track, or already holds exact target, block apply */
  const alreadyAtMaxForTrack = !!type && availableLevelOptions.length === 0;

  /* Auto-uncheck when track changes to one where no higher level is possible */
  useEffect(() => {
    if (!open) return;
    if (applyForLevel && alreadyAtMaxForTrack) {
      setApplyForLevel(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, trackCerts, open]);

  /* Reset form when initial changes (opening for different item) */
  useEffect(() => {
    if (open) {
      setTitle(initial?.title       ?? "");
      setType(initial?.type         ?? "");
      setDescription(initial?.description ?? "");
      setProjectUrl(initial?.projectUrl   ?? "");
      setCoverImage(initial?.coverImage   ?? "");
      setStatus("idle");
      setApplyForLevel(!!initial?.applyLevel);
      setApplyLevel(initial?.applyLevel ?? "C");
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
    const computedCatId = categories.find(c => c.name === type)?.id ?? null;
    if (applyForLevel && !computedCatId) {
      alert("申请赛道认证时请先选择项目类型");
      return;
    }
    if (applyForLevel && alreadyAtMaxForTrack) {
      alert(`您在「${type}」赛道已持有最高等级（A级·专家）认证，无需再次申请。`);
      return;
    }
    if (applyForLevel && trackCurrentLevel) {
      const applyIdx   = LEVEL_ORDER.indexOf(applyLevel as typeof LEVEL_ORDER[number]);
      const currentIdx = LEVEL_ORDER.indexOf(trackCurrentLevel as typeof LEVEL_ORDER[number]);
      if (applyIdx <= currentIdx) {
        const LEVEL_NAME: Record<string, string> = { A: "A级·专家", B: "B级·进阶", C: "C级·基础" };
        alert(`您在「${type}」赛道已持有 ${LEVEL_NAME[trackCurrentLevel] ?? trackCurrentLevel} 认证，只能申请更高等级，不能重复申请相同等级。`);
        return;
      }
    }
    setStatus("saving");
    const payload = {
      title:         title.trim(),
      type,
      description:   description.trim(),
      coverImage:    coverImage || undefined,
      projectUrl:    projectUrl.trim() || undefined,
      applyLevel:    applyForLevel ? applyLevel : null,
      catCategoryId: applyForLevel && computedCatId ? computedCatId : null,
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

            {/* ── 等级认证申请（紧跟项目类型） ── */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-gradient-to-br from-amber-50/60 to-orange-50/40">
              <div className="flex items-center justify-between mb-2">
                <label className={`flex items-center gap-2 select-none ${alreadyAtMaxForTrack ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={applyForLevel}
                    onChange={e => setApplyForLevel(e.target.checked)}
                    className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
                    disabled={initial?.levelApplyStatus === "pending" || alreadyAtMaxForTrack}
                  />
                  <span className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                    <Trophy size={14} className="text-amber-500" />
                    用此作品申请OPC等级认证
                  </span>
                </label>
                {initial?.levelApplyStatus && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${LEVEL_STATUS_LABEL[initial.levelApplyStatus]?.color}`}>
                    {LEVEL_STATUS_LABEL[initial.levelApplyStatus]?.text}
                  </span>
                )}
              </div>
              {alreadyAtMaxForTrack && (
                <p className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 size={12} className="shrink-0" />
                  您在「{type}」赛道已持有最高等级（A级·专家）认证，无需再次申请。
                </p>
              )}

              {initial?.levelApplyStatus === "pending" && (
                <p className="text-[11px] text-amber-600 bg-amber-100 rounded-lg px-3 py-2 mb-2">
                  等级申请已提交，等待平台专家评审中。评审期间无法修改等级，但可更新作品内容。
                </p>
              )}

              {applyForLevel && initial?.levelApplyStatus !== "pending" && (
                <div className="mt-2 space-y-3">
                  {type && (
                    <p className="text-[11px] text-amber-700 bg-amber-100/70 rounded-lg px-3 py-1.5">
                      赛道：<strong>{type}</strong>（与项目类型一致）
                    </p>
                  )}
                  <div>
                    <label className="text-[11px] font-semibold text-amber-700 block mb-1.5">申请等级</label>
                    {availableLevelOptions.length > 0 ? (
                      <select
                        value={availableLevelOptions.some(o => o.value === applyLevel) ? applyLevel : availableLevelOptions[0].value}
                        onChange={e => setApplyLevel(e.target.value)}
                        className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-amber-300 outline-none">
                        {availableLevelOptions.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        ℹ️ 您在「{type}」赛道已达最高等级（A级·专家），无需再次申请。
                      </p>
                    )}
                  </div>
                  {trackCurrentLevel && availableLevelOptions.length > 0 && (() => {
                    const LEVEL_NAME: Record<string, string> = { A: "A级·专家", B: "B级·进阶", C: "C级·基础" };
                    return (
                      <p className="text-[11px] text-slate-500">
                        您在此赛道当前等级：{LEVEL_NAME[trackCurrentLevel] ?? trackCurrentLevel}，只能申请更高等级。
                      </p>
                    );
                  })()}
                  {!trackCurrentLevel && (
                    <p className="text-[11px] text-slate-500">保存后将自动发起等级申请，由平台专家在5个工作日内评审。</p>
                  )}
                </div>
              )}

              {initial?.levelApplyNote && (
                <div className="mt-2 bg-white/70 border border-slate-200 rounded-xl px-3 py-2.5">
                  <p className="text-[11px] font-bold text-slate-500 mb-0.5">评审意见</p>
                  <p className="text-sm text-slate-700">{initial.levelApplyNote}</p>
                </div>
              )}
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
