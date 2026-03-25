import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import {
  Star, ChevronRight, ShieldCheck, BadgeCheck, Cpu, Bot, Globe, Lock,
  Pencil, X, Plus, Save, Camera, MapPin, Link2, Briefcase,
  Phone, MessageCircle, CheckCircle2, AlertCircle, Upload, ExternalLink,
} from "lucide-react";
import {
  useGetCurrentUser,
  useGetOpcProfile,
  useListPortfolios,
  useUpdateOpcProfile,
  type Portfolio,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { PortfolioDrawer, TYPE_LABEL } from "@/components/PortfolioDrawer";

/* ─── Static ─────────────────────────────────── */

const DEMAND_TYPE_LABELS: Record<string, string> = {
  ai_education:     "AI 教育",
  gov_training:     "政企培训",
  ai_research:      "AI 研究",
  ai_tool_dev:      "AI 工具开发",
  party_building:   "党建数字化",
  livestream_media: "直播媒体",
  other:            "综合",
};

const CERT_BY_LEVEL: Record<string, { label: string; detail: string; type: "done" | "current" | "locked" }[]> = {
  A: [
    { label: "A 级专家认证", detail: "2023 年 9 月解锁 · 高级 AI 系统架构", type: "current" },
    { label: "B 级进阶开发", detail: "2022 年 2 月解锁 · 云原生迁移专项",   type: "done" },
    { label: "C 级基础认证", detail: "2020 年 1 月解锁 · 系统集成入门",    type: "locked" },
  ],
  B: [
    { label: "B 级进阶开发", detail: "2022 年 2 月解锁 · 云原生迁移专项",   type: "current" },
    { label: "C 级基础认证", detail: "2020 年 1 月解锁 · 系统集成入门",    type: "done" },
  ],
  C: [
    { label: "C 级基础认证", detail: "2020 年 1 月解锁 · 系统集成入门",    type: "current" },
  ],
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
  const [form, setForm]       = useState<FormState>(initial);
  const [newSkill, setNewSkill] = useState("");
  const [status, setStatus]   = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [avatarPreview, setAvatarPreview] = useState(initial.avatar);
  const fileRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();
  const { mutateAsync: save } = useUpdateOpcProfile();

  /* reset when drawer opens */
  const openKey = open ? "open" : "closed";

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  /* ── File upload with canvas compression ── */
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("图片不能超过 10 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        /* Resize to max 600×600 and compress to JPEG */
        const MAX = 600;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else                 { width = Math.round(width * MAX / height);  height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.80);
        setAvatarPreview(compressed);
        set("avatar", compressed);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    /* Reset input so same file can be re-selected */
    e.target.value = "";
  }, []);

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
      await save({
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
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/users/me"] }),
        qc.invalidateQueries({ queryKey: [`/api/users/${userId}/opc-profile`] }),
      ]);
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
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">头像</label>
            <div className="flex items-center gap-5">
              {/* Preview */}
              <div className="relative shrink-0 cursor-pointer" onClick={() => fileRef.current?.click()}>
                <div className="w-20 h-20 rounded-2xl border-4 border-slate-100 overflow-hidden bg-primary/10 flex items-center justify-center">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black text-primary">{form.nickname?.[0] ?? "新"}</span>
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-md">
                  <Camera size={13} className="text-white" />
                </div>
              </div>

              {/* Upload area */}
              <div className="flex-1">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden" onChange={handleFileChange} />

                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 rounded-xl py-4 text-sm font-bold text-primary transition-colors"
                >
                  <Upload size={16} /> 点击上传图片
                </button>
                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  支持 JPG / PNG / WebP，最大 3 MB
                </p>
                {avatarPreview && (
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

/* ─── Page ─────────────────────────────────────── */

const PREVIEW_COUNT = 4;

export default function Profile() {
  const [editOpen,         setEditOpen]         = useState(false);
  const [portfolioDrawer,  setPortfolioDrawer]  = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<Portfolio | null>(null);

  const openAddPortfolio  = () => { setEditingPortfolio(null); setPortfolioDrawer(true); };
  const openEditPortfolio = (p: Portfolio) => { setEditingPortfolio(p); setPortfolioDrawer(true); };

  const { data: user }       = useGetCurrentUser();
  const { data: profile }    = useGetOpcProfile(user?.id ?? 1, { query: { enabled: !!user?.id } });
  const { data: portfolios } = useListPortfolios({ userId: user?.id ?? 1 }, { query: { enabled: !!user?.id } });

  const level    = profile?.level ?? "C";
  const certs    = CERT_BY_LEVEL[level] ?? CERT_BY_LEVEL["C"];
  const rating   = Number(profile?.avgRating ?? 0);
  const credits  = profile?.creditScore ?? 0;
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

  const formInitial: FormState = {
    nickname: name,
    title,
    bio,
    avatar,
    skills,
    location,
    website: website ?? "",
    yearsExp: yearsExp ?? 0,
    phone,
    wechat,
  };

  const reviewItems = portfolios?.filter(p => p.clientFeedback).slice(0, 2) ?? [];

  return (
    <>
      {user && (
        <EditDrawer
          open={editOpen}
          onClose={() => setEditOpen(false)}
          userId={user.id}
          initial={formInitial}
        />
      )}
      <PortfolioDrawer
        open={portfolioDrawer}
        onClose={() => setPortfolioDrawer(false)}
        userId={user?.id ?? 1}
        initial={editingPortfolio}
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
            <button onClick={() => setEditOpen(true)}
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
                <span className="inline-flex items-center gap-1 bg-secondary/15 text-secondary px-3 py-1 rounded-full text-xs font-bold">
                  <BadgeCheck size={12} />
                  Lv.{level} {level === "A" ? "专家认证" : level === "B" ? "进阶认证" : "基础认证"}
                </span>
                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                  <ShieldCheck size={12} /> 平台认证伙伴
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setEditOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-primary/30 text-primary text-sm font-bold rounded-xl hover:bg-primary/5 transition-colors">
                  <Pencil size={14} /> 编辑资料
                </button>
                <button className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 shadow-sm">
                  联系报价 <ChevronRight size={14} />
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
                { val: credits > 0 ? String(credits) : "—", label: "信用分" },
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
                <button onClick={() => setEditOpen(true)}
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
                <button onClick={() => setEditOpen(true)}
                  className="w-full text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 rounded-xl py-4 hover:border-primary/30 hover:text-primary transition-colors">
                  + 添加核心技能
                </button>
              )}
            </div>

            {/* Bio */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">职业简介</h3>
                <button onClick={() => setEditOpen(true)}
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

            {/* Certification */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">认证历史</h3>
              <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                {certs.map((cert, i) => (
                  <div key={i} className={`relative pl-8 ${cert.type === "locked" ? "opacity-50" : ""}`}>
                    <div className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white z-10 ${
                      cert.type === "current" ? "bg-secondary" : cert.type === "done" ? "bg-primary" : "bg-slate-400"
                    }`}>
                      <Star size={10} className="text-white fill-white" />
                    </div>
                    <p className="text-sm font-bold text-blue-900">{cert.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{cert.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Main 8-col */}
          <div className="col-span-12 lg:col-span-8 space-y-10">

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
                            <span className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider mb-3 inline-block">
                              {TYPE_LABEL[p.type] ?? p.type}
                            </span>
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
