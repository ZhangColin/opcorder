import { ReactNode } from "react";
import { Inbox, Loader2 } from "lucide-react";

/* ─── Section header ─────────────────── */
export function PageHeader({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-extrabold text-primary font-display">{title}</h1>
        {desc && <p className="text-sm text-muted-foreground mt-1">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

/* ─── Empty state ────────────────────── */
export function EmptyState({ text = "暂无数据", icon }: { text?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <div className="w-14 h-14 rounded-2xl bg-primary/5 flex items-center justify-center mb-3">
        {icon ?? <Inbox size={26} className="text-primary/40" />}
      </div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

/* ─── Loading ─────────────────────────── */
export function Loading() {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <Loader2 size={26} className="animate-spin text-primary" />
    </div>
  );
}

/* ─── Error banner ────────────────────── */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3">
      {message}
    </div>
  );
}

/* ─── Primary button ─────────────────── */
export function PrimaryButton({
  children, onClick, type = "button", disabled, className = "",
}: {
  children: ReactNode; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean; className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 bg-primary text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children, onClick, active, className = "",
}: {
  children: ReactNode; onClick?: () => void; active?: boolean; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors border ${
        active
          ? "bg-primary text-white border-primary"
          : "bg-white text-slate-600 border-border/60 hover:border-primary/40 hover:text-primary"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/* ─── Modal shell ─────────────────────── */
export function Modal({
  title, onClose, children, footer, wide,
}: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-2xl" : "max-w-lg"} flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-extrabold text-primary font-display">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 text-xl leading-none w-8 h-8">
            ×
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">{footer}</div>}
      </div>
    </div>
  );
}

/* ─── Form field ─────────────────────── */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-bold text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-border/60 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors";

/* ─── Tag list input helper ──────────── */
export function TagBadges({ tags }: { tags?: string[] | null }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-primary/8 text-primary font-medium">
          {t}
        </span>
      ))}
    </div>
  );
}

/* ─── App type badge ─────────────────── */
export function AppTypeBadge({ appType }: { appType: "agent" | "workflow" }) {
  const isAgent = appType === "agent";
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${
        isAgent ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
      }`}
    >
      {isAgent ? "Agent" : "工作流"}
    </span>
  );
}
