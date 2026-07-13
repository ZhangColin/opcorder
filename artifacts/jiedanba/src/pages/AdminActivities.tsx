import { useState, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  Plus, Loader2, Search, Edit2, Trash2, QrCode, Link2,
  ChevronLeft, X, FileText, Eye,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAccessToken } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getAdminHeaders() {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: getAdminHeaders() });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "请求失败"); }
  return res.json();
}

async function adminPost<T = unknown>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: getAdminHeaders(), body: JSON.stringify(body) });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "操作失败"); }
  return res.json();
}

async function adminPut<T = unknown>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "PUT", headers: getAdminHeaders(), body: JSON.stringify(body) });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "更新失败"); }
  return res.json();
}

async function adminPatch(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, { method: "PATCH", headers: getAdminHeaders(), body: JSON.stringify(body) });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "操作失败"); }
  return res.json();
}

async function adminDelete(path: string) {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", headers: getAdminHeaders() });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "删除失败"); }
  return res.json();
}

/* ─── Types ──────────────────────────────────────── */

type FieldType = "text" | "textarea" | "select" | "radio" | "checkbox";

type ActivityField = {
  id: number;
  label: string;
  fieldType: FieldType;
  isRequired: boolean;
  options: string[];
  sortOrder: number;
};

type Activity = {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  status: "draft" | "active" | "ended";
  registrationCount: number;
  createdAt: string;
  fields?: ActivityField[];
};

type RegistrationItem = {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  organization: string | null;
  extraData: Record<string, string | string[]>;
  adminNote: string | null;
  tags: string[];
  createdAt: string;
};

type FormField = {
  label: string;
  fieldType: FieldType;
  isRequired: boolean;
  options: string[];
};

/* ─── Beijing time helpers ───────────────────────── */

function utcToBeijingLocal(isoString: string): string {
  const bjMs = new Date(isoString).getTime() + 8 * 60 * 60 * 1000;
  return new Date(bjMs).toISOString().slice(0, 16);
}

function beijingLocalToUtc(localValue: string): string {
  return new Date(localValue + ":00+08:00").toISOString();
}

/* ─── Status display helper ──────────────────────── */

const STATUS_MAP = {
  draft:  { label: "草稿", cls: "bg-slate-100 text-slate-500" },
  active: { label: "进行中", cls: "bg-green-50 text-green-600" },
  ended:  { label: "已结束", cls: "bg-red-50 text-red-500" },
} as const;

function getStatusDisplay(status: Activity["status"]) {
  return STATUS_MAP[status] ?? { label: status, cls: "bg-slate-100 text-slate-500" };
}

/* ─── Pagination ─────────────────────────────────── */

function Pagination({ page, pageSize, total, onPage }: {
  page: number; pageSize: number; total: number; onPage: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages: number[] = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) pages.push(i);
  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <span className="text-xs text-slate-400">共 <b className="text-slate-600">{total}</b> 条，第 <b className="text-slate-600">{page}</b>/<b className="text-slate-600">{totalPages}</b> 页</span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40">‹</button>
        {pages.map(p => (
          <button key={p} onClick={() => onPage(p)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${p === page ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{p}</button>
        ))}
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40">›</button>
      </div>
    </div>
  );
}

/* ─── QR Code Modal ──────────────────────────────── */

function QrModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-8 shadow-xl max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-blue-900">扫码报名</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="flex flex-col items-center gap-4">
          <QRCodeSVG value={url} size={200} />
          <p className="text-sm font-semibold text-blue-900 text-center">{title}</p>
          <p className="text-xs text-slate-400 text-center break-all">{url}</p>
          <button
            onClick={() => { navigator.clipboard.writeText(url); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200"
          >
            <Link2 size={13} /> 复制链接
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Activity Form Modal ────────────────────────── */

function ActivityFormModal({
  activity,
  onClose,
  onSaved,
}: {
  activity?: Activity & { fields?: ActivityField[] };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [title, setTitle] = useState(activity?.title ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [location, setLocation] = useState(activity?.location ?? "");
  const [startTime, setStartTime] = useState(
    activity?.startTime ? utcToBeijingLocal(activity.startTime) : ""
  );
  const [endTime, setEndTime] = useState(
    activity?.endTime ? utcToBeijingLocal(activity.endTime) : ""
  );
  const [fields, setFields] = useState<FormField[]>(
    activity?.fields?.map(f => ({
      label: f.label,
      fieldType: f.fieldType,
      isRequired: f.isRequired,
      options: f.options ?? [],
    })) ?? []
  );
  const [saving, setSaving] = useState(false);

  function addField() {
    setFields(prev => [...prev, { label: "", fieldType: "text", isRequired: false, options: [] }]);
  }

  function updateField(i: number, patch: Partial<FormField>) {
    setFields(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  }

  function removeField(i: number) {
    setFields(prev => prev.filter((_, idx) => idx !== i));
  }

  function addOption(i: number) {
    setFields(prev => prev.map((f, idx) => idx === i ? { ...f, options: [...f.options, ""] } : f));
  }

  function updateOption(i: number, j: number, val: string) {
    setFields(prev => prev.map((f, idx) => idx === i ? {
      ...f,
      options: f.options.map((o, oidx) => oidx === j ? val : o),
    } : f));
  }

  function removeOption(i: number, j: number) {
    setFields(prev => prev.map((f, idx) => idx === i ? { ...f, options: f.options.filter((_, oidx) => oidx !== j) } : f));
  }

  async function handleSave() {
    if (!title.trim()) { toast({ title: "活动名称不能为空", variant: "destructive" }); return; }
    for (const f of fields) {
      if (!f.label.trim()) { toast({ title: "扩展字段名称不能为空", variant: "destructive" }); return; }
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startTime: startTime ? beijingLocalToUtc(startTime) : undefined,
        endTime: endTime ? beijingLocalToUtc(endTime) : undefined,
        fields: fields.map((f, i) => ({ ...f, sortOrder: i })),
      };

      if (activity) {
        await adminPut(`/api/admin/activities/${activity.id}`, payload);
        toast({ title: "活动已更新" });
      } else {
        await adminPost("/api/admin/activities", payload);
        toast({ title: "活动已创建" });
      }
      onSaved();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "保存失败", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const FIELD_TYPES: { value: FieldType; label: string }[] = [
    { value: "text", label: "单行文字" },
    { value: "textarea", label: "多行文字" },
    { value: "select", label: "下拉单选" },
    { value: "radio", label: "单选" },
    { value: "checkbox", label: "多选" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-blue-900">{activity ? "编辑活动" : "新建活动"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Basic info */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">活动名称 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="输入活动名称" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">活动简介</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="输入活动简介（选填）" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">活动地点</label>
            <input value={location} onChange={e => setLocation(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="输入活动地点（选填）" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">开始时间</label>
              <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">结束时间</label>
              <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          {/* Extension fields */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">自定义扩展字段</label>
              <button onClick={addField} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20">
                <Plus size={13} /> 添加字段
              </button>
            </div>

            <div className="space-y-3">
              {fields.map((field, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={field.label}
                      onChange={e => updateField(i, { label: e.target.value })}
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="字段名称"
                    />
                    <select
                      value={field.fieldType}
                      onChange={e => updateField(i, { fieldType: e.target.value as FieldType })}
                      className="border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none bg-white"
                    >
                      {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={field.isRequired}
                        onChange={e => updateField(i, { isRequired: e.target.checked })}
                        className="rounded"
                      />
                      必填
                    </label>
                    <button onClick={() => removeField(i)} className="text-slate-400 hover:text-red-500 p-1">
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {(field.fieldType === "select" || field.fieldType === "radio" || field.fieldType === "checkbox") && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-400">选项列表</p>
                      {field.options.map((opt, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <input
                            value={opt}
                            onChange={e => updateOption(i, j, e.target.value)}
                            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            placeholder={`选项 ${j + 1}`}
                          />
                          <button onClick={() => removeOption(i, j)} className="text-slate-400 hover:text-red-500 p-1">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => addOption(i)} className="text-xs text-primary font-bold hover:underline">
                        + 添加选项
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {fields.length === 0 && (
                <div className="text-center py-6 text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  暂无扩展字段，点击「添加字段」创建
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">取消</button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-60 flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Registration Detail Drawer ─────────────────── */

function RegistrationDrawer({
  registration,
  fields,
  onClose,
  onUpdated,
}: {
  registration: RegistrationItem;
  fields: ActivityField[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [note, setNote] = useState(registration.adminNote ?? "");
  const [tags, setTags] = useState<string[]>(registration.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  async function saveNote() {
    setSavingNote(true);
    try {
      await adminPatch(`/api/admin/registrations/${registration.id}/note`, { note });
      toast({ title: "备注已保存" });
      onUpdated();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "保存失败", variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  }

  async function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    try {
      const res = await adminPost<{ tags: string[] }>(`/api/admin/registrations/${registration.id}/tags`, { tag: trimmed });
      setTags(res.tags);
      setTagInput("");
      onUpdated();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "添加标签失败", variant: "destructive" });
    }
  }

  async function removeTag(tag: string) {
    try {
      const res = await adminDelete(`/api/admin/registrations/${registration.id}/tags/${encodeURIComponent(tag)}`);
      setTags((res as { tags: string[] }).tags);
      onUpdated();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "删除标签失败", variant: "destructive" });
    }
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-blue-900">报名详情</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <div className="flex-1 p-6 space-y-5">
          {/* Basic info */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
            <InfoRow label="姓名" value={registration.name} />
            {registration.phone && <InfoRow label="手机号" value={registration.phone} />}
            {registration.email && <InfoRow label="邮箱" value={registration.email} />}
            {registration.organization && <InfoRow label="单位/公司" value={registration.organization} />}
            <InfoRow label="报名时间" value={new Date(registration.createdAt).toLocaleString("zh-CN")} />
          </div>

          {/* Extension fields */}
          {fields.length > 0 && Object.keys(registration.extraData ?? {}).length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">扩展字段</p>
              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                {fields.map(f => {
                  const val = registration.extraData?.[f.label];
                  if (!val) return null;
                  return (
                    <InfoRow key={f.id} label={f.label} value={Array.isArray(val) ? val.join("、") : val} />
                  );
                })}
              </div>
            </div>
          )}

          {/* Tags */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">标签</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map(tag => (
                <span key={tag} className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-red-500"><X size={11} /></button>
                </span>
              ))}
              {tags.length === 0 && <span className="text-xs text-slate-400">暂无标签</span>}
            </div>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="输入标签，按回车添加"
              />
              <button onClick={() => addTag(tagInput)} className="px-3 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90">
                添加
              </button>
            </div>
          </div>

          {/* Admin note */}
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">管理员备注</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="输入备注内容…"
            />
            <button
              onClick={saveNote}
              disabled={savingNote}
              className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5"
            >
              {savingNote && <Loader2 size={12} className="animate-spin" />}
              保存备注
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs font-medium text-slate-400 w-24 shrink-0">{label}</span>
      <span className="text-sm text-slate-700 flex-1 break-words">{value}</span>
    </div>
  );
}

/* ─── Registrations List ─────────────────────────── */

function RegistrationsList({ activity, onBack }: { activity: Activity; onBack: () => void }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [selectedReg, setSelectedReg] = useState<RegistrationItem | null>(null);
  const [exporting, setExporting] = useState(false);
  const qc = useQueryClient();

  const { data: regsData, isLoading } = useQuery({
    queryKey: ["admin-registrations", activity.id, page, q],
    queryFn: () => adminGet<{ data: RegistrationItem[]; total: number; page: number; pageSize: number }>(
      `/api/admin/activities/${activity.id}/registrations?page=${page}&q=${encodeURIComponent(q)}&pageSize=20`
    ),
  });

  const { data: activityDetail } = useQuery({
    queryKey: ["admin-activity-detail", activity.id],
    queryFn: () => adminGet<Activity & { fields: ActivityField[] }>(`/api/admin/activities/${activity.id}`),
  });

  const fields = activityDetail?.fields ?? [];
  const regs = regsData?.data ?? [];
  const total = regsData?.total ?? 0;

  async function handleExport() {
    setExporting(true);
    try {
      const headers = getAdminHeaders();
      const url = `${BASE}/api/admin/activities/${activity.id}/registrations/export?q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("导出失败");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${activity.title}-报名名单.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      /* ignore */
    } finally {
      setExporting(false);
    }
  }

  function handleUpdated() {
    qc.invalidateQueries({ queryKey: ["admin-registrations", activity.id] });
    if (selectedReg) {
      const updated = regsData?.data.find(r => r.id === selectedReg.id);
      if (updated) setSelectedReg(updated);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-primary">
          <ChevronLeft size={16} /> 返回
        </button>
        <div>
          <h2 className="text-2xl font-extrabold text-blue-900">{activity.title}</h2>
          <p className="text-slate-500 text-sm mt-0.5">报名列表</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            placeholder="搜索姓名、手机号、邮箱、标签…"
          />
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 bg-white disabled:opacity-60"
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          导出 CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
            <tr>
              <th className="px-6 py-4">姓名</th>
              <th className="px-6 py-4">手机号</th>
              <th className="px-6 py-4">邮箱</th>
              <th className="px-6 py-4">单位/公司</th>
              <th className="px-6 py-4">标签</th>
              <th className="px-6 py-4">报名时间</th>
              <th className="px-6 py-4">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                <div className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /><span className="text-sm">加载中…</span></div>
              </td></tr>
            ) : regs.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">暂无报名记录</td></tr>
            ) : regs.map(reg => (
              <tr key={reg.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-semibold text-blue-900 text-sm">{reg.name}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{reg.phone ?? "—"}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{reg.email ?? "—"}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{reg.organization ?? "—"}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {reg.tags.map(t => (
                      <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold">{t}</span>
                    ))}
                    {reg.adminNote && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold flex items-center gap-0.5"><FileText size={9} />有备注</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">{new Date(reg.createdAt).toLocaleString("zh-CN")}</td>
                <td className="px-6 py-4">
                  <button onClick={() => setSelectedReg(reg)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20">
                    <Eye size={12} /> 详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={20} total={total} onPage={setPage} />

      {selectedReg && (
        <RegistrationDrawer
          registration={selectedReg}
          fields={fields}
          onClose={() => setSelectedReg(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}

/* ─── Activities List ────────────────────────────── */

export default function AdminActivities() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editActivity, setEditActivity] = useState<(Activity & { fields?: ActivityField[] }) | undefined>();
  const [qrActivity, setQrActivity] = useState<Activity | null>(null);
  const [viewingActivity, setViewingActivity] = useState<Activity | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-activities", page, q, statusFilter],
    queryFn: () => adminGet<{ data: Activity[]; total: number; page: number; pageSize: number }>(
      `/api/admin/activities?page=${page}&q=${encodeURIComponent(q)}&status=${statusFilter}&pageSize=20`
    ),
  });

  const publishMutation = useMutation({
    mutationFn: (id: number) => adminPatch(`/api/admin/activities/${id}/publish`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-activities"] }); toast({ title: "活动已发布，报名链接现已生效" }); },
    onError: (err) => toast({ title: err instanceof Error ? err.message : "发布失败", variant: "destructive" }),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: number) => adminPatch(`/api/admin/activities/${id}/unpublish`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-activities"] }); toast({ title: "已退回草稿" }); },
    onError: (err) => toast({ title: err instanceof Error ? err.message : "操作失败", variant: "destructive" }),
  });

  const endMutation = useMutation({
    mutationFn: (id: number) => adminPatch(`/api/admin/activities/${id}/end`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-activities"] }); toast({ title: "活动已结束" }); },
    onError: (err) => toast({ title: err instanceof Error ? err.message : "操作失败", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminDelete(`/api/admin/activities/${id}`),
    onSuccess: () => {
      toast({ title: "活动已删除" });
      qc.invalidateQueries({ queryKey: ["admin-activities"] });
    },
    onError: (err) => toast({ title: err instanceof Error ? err.message : "删除失败", variant: "destructive" }),
  });

  async function handleEdit(activity: Activity) {
    const detail = await adminGet<Activity & { fields: ActivityField[] }>(`/api/admin/activities/${activity.id}`);
    setEditActivity(detail);
    setShowForm(true);
  }

  function getRegisterUrl(id: number) {
    const origin = window.location.origin;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${origin}${base}/activity/${id}`;
  }

  const activities = data?.data ?? [];
  const total = data?.total ?? 0;

  if (viewingActivity) {
    return <RegistrationsList activity={viewingActivity} onBack={() => setViewingActivity(null)} />;
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-blue-900">活动报名</h2>
          <p className="text-slate-500 text-sm mt-1">创建活动，生成报名链接，管理报名信息</p>
        </div>
        <button
          onClick={() => { setEditActivity(undefined); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 shadow-lg shadow-primary/20"
        >
          <Plus size={16} /> 新建活动
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            placeholder="搜索活动名称…"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white"
        >
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="active">进行中</option>
          <option value="ended">已结束</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
            <tr>
              <th className="px-6 py-4">活动名称</th>
              <th className="px-6 py-4">时间</th>
              <th className="px-6 py-4">地点</th>
              <th className="px-6 py-4">报名数</th>
              <th className="px-6 py-4">状态</th>
              <th className="px-6 py-4">创建时间</th>
              <th className="px-6 py-4">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                <div className="flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /><span className="text-sm">加载中…</span></div>
              </td></tr>
            ) : activities.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">暂无活动，点击「新建活动」创建第一个</td></tr>
            ) : activities.map(act => (
              <tr key={act.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-semibold text-blue-900 text-sm">{act.title}</p>
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">
                  {act.startTime && <div>{new Date(act.startTime).toLocaleDateString("zh-CN")}</div>}
                  {act.endTime && <div>{new Date(act.endTime).toLocaleDateString("zh-CN")}</div>}
                  {!act.startTime && !act.endTime && "—"}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{act.location ?? "—"}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setViewingActivity(act)}
                    className="flex items-center gap-1.5 text-primary font-bold text-sm hover:underline"
                  >
                    <Users size={14} /> {act.registrationCount}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col items-start gap-1.5">
                    {(() => { const s = getStatusDisplay(act.status); return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}</span>; })()}
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {act.status === "draft" && (
                        <button onClick={() => publishMutation.mutate(act.id)}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20">发布</button>
                      )}
                      {act.status === "active" && (<>
                        <button onClick={() => unpublishMutation.mutate(act.id)}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200">退回草稿</button>
                        <button onClick={() => endMutation.mutate(act.id)}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-500 hover:bg-red-100">结束活动</button>
                      </>)}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">{new Date(act.createdAt).toLocaleDateString("zh-CN")}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setViewingActivity(act)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10"
                      title="查看报名"
                    >
                      <Users size={14} />
                    </button>
                    <button
                      onClick={() => setQrActivity(act)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10"
                      title="二维码/链接"
                    >
                      <QrCode size={14} />
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(getRegisterUrl(act.id)); toast({ title: "链接已复制" }); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10"
                      title="复制链接"
                    >
                      <Link2 size={14} />
                    </button>
                    <button
                      onClick={() => handleEdit(act)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                      title="编辑"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`确定删除活动「${act.title}」及其所有报名数据吗？`)) {
                          deleteMutation.mutate(act.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={20} total={total} onPage={setPage} />

      {showForm && (
        <ActivityFormModal
          activity={editActivity}
          onClose={() => { setShowForm(false); setEditActivity(undefined); }}
          onSaved={() => {
            setShowForm(false);
            setEditActivity(undefined);
            qc.invalidateQueries({ queryKey: ["admin-activities"] });
          }}
        />
      )}

      {qrActivity && (
        <QrModal
          url={getRegisterUrl(qrActivity.id)}
          title={qrActivity.title}
          onClose={() => setQrActivity(null)}
        />
      )}
    </div>
  );
}
