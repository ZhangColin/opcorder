import { Link, useLocation } from "wouter";
import {
  FileText, FileSignature, CreditCard, Wrench,
  LogOut, X, ChevronRight, Package, Users2, Boxes,
  Wallet, LayoutGrid, Network, Gavel,
} from "lucide-react";
import { SiteLogo } from "@/components/SiteLogo";
import { useEffect } from "react";

interface SidebarLinkProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
  onClick?: () => void;
  highlight?: boolean;
}

function SidebarLink({ icon: Icon, label, href, active, onClick, highlight }: SidebarLinkProps) {
  const cls = `w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:translate-x-0.5 cursor-pointer ${
    active ? "bg-white text-primary shadow-sm" : highlight ? "text-amber-600 hover:text-amber-700" : "text-slate-500 hover:text-primary"
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

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="px-4 pt-3 pb-1">
      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">{label}</span>
    </div>
  );
}

interface AdminV2SidebarProps {
  onLogout: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AdminV2Sidebar({ onLogout, mobileOpen = false, onMobileClose }: AdminV2SidebarProps) {
  const [location] = useLocation();

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (isMobile) document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const isActive = (path: string) => location === path || location.startsWith(path + "/");
  const close = () => onMobileClose?.();

  const content = (
    <>
      <div className="mb-4 px-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <SiteLogo size={30} />
          <div>
            <h2 className="text-base font-extrabold text-blue-900 leading-tight font-display">运营 V2</h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">双通道后台</p>
          </div>
        </div>
        <button
          onClick={close}
          className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-colors">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 flex flex-col">
        <SidebarLink icon={LayoutGrid} label="跨通道总览" href="/admin/v2/overview"
          active={isActive("/admin/v2/overview")} onClick={close} />

        <SectionLabel label="通道A · 发单方" />
        <SidebarLink icon={FileText}      label="客户需求"   href="/admin/v2/client-demands"
          active={isActive("/admin/v2/client-demands")} onClick={close} />
        <SidebarLink icon={FileSignature} label="合同 (A)"   href="/admin/v2/contracts-a"
          active={isActive("/admin/v2/contracts-a")} onClick={close} />
        <SidebarLink icon={CreditCard}    label="收款 (A)"   href="/admin/v2/payments-a"
          active={isActive("/admin/v2/payments-a")} onClick={close} />
        <SidebarLink icon={Wrench}        label="工单 (A)"   href="/admin/v2/tickets-a"
          active={isActive("/admin/v2/tickets-a")} onClick={close} />

        <SectionLabel label="通道B · OPC" />
        <SidebarLink icon={Network}  label="外包需求"   href="/admin/v2/outsource-demands"
          active={isActive("/admin/v2/outsource-demands")} onClick={close} />
        <SidebarLink icon={Gavel}    label="投标管理"   href="/admin/v2/tenders"
          active={isActive("/admin/v2/tenders")} onClick={close} />
        <SidebarLink icon={Boxes}    label="接单订单"   href="/admin/v2/outsource-orders"
          active={isActive("/admin/v2/outsource-orders")} onClick={close} />
        <SidebarLink icon={Wallet}   label="结算付款"   href="/admin/v2/payments-b"
          active={isActive("/admin/v2/payments-b")} onClick={close} />
        <SidebarLink icon={Package}  label="工单 (B)"   href="/admin/v2/tickets-b"
          active={isActive("/admin/v2/tickets-b")} onClick={close} />
      </nav>

      <div className="mt-4 border-t border-slate-200 pt-4 flex flex-col gap-0.5">
        <Link href="/admin" onClick={close}>
          <div className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
            <ChevronRight size={14} className="rotate-180" /> 返回旧版后台
          </div>
        </Link>
        <button
          onClick={() => { close(); onLogout(); }}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors mt-1"
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
