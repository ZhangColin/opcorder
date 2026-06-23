import { useState } from "react";
import { useLocation } from "wouter";
import { Menu } from "lucide-react";
import { OpcV2Sidebar } from "./OpcV2Sidebar";
import { clearSession } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

interface OpcV2LayoutProps {
  children: React.ReactNode;
  title?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

export function OpcV2Layout({ children }: OpcV2LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, navigate] = useLocation();

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <OpcV2Sidebar
        onLogout={logout}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <main className="lg:ml-60 pt-16 sm:pt-20 flex-1 min-w-0 overflow-x-hidden">
        <div className="lg:hidden px-4 py-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>

        <div className="pb-12 px-4 lg:px-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>

      <div className="lg:ml-60">
        <Footer />
      </div>
    </div>
  );
}
