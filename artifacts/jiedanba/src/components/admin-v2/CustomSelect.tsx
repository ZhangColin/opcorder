import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Loader2 } from "lucide-react";

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "请选择",
  loading = false,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
      >
        {loading ? (
          <span className="text-slate-400 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" />加载中…</span>
        ) : selected ? (
          <span className="text-slate-800 text-left truncate">{selected.label}</span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <span className={opt.value === value ? "text-primary font-medium" : "text-slate-700"}>{opt.label}</span>
              {opt.value === value && <Check size={13} className="text-primary shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
