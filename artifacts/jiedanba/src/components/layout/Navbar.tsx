import { Link, useLocation } from "wouter";
import { Bell, Search, Menu, ShieldCheck } from "lucide-react";
import { useGetCurrentUser, useGetOpcProfile } from "@workspace/api-client-react";

export function Navbar() {
  const [location]  = useLocation();

  const { data: user }    = useGetCurrentUser();
  const { data: profile } = useGetOpcProfile(user?.id ?? 1, { query: { enabled: !!user?.id } });

  const name    = profile?.nickname ?? user?.nickname ?? "新用户";
  const avatar  = profile?.avatar  ?? user?.avatar   ?? "";
  const level   = profile?.level   ?? "C";
  const levelLabel = level === "A" ? "专家" : level === "B" ? "进阶" : "新手";

  const navLinks = [
    { href: "/",           label: "首页" },
    { href: "/demands",    label: "抢单大厅" },
    { href: "/order-hall", label: "订单大厅" },
    { href: "/orders",     label: "我的订单" },
    { href: "/cockpit",    label: "驾驶舱" },
    { href: "/disputes",   label: "争议处理" },
    { href: "/academy",    label: "培训进阶" },
    { href: "/profile",    label: "个人中心" },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 glass-panel border-b border-border/50">
      <div className="max-w-[1920px] mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">

        {/* Logo + links */}
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform duration-300">
              <ShieldCheck size={24} strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-black text-primary tracking-tight font-display">接单吧</span>
          </Link>

          <div className="hidden md:flex items-center gap-1 mt-1">
            {navLinks.map(link => {
              const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
              return (
                <Link key={link.href} href={link.href}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all duration-200 ${
                    isActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}>
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
            <Search size={20} />
          </button>
          <Link href="/notifications"
            className="relative w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-white" />
          </Link>

          <div className="h-8 w-px bg-border mx-2 hidden sm:block" />

          {/* User chip — reads live from DB via API */}
          <Link href="/profile"
            className="flex items-center gap-3 pl-1.5 p-1 pr-4 rounded-full border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
            <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
              {avatar ? (
                <img src={avatar} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-black text-primary">{name?.[0] ?? "新"}</span>
              )}
            </div>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-sm font-bold text-foreground leading-none">{name}</span>
              <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider mt-1">
                Lv. {level} {levelLabel}
              </span>
            </div>
          </Link>

          <button className="md:hidden w-10 h-10 flex items-center justify-center text-foreground ml-2">
            <Menu size={24} />
          </button>
        </div>
      </div>
    </nav>
  );
}
