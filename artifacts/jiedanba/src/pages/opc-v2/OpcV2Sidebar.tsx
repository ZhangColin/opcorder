import { Link, useLocation } from "wouter";
import {
  LayoutGrid, Search, FileText, Package, Wallet, Wrench, LogOut, X, ChevronRight,
} from "lucide-react";
import { SiteLogo } from "@/components/SiteLogo";
import { clearSession } from "@/lib/auth";
import { useEffect } from "react";

interface SidebarLinkProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
}

function SidebarLink({ icon: Icon, label, href, active, onClick }: SidebarLinkProps) {
  const cls = `w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:translate-x-0.5 cursor-pointer ${
    active ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-primary"
  }`;
  return (
    <Link href={href}>
      <div className={cls} onClick={onClick}>
        <Icon size={17} />
        <span className="flex-1">{label}</span>
      </div>
    </Link>
  );
}

interface OpcV2SidebarProps {
  onLogout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function OpcV2Sidebar({ onLogout, mobileOpen = false, onMobileClose }: OpcV2SidebarProps) {
  const [location] = useLocation();

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (isMobile) document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const isActive = (path: string) =>
    path === "/opc" ? location === "/opc" : location === path || location.startsWith(path + "/");
  const close = () => onMobileClose?.();

  const content = (
    <>
      <div className="mb-4 px-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SiteLogo size={30} />
          <div>
            <h2 className="text-base font-extrabold text-emerald-900 leading-tight font-display">OPC 工作台</h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">V2 双通道</p>
          </div>
        </div>
        <button
          onClick={close}
          className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5">
        <SidebarLink icon={LayoutGrid} label="待办总览"  href="/opc"              active={isActive("/opc")}             onClick={close} />
        <SidebarLink icon={Search}     label="需求大厅"  href="/opc/demand-hall"  active={isActive("/opc/demand-hall")} onClick={close} />
        <SidebarLink icon={FileText}   label="我的投标"  href="/opc/tenders"      active={isActive("/opc/tenders")}     onClick={close} />
        <SidebarLink icon={Package}    label="我的订单"  href="/opc/orders"       active={isActive("/opc/orders")}      onClick={close} />
        <SidebarLink icon={Wallet}     label="我的收款"  href="/opc/income"       active={isActive("/opc/income")}      onClick={close} />
        <SidebarLink icon={Wrench}     label="工单"      href="/opc/tickets"      active={isActive("/opc/tickets")}     onClick={close} />
      </nav>

      <div className="mt-4 border-t border-slate-200 pt-4 flex flex-col gap-0.5">
        <Link href="/" onClick={close}>
          <div className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
            <ChevronRight size={14} className="rotate-180" /> 返回旧版工作台
          </div>
        </Link>
        <button
          onClick={() => { close(); onLogout(); }}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-colors mt-1"
        >
          <LogOut size={18} /> 退出登录
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden lg:flex h-screen w-60 fixed left-0 top-0 z-50 bg-slate-50 border-r border-slate-200 flex-col p-4 gap-1">
        {content}
      </aside>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-slate-50 border-r border-slate-200 flex flex-col p-4 gap-1 animate-in slide-in-from-left duration-300 shadow-2xl">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
