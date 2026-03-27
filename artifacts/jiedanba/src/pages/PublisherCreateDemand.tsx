import { useCurrentUser } from "@/hooks/use-current-user";
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  Search, Bell, Plus, Trash2, AlertCircle,
  CheckCircle2, ChevronRight, Info, Zap, Upload, X,
} from "lucide-react";
import { useCreateDemand, useUpdateDemand, useUpdateDemandStatus, useGetDemandById, useGetOpcLeaderboard } from "@workspace/api-client-react";
import { PublisherSidebar } from "@/components/publisher/PublisherSidebar";
import { PublisherHeaderUser } from '@/components/publisher/PublisherHeaderUser';
import { useToast } from "@/hooks/use-toast";

/* ─── Constants ───────────────────────────────── */

const DEMAND_TYPES = [
  { value: "ai_education",    label: "AI教育课程开发" },
  { value: "gov_training",    label: "政企AI培训" },
  { value: "ai_research",     label: "AI研学项目" },
  { value: "party_building",  label: "党建AI应用" },
  { value: "livestream_media",label: "直播与新媒体" },
  { value: "ai_tool_dev",     label: "AI工具开发定制" },
  { value: "other",           label: "其他" },
];

const SKILL_TAGS_OPTIONS = [
  "PPT设计", "视频剪辑", "AI应用开发", "Vibe Coding", "提示词工程",
  "教案设计", "文案撰写", "直播运营", "短视频制作", "数据处理",
  "Web开发", "小程序开发", "Python编程", "图文设计", "品牌策划",
];

const OPC_LEVELS = [
  { value: "any", label: "不限", desc: "任意等级OPC均可申请" },
  { value: "C",   label: "C级 · 新手", desc: "500-3,000元任务" },
  { value: "B",   label: "B级 · 进阶", desc: "3,000-20,000元任务" },
  { value: "A",   label: "A级 · 专家", desc: "20,000-200,000元任务" },
];

interface Milestone {
  name: string;
  deadline: string;
  deliverableDesc: string;
}

/* ─── FormField wrapper ───────────────────────── */

function FormField({
  label, required, hint, error, children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-bold text-blue-900">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

/* ─── Tag selector ────────────────────────────── */

function TagSelector({
  options,
  selected,
  onChange,
  max,
}: {
  options: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
  max?: number;
}) {
  const toggle = (tag: string) => {
    if (selected.includes(tag)) {
      onChange(selected.filter(t => t !== tag));
    } else if (!max || selected.length < max) {
      onChange([...selected, tag]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(tag => (
        <button
          key={tag}
          type="button"
          onClick={() => toggle(tag)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            selected.includes(tag)
              ? "bg-primary text-white shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary"
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

/* ─── Section wrapper ─────────────────────────── */

function AttachmentLinkInput({ onAdd }: { onAdd: (name: string, url: string) => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const handleAdd = () => {
    const n = name.trim(), u = url.trim();
    if (!n || !u) return;
    try { new URL(u); } catch { return; }
    onAdd(n, u);
    setName(""); setUrl("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="文件名称（如：需求说明.pdf）"
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="粘贴文件链接 (https://...)"
          className="flex-[2] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!name.trim() || !url.trim()}
          className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
        >
          添加
        </button>
      </div>
      <p className="text-xs text-slate-400">支持飞书文档、Google Drive、百度网盘等任意可访问链接</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8">
      <div className="mb-6">
        <h2 className="text-lg font-extrabold text-blue-900 font-display">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

/* ─── Main page ───────────────────────────────── */

export default function PublisherCreateDemand() {
  const [, navigate] = useLocation();
  const { nickname } = useCurrentUser();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id && params.id !== "new";
  const editId = isEdit ? parseInt(params.id!, 10) : undefined;

  const { toast } = useToast();
  const { data: existingDemand } = useGetDemandById(editId ?? 0, { query: { enabled: isEdit && !!editId } });
  const { data: opcLeaderboard } = useGetOpcLeaderboard({ limit: 20 });
  const createDemand = useCreateDemand();
  const updateDemand = useUpdateDemand();
  const updateStatus = useUpdateDemandStatus();

  /* ── Form state ── */
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [opcLevel, setOpcLevel] = useState("any");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [deadline, setDeadline] = useState("");
  const [mode, setMode] = useState<"open" | "directed">("open");
  const [bidDeadline, setBidDeadline] = useState("");
  const [directedOpcIds, setDirectedOpcIds] = useState<number[]>([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [attachments, setAttachments] = useState<{ name: string; size: string; type: string; url: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const minDeadlineDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  })();

  /* ── Load existing demand for edit ── */
  useEffect(() => {
    if (existingDemand) {
      setTitle(existingDemand.title ?? "");
      setType(existingDemand.type ?? "");
      setDescription(existingDemand.description ?? "");
      setSkillTags((existingDemand.skillTags as string[]) ?? []);
      setOpcLevel(existingDemand.opcLevel ?? "any");
      setBudgetMin(String(existingDemand.budgetMin ?? ""));
      setBudgetMax(String(existingDemand.budgetMax ?? ""));
      setDeadline(existingDemand.deadline ? String(existingDemand.deadline).split("T")[0] : "");
      setMode((existingDemand.mode as "open" | "directed") ?? "open");
      setBidDeadline(existingDemand.bidDeadline ? String(existingDemand.bidDeadline).split("T")[0] : "");
      setIsUrgent(existingDemand.isUrgent ?? false);
      const ms = (existingDemand.milestones as any[]) ?? [];
      setMilestones(ms.map(m => ({ name: m.name ?? "", deadline: m.deadline ?? "", deliverableDesc: m.deliverableDesc ?? "" })));
      setAttachments((existingDemand.attachments as any[]) ?? []);
    }
  }, [existingDemand]);

  /* ── Validation ── */
  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "请填写需求标题";
    else if (title.length > 50) e.title = "标题不能超过50字";
    if (!type) e.type = "请选择需求类型";
    if (!description.trim()) e.description = "请填写需求描述";
    if (skillTags.length === 0) e.skillTags = "请至少选择一个技能标签";
    if (!budgetMin || !budgetMax) e.budget = "请填写预算范围";
    else if (Number(budgetMin) >= Number(budgetMax)) e.budget = "预算最小值须小于最大值";
    if (!deadline) e.deadline = "请选择交付截止日期";
    else if (deadline < minDeadlineDate) e.deadline = "截止日期须至少在今天3天后";
    if (mode === "open" && !bidDeadline) e.bidDeadline = "公开抢单模式须设置抢单截止时间";
    if (mode === "directed" && directedOpcIds.length === 0) e.directedOpcIds = "定向派单模式须选择目标OPC";
    milestones.forEach((m, i) => {
      if (!m.name.trim()) e[`ms_name_${i}`] = "里程碑名称不能为空";
      if (!m.deadline) e[`ms_deadline_${i}`] = "里程碑截止日期不能为空";
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Milestone helpers ── */
  const addMilestone = () => setMilestones(prev => [...prev, { name: "", deadline: "", deliverableDesc: "" }]);
  const removeMilestone = (i: number) => setMilestones(prev => prev.filter((_, idx) => idx !== i));
  const updateMilestone = (i: number, field: keyof Milestone, value: string) => {
    setMilestones(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };

  /* ── OPC toggle for directed mode ── */
  const toggleDirectedOpc = (id: number) => {
    setDirectedOpcIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  /* ── Submit ── */
  const handleSubmit = async (asDraft: boolean) => {
    if (!asDraft && !validate()) {
      // 滚动到顶部以便用户看到错误提示
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast({ title: "请检查表单", description: "请填写所有必填项后再提交", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        type: type as any,
        description: description.trim(),
        skillTags,
        opcLevel,
        budgetMin: Number(budgetMin),
        budgetMax: Number(budgetMax),
        deadline,
        mode: mode as any,
        isUrgent,
        bidDeadline: mode === "open" && bidDeadline ? bidDeadline : undefined,
        directedOpcIds: mode === "directed" ? directedOpcIds : [],
        milestones,
        attachments,
      };
      if (isEdit && editId) {
        await updateDemand.mutateAsync({ demandId: editId, data: payload });
        toast({ title: "需求已更新", description: "需求信息已保存成功" });
      } else {
        const created = await createDemand.mutateAsync({ data: payload });
        if (!asDraft && created?.id) {
          await updateStatus.mutateAsync({ demandId: created.id, data: { status: "pending_review" } });
        }
        toast({ title: asDraft ? "草稿已保存" : "需求已提交审核", description: asDraft ? "您可以随时回来继续编辑" : "平台将在24小时内完成审核" });
      }
      navigate("/publisher/demands");
    } catch {
      toast({ title: "提交失败", description: "请稍后重试", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("jdb_role");
    navigate("/login");
  };

  /* ── Render ── */
  return (
    <div className="flex min-h-screen bg-[#f9f9fc] text-[#1a1c1e]">
      <PublisherSidebar onLogout={logout} />

      <main className="flex-1 ml-64 min-h-screen">
        {/* Top bar */}
        <header className="fixed top-0 right-0 left-64 z-40 bg-white/80 backdrop-blur-md shadow-sm flex justify-between items-center px-8 py-3">
          <div className="flex items-center gap-2 text-sm">
            <span
              className="text-slate-400 hover:text-primary cursor-pointer font-medium"
              onClick={() => navigate("/publisher/demands")}
            >
              需求管理
            </span>
            <ChevronRight size={14} className="text-slate-300" />
            <span className="text-blue-900 font-bold">{isEdit ? "编辑需求" : "发布新需求"}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索需求 ID、人才…"
                className="w-full bg-slate-100 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
              />
            </div>
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
            </button>
            <PublisherHeaderUser onLogout={logout} />
          </div>
        </header>

        {/* Body */}
        <div className="pt-24 px-8 pb-20 max-w-[900px] mx-auto space-y-6">

          {/* Page title */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-blue-900 font-display tracking-tight">
                {isEdit ? "编辑需求" : "发布新需求"}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {isEdit
                  ? "修改需求信息，保存后进入重新审核流程"
                  : "填写需求信息，提交后将进入平台审核队列（24小时内完成）"}
              </p>
            </div>
            {isUrgent && (
              <span className="flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-bold px-3 py-1.5 rounded-full border border-red-200">
                <Zap size={12} /> 紧急需求
              </span>
            )}
          </div>

          {/* ── Section 1: 基本信息 ── */}
          <Section title="基本信息" subtitle="简洁清晰地描述您的需求">

            <FormField label="需求标题" required error={errors.title}
              hint={`${title.length}/50 字，简洁描述任务内容`}>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value.slice(0, 50))}
                placeholder="例如：AI赋能党建工作坊PPT课件开发"
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition ${
                  errors.title ? "border-destructive bg-red-50" : "border-slate-200 bg-white"
                }`}
              />
            </FormField>

            <FormField label="需求类型" required error={errors.type}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DEMAND_TYPES.map(dt => (
                  <button
                    key={dt.value}
                    type="button"
                    onClick={() => setType(dt.value)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                      type === dt.value
                        ? "border-primary bg-primary text-white shadow-sm"
                        : "border-slate-200 text-slate-600 hover:border-primary/30 hover:text-primary bg-white"
                    }`}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>
            </FormField>

            {/* Urgent toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                  <Zap size={16} className="text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-900">紧急标记</p>
                  <p className="text-xs text-slate-400">开启后需求将在抢单大厅置顶展示</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUrgent(prev => !prev)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                  isUrgent ? "bg-red-500" : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                    isUrgent ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </Section>

          {/* ── Section 2: 需求详情 ── */}
          <Section title="需求详情" subtitle="详细说明任务内容和交付要求">

            <FormField label="需求描述" required error={errors.description}
              hint="详细说明任务内容、交付标准、验收条件等">
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="请详细描述任务要求、工作内容、交付物规格、验收标准等…"
                rows={8}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none transition ${
                  errors.description ? "border-destructive bg-red-50" : "border-slate-200 bg-white"
                }`}
              />
            </FormField>

            <FormField label="需求技能标签" required error={errors.skillTags}
              hint="选择与任务相关的技能标签（可多选）">
              <TagSelector
                options={SKILL_TAGS_OPTIONS}
                selected={skillTags}
                onChange={setSkillTags}
              />
            </FormField>

          </Section>

          {/* ── Section 3: 匹配设置 ── */}
          <Section title="匹配设置" subtitle="设置OPC等级要求和派单模式">

            <FormField label="需求OPC等级" required>
              <div className="grid grid-cols-2 gap-3">
                {OPC_LEVELS.map(lvl => (
                  <button
                    key={lvl.value}
                    type="button"
                    onClick={() => setOpcLevel(lvl.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      opcLevel === lvl.value
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-primary/30 bg-white"
                    }`}
                  >
                    <p className={`text-sm font-bold ${opcLevel === lvl.value ? "text-primary" : "text-blue-900"}`}>
                      {lvl.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{lvl.desc}</p>
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="派单模式" required>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "open",     label: "公开抢单", desc: "所有符合等级要求的OPC均可申请" },
                  { value: "directed", label: "定向派单", desc: "直接邀约特定OPC承接任务" },
                ].map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMode(m.value as "open" | "directed")}
                    className={`p-5 rounded-xl border-2 text-left transition-all ${
                      mode === m.value
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-primary/30 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className={`text-sm font-extrabold ${mode === m.value ? "text-primary" : "text-blue-900"}`}>
                        {m.label}
                      </p>
                      {mode === m.value && <CheckCircle2 size={16} className="text-primary" />}
                    </div>
                    <p className="text-xs text-slate-400">{m.desc}</p>
                  </button>
                ))}
              </div>
            </FormField>

            {/* Open mode: bid deadline */}
            {mode === "open" && (
              <FormField label="抢单截止时间" required error={errors.bidDeadline}
                hint="OPC须在此时间前提交抢单申请">
                <input
                  type="datetime-local"
                  value={bidDeadline}
                  onChange={e => setBidDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition ${
                    errors.bidDeadline ? "border-destructive bg-red-50" : "border-slate-200 bg-white"
                  }`}
                />
              </FormField>
            )}

            {/* Directed mode: OPC selector */}
            {mode === "directed" && (
              <FormField label="定向邀约OPC" required error={errors.directedOpcIds}
                hint="从OPC生态池中选择目标OPC（48小时未响应自动转为公开抢单）">
                {opcLeaderboard && opcLeaderboard.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-200 rounded-xl p-3">
                    {opcLeaderboard.map(opc => {
                      const selected = directedOpcIds.includes(opc.id);
                      return (
                        <div
                          key={opc.id}
                          onClick={() => toggleDirectedOpc(opc.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                            selected ? "bg-primary/5 border border-primary/30" : "hover:bg-slate-50 border border-transparent"
                          }`}
                        >
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {(opc.nickname ?? "OC").slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-blue-900 truncate">{opc.nickname}</p>
                            <p className="text-xs text-slate-400">
                              {(opc as any).level === "A" ? "A级·专家" : (opc as any).level === "B" ? "B级·进阶" : "C级·新手"} &middot; 评分 {(opc as any).avgRating ?? "4.8"}
                            </p>
                          </div>
                          {selected && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
                    暂无可邀约的OPC
                  </div>
                )}
              </FormField>
            )}

          </Section>

          {/* ── Section 4: 预算与时间 ── */}
          <Section title="预算与时间" subtitle="设置项目预算范围和交付截止日期">

            <FormField label="预算范围（元）" required error={errors.budget}
              hint="设置合理的预算区间，吸引优质OPC">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">¥</span>
                  <input
                    type="number"
                    value={budgetMin}
                    onChange={e => setBudgetMin(e.target.value)}
                    placeholder="最低预算"
                    min={0}
                    className={`w-full border rounded-xl pl-8 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition ${
                      errors.budget ? "border-destructive bg-red-50" : "border-slate-200 bg-white"
                    }`}
                  />
                </div>
                <span className="text-slate-400 font-bold">—</span>
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">¥</span>
                  <input
                    type="number"
                    value={budgetMax}
                    onChange={e => setBudgetMax(e.target.value)}
                    placeholder="最高预算"
                    min={0}
                    className={`w-full border rounded-xl pl-8 pr-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition ${
                      errors.budget ? "border-destructive bg-red-50" : "border-slate-200 bg-white"
                    }`}
                  />
                </div>
              </div>
              {budgetMin && budgetMax && Number(budgetMin) < Number(budgetMax) && (
                <p className="text-xs text-secondary font-semibold mt-1.5 flex items-center gap-1">
                  <Info size={12} />
                  OPC实际到手：¥{Math.floor(Number(budgetMin) * 0.5).toLocaleString()} - ¥{Math.floor(Number(budgetMax) * 0.7).toLocaleString()}（50%-70%分成）
                </p>
              )}
            </FormField>

            <FormField label="交付截止日期" required error={errors.deadline}
              hint="不得早于今日起3天后">
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                min={minDeadlineDate}
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition ${
                  errors.deadline ? "border-destructive bg-red-50" : "border-slate-200 bg-white"
                }`}
              />
            </FormField>

          </Section>

          {/* ── Section 5: 里程碑（选填）── */}
          <Section title="里程碑节点" subtitle="选填：拆解项目执行阶段，便于过程管理和分期付款">

            {milestones.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-slate-400 text-sm mb-3">暂未添加里程碑节点</p>
                <button
                  type="button"
                  onClick={addMilestone}
                  className="inline-flex items-center gap-2 text-primary font-bold text-sm hover:underline"
                >
                  <Plus size={16} /> 添加第一个里程碑
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {milestones.map((ms, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-5 relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        {i + 1}
                      </div>
                      <p className="text-sm font-bold text-blue-900">阶段 {i + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeMilestone(i)}
                        className="ml-auto text-slate-400 hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">节点名称 <span className="text-destructive">*</span></label>
                        <input
                          type="text"
                          value={ms.name}
                          onChange={e => updateMilestone(i, "name", e.target.value)}
                          placeholder="如：需求分析与方案设计"
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition ${
                            errors[`ms_name_${i}`] ? "border-destructive bg-red-50" : "border-slate-200"
                          }`}
                        />
                        {errors[`ms_name_${i}`] && (
                          <p className="text-xs text-destructive mt-1">{errors[`ms_name_${i}`]}</p>
                        )}
                      </div>
                      <div className="col-span-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">节点截止日期 <span className="text-destructive">*</span></label>
                        <input
                          type="date"
                          value={ms.deadline}
                          onChange={e => updateMilestone(i, "deadline", e.target.value)}
                          min={minDeadlineDate}
                          max={deadline}
                          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition ${
                            errors[`ms_deadline_${i}`] ? "border-destructive bg-red-50" : "border-slate-200"
                          }`}
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5">交付物说明</label>
                        <input
                          type="text"
                          value={ms.deliverableDesc}
                          onChange={e => updateMilestone(i, "deliverableDesc", e.target.value)}
                          placeholder="描述本阶段需提交的具体交付物"
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addMilestone}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary/30 text-primary py-3 rounded-xl text-sm font-bold hover:border-primary/60 hover:bg-primary/5 transition-colors"
                >
                  <Plus size={16} /> 继续添加里程碑
                </button>
              </div>
            )}
          </Section>

          {/* ── Section 6: 参考材料（选填）── */}
          <Section title="参考材料 / 附件" subtitle="选填：填写参考资料链接（飞书文档、Google Drive、百度网盘等）">
            {attachments.length > 0 && (
              <div className="space-y-2 mb-4">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Upload size={14} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-blue-900 truncate">{att.name}</p>
                      <a href={att.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate block">{att.url}</a>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-400 hover:text-destructive transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <AttachmentLinkInput onAdd={(name, url) => setAttachments(prev => [...prev, { name, url, size: "外链", type: "link" }])} />
          </Section>

          {/* ── Tips ── */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
            <Info size={18} className="text-primary shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-bold mb-1">提交后流程说明</p>
              <ul className="text-xs text-blue-700 space-y-0.5 list-disc pl-4">
                <li>需求提交后进入「待审核」状态，平台运营团队将在24小时内完成审核</li>
                <li>审核通过后自动进入「已发布」状态，OPC可开始抢单</li>
                <li>定向派单邀约OPC后48小时未响应，自动转为公开抢单</li>
                <li>您可在「需求管理」页跟踪需求进展</li>
              </ul>
            </div>
          </div>

          {/* ── Action buttons ── */}
          <div className="flex items-center justify-between pt-4 pb-8 border-t border-slate-200">
            <button
              type="button"
              onClick={() => navigate("/publisher/demands")}
              className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              取消
            </button>
            <div className="flex gap-3">
              {!isEdit && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmit(true)}
                  className="px-6 py-3 rounded-xl text-sm font-bold border-2 border-primary text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  {saving ? "保存中…" : "保存草稿"}
                </button>
              )}
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSubmit(false)}
                className="px-8 py-3 rounded-xl text-sm font-bold bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? "提交中…" : isEdit ? "保存修改" : "提交审核"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
