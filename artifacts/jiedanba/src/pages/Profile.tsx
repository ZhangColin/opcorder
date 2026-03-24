import { useState } from "react";
import {
  Star, ChevronRight, ShieldCheck, BadgeCheck, Cpu, Bot, Globe, Lock,
  Pencil, X, Plus, Save, Camera, MapPin, Link2, Briefcase,
  Phone, MessageCircle, CheckCircle2, AlertCircle,
} from "lucide-react";
import { useGetCurrentUser, useGetOpcProfile, useListPortfolios } from "@workspace/api-client-react";
import { useProfile, DEFAULT_PROFILE } from "@/contexts/ProfileContext";

/* ─── Static data ─────────────────────────────── */

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
const PORTFOLIO_GRAD = [
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

/* ─── Sub-components ──────────────────────────── */

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
  const pct = value / max;
  const offset = circ * (1 - pct);
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

/* ─── Avatar component ─────────────────────────── */

function AvatarDisplay({ avatar, name, size = "lg" }: { avatar: string; name: string; size?: "sm" | "lg" }) {
  const dim  = size === "lg" ? "w-36 h-36" : "w-9 h-9";
  const font = size === "lg" ? "text-5xl font-black" : "text-sm font-bold";

  if (avatar) {
    return (
      <img src={avatar} alt={name}
        className={`${dim} rounded-2xl border-4 border-white shadow-xl object-cover`} />
    );
  }
  return (
    <div className={`${dim} rounded-2xl border-4 border-white shadow-xl bg-primary/10 flex items-center justify-center`}>
      <span className={`${font} text-primary`}>{name?.[0] ?? "新"}</span>
    </div>
  );
}

/* ─── New-user banner ─────────────────────────── */

function NewUserBanner({ onEdit }: { onEdit: () => void }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
      <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
        <AlertCircle size={18} className="text-amber-600" />
      </div>
      <div className="flex-1">
        <p className="font-bold text-amber-800 text-sm">欢迎加入接单吧！请完善您的个人资料</p>
        <p className="text-amber-700 text-xs mt-1 leading-relaxed">
          完整的职业简介、头像和核心技能标签能显著提升您的接单成功率。
        </p>
      </div>
      <button
        onClick={onEdit}
        className="shrink-0 px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors"
      >
        立即完善
      </button>
    </div>
  );
}

/* ─── Edit Modal ─────────────────────────────── */

interface EditModalProps {
  open: boolean;
  onClose: () => void;
}

function EditModal({ open, onClose }: EditModalProps) {
  const { profile, updateProfile } = useProfile();

  const [form, setForm] = useState({ ...profile });
  const [newSkill, setNewSkill] = useState("");
  const [avatarMode, setAvatarMode] = useState<"url" | "initial">(profile.avatar ? "url" : "initial");
  const [saved, setSaved] = useState(false);

  const set = (k: keyof typeof form, v: unknown) => setForm(prev => ({ ...prev, [k]: v }));

  const addSkill = (tag: string) => {
    const t = tag.trim();
    if (t && !form.skills.includes(t) && form.skills.length < 12) {
      set("skills", [...form.skills, t]);
    }
    setNewSkill("");
  };

  const removeSkill = (tag: string) =>
    set("skills", form.skills.filter(s => s !== tag));

  const handleSave = () => {
    updateProfile(form);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative ml-auto w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-xl font-extrabold text-blue-900 font-display">编辑个人资料</h2>
            <p className="text-slate-500 text-xs mt-0.5">修改后将同步显示在个人中心与导航栏</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body – scrollable */}
        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-7">

          {/* ── 头像 ── */}
          <section>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">头像</label>
            <div className="flex items-center gap-5">
              {/* Preview */}
              <div className="relative shrink-0">
                {form.avatar ? (
                  <img src={form.avatar} alt="preview"
                    className="w-20 h-20 rounded-2xl object-cover border-4 border-slate-100" />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 border-4 border-slate-100 flex items-center justify-center">
                    <span className="text-3xl font-black text-primary">{form.name?.[0] ?? "新"}</span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <Camera size={12} className="text-white" />
                </div>
              </div>

              {/* Tabs + input */}
              <div className="flex-1">
                <div className="flex gap-2 mb-3">
                  {(["url", "initial"] as const).map(m => (
                    <button key={m} onClick={() => setAvatarMode(m)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                        avatarMode === m ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                      }`}>
                      {m === "url" ? "图片链接" : "使用首字母"}
                    </button>
                  ))}
                </div>
                {avatarMode === "url" ? (
                  <input
                    type="url"
                    placeholder="https://example.com/avatar.jpg"
                    value={form.avatar}
                    onChange={e => set("avatar", e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                ) : (
                  <p className="text-xs text-slate-400">将使用您姓名的首个字符作为头像</p>
                )}
                {avatarMode === "initial" && (
                  <button onClick={() => set("avatar", "")}
                    className="mt-2 text-xs font-bold text-destructive hover:underline">
                    清除头像图片
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
              <input type="text" value={form.name} onChange={e => set("name", e.target.value)}
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
            <textarea
              rows={4}
              value={form.bio}
              onChange={e => set("bio", e.target.value)}
              placeholder="介绍您的专业背景、擅长领域和代表性成就…"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none leading-relaxed"
            />
            <p className="text-right text-[10px] text-slate-400 mt-1">{form.bio.length} / 300</p>
          </section>

          {/* ── 核心技能 ── */}
          <section>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-3">
              核心技能 <span className="text-slate-400 font-normal">(最多 12 个)</span>
            </label>

            {/* Current tags */}
            <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
              {form.skills.map(tag => (
                <span key={tag}
                  className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold">
                  {tag}
                  <button onClick={() => removeSkill(tag)} className="hover:text-destructive transition-colors">
                    <X size={11} />
                  </button>
                </span>
              ))}
              {form.skills.length === 0 && (
                <span className="text-xs text-slate-400">尚未添加技能标签</span>
              )}
            </div>

            {/* Custom add */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newSkill}
                onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(newSkill); } }}
                placeholder="输入自定义技能后按回车"
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              />
              <button onClick={() => addSkill(newSkill)}
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
                <Plus size={16} />
              </button>
            </div>

            {/* Preset suggestions */}
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">常用技能快速添加</p>
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
        <div className="px-7 py-4 border-t border-slate-100 flex items-center gap-3 shrink-0 bg-white">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            取消
          </button>
          <button onClick={handleSave}
            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
              saved
                ? "bg-secondary text-white"
                : "bg-primary text-white hover:bg-primary/90"
            }`}>
            {saved ? <><CheckCircle2 size={16} />已保存</> : <><Save size={16} />保存资料</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────── */

export default function Profile() {
  const { profile, isNew } = useProfile();
  const [editOpen, setEditOpen] = useState(false);

  const { data: user }       = useGetCurrentUser();
  const { data: apiProfile } = useGetOpcProfile(user?.id ?? 1, { query: { enabled: !!user?.id } });
  const { data: portfolios } = useListPortfolios({ userId: user?.id ?? 1 }, { query: { enabled: !!user?.id } });

  const level    = profile.level;
  const certs    = CERT_BY_LEVEL[level] ?? CERT_BY_LEVEL["C"];
  const rating   = Number(apiProfile?.avgRating ?? 4.9);
  const credits  = apiProfile?.creditScore ?? 100;
  const skills   = profile.skills.length > 0
    ? profile.skills
    : (apiProfile?.skillTags ?? ["AI 架构设计", "系统集成", "云原生", "大模型应用"]);

  const reviewItems = portfolios?.filter(p => p.clientFeedback).slice(0, 2) ?? [];

  return (
    <>
      <EditModal open={editOpen} onClose={() => setEditOpen(false)} />

      <div className="space-y-6">

        {/* New-user banner */}
        {isNew && <NewUserBanner onEdit={() => setEditOpen(true)} />}

        {/* ═══ Profile Header ═══ */}
        <section className="bg-white rounded-2xl overflow-hidden shadow-sm border border-border/40">
          {/* Cover */}
          <div className="h-44 bg-gradient-to-r from-primary to-[#0047ab] relative">
            <div className="absolute inset-0 opacity-10 pointer-events-none"
              style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
          </div>

          {/* Info row */}
          <div className="px-8 pb-8 flex flex-col md:flex-row items-end gap-6 -mt-14 relative z-10">
            {/* Avatar */}
            <AvatarDisplay avatar={profile.avatar} name={profile.name} size="lg" />

            {/* Name / badges / stats */}
            <div className="flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-3 mb-1">
                <h1 className="text-3xl font-extrabold text-primary font-display">{profile.name}</h1>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 bg-secondary/15 text-secondary px-3 py-1 rounded-full text-xs font-bold">
                    <BadgeCheck size={12} />
                    Lv.{level} {level === "A" ? "专家认证" : level === "B" ? "进阶认证" : "基础认证"}
                  </span>
                  <span className="inline-flex items-center gap-1 bg-[#4dffb2]/20 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold">
                    <ShieldCheck size={12} /> 平台认证伙伴
                  </span>
                </div>
              </div>

              <p className="text-slate-500 font-medium text-sm mb-1">{profile.title}</p>
              {(profile.location || profile.yearsExp > 0) && (
                <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
                  {profile.location && <span className="flex items-center gap-1"><MapPin size={11} />{profile.location}</span>}
                  {profile.yearsExp > 0 && <span className="flex items-center gap-1"><Briefcase size={11} />{profile.yearsExp} 年从业经验</span>}
                </div>
              )}
              <p className="text-muted-foreground font-medium text-base mb-4">{profile.bio}</p>

              <div className="flex gap-8 border-t border-border pt-4">
                <div>
                  <span className="block text-2xl font-bold text-primary">{portfolios?.length ?? 0}+</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">完成项目</span>
                </div>
                <div>
                  <span className="block text-2xl font-bold text-primary">{rating}/5.0</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">综合评分</span>
                </div>
                <div>
                  <span className="block text-2xl font-bold text-primary">{credits}</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">信用分</span>
                </div>
                <div>
                  <span className="block text-2xl font-bold text-primary">98%</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">按时交付率</span>
                </div>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="pb-1 shrink-0 flex flex-col gap-2">
              <button
                onClick={() => setEditOpen(true)}
                className="border border-primary text-primary px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/5 transition-all flex items-center gap-2"
              >
                <Pencil size={15} /> 编辑资料
              </button>
              <button className="bg-gradient-to-br from-primary to-[#0047ab] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:brightness-110 transition-all flex items-center gap-2">
                联系报价 <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </section>

        {/* ═══ Two-col layout ═══ */}
        <div className="grid grid-cols-12 gap-8 items-start">

          {/* Sidebar 4-col */}
          <aside className="col-span-12 lg:col-span-4 space-y-6">

            {/* Reputation gauge */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">信誉分析</h3>
              <div className="flex items-center gap-6">
                <CircleGauge value={rating} />
                <div>
                  <p className="font-bold text-lg text-primary">
                    {rating >= 4.8 ? "大师级信誉" : rating >= 4.5 ? "优秀口碑" : "良好信誉"}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                    平台前 2% 顶级 OPC，合规记录优秀，履约率高。
                  </p>
                </div>
              </div>
            </div>

            {/* Core Skills */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">核心技能</h3>
                <button onClick={() => setEditOpen(true)}
                  className="text-primary text-[10px] font-bold flex items-center gap-1 hover:underline">
                  <Pencil size={10} /> 编辑
                </button>
              </div>
              {skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {skills.map(tag => (
                    <span key={tag} className="bg-muted px-3 py-1.5 rounded-lg text-sm font-medium text-primary border border-border/50">
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
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">职业简介</h3>
                <button onClick={() => setEditOpen(true)}
                  className="text-primary text-[10px] font-bold flex items-center gap-1 hover:underline">
                  <Pencil size={10} /> 编辑
                </button>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{profile.bio}</p>
            </div>

            {/* Contact info (if filled) */}
            {(profile.website || profile.phone || profile.wechat) && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">联系方式</h3>
                <div className="space-y-3">
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                      <Link2 size={14} className="text-slate-400" /> {profile.website}
                    </a>
                  )}
                  {profile.phone && (
                    <p className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={14} className="text-slate-400" /> {profile.phone}
                    </p>
                  )}
                  {profile.wechat && (
                    <p className="flex items-center gap-2 text-sm text-slate-600">
                      <MessageCircle size={14} className="text-slate-400" /> {profile.wechat}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Certification Timeline */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/40">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6">认证历史</h3>
              <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
                {certs.map((cert, i) => (
                  <div key={i} className={`relative pl-8 ${cert.type === "locked" ? "opacity-50" : ""}`}>
                    <div className={`absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white z-10 ${
                      cert.type === "current" ? "bg-secondary" : cert.type === "done" ? "bg-primary" : "bg-muted-foreground/50"
                    }`}>
                      <Star size={10} className="text-white fill-white" />
                    </div>
                    <p className="text-sm font-bold text-foreground">{cert.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{cert.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* Main content 8-col */}
          <div className="col-span-12 lg:col-span-8 space-y-10">

            {/* Portfolio Gallery */}
            <section>
              <div className="flex justify-between items-end mb-6">
                <h2 className="text-2xl font-extrabold text-primary font-display">案例作品集</h2>
                <button className="text-secondary font-bold text-sm hover:underline flex items-center gap-1">
                  查看全部项目 <ChevronRight size={16} />
                </button>
              </div>

              {portfolios && portfolios.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {portfolios.map((p, idx) => {
                    const Icon = PORTFOLIO_ICONS[idx % PORTFOLIO_ICONS.length];
                    const grad = PORTFOLIO_GRAD[idx % PORTFOLIO_GRAD.length];
                    const typeLabel = DEMAND_TYPE_LABELS[p.type] ?? p.type;
                    return (
                      <div key={p.id}
                        className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border border-border/40">
                        <div className={`h-48 bg-gradient-to-br ${grad} flex items-center justify-center relative overflow-hidden`}>
                          {p.coverImage ? (
                            <img src={p.coverImage} alt={p.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <>
                              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
                              <Icon size={48} className="text-white/60 group-hover:scale-110 transition-transform duration-500" />
                            </>
                          )}
                        </div>
                        <div className="p-6">
                          <span className="bg-primary/10 text-primary px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider mb-3 inline-block">
                            {typeLabel}
                          </span>
                          <h3 className="text-lg font-bold text-foreground mb-2 font-display">{p.title}</h3>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{p.description}</p>
                          <a href={p.projectUrl ?? "#"}
                            className="inline-flex items-center text-primary font-bold text-sm gap-1 hover:gap-2 transition-all">
                            查看案例 <ChevronRight size={16} />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border-2 border-dashed border-border p-16 text-center">
                  <p className="text-muted-foreground font-medium">暂无作品，上传案例可大幅提升接单率</p>
                </div>
              )}
            </section>

            {/* Client Reviews */}
            {reviewItems.length > 0 && (
              <section>
                <h2 className="text-2xl font-extrabold text-primary mb-6 font-display">客户评价</h2>
                <div className="space-y-4">
                  {reviewItems.map((p, i) => {
                    const borderColors = ["border-secondary", "border-primary"];
                    const initials    = ["HT", "LZ"];
                    const bgColors    = ["bg-primary/10 text-primary", "bg-secondary/15 text-secondary"];
                    const reviewers   = ["海创元运营团队负责人", "政企培训客户代表"];
                    return (
                      <div key={p.id}
                        className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${borderColors[i % 2]} border border-border/40`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${bgColors[i % 2]}`}>
                              {initials[i % 2]}
                            </div>
                            <div>
                              <p className="font-bold text-foreground text-sm">{reviewers[i % 2]}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">已验证合作</p>
                            </div>
                          </div>
                          <StarRating rating={p.rating ?? 5} />
                        </div>
                        <p className="text-muted-foreground italic leading-relaxed text-sm">"{p.clientFeedback}"</p>
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
