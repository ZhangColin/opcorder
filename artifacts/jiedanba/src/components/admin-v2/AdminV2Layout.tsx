interface AdminV2LayoutProps {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function AdminV2Layout({ children }: AdminV2LayoutProps) {
  return <div className="space-y-4">{children}</div>;
}
