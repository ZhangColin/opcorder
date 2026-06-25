import { useRef } from "react";
import { UploadCloud, FileText, X, Loader2, Paperclip } from "lucide-react";

/* ──────────────────────────────────────────────────────────────
   FilePickerZone  —  统一文件上传区域组件

   variant="zone"   : 带虚线框的整块可点击区（模态框上传场景）
   variant="inline" : 行内小按钮样式（富文本编辑器旁 "添加附件" 场景）
   variant="button" : 独立按钮样式（表单内单文件选择场景）
   ────────────────────────────────────────────────────────────── */

interface FilePickerZoneProps {
  /** 显示形式 */
  variant?: "zone" | "inline" | "button";
  /** 已选中的文件（受控） */
  file?: File | null;
  /** 多文件已选（variant=inline 时传此项） */
  files?: Array<{ name: string; url?: string }>;
  /** 上传中状态 */
  uploading?: boolean;
  /** 禁用 */
  disabled?: boolean;
  /** input accept */
  accept?: string;
  /** 允许多选 */
  multiple?: boolean;
  /** 选择文件后回调 */
  onChange: (file: File) => void;
  /** zone 场景：点 ✕ 清除 */
  onClear?: () => void;
  /** inline 场景：移除某一个文件 */
  onRemove?: (index: number) => void;
  /** 自定义占位文字 */
  placeholder?: string;
  /** 自定义子说明 */
  hint?: string;
}

export function FilePickerZone({
  variant = "zone",
  file,
  files,
  uploading = false,
  disabled = false,
  accept,
  multiple = false,
  onChange,
  onClear,
  onRemove,
  placeholder,
  hint,
}: FilePickerZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled && !uploading) inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onChange(f);
    e.target.value = "";
  };

  /* ── zone ── */
  if (variant === "zone") {
    return (
      <div
        onClick={handleClick}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
        className={`relative border-2 border-dashed rounded-xl px-5 py-6 flex flex-col items-center justify-center gap-2 transition-colors select-none
          ${disabled || uploading
            ? "border-slate-200 bg-slate-50 cursor-not-allowed opacity-60"
            : file
              ? "border-primary/40 bg-primary/5 cursor-pointer hover:border-primary hover:bg-primary/10"
              : "border-slate-300 bg-white cursor-pointer hover:border-primary hover:bg-primary/5"
          }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          disabled={disabled || uploading}
          onChange={handleChange}
        />

        {uploading ? (
          <>
            <Loader2 size={28} className="text-primary animate-spin" />
            <span className="text-sm font-medium text-primary">上传中…</span>
          </>
        ) : file ? (
          <>
            <FileText size={28} className="text-primary" />
            <span className="text-sm font-semibold text-slate-800 text-center break-all max-w-xs">{file.name}</span>
            <span className="text-xs text-slate-400">点击重新选择</span>
            {onClear && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onClear(); }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-100 hover:bg-red-100 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </>
        ) : (
          <>
            <UploadCloud size={28} className="text-slate-400" />
            <div className="text-center">
              <p className="text-sm font-semibold text-primary">
                {placeholder ?? "点击选择文件"}
              </p>
              {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
            </div>
          </>
        )}
      </div>
    );
  }

  /* ── button ── */
  if (variant === "button") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-xs font-bold hover:bg-primary/10 hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading
            ? <><Loader2 size={12} className="animate-spin" />上传中…</>
            : <><UploadCloud size={12} />选择文件</>
          }
        </button>
        {file && (
          <span className="flex items-center gap-1 text-xs text-slate-600">
            <FileText size={11} className="text-slate-400" />
            {file.name}
            {onClear && (
              <button type="button" onClick={onClear} className="text-slate-300 hover:text-red-500 ml-0.5">
                <X size={11} />
              </button>
            )}
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          multiple={multiple}
          disabled={disabled || uploading}
          onChange={handleChange}
        />
      </div>
    );
  }

  /* ── inline ── */
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || uploading}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-xs font-semibold hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading
          ? <><Loader2 size={11} className="animate-spin text-primary" />上传中…</>
          : <><Paperclip size={11} />添加附件</>
        }
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled || uploading}
        onChange={handleChange}
      />
      {files && files.length > 0 && files.map((f, i) => (
        <div key={i} className="flex items-center gap-1 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5">
          <FileText size={10} className="text-slate-400 shrink-0" />
          <span className="truncate max-w-[140px]">{f.name}</span>
          {onRemove && (
            <button type="button" onClick={() => onRemove(i)} className="text-slate-300 hover:text-red-500 ml-0.5 shrink-0">
              <X size={10} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
