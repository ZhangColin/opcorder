import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { AlertCircle, Upload, X, Loader2, Zap, Bot } from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { v2Get, v2Post, v2Patch, uploadFile } from "@/lib/v2api";
import { useToast } from "@/hooks/use-toast";
import { AgentChatPanel, type FormSuggestion } from "@/components/agent/AgentChatPanel";
import { getValidAccessToken } from "@/lib/auth";

interface DemandType { id: number; code: string; name: string; }

interface Attachment { name: string; url: string; size?: string; type?: string; }

function FormField({ label, required, hint, error, children }: {
  label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5" {...(error ? { "data-error": "true" } : {})}>
      <label className="block text-sm font-bold text-blue-900">
        {label}{required && <span className="text-destructive ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
      {error && <p className="flex items-center gap-1 text-xs text-destructive"><AlertCircle size={12} />{error}</p>}
    </div>
  );
}

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function PubCreateDemand() {
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEdit = !!params.id && params.id !== "new";
  const editId = isEdit ? parseInt(params.id!, 10) : undefined;
  const { toast } = useToast();

  const [demandTypes, setDemandTypes] = useState<DemandType[]>([]);
  const [editStatus, setEditStatus] = useState<string>("draft");
  const [title, setTitle] = useState("");
  const [demandType, setDemandType] = useState("");
  const [isUrgent, setIsUrgent] = useState(false);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [hopeDeliveryDate, setHopeDeliveryDate] = useState("");
  const [detail, setDetail] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [sessionKey] = useState(() =>
    isEdit && editId ? `v2_pub_demand_${editId}` : `v2_pub_demand_new_${Date.now()}`
  );
  const agentConversationId = useRef<number | null>(null);

  const handleAgentFill = (suggestion: FormSuggestion) => {
    if (suggestion.title) setTitle(suggestion.title);
    if (suggestion.type) setDemandType(suggestion.type);
    if (suggestion.description) setDetail(suggestion.description);
    if (suggestion.budgetMin != null) setBudgetMin(String(suggestion.budgetMin));
    if (suggestion.budgetMax != null) setBudgetMax(String(suggestion.budgetMax));
    if (suggestion.deadline) setHopeDeliveryDate(suggestion.deadline);
    toast({ title: "AI建议已填入", description: "请检查并完善表单内容" });
  };

  useEffect(() => {
    fetch(`${BASE_URL}/api/cat-categories`)
      .then(r => r.ok ? r.json() : [])
      .then((data: DemandType[]) => setDemandTypes(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!editId) return;
    v2Get<any>(`/client-demands/${editId}`).then(d => {
      setTitle(d.title ?? "");
      setDemandType(d.demandType ?? "");
      setIsUrgent(d.isUrgent ?? false);
      setBudgetMin(d.budgetMin != null ? String(d.budgetMin) : "");
      setBudgetMax(d.budgetMax != null ? String(d.budgetMax) : "");
      setHopeDeliveryDate(d.hopeDeliveryDate ? String(d.hopeDeliveryDate).slice(0, 10) : "");
      setEditStatus(d.status ?? "draft");
      if (d.latestVersion) {
        setDetail(d.latestVersion.detail ?? "");
        setAttachments(d.latestVersion.attachments ?? []);
      }
    }).catch(() => {});
  }, [editId]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "请填写需求标题";
    else if (title.length > 80) e.title = "标题不超过80字";
    if (budgetMin && isNaN(Number(budgetMin))) e.budget = "预算格式不正确";
    if (budgetMax && isNaN(Number(budgetMax))) e.budget = "预算格式不正确";
    if (budgetMin && budgetMax && Number(budgetMin) > Number(budgetMax)) e.budget = "最高预算不能低于最低预算";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const url = await uploadFile(file);
        const size = file.size >= 1048576
          ? `${(file.size / 1048576).toFixed(1)}MB`
          : `${Math.max(1, Math.round(file.size / 1024))}KB`;
        setAttachments(prev => [...prev, { name: file.name, url, size, type: file.type }]);
      }
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleSave = async (asDraft: boolean) => {
    if (!asDraft && !validate()) {
      toast({ title: "请填写必填项", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        demandType: demandType || undefined,
        isUrgent,
        budgetMin: budgetMin ? Number(budgetMin) : undefined,
        budgetMax: budgetMax ? Number(budgetMax) : undefined,
        hopeDeliveryDate: hopeDeliveryDate || undefined,
      };

      let demandId = editId;
      if (isEdit && demandId) {
        await v2Patch(`/client-demands/${demandId}`, body);
        if (asDraft && detail.trim()) {
          await v2Post(`/client-demands/${demandId}/save-draft-detail`, { detail: detail.trim(), attachments }).catch(() => {});
        } else if (!asDraft && detail.trim()) {
          if (editStatus === "draft") {
            await v2Post(`/client-demands/${demandId}/submit`, { detail: detail.trim(), attachments });
          } else {
            await v2Post(`/client-demands/${demandId}/update-detail`, { detail: detail.trim(), attachments });
          }
        }
      } else {
        const created = await v2Post<{ id: number }>("/client-demands", body);
        demandId = created.id;
        if (agentConversationId.current) {
          try {
            const token = await getValidAccessToken(BASE_URL);
            const bindRes = await fetch(`${BASE_URL}/api/agent/demand-analysis/bind-demand`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
              body: JSON.stringify({ conversationId: agentConversationId.current, demandId }),
            });
            if (!bindRes.ok) console.warn("[AgentBind] bind-demand failed:", bindRes.status, await bindRes.text().catch(() => ""));
          } catch (bindErr) { console.warn("[AgentBind] bind-demand error:", bindErr); }
        }
        if (asDraft && detail.trim()) {
          await v2Post(`/client-demands/${demandId}/save-draft-detail`, { detail: detail.trim(), attachments }).catch(() => {});
        } else if (!asDraft && detail.trim()) {
          await v2Post(`/client-demands/${demandId}/submit`, { detail: detail.trim(), attachments });
        }
      }

      toast({ title: asDraft ? "草稿已保存" : "需求已提交，运营方将与您确认详情" });
      navigate(`/pub/demands/${demandId}`);
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <PubLayout
      title={isEdit ? "编辑需求" : "发布新需求"}
      backHref="/pub/demands"
      backLabel="需求列表"
    >
      <div className="mt-6 space-y-5">
        {/* AI Agent entrance */}
        <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <Bot size={18} className="text-violet-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-violet-800">需求分析助手</p>
            <p className="text-xs text-violet-600 mt-0.5">通过 AI 对话引导，精准描述您的需求，获得更准确的报价</p>
          </div>
          <button
            onClick={() => setAgentOpen(true)}
            className="shrink-0 text-xs bg-violet-600 text-white rounded-lg px-3 py-1.5 font-bold hover:bg-violet-700 transition-colors"
          >
            开始对话
          </button>
        </div>

        <AgentChatPanel
          open={agentOpen}
          onClose={() => setAgentOpen(false)}
          sessionKey={sessionKey}
          demandId={editId}
          sceneKey="v2_demand_analysis"
          onFillForm={handleAgentFill}
          onConversationId={id => { agentConversationId.current = id; }}
        />

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
          <FormField label="需求标题" required error={errors.title}>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="一句话概括您的需求，如：为教育产品制作3支宣传短视频"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="需求类型">
              <select
                value={demandType}
                onChange={e => setDemandType(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                <option value="">请选择（可选）</option>
                {demandTypes.map(t => <option key={t.id} value={t.code}>{t.name}</option>)}
              </select>
            </FormField>

            <FormField label="希望交付日期">
              <input
                type="date"
                value={hopeDeliveryDate}
                onChange={e => setHopeDeliveryDate(e.target.value)}
                min={today}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="预算区间" hint="填写您的心理预期，运营方会据此报价" error={errors.budget}>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                  <input
                    type="number"
                    value={budgetMin}
                    onChange={e => setBudgetMin(e.target.value)}
                    placeholder="最低"
                    className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <span className="text-slate-300 shrink-0">–</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                  <input
                    type="number"
                    value={budgetMax}
                    onChange={e => setBudgetMax(e.target.value)}
                    placeholder="最高"
                    className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
            </FormField>

            <FormField label="是否紧急">
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <button
                  type="button"
                  onClick={() => setIsUrgent(v => !v)}
                  className={`w-11 h-6 rounded-full transition-colors relative ${isUrgent ? "bg-red-500" : "bg-slate-200"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isUrgent ? "translate-x-5" : ""}`} />
                </button>
                <span className="text-sm text-slate-600 flex items-center gap-1">
                  {isUrgent && <Zap size={14} className="text-red-500" />}
                  {isUrgent ? "紧急需求（优先处理）" : "普通需求"}
                </span>
              </label>
            </FormField>
          </div>

          <FormField label="需求详情" hint="详细描述您的需求背景、具体要求、参考案例等">
            <MarkdownEditor value={detail} onChange={setDetail} placeholder="请详细描述您的需求…" />
          </FormField>

          <FormField label="附件">
            <div className="space-y-3">
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 text-sm">
                      <span className="flex-1 truncate text-slate-700">{a.name}</span>
                      {a.size && <span className="text-xs text-slate-400 shrink-0">{a.size}</span>}
                      <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl text-sm font-medium text-primary hover:bg-blue-100 transition-colors cursor-pointer justify-center">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? "上传中…" : "点击上传附件"}
                <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>
          </FormField>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            保存草稿
          </button>
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "保存并提交更新" : "提交需求"}
          </button>
        </div>
      </div>
    </PubLayout>
  );
}
