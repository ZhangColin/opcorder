import { useState } from "react";
import { useLocation } from "wouter";
import {
  Menu, Bell, LayoutDashboard, FileText, FileSignature,
  CreditCard, PackageCheck, Wrench, Building2,
} from "lucide-react";
import { PubSidebar } from "./PubSidebar";
import { clearSession } from "@/lib/auth";
import { PublisherHeaderUser } from "@/components/publisher/PublisherHeaderUser";

/* route → { icon, label } */
const ROUTE_MAP: { path: string; icon: React.ElementType; label: string }[] = [
  { path: "/pub/demands",       icon: FileText,        label: "需求管理" },
  { path: "/pub/contracts",     icon: FileSignature,   label: "合同管理" },
  { path: "/pub/payments",      icon: CreditCard,      label: "付款管理" },
  { path: "/pub/deliveries",    icon: PackageCheck,    label: "交付确认" },
  { path: "/pub/tickets",       icon: Wrench,          label: "质保工单" },
  { path: "/pub/notifications", icon: Bell,            label: "消息中心" },
  { path: "/pub/profile",       icon: Building2,       label: "企业信息" },
  { path: "/pub",               icon: LayoutDashboard, label: "工作台" },
];

interface PubLayoutProps {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function PubLayout({ children, title, backHref, backLabel, actions }: PubLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location, navigate] = useLocation();

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  /* auto-detect page from route (longest prefix match) */
  const matched = ROUTE_MAP.find(r =>
    location === r.path || location.startsWith(r.path + "/")
  );
  const PageIcon  = matched?.icon ?? LayoutDashboard;
  const pageLabel = title || matched?.label || "";

  return (
    <div className="flex min-h-screen bg-[#f9f9fc] text-[#1a1c1e] overflow-x-hidden">
      <PubSidebar onLogout={logout} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      <main className="flex-1 lg:ml-64 min-h-screen min-w-0 overflow-x-hidden">
        <header className="fixed top-0 right-0 lg:left-64 left-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-100 shadow-sm flex items-center px-4 lg:px-8 py-3 gap-3">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden shrink-0 p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Menu size={20} />
          </button>

          {/* Back button */}
          {backHref && (
            <button
              onClick={() => navigate(backHref)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-primary text-sm font-medium transition-colors shrink-0"
            >
              <span className="text-lg leading-none">←</span>
              {backLabel ?? "返回"}
            </button>
          )}

          {/* Page icon + name */}
          {pageLabel && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                <PageIcon size={14} className="text-primary" />
              </div>
              <h1 className="text-sm font-extrabold text-blue-900 font-display truncate">{pageLabel}</h1>
            </div>
          )}

          {/* Slot for page-level actions */}
          {actions && <div className="flex items-center gap-2">{actions}</div>}

          <div className="ml-auto flex items-center gap-3">
            <button
              className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors"
              onClick={() => navigate("/pub/notifications")}
            >
              <Bell size={20} />
            </button>
            <PublisherHeaderUser onLogout={logout} />
          </div>
        </header>

        {/* Extra top padding to create breathing room below fixed header */}
        <div className="pt-20 pb-12 px-4 lg:px-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
