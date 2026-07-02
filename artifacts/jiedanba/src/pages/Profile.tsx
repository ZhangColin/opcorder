import { useState, useRef, useCallback, useEffect } from "react";
import { getAccessToken } from "@/lib/auth";
import { Link, useSearch, useLocation } from "wouter";
import {
  Star, ChevronRight, ShieldCheck, BadgeCheck, Cpu, Bot, Globe, Lock,
  Pencil, X, Plus, Save, Camera, MapPin, Link2, Briefcase,
  Phone, MessageCircle, CheckCircle2, AlertCircle, Upload, ExternalLink, Banknote,
  ZoomIn, ZoomOut, Crop, Loader2, Trophy, Medal,
} from "lucide-react";

import {
  useGetCurrentUser,
  useGetOpcProfile,
  useListPortfolios,
  useUpdateOpcProfile,
  type Portfolio,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PortfolioDrawer, TYPE_LABEL } from "@/components/PortfolioDrawer";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ─── Image Crop Modal ─────────────────────────── */
interface CropModalProps {
  src: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

function CropModal({ src, onConfirm, onCancel }: CropModalProps) {
  const [imgNatural, setImgNatural] = useState({ w: 1, h: 1 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  const CROP_SIZE = 280;
  const PADDING = 32;
  const MODAL_W = CROP_SIZE + PADDING * 2;

  const clampOffset = useCallback((ox: number, oy: number, sc: number, natW: number, natH: number) => {
    const rendW = natW * sc;
    const rendH = natH * sc;
    const maxX = Math.max(0, (rendW - CROP_SIZE) / 2);
    const maxY = Math.max(0, (rendH - CROP_SIZE) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    };
  }, []);

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: nw, naturalHeight: nh } = e.currentTarget;
    setImgNatural({ w: nw, h: nh });
    const initScale = Math.max(CROP_SIZE / nw, CROP_SIZE / nh);
    setScale(initScale);
    setOffset({ x: 0, y: 0 });
  };

  const changeScale = (delta: number) => {
    setScale(prev => {
      const minSc = Math.max(CROP_SIZE / imgNatural.w, CROP_SIZE / imgNatural.h);
      const next = Math.max(minSc, Math.min(prev + delta, minSc * 5));
      setOffset(o => clampOffset(o.x, o.y, next, imgNatural.w, imgNatural.h));
      return next;
    });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    changeScale(e.deltaY < 0 ? 0.08 : -0.08);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    setOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, scale, imgNatural.w, imgNatural.h));
  };
  const onMouseUp = () => { dragging.current = false; };

  const handleConfirm = () => {
    const canvas = document.createElement("canvas");
    const OUT = 512;
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      const rendW = imgNatural.w * scale;
      const rendH = imgNatural.h * scale;
      const imgLeft = (CROP_SIZE - rendW) / 2 + offset.x;
      const imgTop  = (CROP_SIZE - rendH) / 2 + offset.y;
      const ratio = OUT / CROP_SIZE;
      ctx.drawImage(img, imgLeft * ratio, imgTop * ratio, rendW * ratio, rendH * ratio);
      canvas.toBlob(blob => { if (blob) onConfirm(blob); }, "image/jpeg", 0.88);
    };
    img.src = src;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col" style={{ width: MODAL_W + "px" }}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <span className="font-bold text-slate-800 flex items-center gap-2"><Crop size={16} className="text-primary" />裁剪头像</span>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
        </div>
        <div className="px-8 py-5 flex flex-col items-center gap-4">
          <p className="text-xs text-slate-400">拖拽移动图片，滚轮缩放；裁剪区域为正方形</p>
          <div
            className="relative select-none overflow-hidden rounded-xl border-2 border-primary/40 cursor-move bg-slate-100"
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
          >
            <img
              src={src}
              alt="crop"
              draggable={false}
              onLoad={handleImgLoad}
              style={{
                position: "absolute",
                width: imgNatural.w * scale,
                height: imgNatural.h * scale,
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                userSelect: "none",
              }}
            />
            <div className="absolute inset-0 pointer-events-none border-2 border-white/60 rounded-xl" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => changeScale(-0.12)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
              <ZoomOut size={15} className="text-slate-600" />
            </button>
            <input
              type="range" min={0} max={100} step={1}
              value={Math.round(((scale - Math.max(CROP_SIZE / imgNatural.w, CROP_SIZE / imgNatural.h)) /
                (Math.max(CROP_SIZE / imgNatural.w, CROP_SIZE / imgNatural.h) * 4)) * 100)}
              onChange={e => {
                const minSc = Math.max(CROP_SIZE / imgNatural.w, CROP_SIZE / imgNatural.h);
                const next = minSc + (Number(e.target.value) / 100) * minSc * 4;
                setScale(next);
                setOffset(o => clampOffset(o.x, o.y, next, imgNatural.w, imgNatural.h));
              }}
              className="w-32 accent-primary"
            />
            <button onClick={() => changeScale(0.12)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
              <ZoomIn size={15} className="text-slate-600" />
            </button>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            取消
          </button>
          <button onClick={handleConfirm} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20">
            确认裁剪
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Static ─────────────────────────────────── */

const DEMAND_TYPE_LABELS: Record<string, string> = {
  education: "教育培训",
  software:  "软件开发",
  marketing: "营销",
  content:   "内容设计",
  other:     "其他",
};


const PORTFOLIO_ICONS = [Cpu, Bot, Globe, Lock];
const PORTFOLIO_GRAD  = [
  "from-blue-700 to-indigo-900",
  "from-emerald-700 to-teal-900",
  "from-violet-700 to-purple-900",
  "from-slate-600 to-blue-900",
];

const PRESET_SKILLS = [
  "AI 架构设计", "系统集成", "云原生", "大模型应用", "政企项目",
  "数据治理", "前端开发", "Python", "区块链", "安全合规",
  "运维自动化", "知识图谱", "RPA 流程", "VibeCoding",
];

/* ─── Shared components ─────────────────────── */

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={16}
          className={i <= Math.round(rating) ? "fill-secondary text-secondary" : "text-muted-foreground/30"} />
      ))}
    </div>
  );
}

function CircleGauge({ value, max = 5 }: { value: number; max?: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value / max);
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="transparent" stroke="currentColor" strokeWidth="8" className="text-muted/50" />
        <circle cx="48" cy="48" r={r} fill="transparent" stroke="currentColor" strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="text-secondary transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-black text-foreground">{value}</span>
      </div>
    </div>
  );
}

function AvatarCircle({ avatar, name, size = "lg" }: { avatar?: string | null; name: string; size?: "sm" | "lg" }) {
  const dim  = size === "lg" ? "w-32 h-32" : "w-9 h-9";
  const font = size === "lg" ? "text-5xl font-black" : "text-sm font-bold";
  const cls  = `${dim} rounded-2xl border-4 border-white shadow-xl overflow-hidden bg-primary/10 flex items-center justify-center`;
  return (
    <div className={cls}>
      {avatar ? (
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span className={`${font} text-primary`}>{name?.[0] ?? "新"}</span>
      )}
    </div>
  );
}

/* ─── Edit Drawer ────────────────────────────── */

interface FormState {
  nickname:  string;
  title:     string;
  bio:       string;
  avatar:    string;
  skills:    string[];
  location:  string;
  website:   string;
  yearsExp:  number;
  phone:     string;
  wechat:    string;
}

interface EditDrawerProps {
  open:    boolean;
  onClose: () => void;
  userId:  number;
  initial: FormState;
}

function EditDrawer({ open, onClose, userId, initial }: EditDrawerProps) {
  const [form, setForm]         = useState<FormState>(initial);
  const [newSkill, setNewSkill] = useState("");
  const [status, setStatus]     = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [avatarPreview, setAvatarPreview] = useState(initial.avatar);
  const [cropSrc, setCropSrc]   = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();
  const { mutateAsync: save } = useUpdateOpcProfile();

  /* Sync form with latest profile data every time the drawer opens */
  useEffect(() => {
    if (open) {
      setForm(initial);
      setAvatarPreview(initial.avatar);
      setStatus("idle");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const openKey = open ? "open" : "closed";

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  /* ── File selected → open crop modal ── */
  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (ev.target?.result) setCropSrc(ev.target.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  /* ── Crop confirmed → upload to storage ── */
  const handleCropConfirm = useCallback(async (blob: Blob) => {
    setCropSrc(null);
    setAvatarUploading(true);
    try {
      const reqRes = await fetch(`${API_BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() ?? ""}` },
        body: JSON.stringify({ name: "avatar.jpg", size: blob.size, contentType: "image/jpeg" }),
      });
      if (!reqRes.ok) throw new Error("获取上传地址失败");
      const { uploadURL, objectPath, sessionToken } = await reqRes.json();

      const putRes = await fetch(uploadURL, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
      if (!putRes.ok) throw new Error("头像上传失败");

      const verifyRes = await fetch(`${API_BASE}/api/storage/uploads/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() ?? ""}` },
        body: JSON.stringify({ sessionToken }),
      });
      if (!verifyRes.ok) throw new Error("头像验证失败");

      const avatarUrl = `${API_BASE}/api/storage${objectPath}`;
      setAvatarPreview(avatarUrl);
      set("avatar", avatarUrl);
    } finally {
      setAvatarUploading(false);
    }
  }, [userId]);

  /* ── Skills ── */
  const addSkill = (tag: string) => {
    const t = tag.trim();
    if (t && !form.skills.includes(t) && form.skills.length < 12) {
      set("skills", [...form.skills, t]);
    }
    setNewSkill("");
  };
  const removeSkill = (tag: string) =>
    set("skills", form.skills.filter(s => s !== tag));

  /* ── Save ── */
  const handleSave = async () => {
    setStatus("saving");
    try {
      const updatedProfile = await save({
        userId,
        data: {
          nickname:     form.nickname,
          avatar:       form.avatar || null,
          bio:          form.bio,
          skillTags:    form.skills,
          title:        form.title,
          location:     form.location,
          website:      form.website || null,
          yearsExp:     form.yearsExp,
          phone:        form.phone,
          wechat:       form.wechat,
        },
      });
      qc.setQueryData([`/api/users/${userId}/opc-profile`], updatedProfile);
      qc.invalidateQueries({ queryKey: ["/api/users/me"] });
      setStatus("saved");
      setTimeout(() => { setStatus("idle"); onClose(); }, 800);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" key={openKey}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-xl h-full bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-blue-900 font-display">编辑个人资料</h2>
            <p className="text-slate-400 text-xs mt-0.5">修改后实时同步至平台，所有人可见</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">

          {/* ── 头像 ── */}
          <section>
            {cropSrc && (
              <CropModal
                src={cropSrc}
                onConfirm={handleCropConfirm}
                onCancel={() => setCropSrc(null)}
              />
            )}
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">头像</label>
            <div className="flex items-center gap-5">
              {/* Preview */}
              <div
                className="relative shrink-0 cursor-pointer"
                onClick={() => !avatarUploading && fileRef.current?.click()}
              >
                <div className="w-20 h-20 rounded-2xl border-4 border-slate-100 overflow-hidden bg-primary/10 flex items-center justify-center">
                  {avatarUploading ? (
                    <Loader2 size={28} className="text-primary animate-spin" />
                  ) : avatarPreview ? (
                    <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black text-primary">{form.nickname?.[0] ?? "新"}</span>
                  )}
                </div>
                {!avatarUploading && (
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-md">
                    <Camera size={13} className="text-white" />
                  </div>
                )}
              </div>

              {/* Upload area */}
              <div className="flex-1">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden" onChange={handleFileSelected} />

                <button
                  onClick={() => !avatarUploading && fileRef.current?.click()}
                  disabled={avatarUploading}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 rounded-xl py-4 text-sm font-bold text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {avatarUploading
                    ? <><Loader2 size={16} className="animate-spin" />上传中…</>
                    : <><Upload size={16} />{avatarPreview ? "重新上传" : "点击上传图片"}</>
                  }
                </button>
                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  支持 JPG / PNG / WebP，上传后可裁剪
                </p>
                {avatarPreview && !avatarUploading && (
                  <button
                    onClick={() => { setAvatarPreview(""); set("avatar", ""); }}
                    className="mt-1.5 w-full text-center text-xs text-destructive hover:underline"
                  >
                    移除头像
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ── 基本信息 ── */}
          <section className="space-y-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">基本信息</label>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">显示姓名 *</label>
              <input type="text" value={form.nickname} onChange={e => set("nickname", e.target.value)}
                placeholder="张明远"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">职业头衔</label>
              <input type="text" value={form.title} onChange={e => set("title", e.target.value)}
                placeholder="AI 系统架构师"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  <MapPin size={11} className="inline mr-1" />所在城市
                </label>
                <input type="text" value={form.location} onChange={e => set("location", e.target.value)}
                  placeholder="北京"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  <Briefcase size={11} className="inline mr-1" />从业年限
                </label>
                <input type="number" min={0} max={40} value={form.yearsExp || ""}
                  onChange={e => set("yearsExp", Number(e.target.value))}
                  placeholder="5"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
            </div>
          </section>

          {/* ── 职业简介 ── */}
          <section>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">职业简介</label>
            <textarea rows={4} value={form.bio}
              onChange={e => set("bio", e.target.value)}
              placeholder="介绍您的专业背景、擅长领域和代表性成就…"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none leading-relaxed" />
            <p className="text-right text-[10px] text-slate-400 mt-1">{form.bio.length} / 500</p>
          </section>

          {/* ── 核心技能 ── */}
          <section>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">
              核心技能 <span className="text-slate-400 font-normal">(最多 12 个)</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
              {form.skills.map(tag => (
                <span key={tag} className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold">
                  {tag}
                  <button onClick={() => removeSkill(tag)} className="hover:text-destructive transition-colors">
                    <X size={11} />
                  </button>
                </span>
              ))}
              {form.skills.length === 0 && <span className="text-xs text-slate-400">尚未添加技能标签</span>}
            </div>
            <div className="flex gap-2 mb-3">
              <input type="text" value={newSkill} onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(newSkill); } }}
                placeholder="输入自定义技能后按回车"
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
              <button onClick={() => addSkill(newSkill)}
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90">
                <Plus size={16} />
              </button>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">快速添加常用技能</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_SKILLS.filter(s => !form.skills.includes(s)).map(s => (
                  <button key={s} onClick={() => addSkill(s)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-500 rounded-full text-[11px] font-medium transition-colors">
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ── 联系方式 ── */}
          <section className="space-y-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">联系方式</label>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                <Link2 size={11} className="inline mr-1" />个人网站 / 作品链接
              </label>
              <input type="url" value={form.website} onChange={e => set("website", e.target.value)}
                placeholder="https://your-portfolio.com"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  <Phone size={11} className="inline mr-1" />联系电话
                </label>
                <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}
                  placeholder="138 0000 0000"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  <MessageCircle size={11} className="inline mr-1" />微信号
                </label>
                <input type="text" value={form.wechat} onChange={e => set("wechat", e.target.value)}
                  placeholder="wechat_id"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-slate-100 flex gap-3 shrink-0 bg-white">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
            取消
          </button>
          <button onClick={handleSave} disabled={status === "saving"}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              status === "saved"  ? "bg-secondary text-white" :
              status === "error"  ? "bg-destructive text-white" :
              status === "saving" ? "bg-primary/70 text-white cursor-not-allowed" :
              "bg-primary text-white hover:bg-primary/90"
            }`}>
            {status === "saving" ? "保存中…" :
             status === "saved"  ? <><CheckCircle2 size={16} />已保存</> :
             status === "error"  ? "保存失败，请重试" :
             <><Save size={16} />保存资料</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Credit History sidebar widget ────────────── */

const CREDIT_ACTION_LABELS: Record<string, string> = {
  order_completed:   "订单完成",
  five_star_review:  "5星好评",
  bad_review:        "差评扣分",
  order_disputed:    "订单争议",
  manual_adjustment: "管理员调整",
};

interface CreditTx {
  id: number;
  delta: number;
  balance_after: number;
  action_type: string;
  ref_id: number | null;
  note: string | null;
  created_at: string;
}

function CreditHistory({ userId, creditPoints }: { userId?: number; creditPoints: number }) {
  const { data, isLoading } = useQuery<{ data: CreditTx[]; total: number }>({
    queryKey: ["credit-transactions-mine", userId],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/credit-transactions/mine?pageSize=10`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      return r.ok ? r.json() : { data: [], total: 0 };
    },
    enabled: !!userId,
  });

  const txs = data?.data ?? [];
  if (!isLoading && txs.length === 0 && creditPoints === 0) return null;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">信用积分</h3>
        <span className="text-lg font-extrabold text-blue-900">{creditPoints} 分</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-xs">加载中…</span>
        </div>
      ) : txs.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-2">暂无积分记录</p>
      ) : (
        <div className="space-y-2.5">
          {txs.map(tx => (
            <div key={tx.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">
                  {CREDIT_ACTION_LABELS[tx.action_type] ?? tx.action_type}
                </p>
                {tx.note && (
                  <p className="text-[11px] text-slate-400 truncate">{tx.note}</p>
                )}
                <p className="text-[10px] text-slate-300">{new Date(tx.created_at).toLocaleDateString("zh-CN")}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-sm font-bold ${tx.delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                  {tx.delta >= 0 ? "+" : ""}{tx.delta}
                </span>
                <p className="text-[10px] text-slate-400">余 {tx.balance_after}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────── */

const PREVIEW_COUNT = 4;

export default function Profile() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const [portfolioDrawer,  setPortfolioDrawer]  = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);

  /* Redirect ?edit=1 → /account-settings */
  useEffect(() => {
    if (new URLSearchParams(search).get("edit") === "1") {
      window.history.replaceState(null, "", window.location.pathname);
      navigate("/account-settings");
    }
  }, [search, navigate]);

  const openAddPortfolio  = () => { setEditingPortfolio(null); setPortfolioDrawer(true); };
  const openEditPortfolio = (p: Portfolio) => { setEditingPortfolio(p); setPortfolioDrawer(true); };

  const { data: user }       = useGetCurrentUser();
  const { data: profile }    = useGetOpcProfile(user?.id ?? 1, { query: { enabled: !!user?.id } });
  const { data: portfolios } = useListPortfolios({ userId: user?.id ?? 1 }, { query: { enabled: !!user?.id } });

  /* Auto-open portfolio drawer when navigated here with ?portfolio={id} */
  const [pendingPortfolioId, setPendingPortfolioId] = useState<number | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(search).get("portfolio");
    if (id) {
      setPendingPortfolioId(Number(id));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [search]);

  useEffect(() => {
    if (!pendingPortfolioId || !portfolios) return;
    const target = portfolios.find(p => p.id === pendingPortfolioId);
    if (target) {
      setEditingPortfolio(target);
      setPortfolioDrawer(true);
      setPendingPortfolioId(null);
    }
  }, [pendingPortfolioId, portfolios]);

  const level           = profile?.level ?? "C";
  const creditLevelName = (profile as any)?.creditLevelName as string | null ?? null;
  const creditLevelColor = (profile as any)?.creditLevelColor as string | null ?? null;
  const creditPoints    = (profile as any)?.creditPoints as number ?? 0;
  const rating          = Number(profile?.avgRating ?? 0);

  type RegistrationStatus = "registered" | "test_submitted" | "test_passed" | "test_failed" | "assignment_submitted" | "assignment_passed" | "assignment_failed";
  type Grade = "A" | "B" | "C" | "fail" | null;
  interface MyContest {
    id: number; contestId: number; trackId: number; status: RegistrationStatus;
    testGrade: Grade; assignmentGrade: Grade; createdAt: string;
    contestTitle: string | null; catName: string | null; catColorHex: string | null;
  }
  const CONTEST_STATUS: Record<RegistrationStatus, { label: string; cls: string }> = {
    registered:           { label: "已报名",     cls: "bg-blue-100 text-blue-700" },
    test_submitted:       { label: "测试已提交",  cls: "bg-amber-100 text-amber-700" },
    test_passed:          { label: "测试通过",    cls: "bg-emerald-100 text-emerald-700" },
    test_failed:          { label: "测试未通过",  cls: "bg-red-100 text-red-600" },
    assignment_submitted: { label: "测试单已提交", cls: "bg-violet-100 text-violet-700" },
    assignment_passed:    { label: "测试单通过",  cls: "bg-emerald-100 text-emerald-700" },
    assignment_failed:    { label: "测试单未通过", cls: "bg-red-100 text-red-600" },
  };
  const { data: myContests = [] } = useQuery<MyContest[]>({
    queryKey: ["my-contests", user?.id],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/contests/my`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      return r.ok ? r.json() : [];
    },
    enabled: !!user?.id,
  });

  const { data: trackCerts = [] } = useQuery<Array<{
    id: number; level: string; status: string; certified_at: string;
    cat_category_id: number; cat_category_name: string; cat_category_icon: string | null;
  }>>({
    queryKey: ["opc-track-certs", user?.id],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/opc/track-certs`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      return r.ok ? r.json() : [];
    },
    enabled: !!user?.id,
  });

  const skills   = profile?.skillTags ?? [];

  const name    = profile?.nickname ?? user?.nickname ?? "新用户";
  const avatar  = profile?.avatar ?? user?.avatar ?? "";
  const title   = profile?.title ?? "OPC 超级个体";
  const bio     = profile?.bio ?? "尚未填写职业简介，完善资料有助于获得更多项目机会。";
  const location = profile?.location ?? "";
  const yearsExp = profile?.yearsExp ?? 0;
  const website  = profile?.website ?? "";
  const phone    = profile?.phone ?? user?.phone ?? "";
  const wechat   = profile?.wechat ?? "";

  const isNew = !profile?.bio && !profile?.title && skills.length === 0;

  const reviewItems = portfolios?.filter(p => p.clientFeedback).slice(0, 2) ?? [];

  return (
    <>
      <PortfolioDrawer
        open={portfolioDrawer}
        onClose={() => setPortfolioDrawer(false)}
        userId={user?.id ?? 1}
        initial={editingPortfolio}
        currentLevel={profile?.level}
      />

      <div className="space-y-6">

        {/* New-user reminder */}
        {isNew && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <AlertCircle size={18} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-800 text-sm">欢迎加入接单吧！请完善您的个人资料</p>
              <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                完整的头像、职业简介和技能标签能显著提升接单成功率。
              </p>
            </div>
            <button onClick={() => navigate("/account-settings")}
              className="shrink-0 px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600">
              立即完善
            </button>
          </div>
        )}

        {/* ═══ Profile Card ═══ */}
        <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-border/40">
          {/* Cover banner */}
          <div className="h-40 bg-gradient-to-r from-[#00327d] to-[#0047ab] relative">
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
          </div>

          {/* Body below cover */}
          <div className="px-8 pb-8 relative">
            {/* Avatar lifted over cover */}
            <div className="absolute -top-16 left-8">
              <AvatarCircle avatar={avatar} name={name} size="lg" />
            </div>

            {/* Row: badges + edit button — cleared past avatar */}
            <div className="flex items-start justify-between pt-20">
              <div className="flex flex-wrap gap-2">
                {creditLevelName ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: creditLevelColor ?? "#94a3b8" }}>
                    <BadgeCheck size={12} />
                    {creditLevelName}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-bold">
                    <BadgeCheck size={12} /> 新人 OPC
                  </span>
                )}
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                  <ShieldCheck size={12} /> 平台认证伙伴
                </span>
                {trackCerts.map(cert => {
                  const HERO_LEVEL_STYLE: Record<string, string> = {
                    A: "bg-amber-50 text-amber-700 border border-amber-200",
                    B: "bg-blue-50 text-blue-700 border border-blue-200",
                    C: "bg-emerald-50 text-emerald-700 border border-emerald-200",
                  };
                  const HERO_LEVEL_NAME: Record<string, string> = { A: "专家", B: "进阶", C: "基础" };
                  return (
                    <span key={cert.id} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${HERO_LEVEL_STYLE[cert.level] ?? "bg-slate-50 text-slate-600 border border-slate-200"}`}>
                      <Trophy size={11} />
                      {cert.cat_category_name} · {HERO_LEVEL_NAME[cert.level] ?? cert.level}级
                    </span>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => navigate("/account-settings")}
                  className="flex items-center gap-1.5 px-4 py-2 border border-primary/30 text-primary text-sm font-bold rounded-xl hover:bg-primary/5 transition-colors">
                  <Pencil size={14} /> 账户设置
                </button>
              </div>
            </div>

            {/* Name + title */}
            <div className="mt-4">
              <h1 className="text-3xl font-extrabold text-blue-900 font-display leading-tight">{name}</h1>
              <p className="text-slate-500 font-medium mt-1">{title}</p>
              {(location || yearsExp > 0) && (
                <div className="flex items-center gap-4 mt-2">
                  {location && (
                    <span className="flex items-center gap-1 text-sm text-slate-400">
                      <MapPin size={13} /> {location}
                    </span>
                  )}
                  {(yearsExp ?? 0) > 0 && (
                    <span className="flex items-center gap-1 text-sm text-slate-400">
                      <Briefcase size={13} /> {yearsExp} 年从业经验
                    </span>
                  )}
                </div>
              )}
              <p className="mt-3 text-slate-600 leading-relaxed">{bio}</p>
            </div>

            {/* Stats */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex gap-10">
              {[
                { val: `${portfolios?.length ?? 0}+`, label: "完成项目" },
                { val: rating > 0 ? `${rating}/5.0` : "暂无评分", label: "综合评分" },
                { val: creditPoints > 0 ? String(creditPoints) : "—", label: "信用积分" },
                { val: "98%", label: "按时交付率" },
              ].map(s => (
                <div key={s.label}>
                  <span className="block text-2xl font-bold text-blue-900">{s.val}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ Two-col layout ═══ */}
        <div className="grid grid-cols-12 gap-8 items-start">

          {/* Sidebar 4-col */}
          <aside className="col-span-12 lg:col-span-4 space-y-6">

            {/* Track Cert Records */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">赛道认证记录</h3>
              {trackCerts.length > 0 ? (
                <div className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                  {trackCerts.map((cert) => {
                    const LEVEL_COLOR: Record<string, string> = { A: "bg-amber-500", B: "bg-primary", C: "bg-secondary" };
                    const LEVEL_NAME:  Record<string, string> = { A: "A级·专家", B: "B级·进阶", C: "C级·基础" };
                    return (
                      <div key={cert.id} className="relative pl-8">
                        <div className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white z-10 ${LEVEL_COLOR[cert.level] ?? "bg-slate-400"}`}>
                          <Trophy size={10} className="text-white" />
                        </div>
                        <p className="text-sm font-bold text-blue-900">{cert.cat_category_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {LEVEL_NAME[cert.level] ?? `${cert.level}级`} · {new Date(cert.certified_at).toLocaleDateString("zh-CN")} 认证
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Trophy size={28} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">暂无赛道认证记录</p>
                  <p className="text-[11px] text-slate-300 mt-1">提交作品申请赛道认证，展示您的专业能力</p>
                </div>
              )}
            </div>

            {/* Reputation gauge */}
            {rating > 0 && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-5">信誉分析</h3>
                <div className="flex items-center gap-6">
                  <CircleGauge value={rating} />
                  <div>
                    <p className="font-bold text-lg text-blue-900">
                      {rating >= 4.8 ? "大师级信誉" : rating >= 4.5 ? "优秀口碑" : "良好信誉"}
                    </p>
                    <p className="text-sm text-slate-500 leading-relaxed mt-1">
                      平台前 2% 顶级 OPC，合规记录优秀，履约率高。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Skills */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">核心技能</h3>
                <button onClick={() => navigate("/account-settings")}
                  className="text-primary text-[10px] font-bold flex items-center gap-1 hover:underline">
                  <Pencil size={10} /> 编辑
                </button>
              </div>
              {skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {skills.map(tag => (
                    <span key={tag} className="bg-slate-100 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-900 border border-slate-200">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <button onClick={() => navigate("/account-settings")}
                  className="w-full text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-xl py-4 hover:border-primary/30 hover:text-primary transition-colors">
                  + 添加核心技能
                </button>
              )}
            </div>

            {/* Bio */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">职业简介</h3>
                <button onClick={() => navigate("/account-settings")}
                  className="text-primary text-[10px] font-bold flex items-center gap-1 hover:underline">
                  <Pencil size={10} /> 编辑
                </button>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed">{bio}</p>
            </div>

            {/* Contact */}
            {(website || phone || wechat) && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">联系方式</h3>
                <div className="space-y-3">
                  {website && (
                    <a href={website} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                      <Link2 size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">{website}</span>
                    </a>
                  )}
                  {phone && (
                    <p className="flex items-center gap-2 text-sm text-slate-700">
                      <Phone size={14} className="text-slate-400 shrink-0" /> {phone}
                    </p>
                  )}
                  {wechat && (
                    <p className="flex items-center gap-2 text-sm text-slate-700">
                      <MessageCircle size={14} className="text-slate-400 shrink-0" /> {wechat}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Credit Transactions History */}
            <CreditHistory userId={user?.id} creditPoints={creditPoints} />

            {/* Income quick link */}
            <Link
              href="/income"
              className="flex items-center justify-between gap-3 bg-white rounded-2xl p-5 shadow-sm border border-border/40 hover:border-secondary/40 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-secondary/10 flex items-center justify-center">
                  <Banknote size={18} className="text-secondary" />
                </div>
                <div>
                  <p className="font-bold text-blue-900 text-sm">收入结算</p>
                  <p className="text-xs text-slate-400">查看结算明细与待结算金额</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-slate-400 group-hover:text-secondary transition-colors" />
            </Link>
          </aside>

          {/* Main 8-col */}
          <div className="col-span-12 lg:col-span-8 space-y-10">

            {/* My Contests */}
            {myContests.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-extrabold text-blue-900 font-display">我的大赛</h2>
                  <Link href="/profile/contests"
                    className="text-secondary font-bold text-sm hover:underline flex items-center gap-1">
                    全部 <ChevronRight size={16} />
                  </Link>
                </div>
                <div className="space-y-4">
                  {myContests.slice(0, 3).map((c, i) => {
                    const borderColors = ["border-primary", "border-secondary", "border-violet-400"];
                    const statusCfg = CONTEST_STATUS[c.status];
                    return (
                      <Link key={c.id} href={`/profile/contests/${c.id}`}>
                        <div className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${borderColors[i % 3]} border border-border/40 hover:shadow-md transition-shadow`}>
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Trophy size={15} className="text-amber-500 shrink-0" />
                              <span className="font-bold text-blue-900 text-sm leading-snug">{c.contestTitle ?? "OPC 月度大赛"}</span>
                            </div>
                            <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusCfg.cls}`}>
                              {statusCfg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {c.catName && (
                              <span
                                className="px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white"
                                style={{ backgroundColor: c.catColorHex || "#6b7280" }}
                              >
                                {c.catName}
                              </span>
                            )}
                            {c.testGrade && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">
                                <Medal size={9} className="inline mr-0.5" />{c.testGrade} 级
                              </span>
                            )}
                            <span className="text-xs text-slate-400">
                              {new Date(c.createdAt).toLocaleDateString("zh-CN")}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Portfolio */}
            <section>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-blue-900 font-display">案例作品集</h2>
                  {(portfolios?.length ?? 0) > 0 && (
                    <p className="text-slate-400 text-sm mt-0.5">{portfolios?.length} 个案例</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(portfolios?.length ?? 0) > 0 && (
                    <Link href="/portfolios"
                      className="text-secondary font-bold text-sm hover:underline flex items-center gap-1">
                      查看全部 <ChevronRight size={16} />
                    </Link>
                  )}
                  <button onClick={openAddPortfolio}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 shadow-sm transition-colors">
                    <Plus size={14} /> 添加案例
                  </button>
                </div>
              </div>

              {portfolios && portfolios.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {portfolios.slice(0, PREVIEW_COUNT).map((p, idx) => {
                      const Icon = PORTFOLIO_ICONS[idx % PORTFOLIO_ICONS.length];
                      const grad = PORTFOLIO_GRAD[idx % PORTFOLIO_GRAD.length];
                      return (
                        <div key={p.id}
                          className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-border/40">
                          <div className={`h-44 bg-gradient-to-br ${grad} flex items-center justify-center relative overflow-hidden`}>
                            {p.coverImage ? (
                              <img src={p.coverImage} alt={p.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                              <>
                                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
                                <Icon size={44} className="text-white/60 group-hover:scale-110 transition-transform duration-500" />
                              </>
                            )}
                            {/* Edit overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <button
                                onClick={() => openEditPortfolio(p)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white text-blue-900 rounded-xl text-sm font-bold shadow-lg">
                                <Pencil size={13} /> 编辑
                              </button>
                            </div>
                          </div>
                          <div className="p-5">
                            <div className="flex items-center gap-2 flex-wrap mb-3">
                              <span className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider inline-block">
                                {TYPE_LABEL[p.type] ?? p.type}
                              </span>
                              {(p as any).catCategoryName && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                                  {(p as any).catCategoryName}
                                </span>
                              )}
                              {p.levelApplyStatus && (() => {
                                const lsMap: Record<string, { text: string; cls: string }> = {
                                  pending:    { text: "审核中",   cls: "bg-amber-100 text-amber-700 border-amber-200" },
                                  approved:   { text: "已通过",   cls: "bg-green-100 text-green-700 border-green-200" },
                                  downgraded: { text: "降级通过", cls: "bg-blue-100  text-blue-700  border-blue-200"  },
                                  rejected:   { text: "未通过",   cls: "bg-red-100   text-red-700   border-red-200"   },
                                };
                                const s = lsMap[p.levelApplyStatus];
                                return s ? (
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border ${s.cls}`}>
                                    <Trophy size={9} />{p.applyLevel} 级 · {s.text}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            <h3 className="text-base font-bold text-blue-900 mb-1.5 font-display leading-snug">{p.title}</h3>
                            <p className="text-sm text-slate-500 mb-3 line-clamp-2 leading-relaxed">{p.description}</p>
                            <div className="flex items-center justify-between">
                              {p.projectUrl ? (
                                <a href={p.projectUrl} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center text-primary font-bold text-sm gap-1 hover:underline">
                                  查看案例 <ExternalLink size={13} />
                                </a>
                              ) : <span />}
                              <button onClick={() => openEditPortfolio(p)}
                                className="text-slate-400 hover:text-primary transition-colors">
                                <Pencil size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {portfolios.length > PREVIEW_COUNT && (
                    <Link href="/portfolios"
                      className="mt-4 flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-bold text-slate-600 hover:border-primary/40 hover:text-primary transition-all">
                      查看全部 {portfolios.length} 个案例 <ChevronRight size={16} />
                    </Link>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-border/40">
                    <div className="h-44 bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                      <Cpu size={44} className="text-slate-400" />
                    </div>
                    <div className="p-5">
                      <span className="bg-slate-100 text-slate-400 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider mb-3 inline-block">
                        暂无类型
                      </span>
                      <h3 className="text-base font-bold text-slate-400 mb-1.5 font-display">尚未上传案例，请尽快更新</h3>
                      <p className="text-sm text-slate-300 mb-3">添加您的项目案例，让发单方了解您的能力</p>
                      <button onClick={openAddPortfolio}
                        className="inline-flex items-center text-primary font-bold text-sm gap-1 hover:underline">
                        <Plus size={14} /> 立即添加
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Reviews */}
            {reviewItems.length > 0 && (
              <section>
                <h2 className="text-2xl font-extrabold text-blue-900 mb-6 font-display">客户评价</h2>
                <div className="space-y-4">
                  {reviewItems.map((p, i) => {
                    const borderColors = ["border-secondary", "border-primary"];
                    const initials     = ["HT", "LZ"];
                    const bgColors     = ["bg-primary/10 text-primary", "bg-secondary/15 text-secondary"];
                    const reviewers    = ["海创元运营团队负责人", "政企培训客户代表"];
                    return (
                      <div key={p.id}
                        className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${borderColors[i % 2]} border border-border/40`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${bgColors[i % 2]}`}>
                              {initials[i % 2]}
                            </div>
                            <div>
                              <p className="font-bold text-blue-900 text-sm">{reviewers[i % 2]}</p>
                              <p className="text-xs text-slate-400 mt-0.5">已验证合作</p>
                            </div>
                          </div>
                          <StarRating rating={p.rating ?? 5} />
                        </div>
                        <p className="text-slate-600 italic leading-relaxed text-sm">"{p.clientFeedback}"</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
