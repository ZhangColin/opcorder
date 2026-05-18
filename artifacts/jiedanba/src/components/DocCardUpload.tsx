import { useRef } from "react";
import { Loader2, Upload } from "lucide-react";

export type DocType = "license" | "id-front" | "id-back";

export function DocCardIllustration({ docType }: { docType: DocType }) {
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

export interface DocCardProps {
  label: string;
  hint: string;
  docType: DocType;
  value: string;
  uploading: boolean;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  accept?: string;
}

export function DocCardUpload({
  label, hint, docType, value, uploading, onFileSelect, onClear, accept = "image/*,.pdf",
}: DocCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-slate-600">{label}</label>
      <div
        className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
          value
            ? "border-slate-200 hover:border-primary/40"
            : "border-dashed border-slate-200 hover:border-primary/50 hover:bg-primary/[0.02]"
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
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onFileSelect(f);
            e.target.value = "";
          }}
        />
      </div>
      {value && (
        <div className="flex items-center justify-between text-[11px]">
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
            查看原图
          </a>
          <button
            onClick={e => { e.stopPropagation(); onClear(); }}
            className="text-slate-400 hover:text-red-500 transition-colors"
          >
            删除
          </button>
        </div>
      )}
    </div>
  );
}
