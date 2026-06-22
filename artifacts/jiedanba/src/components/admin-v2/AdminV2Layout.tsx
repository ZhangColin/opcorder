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
          {title && <h2 className="text-lg font-bold text-blue-900">{title}</h2>}
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
