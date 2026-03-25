import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, BarChart2, FileText,
  PlusCircle, HelpCircle, LogOut, ShieldCheck, Gavel, Gauge, ClipboardList,
} from "lucide-react";

interface SidebarLinkProps {
  icon: React.ElementType;
  label: string;
  href: string;
  active?: boolean;
}

function SidebarLink({ icon: Icon, label, href, active }: SidebarLinkProps) {
  const cls = `w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:translate-x-0.5 cursor-pointer ${
    active ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-primary"
  }`;
  return (
    <Link href={href}>
      <div className={cls}>
        <Icon size={18} />
        {label}
      </div>
    </Link>
  );
}

export function PublisherSidebar({ onLogout }: { onLogout: () => void }) {
  const [location] = useLocation();

  const isActive = (path: string) => {
    if (path === "/publisher" && location === "/publisher") return true;
    if (path !== "/publisher" && location.startsWith(path)) return true;
    return false;
  };

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 z-50 bg-slate-50 border-r border-slate-200 flex flex-col p-4 gap-1">
      <div className="mb-6 px-2 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <ShieldCheck size={20} strokeWidth={2.5} />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-blue-900 leading-tight font-display">发单方门户</h2>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest">机构专属通道</p>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-0.5">
        <SidebarLink icon={LayoutDashboard} label="工作台"    href="/publisher"          active={isActive("/publisher")} />
        <SidebarLink icon={FileText}        label="需求管理"   href="/publisher/demands"  active={isActive("/publisher/demands")} />
        <SidebarLink icon={ClipboardList}   label="订单管理"   href="/publisher/orders"   active={isActive("/publisher/orders")} />
        <SidebarLink icon={Users}           label="OPC 人才库" href="#"                   active={false} />
        <SidebarLink icon={BarChart2}       label="数据分析"   href="#"                   active={false} />
        <SidebarLink icon={Gauge}           label="驾驶舱"    href="/publisher/cockpit"  active={isActive("/publisher/cockpit")} />
        <SidebarLink icon={Gavel}           label="争议处理"  href="/publisher/disputes" active={isActive("/publisher/disputes")} />
      </nav>

      <Link href="/publisher/demands/new">
        <div className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-xl px-4 py-3 font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all cursor-pointer">
          <PlusCircle size={16} /> 发布新需求
        </div>
      </Link>

      <div className="mt-4 border-t border-slate-200 pt-4 flex flex-col gap-0.5">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:text-primary transition-all">
          <HelpCircle size={18} /> 帮助中心
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-bold text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut size={18} /> 退出登录
        </button>
      </div>
    </aside>
  );
}
