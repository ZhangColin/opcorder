import { useState, useEffect, useRef, useCallback } from "react";
import { getAccessToken, updateStoredUserField } from "@/lib/auth";
import {
  Building2, Phone, CreditCard, FileText,
  Pencil, Save, X, CheckCircle,
  Upload, Loader2, ZoomIn, ZoomOut, Crop,
  MapPin, Users, Calendar, Globe, Mail, Hash,
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
  contactPerson: string | null;
  contactAddress: string | null;
  taxId: string | null;
  bankName: string | null;
  bankAccount: string | null;
}

/* ─── Shared sub-components ─── */

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col space-y-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${value ? "text-slate-800" : "text-slate-400"}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
        <Icon size={17} className="text-primary shrink-0" />
        <h2 className="text-sm font-bold text-slate-700">{title}</h2>
      </div>
      <div className="px-6 py-5">
        {children}
      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder, type = "text" }: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col space-y-1.5">
      <label className="text-xs font-semibold text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 placeholder:text-slate-300 transition-colors"
      />
    </div>
  );
}

/* ─── Main Page ─── */

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
    contactPerson: "",
    contactAddress: "",
    taxId: "",
    bankName: "",
    bankAccount: "",
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
          nickname:       data.nickname ?? "",
          phone:          data.phone ?? "",
          companyDesc:    data.companyDesc ?? "",
          location:       data.location ?? "",
          industry:       data.industry ?? "",
          teamSize:       data.teamSize ?? "",
          foundedYear:    data.foundedYear ?? "",
          website:        data.website ?? "",
          contactEmail:   data.contactEmail ?? "",
          creditCode:     data.creditCode ?? "",
          companyLogo:    data.companyLogo ?? "",
          contactPerson:  data.contactPerson ?? "",
          contactAddress: data.contactAddress ?? "",
          taxId:          data.taxId ?? "",
          bankName:       data.bankName ?? "",
          bankAccount:    data.bankAccount ?? "",
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
      nickname:       profile?.nickname ?? "",
      phone:          profile?.phone ?? "",
      companyDesc:    profile?.companyDesc ?? "",
      location:       profile?.location ?? "",
      industry:       profile?.industry ?? "",
      teamSize:       profile?.teamSize ?? "",
      foundedYear:    profile?.foundedYear ?? "",
      website:        profile?.website ?? "",
      contactEmail:   profile?.contactEmail ?? "",
      creditCode:     profile?.creditCode ?? "",
      companyLogo:    profile?.companyLogo ?? "",
      contactPerson:  profile?.contactPerson ?? "",
      contactAddress: profile?.contactAddress ?? "",
      taxId:          profile?.taxId ?? "",
      bankName:       profile?.bankName ?? "",
      bankAccount:    profile?.bankAccount ?? "",
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
  const displayIndustry = editing ? form.industry : profile?.industry;

  return (
    <PubLayout title="企业信息" backHref="/pub">
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-5">

        {/* ── Hero Card ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          {/* Logo */}
          <div
            className="relative shrink-0 cursor-pointer group self-start"
            onClick={() => editing && logoInputRef.current?.click()}
          >
            {currentLogo ? (
              <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden border-2 border-slate-200 shadow-sm bg-white">
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
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const file = e.target.files?.[0]; if (file) handleLogoFileSelected(file); }}
          />

          {/* Name + industry */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">发单方企业</p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight truncate">
              {displayName}
            </h1>
            {displayIndustry && (
              <span className="inline-block text-xs font-semibold text-primary bg-primary/8 px-2.5 py-0.5 rounded-full">
                {displayIndustry}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 shrink-0">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-primary text-white shadow hover:bg-primary/90 transition-all active:scale-95"
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
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-primary text-white shadow hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? "保存中…" : "保存"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Saved toast ── */}
        {saved && (
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-700">
            <CheckCircle size={15} className="text-emerald-500 shrink-0" /> 信息已保存
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-60 text-slate-400 text-sm">加载中…</div>
        ) : (
          <div className="space-y-5">

            {/* ── 工商信息 ── */}
            <SectionCard icon={Building2} title="工商信息">
              {!editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
                  <Field label="公司名称"         value={profile?.nickname} />
                  <Field label="统一社会信用代码" value={profile?.creditCode} />
                  <Field label="纳税识别号"       value={profile?.taxId} />
                  <Field label="所属行业"         value={profile?.industry} />
                  <Field label="成立年份"         value={profile?.foundedYear} />
                  <Field label="团队规模"         value={profile?.teamSize} />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <FormInput label="公司名称"         value={form.nickname}    onChange={f("nickname")}    placeholder="公司/机构名称" />
                  <FormInput label="统一社会信用代码" value={form.creditCode}  onChange={f("creditCode")}  placeholder="如：91440300XXXXXXXXXX" />
                  <FormInput label="纳税识别号"       value={form.taxId}       onChange={f("taxId")}       placeholder="纳税人识别号" />
                  <FormInput label="所属行业"         value={form.industry}    onChange={f("industry")}    placeholder="如：AI 教育、政府培训" />
                  <FormInput label="成立年份"         value={form.foundedYear} onChange={f("foundedYear")} placeholder="如：2018" />
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-xs font-semibold text-slate-500">团队规模</label>
                    <select
                      value={form.teamSize}
                      onChange={f("teamSize")}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                    >
                      <option value="">请选择</option>
                      {TEAM_SIZE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </SectionCard>

            {/* ── 联系信息 ── */}
            <SectionCard icon={Phone} title="联系信息">
              {!editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
                  <Field label="联系人"   value={profile?.contactPerson} />
                  <Field label="联系电话" value={profile?.phone} />
                  <Field label="联系邮箱" value={profile?.contactEmail} />
                  <Field label="官方网站" value={profile?.website} />
                  <Field label="所在地区" value={profile?.location} />
                  <Field label="联系地址" value={profile?.contactAddress} />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <FormInput label="联系人"   value={form.contactPerson}  onChange={f("contactPerson")}  placeholder="联系人姓名" />
                  <FormInput label="联系电话" value={form.phone}          onChange={f("phone")}          placeholder="如：13800138000" />
                  <FormInput label="联系邮箱" value={form.contactEmail}   onChange={f("contactEmail")}   placeholder="contact@company.com" />
                  <FormInput label="官方网站" value={form.website}        onChange={f("website")}        placeholder="https://example.com" />
                  <FormInput label="所在地区" value={form.location}       onChange={f("location")}       placeholder="如：深圳市南山区" />
                  <div className="sm:col-span-2">
                    <FormInput label="联系地址" value={form.contactAddress} onChange={f("contactAddress")} placeholder="公司详细地址" />
                  </div>
                </div>
              )}
            </SectionCard>

            {/* ── 财务信息 ── */}
            <SectionCard icon={CreditCard} title="财务信息">
              {!editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5">
                  <Field label="开户银行" value={profile?.bankName} />
                  <Field label="银行账号" value={profile?.bankAccount} />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <FormInput label="开户银行" value={form.bankName}    onChange={f("bankName")}    placeholder="如：中国工商银行北京分行" />
                  <FormInput label="银行账号" value={form.bankAccount} onChange={f("bankAccount")} placeholder="银行账号" />
                </div>
              )}
            </SectionCard>

            {/* ── 企业介绍 ── */}
            <SectionCard icon={FileText} title="企业介绍">
              {!editing ? (
                profile?.companyDesc ? (
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {profile.companyDesc}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400 italic">暂无企业介绍，点击"编辑信息"填写。</p>
                )
              ) : (
                <div className="flex flex-col space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">企业介绍</label>
                  <textarea
                    value={form.companyDesc}
                    onChange={f("companyDesc")}
                    rows={6}
                    placeholder="介绍公司背景、主营业务、核心优势等…"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 placeholder:text-slate-300 resize-none transition-colors"
                  />
                </div>
              )}
            </SectionCard>

            {/* ── Logo upload section (edit mode only) ── */}
            {editing && (
              <SectionCard icon={Upload} title="企业 Logo">
                <div
                  className="flex items-center gap-4 p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/[0.02] transition-colors"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                    {form.companyLogo
                      ? <img src={form.companyLogo} alt="logo" className="w-full h-full object-cover" />
                      : <Building2 size={22} className="text-slate-300" />}
                  </div>
                  <div>
                    {logoUploading
                      ? <span className="flex items-center gap-2 text-sm text-primary font-semibold"><Loader2 size={13} className="animate-spin" />上传中…</span>
                      : <span className="flex items-center gap-2 text-sm text-slate-600 font-semibold"><Upload size={13} />{form.companyLogo ? "重新上传 Logo" : "点击上传 Logo"}</span>}
                    <p className="text-xs text-slate-400 mt-0.5">JPG / PNG，建议正方形，最优尺寸 512×512</p>
                  </div>
                </div>
              </SectionCard>
            )}

          </div>
        )}
      </div>
    </PubLayout>
  );
}
