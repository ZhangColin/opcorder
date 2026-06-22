import { Link, useLocation } from "wouter";
import {
  FileText, FileSignature, CreditCard, Wrench,
  PlusCircle, LogOut, X, PackageCheck,
  LayoutDashboard, Bell,
} from "lucide-react";
import { SiteLogo } from "@/components/SiteLogo";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { v2Get } from "@/lib/v2api";

interface BadgeCounts { pendingA: number; pendingB: number; }

interface SidebarLinkProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
  dot?: boolean;
}

function SidebarLink({ icon: Icon, label, href, active, onClick, dot }: SidebarLinkProps) {
  const cls = `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:translate-x-0.5 cursor-pointer ${
    active ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-primary"
  }`;
  return (
    <Link href={href}>
      <div className={cls} onClick={onClick}>
        <Icon size={18} />
        <span className="flex-1">{label}</span>
        {dot && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />}
      </div>
    </Link>
  );
}

interface PubSidebarProps {
  onLogout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function PubSidebar({ onLogout, mobileOpen = false, onMobileClose }: PubSidebarProps) {
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

  const isActive = (path: string) => {
    if (path === "/pub" && (location === "/pub" || location === "/")) return true;
    if (path !== "/pub" && location.startsWith(path)) return true;
    return false;
  };

  const close = () => onMobileClose?.();

  const content = (
    <>
      <div className="mb-6 px-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <SiteLogo size={32} />
          <div>
            <h2 className="text-base font-extrabold text-blue-900 leading-tight font-display">发单方门户</h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">机构专属通道</p>
          </div>
        </div>
        <button
          onClick={close}
          className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto min-h-0">
        <SidebarLink icon={LayoutDashboard} label="工作台"    href="/pub"              active={isActive("/pub")}              onClick={close} />
        <SidebarLink icon={FileText}        label="需求管理"   href="/pub/demands"      active={isActive("/pub/demands")}      onClick={close} />
        <SidebarLink icon={FileSignature}   label="合同管理"   href="/pub/contracts"    active={isActive("/pub/contracts")}    onClick={close} />
        <SidebarLink icon={CreditCard}      label="付款管理"   href="/pub/payments"     active={isActive("/pub/payments")}     onClick={close} />
        <SidebarLink icon={PackageCheck}    label="交付确认"   href="/pub/deliveries"   active={isActive("/pub/deliveries")}   onClick={close}
          dot={(badges?.pendingA ?? 0) > 0} />
        <SidebarLink icon={Wrench}          label="质保工单"   href="/pub/tickets"      active={isActive("/pub/tickets")}      onClick={close} />
        <SidebarLink icon={Bell}            label="消息中心"   href="/pub/notifications" active={isActive("/pub/notifications")} onClick={close} />
      </nav>

      <Link href="/pub/demands/new" onClick={close}>
        <div className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl px-4 py-3 font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all cursor-pointer mt-4">
          <PlusCircle size={16} /> 发布新需求
        </div>
      </Link>

      <div className="mt-4 border-t border-slate-200 pt-4 shrink-0">
        <button
          onClick={() => { close(); onLogout(); }}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut size={18} /> 退出登录
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden lg:flex h-screen w-64 fixed left-0 top-0 z-50 bg-slate-50 border-r border-slate-200 flex-col p-4 gap-1">
        {content}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-slate-50 border-r border-slate-200 flex flex-col p-4 gap-1 animate-in slide-in-from-left duration-300 shadow-2xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
