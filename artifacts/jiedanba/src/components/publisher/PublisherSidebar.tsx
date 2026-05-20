import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, BarChart2, FileText,
  PlusCircle, HelpCircle, LogOut, ClipboardList, Bell, MessageSquare, X, Sparkles,
} from "lucide-react";
import { HelpDialog } from "@/components/HelpDialog";
import { SiteLogo } from "@/components/SiteLogo";
import { useState, useEffect } from "react";

interface SidebarLinkProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
}

function SidebarLink({ icon: Icon, label, href, active, onClick }: SidebarLinkProps) {
  const cls = `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:translate-x-0.5 cursor-pointer ${
    active ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-primary"
  }`;
  return (
    <Link href={href}>
      <div className={cls} onClick={onClick}>
        <Icon size={18} />
        {label}
      </div>
    </Link>
  );
}

interface PublisherSidebarProps {
  onLogout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function PublisherSidebar({ onLogout, mobileOpen = false, onMobileClose }: PublisherSidebarProps) {
  const [location] = useLocation();
  const [showHelp, setShowHelp] = useState(false);

  /* Lock body scroll on mobile when open */
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      document.body.style.overflow = mobileOpen ? "hidden" : "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const isActive = (path: string) => {
    if (path === "/publisher" && location === "/publisher") return true;
    if (path !== "/publisher" && location.startsWith(path)) return true;
    return false;
  };

  const handleLinkClick = () => {
    onMobileClose?.();
  };

  const sidebarContent = (
    <>
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}

      <div className="mb-6 px-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SiteLogo size={32} />
          <div>
            <h2 className="text-base font-extrabold text-blue-900 leading-tight font-display">发单方门户</h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">机构专属通道</p>
          </div>
        </div>
        {/* Close button on mobile */}
        <button
          onClick={onMobileClose}
          className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5">
        <SidebarLink icon={LayoutDashboard} label="工作台"    href="/publisher"          active={isActive("/publisher")} onClick={handleLinkClick} />
        <SidebarLink icon={FileText}        label="需求管理"   href="/publisher/demands"  active={isActive("/publisher/demands")} onClick={handleLinkClick} />
        <SidebarLink icon={ClipboardList}   label="订单管理"    href="/publisher/orders"        active={isActive("/publisher/orders")} onClick={handleLinkClick} />
        <SidebarLink icon={Users}           label="OPC 人才库"  href="/publisher/opc-library"  active={isActive("/publisher/opc-library")} onClick={handleLinkClick} />
        <SidebarLink icon={Bell}            label="消息中心"    href="/publisher/notifications" active={isActive("/publisher/notifications")} onClick={handleLinkClick} />
        <SidebarLink icon={BarChart2}       label="财务中心"    href="/publisher/finance"       active={isActive("/publisher/finance")} onClick={handleLinkClick} />
        <SidebarLink icon={MessageSquare}   label="社区"      href="/community"          active={isActive("/community")} onClick={handleLinkClick} />
      </nav>

      <div className="flex flex-col gap-1.5">
        <Link href="/publisher/demands/new?ai=1" onClick={handleLinkClick}>
          <div className="relative flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl px-4 py-3 font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all cursor-pointer overflow-hidden">
            <Sparkles size={15} /> AI 发布需求
            <span className="absolute top-0 right-0 bg-amber-400 text-[9px] font-black text-amber-900 px-1.5 py-0.5 rounded-bl-lg rounded-tr-xl leading-tight">推荐</span>
          </div>
        </Link>
        <Link href="/publisher/demands/new" onClick={handleLinkClick}>
          <div className="flex items-center justify-center gap-1.5 text-slate-400 hover:text-primary text-xs font-bold py-1 transition-colors cursor-pointer">
            <PlusCircle size={12} /> 手动填写
          </div>
        </Link>
      </div>

      <div className="mt-4 border-t border-slate-200 pt-4 flex flex-col gap-0.5">
        <button
          onClick={() => setShowHelp(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:text-primary hover:bg-primary/5 transition-all"
        >
          <HelpCircle size={18} /> 帮助中心
        </button>
        <button
          onClick={() => { onMobileClose?.(); onLogout(); }}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut size={18} /> 退出登录
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar – always visible on md+ */}
      <aside className="hidden md:flex h-screen w-64 fixed left-0 top-0 z-50 bg-slate-50 border-r border-slate-200 flex-col p-4 gap-1">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar – slide-over */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          {/* Panel */}
          <aside className="absolute left-0 top-0 h-full w-64 bg-slate-50 border-r border-slate-200 flex flex-col p-4 gap-1 animate-in slide-in-from-left duration-300 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
