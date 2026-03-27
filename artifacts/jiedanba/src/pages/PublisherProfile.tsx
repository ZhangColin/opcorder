import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Building2, MapPin, Users, Calendar, Globe,
  Mail, Phone, Pencil, Save, X, CheckCircle, Briefcase,
  ChevronRight, PlusCircle,
} from "lucide-react";
import { PublisherSidebar } from "@/components/publisher/PublisherSidebar";
import { PublisherHeaderUser } from "@/components/publisher/PublisherHeaderUser";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useListDemands } from "@workspace/api-client-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TEAM_SIZE_OPTIONS = [
  "1-10人", "11-50人", "51-200人", "201-500人", "501-1000人", "1000人以上",
];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  published:          { label: "招募中",  cls: "bg-amber-50 text-amber-700" },
  in_progress:        { label: "进行中",  cls: "bg-blue-50 text-blue-700" },
  pending_acceptance: { label: "待验收",  cls: "bg-purple-50 text-purple-700" },
  matched:            { label: "已匹配",  cls: "bg-cyan-50 text-cyan-700" },
  completed:          { label: "已完成",  cls: "bg-green-50 text-green-700" },
  closed:             { label: "已关闭",  cls: "bg-slate-100 text-slate-500" },
};

interface PublisherProfileData {
  userId: number;
  nickname: string;
  email: string;
  phone: string | null;
  companyDesc: string | null;
  location: string | null;
  industry: string | null;
  teamSize: string | null;
  foundedYear: string | null;
  website: string | null;
  contactEmail: string | null;
}

function Field({ label, icon: Icon, value, placeholder }: {
  label: string; icon: React.ElementType; value: string | null | undefined; placeholder?: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm shrink-0">
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-semibold mt-0.5 ${value ? "text-slate-800" : "text-slate-400 italic"}`}>
          {value || placeholder || "未填写"}
        </p>
      </div>
    </div>
  );
}

export default function PublisherProfile() {
  const [, navigate] = useLocation();
  const { userId, nickname: localNickname } = useCurrentUser();

  const [profile, setProfile] = useState<PublisherProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    nickname: "",
    phone: "",
    companyDesc: "",
    location: "",
    industry: "",
    teamSize: "",
    foundedYear: "",
    website: "",
    contactEmail: "",
  });

  const logout = () => {
    localStorage.removeItem("jdb_role");
    localStorage.removeItem("jdb_user_id");
    localStorage.removeItem("jdb_nickname");
    navigate("/login");
  };

  /* ── Fetch profile ── */
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`${API_BASE}/api/users/${userId}/publisher-profile`, {
      headers: { Authorization: `Bearer ${userId}` },
    })
      .then(r => r.json())
      .then((data: PublisherProfileData) => {
        setProfile(data);
        setForm({
          nickname: data.nickname ?? "",
          phone: data.phone ?? "",
          companyDesc: data.companyDesc ?? "",
          location: data.location ?? "",
          industry: data.industry ?? "",
          teamSize: data.teamSize ?? "",
          foundedYear: data.foundedYear ?? "",
          website: data.website ?? "",
          contactEmail: data.contactEmail ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, [userId]);

  /* ── Fetch demands ── */
  const { data: activeData } = useListDemands({
    publisherId: userId || undefined,
    status: "published" as any,
    limit: 6,
  });
  const { data: progressData } = useListDemands({
    publisherId: userId || undefined,
    status: "in_progress" as any,
    limit: 6,
  });
  const { data: completedData } = useListDemands({
    publisherId: userId || undefined,
    status: "completed" as any,
    limit: 10,
  });

  const activeDemands = [
    ...(activeData?.items ?? []),
    ...(progressData?.items ?? []),
  ];
  const completedDemands = completedData?.items ?? [];

  /* ── Save ── */
  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}/publisher-profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setProfile(data);
      if (form.nickname && form.nickname !== localNickname) {
        localStorage.setItem("jdb_nickname", form.nickname);
      }
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // noop
    } finally {
      setSaving(false);
    }
  };

  const f = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const displayName = editing ? form.nickname : (profile?.nickname ?? localNickname ?? "发单方");
  const avatarChar = displayName.slice(0, 1).toUpperCase();

  return (
    <div className="flex min-h-screen bg-[#f3f3f6] text-[#1a1c1e]">
      <PublisherSidebar onLogout={logout} />

      <main className="flex-1 ml-64 min-h-screen">
        {/* Top bar */}
        <header className="fixed top-0 right-0 left-64 z-40 bg-white/80 backdrop-blur-md shadow-sm flex justify-between items-center px-8 py-3">
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => navigate("/publisher")} className="text-slate-400 hover:text-primary transition-colors flex items-center gap-1">
              <ArrowLeft size={14} />
              工作台
            </button>
            <ChevronRight size={14} className="text-slate-300" />
            <span className="text-blue-900 font-bold">企业信息</span>
          </div>
          <div className="flex items-center gap-4">
            <PublisherHeaderUser onLogout={logout} />
          </div>
        </header>

        <div className="pt-24 px-8 pb-16 max-w-7xl mx-auto">

          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center text-white text-3xl font-extrabold shadow-lg shadow-primary/20">
                {avatarChar}
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">发单方</p>
                <h1 className="text-3xl font-extrabold text-primary tracking-tight font-display">
                  {displayName}
                </h1>
                {profile?.industry && (
                  <p className="text-slate-500 mt-1 text-sm">{profile.industry}</p>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-white shadow-md hover:bg-primary/90 transition-all active:scale-95"
                >
                  <Pencil size={15} />
                  编辑信息
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { setEditing(false); setForm({ nickname: profile?.nickname ?? "", phone: profile?.phone ?? "", companyDesc: profile?.companyDesc ?? "", location: profile?.location ?? "", industry: profile?.industry ?? "", teamSize: profile?.teamSize ?? "", foundedYear: profile?.foundedYear ?? "", website: profile?.website ?? "", contactEmail: profile?.contactEmail ?? "" }); }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                  >
                    <X size={15} />
                    取消
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-primary text-white shadow-md hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-60"
                  >
                    <Save size={15} />
                    {saving ? "保存中…" : "保存"}
                  </button>
                </>
              )}
            </div>
          </div>

          {saved && (
            <div className="mb-6 flex items-center gap-3 px-5 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-700">
              <CheckCircle size={16} className="text-emerald-500" />
              信息已保存
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-60 text-slate-400 text-sm">加载中…</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* ── Left: Company Vitals ── */}
              <div className="lg:col-span-4 space-y-6">
                <section className="bg-[#f9f9fc] rounded-2xl p-6 border border-slate-200">
                  <h2 className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400 mb-6">企业基本信息</h2>

                  {!editing ? (
                    <div className="space-y-5">
                      <Field label="公司名称" icon={Building2} value={profile?.nickname} />
                      <Field label="所在地区" icon={MapPin} value={profile?.location} placeholder="未填写" />
                      <Field label="所属行业" icon={Briefcase} value={profile?.industry} placeholder="未填写" />
                      <Field label="团队规模" icon={Users} value={profile?.teamSize} placeholder="未填写" />
                      <Field label="成立年份" icon={Calendar} value={profile?.foundedYear} placeholder="未填写" />
                      <Field label="官网" icon={Globe} value={profile?.website} placeholder="未填写" />
                      <Field label="联系邮箱" icon={Mail} value={profile?.contactEmail} placeholder="未填写" />
                      <Field label="联系电话" icon={Phone} value={profile?.phone} placeholder="未填写" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {[
                        { label: "公司名称", key: "nickname" as const, placeholder: "公司/机构名称" },
                        { label: "所在地区", key: "location" as const, placeholder: "如：深圳市南山区" },
                        { label: "所属行业", key: "industry" as const, placeholder: "如：AI 教育、政府培训" },
                        { label: "成立年份", key: "foundedYear" as const, placeholder: "如：2018" },
                        { label: "官方网站", key: "website" as const, placeholder: "https://example.com" },
                        { label: "联系邮箱", key: "contactEmail" as const, placeholder: "contact@company.com" },
                        { label: "联系电话", key: "phone" as const, placeholder: "如：13800138000" },
                      ].map(({ label, key, placeholder }) => (
                        <div key={key}>
                          <label className="text-xs font-bold text-slate-600 block mb-1">{label}</label>
                          <input
                            value={form[key]}
                            onChange={f(key)}
                            placeholder={placeholder}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
                          />
                        </div>
                      ))}
                      <div>
                        <label className="text-xs font-bold text-slate-600 block mb-1">团队规模</label>
                        <select
                          value={form.teamSize}
                          onChange={f("teamSize")}
                          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        >
                          <option value="">请选择</option>
                          {TEAM_SIZE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                </section>

                {/* Stats */}
                <section className="bg-primary text-white rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                  <h2 className="text-[10px] uppercase tracking-widest font-extrabold text-blue-200 mb-5">平台数据</h2>
                  <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div>
                      <p className="text-2xl font-extrabold tracking-tight">{activeDemands.length}</p>
                      <p className="text-[10px] font-bold uppercase text-blue-300 mt-1">进行中需求</p>
                    </div>
                    <div>
                      <p className="text-2xl font-extrabold tracking-tight">{completedDemands.length}</p>
                      <p className="text-[10px] font-bold uppercase text-blue-300 mt-1">已完成项目</p>
                    </div>
                  </div>
                </section>
              </div>

              {/* ── Right: Main Content ── */}
              <div className="lg:col-span-8 space-y-8">

                {/* Company Story */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-primary">公司介绍</h2>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    {!editing ? (
                      profile?.companyDesc ? (
                        <p className="text-slate-600 leading-relaxed whitespace-pre-wrap text-sm">{profile.companyDesc}</p>
                      ) : (
                        <p className="text-slate-400 italic text-sm">暂无公司介绍，点击"编辑信息"填写。</p>
                      )
                    ) : (
                      <textarea
                        value={form.companyDesc}
                        onChange={f("companyDesc")}
                        rows={6}
                        placeholder="介绍公司背景、主营业务、核心优势等（可多段落）…"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400 resize-none"
                      />
                    )}
                  </div>
                </section>

                {/* Active Demands */}
                <section>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-primary">进行中的需求</h2>
                      {activeDemands.length > 0 && (
                        <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                          {activeDemands.length} 个
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => navigate("/publisher/demands/new")}
                      className="flex items-center gap-1.5 text-sm font-bold text-primary hover:underline underline-offset-4"
                    >
                      <PlusCircle size={14} />
                      发布新需求
                    </button>
                  </div>

                  {activeDemands.length === 0 ? (
                    <div className="bg-white rounded-2xl p-10 text-center border border-slate-100">
                      <p className="text-slate-400 text-sm">暂无进行中的需求</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeDemands.slice(0, 4).map(d => {
                        const st = STATUS_LABELS[d.status] ?? { label: d.status, cls: "bg-slate-100 text-slate-500" };
                        return (
                          <div
                            key={d.id}
                            onClick={() => navigate(`/publisher/demand/${d.id}`)}
                            className="bg-white p-5 rounded-2xl shadow-sm hover:shadow-md transition-all border border-transparent hover:border-primary/20 group cursor-pointer"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{d.typeLabel}</span>
                            </div>
                            <h3 className="font-bold text-base text-slate-800 mb-2 line-clamp-2 group-hover:text-primary transition-colors">{d.title}</h3>
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                              <span className="text-xs text-slate-400 font-medium">预算 ¥{d.budgetMin?.toLocaleString()}~{d.budgetMax?.toLocaleString()}</span>
                              <span className="text-[10px] font-bold text-primary uppercase">
                                {d.deadline ? `截止 ${String(d.deadline).slice(0, 10)}` : ""}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {activeDemands.length > 4 && (
                    <button
                      onClick={() => navigate("/publisher/demands")}
                      className="mt-4 w-full py-3 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-500 hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      查看全部 {activeDemands.length} 个进行中需求
                    </button>
                  )}
                </section>

                {/* Past Successes */}
                {completedDemands.length > 0 && (
                  <section>
                    <h2 className="text-xl font-bold text-primary mb-5">已完成项目</h2>
                    <div className="space-y-3">
                      {completedDemands.slice(0, 5).map(d => (
                        <div
                          key={d.id}
                          onClick={() => navigate(`/publisher/demand/${d.id}`)}
                          className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 hover:bg-[#f3f3f6] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                              <CheckCircle size={18} />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-slate-800">{d.title}</h4>
                              <p className="text-xs text-slate-400">已完成 · {d.typeLabel}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-5">
                            <div className="text-right">
                              <p className="text-sm font-bold text-slate-700">¥{d.budgetMax?.toLocaleString()}</p>
                              <p className="text-[10px] text-slate-400 uppercase font-bold">预算上限</p>
                            </div>
                            <ChevronRight size={16} className="text-slate-300" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
