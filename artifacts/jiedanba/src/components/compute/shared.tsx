import { ReactNode, useEffect, useRef } from "react";
import { X, Inbox, Loader2 } from "lucide-react";

/* ─── status badge ─────────────────────────── */

type BadgeTone = "green" | "red" | "gray" | "blue" | "yellow";

const TONE_CLS: Record<BadgeTone, string> = {
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  gray: "bg-slate-100 text-slate-500",
  blue: "bg-blue-100 text-blue-700",
  yellow: "bg-amber-100 text-amber-700",
};

/** 中文文案 + 配色 */
export const STATUS_MAP: Record<string, { label: string; tone: BadgeTone }> = {
  // 通用
  running: { label: "运行中", tone: "green" },
  completed: { label: "已完成", tone: "green" },
  stopped: { label: "已停止", tone: "gray" },
  error: { label: "错误", tone: "red" },
  failed: { label: "失败", tone: "red" },
  submit_failed: { label: "提交失败", tone: "red" },
  deploy_failed: { label: "部署失败", tone: "red" },
  creating: { label: "创建中", tone: "blue" },
  deploying: { label: "部署中", tone: "blue" },
  pending: { label: "等待中", tone: "yellow" },
  waiting: { label: "等待中", tone: "yellow" },
  expired: { label: "已过期", tone: "gray" },
  paid: { label: "已支付", tone: "green" },
  cancelled: { label: "已取消", tone: "gray" },
  refunded: { label: "已退款", tone: "yellow" },
  active: { label: "生效中", tone: "green" },
};

export function StatusBadge({ status }: { status?: string | null }) {
  const s = status && STATUS_MAP[status] ? STATUS_MAP[status] : { label: status ?? "未知", tone: "gray" as BadgeTone };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${TONE_CLS[s.tone]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {s.label}
    </span>
  );
}

/* ─── card ─────────────────────────────────── */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl p-5 border border-border/50 shadow-sm hover:shadow-md transition-shadow ${className}`}>
      {children}
    </div>
  );
}

/* ─── button ───────────────────────────────── */

export function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-4 py-2 text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-primary disabled:opacity-40 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

/* ─── modal ────────────────────────────────── */

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-primary font-display">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  );
}

/* ─── form fields ──────────────────────────── */

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-600 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors";

/* ─── empty / loading / error ──────────────── */

export function EmptyState({ text = "暂无数据" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-300">
      <Inbox size={44} strokeWidth={1.4} />
      <p className="mt-3 text-sm font-bold text-slate-400">{text}</p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16 text-primary">
      <Loader2 size={28} className="animate-spin" />
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm font-bold text-red-500">{message ?? "加载失败"}</p>
    </div>
  );
}

/* ─── tab bar ──────────────────────────────── */

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { value: T; label: string }[];
  active: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-100">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors ${
            active === t.value
              ? "border-primary text-primary"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ─── helpers ──────────────────────────────── */

export function fenToYuan(fen?: number | null): string {
  const n = typeof fen === "number" ? fen : 0;
  return `¥${(n / 100).toFixed(2)}`;
}

export function fmtDate(v?: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN", { hour12: false });
}

export function fmtRuntime(sec?: number | null): string {
  if (!sec || sec <= 0) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}小时${m}分`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

export function fmtSize(mb?: number | null): string {
  const n = typeof mb === "number" ? mb : 0;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} GB`;
  return `${n} MB`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* close-on-outside-click hook */
export function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [onOutside]);
  return ref;
}

/* table shell */
export function TableShell({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/50 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-bold text-slate-400 border-b border-slate-100">{head}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
