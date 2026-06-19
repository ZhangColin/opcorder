import { useState } from "react";
import { useLocation } from "wouter";
import { Menu, Bell } from "lucide-react";
import { OpcV2Sidebar } from "./OpcV2Sidebar";
import { clearSession } from "@/lib/auth";
import { useCurrentUser } from "@/hooks/use-current-user";

interface OpcV2LayoutProps {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function OpcV2Layout({ children, title, backHref, backLabel, actions }: OpcV2LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, navigate] = useLocation();
  const { avatarChar, nickname } = useCurrentUser();

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-[#f4f7f4] text-[#1a1c1e] overflow-x-hidden">
      <OpcV2Sidebar onLogout={logout} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      <main className="flex-1 lg:ml-60 min-h-screen min-w-0 overflow-x-hidden">
        <header className="fixed top-0 right-0 lg:left-60 left-0 z-40 bg-white/90 backdrop-blur-md shadow-sm flex items-center px-4 lg:px-8 py-3 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden shrink-0 p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu size={20} />
          </button>

          {backHref && (
            <button
              onClick={() => navigate(backHref)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-emerald-700 text-sm font-medium transition-colors shrink-0"
            >
              <span className="text-lg leading-none">←</span>
              {backLabel ?? "返回"}
            </button>
          )}
          {title && (
            <h1 className="text-base font-extrabold text-emerald-900 font-display truncate">{title}</h1>
          )}
          {actions && <div className="flex items-center gap-2 ml-2">{actions}</div>}

          <div className="ml-auto flex items-center gap-3">
            <button className="relative p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors">
              <Bell size={18} />
            </button>
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm flex items-center justify-center">
              {avatarChar}
            </div>
          </div>
        </header>

        <div className="pt-16 pb-12 px-4 lg:px-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
