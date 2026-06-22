import { useState } from "react";
import { useLocation } from "wouter";
import { Menu, Bell } from "lucide-react";
import { PubSidebar } from "./PubSidebar";
import { clearSession } from "@/lib/auth";
import { PublisherHeaderUser } from "@/components/publisher/PublisherHeaderUser";

interface PubLayoutProps {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function PubLayout({ children, title, backHref, backLabel, actions }: PubLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, navigate] = useLocation();

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-[#f9f9fc] text-[#1a1c1e] overflow-x-hidden">
      <PubSidebar onLogout={logout} mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      <main className="flex-1 lg:ml-64 min-h-screen min-w-0 overflow-x-hidden">
        <header className="fixed top-0 right-0 lg:left-64 left-0 z-40 bg-white/80 backdrop-blur-md shadow-sm flex items-center px-4 lg:px-8 py-3 gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden shrink-0 p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Menu size={20} />
          </button>

          {backHref && (
            <button
              onClick={() => navigate(backHref)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-primary text-sm font-medium transition-colors shrink-0"
            >
              <span className="text-lg leading-none">←</span>
              {backLabel ?? "返回"}
            </button>
          )}

          {title && (
            <h1 className="text-base font-extrabold text-blue-900 font-display truncate">{title}</h1>
          )}
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

        <div className="pt-16 pb-12 px-4 lg:px-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
