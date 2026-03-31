import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Bell, Search, Menu, UserPen, LogOut, ChevronDown, MessageSquare, KeyRound } from "lucide-react";
import { useGetCurrentUser, useGetOpcProfile, useListNotifications } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { SiteLogo, useSiteName } from "@/components/SiteLogo";

export function Navbar() {
  const [location, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: user }    = useGetCurrentUser();
  const { data: profile } = useGetOpcProfile(user?.id ?? 1, { query: { enabled: !!user?.id } });
  const { data: notifData } = useListNotifications({ limit: 1 }, { query: { enabled: !!user?.id, refetchInterval: 30000 } });
  const unreadCount = notifData?.unreadCount ?? 0;
  const siteName = useSiteName();

  const name       = profile?.nickname ?? user?.nickname ?? "新用户";
  const avatar     = profile?.avatar  ?? user?.avatar   ?? "";
  const level      = profile?.level   ?? "newbie";
  const levelLabel = level === "A" ? "专家认证" : level === "B" ? "进阶认证" : level === "C" ? "基础认证" : "未认证";

  /* Close on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const navLinks = [
    { href: "/",           label: "首页" },
    { href: "/order-hall", label: "订单大厅" },
    { href: "/orders",     label: "我的订单" },
    { href: "/academy",    label: "培训进阶" },
    { href: "/profile",    label: "个人中心" },
    { href: "/income",     label: "收入结算" },
    { href: "/community",  label: "社区" },
  ];

  function handleEditProfile() {
    setMenuOpen(false);
    navigate("/profile?edit=1");
  }

  function handleLogout() {
    setMenuOpen(false);
    localStorage.removeItem("jdb_role");
    localStorage.removeItem("jdb_user_id");
    qc.clear();
    navigate("/login");
  }

  return (
    <>
    <nav className="fixed top-0 w-full z-50 glass-panel border-b border-border/50">
      <div className="max-w-[1920px] mx-auto px-6 lg:px-10 h-20 flex items-center justify-between">

        {/* Logo + links */}
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="group-hover:scale-105 transition-transform duration-300 shrink-0">
              <SiteLogo size={36} />
            </div>
            <span className="text-2xl font-black text-primary tracking-tight font-display">{siteName}</span>
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
            <Bell size={20} className={unreadCount > 0 ? "text-primary" : ""} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-destructive text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>

          <div className="h-8 w-px bg-border mx-2 hidden sm:block" />

          {/* User chip with dropdown */}
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className={`flex items-center gap-3 pl-1.5 p-1 pr-3 rounded-full border transition-all cursor-pointer ${
                menuOpen
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/50 hover:border-primary/30 hover:bg-primary/5"
              }`}>
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
                  {level === "newbie" ? "新手 · 未认证" : `Lv.${level} ${levelLabel}`}
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-muted-foreground hidden sm:block transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] w-48 bg-white rounded-2xl shadow-xl border border-border/40 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-xs font-bold text-blue-900 truncate">{name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{level === "newbie" ? "新手 · 未认证" : `Lv.${level} · ${levelLabel}`}</p>
                </div>
                <div className="py-1.5">
                  <button
                    onClick={handleEditProfile}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-primary/5 hover:text-primary transition-colors text-left">
                    <UserPen size={15} className="shrink-0" />
                    编辑个人信息
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); setShowChangePw(true); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-primary/5 hover:text-primary transition-colors text-left">
                    <KeyRound size={15} className="shrink-0" />
                    修改密码
                  </button>
                  <div className="mx-4 my-1 border-t border-slate-100" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors text-left">
                    <LogOut size={15} className="shrink-0" />
                    退出登录
                  </button>
                </div>
              </div>
            )}
          </div>

          <button className="md:hidden w-10 h-10 flex items-center justify-center text-foreground ml-2">
            <Menu size={24} />
          </button>
        </div>
      </div>
    </nav>
    {showChangePw && <ChangePasswordDialog onClose={() => setShowChangePw(false)} />}
    </>
  );
}
