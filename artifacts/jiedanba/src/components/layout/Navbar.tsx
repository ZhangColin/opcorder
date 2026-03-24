import { Link, useLocation } from "wouter";
import { Bell, Search, Menu, User, ShieldCheck } from "lucide-react";
import { useGetOverviewStats } from "@workspace/api-client-react";

export function Navbar() {
  const [location] = useLocation();

  const navLinks = [
    { href: "/", label: "首页" },
    { href: "/demands", label: "抢单大厅" },
    { href: "/order-hall", label: "订单大厅" },
    { href: "/orders", label: "我的订单" },
    { href: "/cockpit", label: "驾驶舱" },
    { href: "/disputes", label: "争议处理" },
    { href: "/academy", label: "培训进阶" },
    { href: "/profile", label: "个人中心" },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 glass-panel border-b border-border/50">
      <div className="max-w-[1920px] mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">
        
        {/* Logo & Links */}
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform duration-300">
              <ShieldCheck size={24} strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-black text-primary tracking-tight font-display">
              接单吧
            </span>
          </Link>
          
          <div className="hidden md:flex items-center gap-1 mt-1">
            {navLinks.map((link) => {
              const isActive = location === link.href || (link.href !== '/' && location.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all duration-200 ${
                    isActive 
                      ? "text-primary bg-primary/5" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
            <Search size={20} />
          </button>
          <Link href="/notifications" className="relative w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-white"></span>
          </Link>
          
          <div className="h-8 w-px bg-border mx-2 hidden sm:block"></div>
          
          <Link href="/profile" className="flex items-center gap-3 pl-2 p-1 pr-4 rounded-full border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
            <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
              {/* professional corporate headshot of a senior digital architect */}
              <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop" alt="User" className="w-full h-full rounded-full object-cover" />
            </div>
            <div className="hidden sm:flex flex-col items-start">
              <span className="text-sm font-bold text-foreground leading-none">系统架构师</span>
              <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider mt-1">Lv. A 专家</span>
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
