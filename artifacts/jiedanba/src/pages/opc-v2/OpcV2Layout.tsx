import { useState } from "react";
import { useLocation } from "wouter";
import { Menu, ChevronLeft } from "lucide-react";
import { OpcV2Sidebar } from "./OpcV2Sidebar";
import { clearSession } from "@/lib/auth";
import { Navbar } from "@/components/layout/Navbar";

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

  const logout = () => {
    clearSession();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#f4f7f4]">
      {/* 顶部全局导航栏（老版 Navbar） */}
      <Navbar />

      {/* 侧边栏从 Navbar 底部开始 (pt-16 sm:pt-20 = 64px/80px) */}
      <OpcV2Sidebar
        onLogout={logout}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      {/* 主内容区：留出左侧边栏宽度 + 顶部 Navbar 高度 */}
      <main className="lg:ml-60 pt-16 sm:pt-20 min-h-screen min-w-0 overflow-x-hidden">
        {/* 页面内子标题栏：返回 + 标题 + 操作 */}
        {(backHref || title || actions) && (
          <div className="bg-white border-b border-slate-100 px-4 lg:px-8 py-3 flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden shrink-0 p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>
            {backHref && (
              <button
                onClick={() => navigate(backHref)}
                className="flex items-center gap-1 text-slate-500 hover:text-primary text-sm font-medium transition-colors shrink-0"
              >
                <ChevronLeft size={16} />
                {backLabel ?? "返回"}
              </button>
            )}
            {title && (
              <h1 className="text-base font-extrabold text-slate-800 truncate">{title}</h1>
            )}
            {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
          </div>
        )}

        {/* 无子标题栏时的汉堡按钮（移动端开侧栏） */}
        {!backHref && !title && !actions && (
          <div className="lg:hidden px-4 py-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>
          </div>
        )}

        <div className="pb-12 px-4 lg:px-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
