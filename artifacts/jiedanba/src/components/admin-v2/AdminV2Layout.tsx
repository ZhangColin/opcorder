import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface AdminV2LayoutProps {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function AdminV2Layout({ children, title, actions }: AdminV2LayoutProps) {
  return (
    <div className="space-y-4">
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3">
          {title && <h2 className="text-[17px] font-extrabold text-blue-900 tracking-tight">{title}</h2>}
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Shared Section card (matches PubDemandDetail style) ── */
export function Section({
  title,
  icon: Icon,
  actions,
  children,
  defaultOpen = true,
  collapsible = true,
}: {
  title: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div
        role={collapsible ? "button" : undefined}
        onClick={collapsible ? () => setOpen(v => !v) : undefined}
        className={`flex items-center gap-3 px-6 py-4 ${collapsible ? "cursor-pointer hover:bg-slate-50 transition-colors" : ""}`}
      >
        {Icon && <Icon size={16} className="text-primary shrink-0" />}
        <span className="font-bold text-slate-800 flex-1 text-sm">{title}</span>
        {actions && (
          <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
            {actions}
          </div>
        )}
        {collapsible && (
          open
            ? <ChevronUp size={15} className="text-slate-400 shrink-0" />
            : <ChevronDown size={15} className="text-slate-400 shrink-0" />
        )}
      </div>
      {open && <div className="px-6 pb-6 border-t border-slate-100">{children}</div>}
    </div>
  );
}
