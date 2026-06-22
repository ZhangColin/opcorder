import { useState, useEffect, useRef, useCallback } from "react";
import { getAccessToken, updateStoredUserField } from "@/lib/auth";
import {
  Building2, MapPin, Users, Calendar, Globe,
  Mail, Phone, Pencil, Save, X, CheckCircle,
  Upload, Loader2, Hash, ZoomIn, ZoomOut, Crop,
} from "lucide-react";
import { PubLayout } from "@/components/pub/PubLayout";
import { useCurrentUser } from "@/hooks/use-current-user";

/* ─── Image Crop Modal ─── */
interface CropModalProps {
  src: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

function CropModal({ src, onConfirm, onCancel }: CropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col" style={{ width: MODAL_W + "px" }}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <span className="font-bold text-slate-800 flex items-center gap-2">
            <Crop size={16} className="text-primary" />裁剪企业 Logo
          </span>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-8 py-5 flex flex-col items-center gap-4">
          <p className="text-xs text-slate-400">拖拽移动图片，滚轮缩放；裁剪区域为正方形</p>
          <div
            ref={containerRef}
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
            <button
              onClick={() => changeScale(-0.12)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
            >
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
            <button
              onClick={() => changeScale(0.12)}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
            >
              <ZoomIn size={15} className="text-slate-600" />
            </button>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
          >
            确认裁剪
          </button>
        </div>
      </div>
    </div>
  );
}

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const TEAM_SIZE_OPTIONS = [
  "1-10人", "11-50人", "51-200人", "201-500人", "501-1000人", "1000人以上",
];

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
  creditCode: string | null;
  companyLogo: string | null;
}

function InfoRow({ label, icon: Icon, value, placeholder }: {
  label: string; icon: React.ElementType; value: string | null | undefined; placeholder?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center text-primary shrink-0 mt-0.5">
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
        <p className={`text-sm font-semibold mt-0.5 ${value ? "text-slate-800" : "text-slate-400 italic"}`}>
          {value || placeholder || "未填写"}
        </p>
      </div>
    </div>
  );
}

export default function PublisherProfile() {
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
    creditCode: "",
    companyLogo: "",
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`${API_BASE}/api/users/${userId}/publisher-profile`, {
      headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
    })
      .then(r => r.json())
      .then((data: PublisherProfileData) => {
        setProfile(data);
        setForm({
          nickname:     data.nickname ?? "",
          phone:        data.phone ?? "",
          companyDesc:  data.companyDesc ?? "",
          location:     data.location ?? "",
          industry:     data.industry ?? "",
          teamSize:     data.teamSize ?? "",
          foundedYear:  data.foundedYear ?? "",
          website:      data.website ?? "",
          contactEmail: data.contactEmail ?? "",
          creditCode:   data.creditCode ?? "",
          companyLogo:  data.companyLogo ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/${userId}/publisher-profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken() ?? ""}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setProfile(data);
      if (form.nickname && form.nickname !== localNickname) {
        updateStoredUserField("nickname", form.nickname);
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

  const cancelEdit = () => {
    setEditing(false);
    setForm({
      nickname:     profile?.nickname ?? "",
      phone:        profile?.phone ?? "",
      companyDesc:  profile?.companyDesc ?? "",
      location:     profile?.location ?? "",
      industry:     profile?.industry ?? "",
      teamSize:     profile?.teamSize ?? "",
      foundedYear:  profile?.foundedYear ?? "",
      website:      profile?.website ?? "",
      contactEmail: profile?.contactEmail ?? "",
      creditCode:   profile?.creditCode ?? "",
      companyLogo:  profile?.companyLogo ?? "",
    });
  };

  const f = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleLogoFileSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => { if (e.target?.result) setCropSrc(e.target.result as string); };
    reader.readAsDataURL(file);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropSrc(null);
    if (!userId) return;
    setLogoUploading(true);
    try {
      const reqRes = await fetch(`${API_BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() ?? ""}` },
        body: JSON.stringify({ name: "logo.jpg", size: blob.size, contentType: "image/jpeg" }),
      });
      if (!reqRes.ok) throw new Error("获取上传地址失败");
      const { uploadURL, objectPath } = await reqRes.json();
      const putRes = await fetch(uploadURL, { method: "PUT", body: blob, headers: { "Content-Type": "image/jpeg" } });
      if (!putRes.ok) throw new Error("上传失败");
      const logoUrl = `${API_BASE}/api/storage${objectPath}`;
      setForm(prev => ({ ...prev, companyLogo: logoUrl }));
    } finally {
      setLogoUploading(false);
    }
  };

  const displayName = editing ? form.nickname : (profile?.nickname ?? localNickname ?? "发单方");
  const avatarChar  = displayName.slice(0, 1).toUpperCase();
  const currentLogo = editing ? form.companyLogo : profile?.companyLogo;

  return (
    <PubLayout title="企业信息" backHref="/pub">
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <div className="max-w-3xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-8">
          <div className="flex items-center gap-4">
            <div
              className="relative shrink-0 cursor-pointer group"
              onClick={() => editing && logoInputRef.current?.click()}
            >
              {currentLogo ? (
                <div className="w-18 h-18 w-[72px] h-[72px] rounded-2xl overflow-hidden border-2 border-slate-200 shadow bg-white">
                  <img src={currentLogo} alt="企业logo" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-[72px] h-[72px] rounded-2xl bg-primary flex items-center justify-center text-white text-2xl font-extrabold shadow shadow-primary/20">
                  {avatarChar}
                </div>
              )}
              {editing && (
                <div className="absolute inset-0 bg-black/30 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload size={18} className="text-white" />
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-0.5">发单方</p>
              <h1 className="text-2xl font-extrabold text-primary tracking-tight font-display">{displayName}</h1>
              {profile?.industry && <p className="text-slate-500 text-sm mt-0.5">{profile.industry}</p>}
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-primary text-white shadow hover:bg-primary/90 transition-all active:scale-95"
              >
                <Pencil size={14} /> 编辑信息
              </button>
            ) : (
              <>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  <X size={14} /> 取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-primary text-white shadow hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-60"
                >
                  <Save size={14} /> {saving ? "保存中…" : "保存"}
                </button>
              </>
            )}
          </div>
        </div>

        {saved && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-700">
            <CheckCircle size={15} className="text-emerald-500" /> 信息已保存
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-60 text-slate-400 text-sm">加载中…</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Left: Company Info */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h2 className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400 mb-4">企业基本信息</h2>

                {!editing ? (
                  <div>
                    <InfoRow label="公司名称"         icon={Building2} value={profile?.nickname} />
                    {profile?.creditCode && (
                      <InfoRow label="统一社会信用代码" icon={Hash}      value={profile.creditCode} />
                    )}
                    <InfoRow label="所在地区" icon={MapPin}   value={profile?.location}     placeholder="未填写" />
                    <InfoRow label="所属行业" icon={Building2} value={profile?.industry}     placeholder="未填写" />
                    <InfoRow label="团队规模" icon={Users}    value={profile?.teamSize}     placeholder="未填写" />
                    <InfoRow label="成立年份" icon={Calendar} value={profile?.foundedYear}  placeholder="未填写" />
                    <InfoRow label="官方网站" icon={Globe}    value={profile?.website}      placeholder="未填写" />
                    <InfoRow label="联系邮箱" icon={Mail}     value={profile?.contactEmail} placeholder="未填写" />
                    <InfoRow label="联系电话" icon={Phone}    value={profile?.phone}        placeholder="未填写" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Logo upload trigger */}
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">企业 Logo</label>
                      <div
                        className="flex items-center gap-3 p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                          {form.companyLogo
                            ? <img src={form.companyLogo} alt="logo" className="w-full h-full object-cover" />
                            : <Building2 size={20} className="text-slate-400" />}
                        </div>
                        <div className="min-w-0">
                          {logoUploading
                            ? <span className="flex items-center gap-1 text-sm text-primary font-semibold"><Loader2 size={13} className="animate-spin" />上传中…</span>
                            : <span className="flex items-center gap-1 text-sm text-slate-500 font-semibold"><Upload size={13} />{form.companyLogo ? "重新上传" : "点击上传"}</span>}
                          <p className="text-[10px] text-slate-400 mt-0.5">JPG / PNG，建议正方形</p>
                        </div>
                      </div>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => { const file = e.target.files?.[0]; if (file) handleLogoFileSelected(file); }}
                      />
                    </div>

                    {[
                      { label: "公司名称",         key: "nickname"     as const, placeholder: "公司/机构名称" },
                      { label: "统一社会信用代码",  key: "creditCode"   as const, placeholder: "如：91440300XXXXXXXXXX" },
                      { label: "所在地区",          key: "location"     as const, placeholder: "如：深圳市南山区" },
                      { label: "所属行业",          key: "industry"     as const, placeholder: "如：AI 教育、政府培训" },
                      { label: "成立年份",          key: "foundedYear"  as const, placeholder: "如：2018" },
                      { label: "官方网站",          key: "website"      as const, placeholder: "https://example.com" },
                      { label: "联系邮箱",          key: "contactEmail" as const, placeholder: "contact@company.com" },
                      { label: "联系电话",          key: "phone"        as const, placeholder: "如：13800138000" },
                    ].map(({ label, key, placeholder }) => (
                      <div key={key}>
                        <label className="text-xs font-bold text-slate-600 block mb-1">{label}</label>
                        <input
                          value={form[key]}
                          onChange={f(key)}
                          placeholder={placeholder}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
                        />
                      </div>
                    ))}

                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">团队规模</label>
                      <select
                        value={form.teamSize}
                        onChange={f("teamSize")}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      >
                        <option value="">请选择</option>
                        {TEAM_SIZE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Company Desc */}
            <div className="lg:col-span-3 space-y-5">
              <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h2 className="text-[10px] uppercase tracking-widest font-extrabold text-slate-400 mb-4">公司介绍</h2>
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
                    rows={10}
                    placeholder="介绍公司背景、主营业务、核心优势等…"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400 resize-none"
                  />
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </PubLayout>
  );
}
