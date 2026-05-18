import { useState, useRef, useCallback, useEffect } from "react";
import { getAccessToken } from "@/lib/auth";
import {
  Save, Camera, Upload, Loader2, X, Plus,
  MapPin, Link2, Briefcase, Phone, MessageCircle,
  Building2, CreditCard, Landmark, User,
  CheckCircle2, Clock, AlertCircle,
  ZoomIn, ZoomOut, Crop, ChevronLeft, IdCard,
} from "lucide-react";
import {
  useGetCurrentUser,
  useGetOpcProfile,
  useUpdateOpcProfile,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ─── MIME detection ──────────────────────────── */
async function detectMimeType(file: File): Promise<string> {
  const buf = await file.slice(0, 8).arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  return file.type || "application/octet-stream";
}

/* ─── Secure upload helper ────────────────────── */
async function secureUpload(file: File, mimeOverride?: string): Promise<string> {
  const token = getAccessToken();
  const contentType = mimeOverride ?? await detectMimeType(file);

  const reqRes = await fetch(`${API_BASE}/api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: file.name, size: file.size, contentType }),
  });
  if (!reqRes.ok) throw new Error("获取上传地址失败");
  const { uploadURL, objectPath, sessionToken } = await reqRes.json();

  const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": contentType } });
  if (!putRes.ok) throw new Error("文件上传失败");

  const verifyRes = await fetch(`${API_BASE}/api/storage/uploads/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sessionToken }),
  });
  if (!verifyRes.ok) throw new Error("文件验证失败");

  return `${API_BASE}/api/storage${objectPath}`;
}

/* ─── Crop Modal ──────────────────────────────── */
function CropModal({ src, onConfirm, onCancel }: { src: string; onConfirm: (blob: Blob) => void; onCancel: () => void }) {
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
    return { x: Math.max(-maxX, Math.min(maxX, ox)), y: Math.max(-maxY, Math.min(maxY, oy)) };
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

  const handleConfirm = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      const rendW = imgNatural.w * scale;
      const rendH = imgNatural.h * scale;
      const imgLeft = (CROP_SIZE - rendW) / 2 + offset.x;
      const imgTop = (CROP_SIZE - rendH) / 2 + offset.y;
      const ratio = 512 / CROP_SIZE;
      ctx.drawImage(img, imgLeft * ratio, imgTop * ratio, rendW * ratio, rendH * ratio);
      canvas.toBlob(blob => { if (blob) onConfirm(blob); }, "image/jpeg", 0.88);
    };
    img.src = src;
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col" style={{ width: MODAL_W + "px" }}>
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
          <span className="font-bold text-slate-800 flex items-center gap-2"><Crop size={16} className="text-primary" />裁剪头像</span>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="px-8 py-5 flex flex-col items-center gap-4">
          <p className="text-xs text-slate-400">拖拽移动图片，滚轮缩放</p>
          <div
            className="relative select-none overflow-hidden rounded-xl border-2 border-primary/40 cursor-move bg-slate-100"
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
            onWheel={e => { e.preventDefault(); changeScale(e.deltaY < 0 ? 0.08 : -0.08); }}
            onMouseDown={e => { dragging.current = true; dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y }; }}
            onMouseMove={e => { if (!dragging.current) return; const dx = e.clientX - dragStart.current.mx; const dy = e.clientY - dragStart.current.my; setOffset(clampOffset(dragStart.current.ox + dx, dragStart.current.oy + dy, scale, imgNatural.w, imgNatural.h)); }}
            onMouseUp={() => { dragging.current = false; }}
            onMouseLeave={() => { dragging.current = false; }}
          >
            <img src={src} alt="crop" draggable={false} onLoad={handleImgLoad}
              style={{ position: "absolute", width: imgNatural.w * scale, height: imgNatural.h * scale, left: "50%", top: "50%", transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`, userSelect: "none" }} />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => changeScale(-0.12)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"><ZoomOut size={15} className="text-slate-600" /></button>
            <input type="range" min={0} max={100} step={1}
              value={Math.round(((scale - Math.max(CROP_SIZE / imgNatural.w, CROP_SIZE / imgNatural.h)) / (Math.max(CROP_SIZE / imgNatural.w, CROP_SIZE / imgNatural.h) * 4)) * 100)}
              onChange={e => { const minSc = Math.max(CROP_SIZE / imgNatural.w, CROP_SIZE / imgNatural.h); const next = minSc + (Number(e.target.value) / 100) * minSc * 4; setScale(next); setOffset(o => clampOffset(o.x, o.y, next, imgNatural.w, imgNatural.h)); }}
              className="w-32 accent-primary" />
            <button onClick={() => changeScale(0.12)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50"><ZoomIn size={15} className="text-slate-600" /></button>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50">取消</button>
          <button onClick={handleConfirm} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 shadow-md shadow-primary/20">确认裁剪</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Document card upload ────────────────────── */
type DocType = "license" | "id-front" | "id-back";

function DocCardIllustration({ docType }: { docType: DocType }) {
  if (docType === "license") {
    return (
      <svg viewBox="0 0 160 112" className="w-full h-full" fill="none">
        <rect width="160" height="112" rx="8" fill="#FFF7ED" />
        <rect x="0" y="0" width="160" height="28" rx="8" fill="#EA580C" fillOpacity="0.18" />
        <rect x="0" y="20" width="160" height="8" fill="#EA580C" fillOpacity="0.18" />
        <text x="80" y="19" textAnchor="middle" fontSize="9" fill="#C2410C" fontWeight="700" opacity="0.75">营 业 执 照</text>
        <circle cx="80" cy="72" r="24" fill="#FED7AA" fillOpacity="0.7" />
        <circle cx="80" cy="72" r="19" fill="none" stroke="#C2410C" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="3 2" />
        <text x="80" y="76" textAnchor="middle" fontSize="11" fill="#C2410C" fontWeight="800" fillOpacity="0.5">印</text>
        <rect x="24" y="102" width="50" height="4" rx="2" fill="#FED7AA" />
        <rect x="86" y="102" width="50" height="4" rx="2" fill="#FED7AA" />
      </svg>
    );
  }
  if (docType === "id-front") {
    return (
      <svg viewBox="0 0 160 100" className="w-full h-full" fill="none">
        <rect width="160" height="100" rx="8" fill="#EFF6FF" />
        <rect x="0" y="0" width="160" height="24" rx="8" fill="#2563EB" fillOpacity="0.15" />
        <rect x="0" y="16" width="160" height="8" fill="#2563EB" fillOpacity="0.15" />
        <text x="80" y="15" textAnchor="middle" fontSize="8" fill="#1D4ED8" fontWeight="700" fillOpacity="0.75">中华人民共和国居民身份证</text>
        <circle cx="36" cy="65" r="18" fill="#BFDBFE" fillOpacity="0.6" />
        <circle cx="36" cy="59" r="8" fill="#93C5FD" fillOpacity="0.7" />
        <path d="M18 78 Q36 64 54 78" fill="#93C5FD" fillOpacity="0.6" />
        <rect x="64" y="48" width="76" height="5" rx="2.5" fill="#BFDBFE" />
        <rect x="64" y="60" width="60" height="4" rx="2" fill="#BFDBFE" />
        <rect x="64" y="72" width="68" height="4" rx="2" fill="#BFDBFE" />
        <rect x="8" y="88" width="144" height="4" rx="2" fill="#DBEAFE" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 100" className="w-full h-full" fill="none">
      <rect width="160" height="100" rx="8" fill="#EFF6FF" />
      <rect x="0" y="0" width="160" height="24" rx="8" fill="#2563EB" fillOpacity="0.15" />
      <rect x="0" y="16" width="160" height="8" fill="#2563EB" fillOpacity="0.15" />
      <text x="80" y="15" textAnchor="middle" fontSize="8" fill="#1D4ED8" fontWeight="700" fillOpacity="0.75">中华人民共和国居民身份证</text>
      <rect x="16" y="34" width="128" height="5" rx="2.5" fill="#BFDBFE" />
      <rect x="16" y="46" width="100" height="4" rx="2" fill="#BFDBFE" />
      <rect x="16" y="57" width="112" height="4" rx="2" fill="#BFDBFE" />
      <rect x="16" y="68" width="90" height="4" rx="2" fill="#BFDBFE" />
      <rect x="96" y="46" width="48" height="36" rx="4" fill="#BFDBFE" fillOpacity="0.5" stroke="#93C5FD" strokeWidth="1" />
      <text x="120" y="68" textAnchor="middle" fontSize="8" fill="#3B82F6" fillOpacity="0.6">章</text>
      <rect x="8" y="88" width="144" height="4" rx="2" fill="#DBEAFE" />
    </svg>
  );
}

interface DocCardProps {
  label: string;
  hint: string;
  docType: DocType;
  value: string;
  uploading: boolean;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  accept?: string;
}

function DocCardUpload({ label, hint, docType, value, uploading, onFileSelect, onClear, accept = "image/*,.pdf" }: DocCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-slate-600">{label}</label>
      <div
        className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
          value ? "border-slate-200 hover:border-primary/40" : "border-dashed border-slate-200 hover:border-primary/50 hover:bg-primary/[0.02]"
        }`}
        style={{ aspectRatio: docType === "license" ? "1.43" : "1.6" }}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        {uploading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50">
            <Loader2 size={24} className="text-primary animate-spin" />
            <span className="text-xs text-slate-400">上传中…</span>
          </div>
        ) : value ? (
          <>
            <img src={value} alt={label} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/35 transition-all flex items-center justify-center opacity-0 hover:opacity-100">
              <span className="bg-white text-primary px-3 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5">
                <Upload size={11} />重新上传
              </span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0">
            <DocCardIllustration docType={docType} />
            <div className="absolute inset-0 flex flex-col items-end justify-end p-2.5 gap-1">
              <span className="bg-white/90 text-slate-500 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-slate-200">
                {hint}
              </span>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = ""; }}
        />
      </div>
      {value && (
        <div className="flex items-center justify-between text-[11px]">
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">查看原图</a>
          <button onClick={e => { e.stopPropagation(); onClear(); }} className="text-slate-400 hover:text-red-500 transition-colors">删除</button>
        </div>
      )}
    </div>
  );
}

/* ─── Field component ─────────────────────────── */
function Field({ label, value, onChange, placeholder, type = "text", maxLength, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; maxLength?: number; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
      />
    </div>
  );
}

/* ─── Section header ──────────────────────────── */
function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon size={15} className="text-primary" />
      </div>
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ─── Preset skills ───────────────────────────── */
const PRESET_SKILLS = [
  "AI 架构设计", "系统集成", "云原生", "大模型应用", "政企项目",
  "数据治理", "前端开发", "Python", "区块链", "安全合规",
  "运维自动化", "知识图谱", "RPA 流程", "VibeCoding",
];

/* ─── Main page ───────────────────────────────── */
interface ProfileForm {
  nickname: string;
  title: string;
  bio: string;
  avatar: string;
  skills: string[];
  location: string;
  website: string;
  yearsExp: number;
  phone: string;
  wechat: string;
}

interface SettlementForm {
  companyName: string;
  creditCode: string;
  businessLicenseUrl: string;
  legalRepIdFrontUrl: string;
  legalRepIdBackUrl: string;
  accountName: string;
  bankAccount: string;
  bankName: string;
  bankBranch: string;
  contactName: string;
  contactPhone: string;
}

const EMPTY_PROFILE: ProfileForm = {
  nickname: "", title: "", bio: "", avatar: "", skills: [],
  location: "", website: "", yearsExp: 0, phone: "", wechat: "",
};

const EMPTY_SETTLEMENT: SettlementForm = {
  companyName: "", creditCode: "", businessLicenseUrl: "",
  legalRepIdFrontUrl: "", legalRepIdBackUrl: "",
  accountName: "", bankAccount: "", bankName: "", bankBranch: "",
  contactName: "", contactPhone: "",
};

export default function AccountSettings() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: user } = useGetCurrentUser();
  const { data: profile } = useGetOpcProfile(user?.id ?? 0, { query: { enabled: !!user?.id } });
  const { mutateAsync: saveProfile } = useUpdateOpcProfile();

  const [profileForm, setProfileForm] = useState<ProfileForm>(EMPTY_PROFILE);
  const [settlementForm, setSettlementForm] = useState<SettlementForm>(EMPTY_SETTLEMENT);
  const [profileDirty, setProfileDirty] = useState(false);
  const [settlementDirty, setSettlementDirty] = useState(false);
  const [settlementStatus, setSettlementStatus] = useState<"pending" | "verified" | "rejected" | null>(null);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [loadingSettlement, setLoadingSettlement] = useState(true);
  const [saving, setSaving] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [newSkill, setNewSkill] = useState("");

  const [licenseUploading, setLicenseUploading] = useState(false);
  const [idFrontUploading, setIdFrontUploading] = useState(false);
  const [idBackUploading, setIdBackUploading] = useState(false);

  const settlementInitialized = useRef(false);

  /* Populate profile form once profile loads */
  useEffect(() => {
    if (!profile) return;
    const f: ProfileForm = {
      nickname: profile.nickname ?? "",
      title: profile.title ?? "",
      bio: profile.bio ?? "",
      avatar: profile.avatar ?? "",
      skills: profile.skillTags ?? [],
      location: profile.location ?? "",
      website: profile.website ?? "",
      yearsExp: profile.yearsExp ?? 0,
      phone: profile.phone ?? user?.phone ?? "",
      wechat: profile.wechat ?? "",
    };
    setProfileForm(f);
    setAvatarPreview(f.avatar);
  }, [profile, user?.phone]);

  /* Load settlement account */
  useEffect(() => {
    if (!user?.id || settlementInitialized.current) return;
    settlementInitialized.current = true;
    const token = getAccessToken();
    fetch(`${API_BASE}/api/opc/settlement-account`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(({ data }) => {
        if (data) {
          setSettlementForm({
            companyName: data.companyName ?? "",
            creditCode: data.creditCode ?? "",
            businessLicenseUrl: data.businessLicenseUrl ?? "",
            legalRepIdFrontUrl: data.legalRepIdFrontUrl ?? "",
            legalRepIdBackUrl: data.legalRepIdBackUrl ?? "",
            accountName: data.accountName ?? "",
            bankAccount: data.bankAccount ?? "",
            bankName: data.bankName ?? "",
            bankBranch: data.bankBranch ?? "",
            contactName: data.contactName ?? "",
            contactPhone: data.contactPhone ?? "",
          });
          setSettlementStatus(data.status ?? null);
          setRejectReason(data.rejectReason ?? null);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSettlement(false));
  }, [user?.id]);

  /* Profile field helpers */
  const setP = useCallback(<K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) => {
    setProfileForm(prev => ({ ...prev, [k]: v }));
    setProfileDirty(true);
  }, []);

  /* Settlement field helpers */
  const setS = useCallback(<K extends keyof SettlementForm>(k: K, v: SettlementForm[K]) => {
    setSettlementForm(prev => ({ ...prev, [k]: v }));
    setSettlementDirty(true);
  }, []);

  /* Avatar: file selected → open crop modal */
  const handleAvatarFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { if (ev.target?.result) setCropSrc(ev.target.result as string); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  /* Avatar: crop confirmed → upload */
  const handleCropConfirm = useCallback(async (blob: Blob) => {
    setCropSrc(null);
    setAvatarUploading(true);
    try {
      const url = await secureUpload(
        new File([blob], "avatar.jpg", { type: "image/jpeg" }),
        "image/jpeg",
      );
      setAvatarPreview(url);
      setP("avatar", url);
    } catch {
      toast({ title: "头像上传失败", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
    }
  }, [setP, toast]);

  /* Doc uploads */
  async function uploadDoc(
    file: File,
    setUploading: (v: boolean) => void,
    onSuccess: (url: string) => void,
  ) {
    setUploading(true);
    try {
      const url = await secureUpload(file);
      onSuccess(url);
    } catch {
      toast({ title: "上传失败，请重试", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  /* Skills */
  const addSkill = (tag: string) => {
    const t = tag.trim();
    if (t && !profileForm.skills.includes(t) && profileForm.skills.length < 12) {
      setP("skills", [...profileForm.skills, t]);
    }
    setNewSkill("");
  };

  /* Save */
  async function handleSave() {
    if (!profileDirty && !settlementDirty) {
      toast({ title: "没有需要保存的改动" });
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    try {
      const tasks: Promise<unknown>[] = [];

      if (profileDirty) {
        tasks.push(saveProfile({
          userId: user.id,
          data: {
            nickname: profileForm.nickname,
            avatar: profileForm.avatar || null,
            bio: profileForm.bio,
            skillTags: profileForm.skills,
            title: profileForm.title,
            location: profileForm.location,
            website: profileForm.website || null,
            yearsExp: profileForm.yearsExp,
            phone: profileForm.phone,
            wechat: profileForm.wechat,
          },
        }).then(updated => {
          qc.setQueryData([`/api/users/${user.id}/opc-profile`], updated);
          qc.invalidateQueries({ queryKey: ["/api/users/me"] });
        }));
      }

      if (settlementDirty) {
        const token = getAccessToken();
        tasks.push(
          fetch(`${API_BASE}/api/opc/settlement-account`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(settlementForm),
          })
            .then(async res => {
              if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`结算账户保存失败 (${res.status})${text ? ": " + text : ""}`);
              }
              return res.json();
            })
            .then(({ data }) => {
              if (!data) throw new Error("结算账户保存失败：服务器未返回有效数据");
              setSettlementStatus(data.status ?? "pending");
              setRejectReason(data.rejectReason ?? null);
            }),
        );
      }

      await Promise.all(tasks);

      setProfileDirty(false);
      setSettlementDirty(false);

      const msgs: string[] = [];
      if (profileDirty) msgs.push("基本资料已更新");
      if (settlementDirty) msgs.push("结算信息已提交审核");
      toast({ title: "保存成功", description: msgs.join("，") });
    } catch {
      toast({ title: "保存失败，请稍后重试", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const statusMap = {
    pending:  { label: "审核中",   color: "text-amber-600 bg-amber-50 border-amber-200",  icon: Clock },
    verified: { label: "已认证",   color: "text-green-600 bg-green-50 border-green-200",  icon: CheckCircle2 },
    rejected: { label: "审核未通过", color: "text-red-600 bg-red-50 border-red-200",       icon: AlertCircle },
  };
  const currentStatus = settlementStatus ? statusMap[settlementStatus] : null;
  const StatusIcon = currentStatus?.icon;

  return (
    <>
      {cropSrc && <CropModal src={cropSrc} onConfirm={handleCropConfirm} onCancel={() => setCropSrc(null)} />}

      <div className="max-w-2xl mx-auto py-8 px-4 pb-24 space-y-6">

        {/* Page header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-100 text-slate-400 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-foreground">账户设置</h1>
            <p className="text-xs text-slate-400 mt-0.5">管理您的个人资料与结算账户信息</p>
          </div>
        </div>

        {/* ══════════ Section 1: Basic Profile ══════════ */}
        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <SectionHeader icon={User} title="基本资料" subtitle="个人信息改动即时生效，无需审核" />

          <div className="p-6 space-y-6">

            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div
                className="relative shrink-0 cursor-pointer"
                onClick={() => !avatarUploading && avatarFileRef.current?.click()}
              >
                <div className="w-20 h-20 rounded-2xl border-4 border-slate-100 overflow-hidden bg-primary/10 flex items-center justify-center">
                  {avatarUploading ? (
                    <Loader2 size={28} className="text-primary animate-spin" />
                  ) : avatarPreview ? (
                    <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-black text-primary">{profileForm.nickname?.[0] ?? "新"}</span>
                  )}
                </div>
                {!avatarUploading && (
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-md">
                    <Camera size={13} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input ref={avatarFileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={handleAvatarFileSelected} />
                <button
                  onClick={() => !avatarUploading && avatarFileRef.current?.click()}
                  disabled={avatarUploading}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 rounded-xl py-3.5 text-sm font-bold text-primary transition-colors disabled:opacity-50"
                >
                  {avatarUploading ? <><Loader2 size={15} className="animate-spin" />上传中…</> : <><Upload size={15} />{avatarPreview ? "重新上传头像" : "点击上传头像"}</>}
                </button>
                <p className="text-[11px] text-slate-400 mt-1.5 text-center">支持 JPG / PNG / WebP，上传后可裁剪</p>
                {avatarPreview && !avatarUploading && (
                  <button onClick={() => { setAvatarPreview(""); setP("avatar", ""); }} className="mt-1 w-full text-center text-xs text-red-400 hover:text-red-600 hover:underline">
                    移除头像
                  </button>
                )}
              </div>
            </div>

            {/* Basic fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="显示姓名" value={profileForm.nickname} onChange={v => setP("nickname", v)} placeholder="张明远" required />
              </div>
              <div className="col-span-2">
                <Field label="职业头衔" value={profileForm.title} onChange={v => setP("title", v)} placeholder="AI 系统架构师" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5"><MapPin size={10} className="inline mr-1" />所在城市</label>
                <input type="text" value={profileForm.location} onChange={e => setP("location", e.target.value)} placeholder="北京"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5"><Briefcase size={10} className="inline mr-1" />从业年限</label>
                <input type="number" min={0} max={40} value={profileForm.yearsExp || ""} onChange={e => setP("yearsExp", Number(e.target.value))} placeholder="5"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">职业简介</label>
              <textarea rows={4} value={profileForm.bio} onChange={e => setP("bio", e.target.value)}
                placeholder="介绍您的专业背景、擅长领域和代表性成就…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none resize-none leading-relaxed bg-slate-50" />
              <p className="text-right text-[10px] text-slate-400 mt-0.5">{profileForm.bio.length} / 500</p>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">核心技能 <span className="font-normal text-slate-400">(最多 12 个)</span></label>
              <div className="flex flex-wrap gap-2 mb-2 min-h-[2rem]">
                {profileForm.skills.map(tag => (
                  <span key={tag} className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                    {tag}
                    <button onClick={() => setP("skills", profileForm.skills.filter(s => s !== tag))} className="hover:text-destructive">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {profileForm.skills.length === 0 && <span className="text-xs text-slate-400">尚未添加</span>}
              </div>
              <div className="flex gap-2 mb-2">
                <input type="text" value={newSkill} onChange={e => setNewSkill(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(newSkill); } }}
                  placeholder="输入自定义技能后按回车"
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none bg-slate-50" />
                <button onClick={() => addSkill(newSkill)} className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90">
                  <Plus size={15} />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_SKILLS.filter(s => !profileForm.skills.includes(s)).map(s => (
                  <button key={s} onClick={() => addSkill(s)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-primary/10 hover:text-primary text-slate-500 rounded-full text-[11px] font-medium transition-colors">
                    + {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-3">
                <label className="block text-xs font-bold text-slate-500 mb-1.5"><Link2 size={10} className="inline mr-1" />个人网站 / 作品链接</label>
                <input type="url" value={profileForm.website} onChange={e => setP("website", e.target.value)} placeholder="https://your-portfolio.com"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5"><Phone size={10} className="inline mr-1" />联系电话</label>
                <input type="tel" value={profileForm.phone} onChange={e => setP("phone", e.target.value)} placeholder="138 0000 0000"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5"><MessageCircle size={10} className="inline mr-1" />微信号</label>
                <input type="text" value={profileForm.wechat} onChange={e => setP("wechat", e.target.value)} placeholder="wechat_id"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* ══════════ Section 2: Enterprise & Settlement ══════════ */}
        <div className="bg-white rounded-2xl border border-border/50 shadow-sm overflow-hidden">
          <SectionHeader icon={Landmark} title="企业与结算信息" subtitle="修改后需重新审核，审核通过方可接单" />

          {/* Status banner */}
          {currentStatus && StatusIcon && (
            <div className={`mx-6 mt-4 flex items-start gap-2 px-4 py-3 rounded-xl border text-sm font-semibold ${currentStatus.color}`}>
              <StatusIcon size={15} className="shrink-0 mt-0.5" />
              <div>
                <span>账户状态：{currentStatus.label}</span>
                {settlementStatus === "pending" && <span className="font-normal text-xs ml-2">平台将在 1-3 个工作日内完成审核</span>}
                {settlementStatus === "rejected" && rejectReason && <p className="font-normal text-xs mt-0.5">驳回原因：{rejectReason}</p>}
                {settlementStatus === "rejected" && !rejectReason && <span className="font-normal text-xs ml-2">请修改后重新提交</span>}
              </div>
            </div>
          )}

          {loadingSettlement ? (
            <div className="p-8 text-center text-slate-400 text-sm">加载中…</div>
          ) : (
            <div className="p-6 space-y-6">

              {/* Company info */}
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Building2 size={12} />企业信息
                </div>
                <Field label="企业名称" value={settlementForm.companyName} onChange={v => setS("companyName", v)} placeholder="请输入营业执照上的企业名称" />
                <Field label="统一社会信用代码" value={settlementForm.creditCode} onChange={v => setS("creditCode", v)} placeholder="18位统一社会信用代码" maxLength={18} />
              </div>

              {/* Document uploads */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                  <IdCard size={12} />证件上传
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <DocCardUpload
                    label="营业执照"
                    hint="JPG / PNG / PDF"
                    docType="license"
                    value={settlementForm.businessLicenseUrl}
                    uploading={licenseUploading}
                    accept="image/*,.pdf"
                    onFileSelect={file => uploadDoc(file, setLicenseUploading, url => { setS("businessLicenseUrl", url); })}
                    onClear={() => setS("businessLicenseUrl", "")}
                  />
                  <DocCardUpload
                    label="法人身份证正面"
                    hint="JPG / PNG"
                    docType="id-front"
                    value={settlementForm.legalRepIdFrontUrl}
                    uploading={idFrontUploading}
                    accept="image/*"
                    onFileSelect={file => uploadDoc(file, setIdFrontUploading, url => { setS("legalRepIdFrontUrl", url); })}
                    onClear={() => setS("legalRepIdFrontUrl", "")}
                  />
                  <DocCardUpload
                    label="法人身份证背面"
                    hint="JPG / PNG"
                    docType="id-back"
                    value={settlementForm.legalRepIdBackUrl}
                    uploading={idBackUploading}
                    accept="image/*"
                    onFileSelect={file => uploadDoc(file, setIdBackUploading, url => { setS("legalRepIdBackUrl", url); })}
                    onClear={() => setS("legalRepIdBackUrl", "")}
                  />
                </div>
              </div>

              {/* Bank info */}
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <CreditCard size={12} />银行账户
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="开户名称" value={settlementForm.accountName} onChange={v => setS("accountName", v)} placeholder="与银行开户名称完全一致" />
                  <Field label="银行账号" value={settlementForm.bankAccount} onChange={v => setS("bankAccount", v)} placeholder="请输入银行账号" />
                  <Field label="开户银行" value={settlementForm.bankName} onChange={v => setS("bankName", v)} placeholder="如：中国工商银行" />
                  <Field label="开户支行" value={settlementForm.bankBranch} onChange={v => setS("bankBranch", v)} placeholder="如：北京市朝阳区建国路支行" />
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <User size={12} />财务联系人
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="联系人姓名" value={settlementForm.contactName} onChange={v => setS("contactName", v)} placeholder="请输入联系人姓名" />
                  <Field label="联系电话" value={settlementForm.contactPhone} onChange={v => setS("contactPhone", v)} placeholder="请输入联系电话" type="tel" />
                </div>
              </div>

              {/* Hint */}
              <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 leading-relaxed">
                <p className="font-semibold mb-1">温馨提示</p>
                <ul className="space-y-0.5 list-disc list-inside text-blue-600">
                  <li>企业名称、统一社会信用代码须与营业执照保持一致</li>
                  <li>请上传法人代表身份证正面和背面的清晰照片</li>
                  <li>银行账号、开户名称请与银行预留信息完全一致</li>
                  <li>提交后平台将在 1-3 个工作日内完成审核</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* ══════════ Save button (sticky) ══════════ */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-100 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="flex-1 text-xs text-slate-400">
              {(profileDirty || settlementDirty) ? (
                <span className="text-amber-600 font-semibold">
                  {[profileDirty && "基本资料", settlementDirty && "结算信息"].filter(Boolean).join(" · ")} 已修改
                </span>
              ) : (
                "尚无改动"
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving || (!profileDirty && !settlementDirty)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary/20"
            >
              {saving ? <><Loader2 size={15} className="animate-spin" />保存中…</> : <><Save size={15} />保存更改</>}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
