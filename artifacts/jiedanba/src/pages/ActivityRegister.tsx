import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Calendar, MapPin, Clock } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ActivityField = {
  id: number;
  label: string;
  fieldType: string;
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
  status: string;
  fields: ActivityField[];
};

async function fetchActivity(id: string): Promise<Activity> {
  const res = await fetch(`${BASE}/api/activities/${id}/public`);
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error ?? "获取活动信息失败");
  }
  return res.json();
}

async function submitRegistration(activityId: string, data: Record<string, unknown>) {
  const res = await fetch(`${BASE}/api/activities/${activityId}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error ?? "提交失败");
  }
  return res.json();
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ActivityRegister() {
  const { id } = useParams<{ id: string }>();
  const [formData, setFormData] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: activity, isLoading, error } = useQuery({
    queryKey: ["activity-public", id],
    queryFn: () => fetchActivity(id!),
    enabled: !!id,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => submitRegistration(id!, data),
    onSuccess: () => setSubmitted(true),
  });

  function validate(): boolean {
    if (!activity) return false;
    const newErrors: Record<string, string> = {};

    if (!String(formData.name ?? "").trim()) {
      newErrors.name = "请填写姓名";
    }

    for (const field of activity.fields) {
      const val = formData[`field_${field.id}`];
      if (field.isRequired) {
        if (!val || (Array.isArray(val) && val.length === 0) || String(val).trim() === "") {
          newErrors[`field_${field.id}`] = `请填写${field.label}`;
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const extraData: Record<string, string | string[]> = {};
    if (activity) {
      for (const field of activity.fields) {
        const key = `field_${field.id}`;
        if (formData[key] !== undefined) {
          extraData[field.label] = formData[key];
        }
      }
    }

    mutation.mutate({
      name: String(formData.name ?? "").trim(),
      phone: String(formData.phone ?? "").trim() || undefined,
      email: String(formData.email ?? "").trim() || undefined,
      organization: String(formData.organization ?? "").trim() || undefined,
      extraData,
    });
  }

  function handleChange(key: string, value: string | string[]) {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const e = { ...prev }; delete e[key]; return e; });
  }

  function handleCheckboxChange(key: string, option: string, checked: boolean) {
    const current = (formData[key] as string[] | undefined) ?? [];
    const updated = checked ? [...current, option] : current.filter(v => v !== option);
    handleChange(key, updated);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-blue-600">
          <Loader2 size={24} className="animate-spin" />
          <span className="text-lg font-medium">加载中…</span>
        </div>
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">暂无法访问此活动</h1>
          <p className="text-gray-500 text-sm">
            {error instanceof Error ? error.message : "请确认链接是否正确"}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-lg p-10 text-center max-w-sm w-full">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-3">报名成功！</h1>
          <p className="text-gray-500 text-base">
            您已成功报名「{activity.title}」，期待与您相见！
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Activity header */}
        <div className="bg-white rounded-3xl shadow-sm p-8 mb-6">
          <h1 className="text-2xl font-extrabold text-blue-900 mb-3">{activity.title}</h1>
          {(activity.startTime || activity.endTime) && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Calendar size={14} className="text-blue-400 shrink-0" />
              <span>
                {activity.startTime && formatDate(activity.startTime)}
                {activity.startTime && activity.endTime && " ~ "}
                {activity.endTime && formatDate(activity.endTime)}
              </span>
            </div>
          )}
          {activity.location && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
              <MapPin size={14} className="text-blue-400 shrink-0" />
              <span>{activity.location}</span>
            </div>
          )}
          {activity.description && (
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{activity.description}</p>
          )}
        </div>

        {/* Form */}
        <div className="bg-white rounded-3xl shadow-sm p-8">
          <h2 className="text-lg font-bold text-blue-900 mb-6">填写报名信息</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Standard fields */}
            <FormField label="姓名" required error={errors.name}>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="请输入姓名"
                value={String(formData.name ?? "")}
                onChange={e => handleChange("name", e.target.value)}
              />
            </FormField>

            <FormField label="手机号" error={errors.phone}>
              <input
                type="tel"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="请输入手机号（选填）"
                value={String(formData.phone ?? "")}
                onChange={e => handleChange("phone", e.target.value)}
              />
            </FormField>

            <FormField label="邮箱" error={errors.email}>
              <input
                type="email"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="请输入邮箱（选填）"
                value={String(formData.email ?? "")}
                onChange={e => handleChange("email", e.target.value)}
              />
            </FormField>

            <FormField label="所在单位/公司" error={errors.organization}>
              <input
                type="text"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="请输入所在单位/公司（选填）"
                value={String(formData.organization ?? "")}
                onChange={e => handleChange("organization", e.target.value)}
              />
            </FormField>

            {/* Custom extension fields */}
            {activity.fields.map(field => {
              const key = `field_${field.id}`;
              return (
                <FormField key={field.id} label={field.label} required={field.isRequired} error={errors[key]}>
                  {field.fieldType === "textarea" ? (
                    <textarea
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                      rows={3}
                      placeholder={`请输入${field.label}`}
                      value={String(formData[key] ?? "")}
                      onChange={e => handleChange(key, e.target.value)}
                    />
                  ) : field.fieldType === "select" ? (
                    <select
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                      value={String(formData[key] ?? "")}
                      onChange={e => handleChange(key, e.target.value)}
                    >
                      <option value="">请选择</option>
                      {(field.options ?? []).map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.fieldType === "radio" ? (
                    <div className="flex flex-wrap gap-3">
                      {(field.options ?? []).map(opt => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={key}
                            value={opt}
                            checked={String(formData[key] ?? "") === opt}
                            onChange={() => handleChange(key, opt)}
                            className="text-blue-600"
                          />
                          <span className="text-sm text-gray-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : field.fieldType === "checkbox" ? (
                    <div className="flex flex-wrap gap-3">
                      {(field.options ?? []).map(opt => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            value={opt}
                            checked={((formData[key] as string[] | undefined) ?? []).includes(opt)}
                            onChange={e => handleCheckboxChange(key, opt, e.target.checked)}
                            className="text-blue-600"
                          />
                          <span className="text-sm text-gray-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder={`请输入${field.label}`}
                      value={String(formData[key] ?? "")}
                      onChange={e => handleChange(key, e.target.value)}
                    />
                  )}
                </FormField>
              );
            })}

            {mutation.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {mutation.error instanceof Error ? mutation.error.message : "提交失败，请重试"}
              </div>
            )}

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold text-base hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {mutation.isPending && <Loader2 size={18} className="animate-spin" />}
              {mutation.isPending ? "提交中…" : "提交报名"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, required, error, children }: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
