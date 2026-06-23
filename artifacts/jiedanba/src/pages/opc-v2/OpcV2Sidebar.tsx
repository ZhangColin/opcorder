import { Link, useLocation } from "wouter";
import {
  LayoutGrid, FileText, Package, Wallet, Wrench, X, PackageCheck,
} from "lucide-react";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { v2Get } from "@/lib/v2api";

interface BadgeCounts { pendingA: number; pendingB: number; }

interface NavItem {
  icon: React.ElementType;
  label: string;
  href: string;
  dot?: boolean;
}

interface OpcV2SidebarProps {
  onLogout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function OpcV2Sidebar({ onLogout: _onLogout, mobileOpen = false, onMobileClose }: OpcV2SidebarProps) {
  const [location] = useLocation();

  const { data: badges } = useQuery<BadgeCounts>({
    queryKey: ["delivery-badge-counts"],
    queryFn: () => v2Get("/delivery-badge-counts"),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (isMobile) document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const close = () => onMobileClose?.();

  const isActive = (path: string) =>
    path === "/opc" ? location === "/opc" : location === path || location.startsWith(path + "/");

  const navItems: NavItem[] = [
    { icon: LayoutGrid,   label: "待办总览",  href: "/opc" },
    { icon: FileText,     label: "我的投标",  href: "/opc/tenders" },
    { icon: Package,      label: "我的订单",  href: "/opc/orders" },
    { icon: Wallet,       label: "我的收款",  href: "/opc/income" },
    { icon: PackageCheck, label: "交付管理",  href: "/opc/deliveries", dot: (badges?.pendingB ?? 0) > 0 },
    { icon: Wrench,       label: "工单",      href: "/opc/tickets" },
  ];

  const navContent = (
    <nav className="flex flex-col gap-0.5">
      {navItems.map(({ icon: Icon, label, href, dot }) => {
        const active = isActive(href);
        return (
          <Link key={href} href={href}>
            <div
              onClick={close}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1">{label}</span>
              {dot && <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse shrink-0" />}
            </div>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop: card block, sticky */}
      <div className="hidden lg:block w-56 xl:w-60 shrink-0 px-4 pt-6">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sticky top-24">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <LayoutGrid size={16} className="text-primary shrink-0" />
            <span className="text-sm font-extrabold text-foreground">OPC 工作台</span>
          </div>
          {navContent}
        </div>
      </div>

      {/* Mobile: slide-in overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-background flex flex-col p-5 gap-4 animate-in slide-in-from-left duration-300 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-extrabold text-foreground">OPC 工作台</span>
              <button
                onClick={close}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
