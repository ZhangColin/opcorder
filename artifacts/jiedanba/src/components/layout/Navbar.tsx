import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Bell, Search, Menu, UserPen, LogOut, ChevronDown, KeyRound, X } from "lucide-react";
import { useGetCurrentUser, useGetOpcProfile, useListNotifications, getGetOpcProfileQueryKey, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { SiteLogo, useSiteName } from "@/components/SiteLogo";
import { callLogout, getAccessToken } from "@/lib/auth";

export function Navbar() {
  const [location, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: user, isLoading: userLoading } = useGetCurrentUser();
  const { data: profile } = useGetOpcProfile(user?.id ?? 1, { query: { queryKey: getGetOpcProfileQueryKey(user?.id ?? 1), enabled: !!user?.id } });
  const { data: notifData } = useListNotifications({ limit: 1 }, { query: { queryKey: getListNotificationsQueryKey({ limit: 1 }), enabled: !!user?.id, refetchInterval: 30000 } });
  const unreadCount = notifData?.unreadCount ?? 0;
  const siteName = useSiteName();

  const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data: trackCerts = [] } = useQuery<Array<{
    id: number; level: string; cat_category_id: number; cat_category_name: string;
  }>>({
    queryKey: ["navbar-track-certs", user?.id],
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) return [];
      const r = await fetch(`${API_BASE}/api/opc/track-certs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.ok ? r.json() : [];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const name   = profile?.nickname ?? user?.nickname ?? "新用户";
  const avatar = profile?.avatar  ?? user?.avatar   ?? "";

  const CERT_LEVEL_COLOR: Record<string, string> = { A: "bg-amber-500", B: "bg-primary", C: "bg-secondary" };
  const CERT_LEVEL_NAME:  Record<string, string> = { A: "专家", B: "进阶", C: "基础" };
  const certSummary = trackCerts.length > 0
    ? `${trackCerts.length} 项赛道认证`
    : "未认证";

  /* Close dropdown on outside click */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  /* Lock body scroll when mobile menu open */
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const navLinks = [
    { href: "/",           label: "首页" },
    { href: "/order-hall", label: "需求大厅" },
    { href: "/opc",        label: "OPC工作台" },
    { href: "/academy",    label: "培训进阶" },
    { href: "/profile",    label: "个人中心" },
    { href: "/community",  label: "社区" },
  ];

  function handleAccountSettings() {
    setMenuOpen(false);
    setMobileOpen(false);
    navigate("/account-settings");
  }

  async function handleLogout() {
    setMenuOpen(false);
    setMobileOpen(false);
    const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");
    await callLogout(apiBase);
    qc.clear();
    navigate("/login");
  }

  function handleNav(href: string) {
    setMobileOpen(false);
    navigate(href);
  }

  return (
    <>
    <nav className="fixed top-0 w-full z-50 glass-panel border-b border-border/50">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-10 h-16 sm:h-20 flex items-center justify-between">

        {/* Logo + desktop links */}
        <div className="flex items-center gap-6 lg:gap-10">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="group-hover:scale-105 transition-transform duration-300 shrink-0">
              <SiteLogo size={30} />
            </div>
            <span className="text-xl sm:text-2xl font-black text-primary tracking-tight font-display">{siteName}</span>
          </Link>

          <div className="hidden md:flex items-center gap-1 mt-1">
            {navLinks.map(link => {
              const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
              return (
                <Link key={link.href} href={link.href}
                  className={`px-3 lg:px-4 py-2 rounded-lg font-bold text-sm transition-all duration-200 ${
                    isActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}>
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button className="hidden sm:flex w-10 h-10 rounded-full items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
            <Search size={20} />
          </button>
          <Link href="/notifications"
            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">
            <Bell size={18} className={unreadCount > 0 ? "text-primary" : ""} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-destructive text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center leading-none">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>

          <div className="h-8 w-px bg-border mx-1 hidden sm:block" />

          {/* Desktop User chip / login button */}
          <div ref={menuRef} className="relative hidden md:block">
            {!user && (!userLoading || !getAccessToken()) ? (
              <button
                onClick={() => navigate("/login")}
                className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all text-primary font-bold text-sm">
                立即登录
              </button>
            ) : (
              <>
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
                      {certSummary}
                    </span>
                  </div>
                  <ChevronDown
                    size={14}
                    className={`text-muted-foreground hidden sm:block transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-48 bg-white rounded-2xl shadow-xl border border-border/40 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-xs font-bold text-blue-900 truncate">{name}</p>
                      {trackCerts.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {trackCerts.map(c => (
                            <span key={c.id} className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full text-white font-bold ${CERT_LEVEL_COLOR[c.level] ?? "bg-slate-400"}`}>
                              {c.cat_category_name} · {CERT_LEVEL_NAME[c.level] ?? c.level}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400 mt-0.5">新手 · 未认证</p>
                      )}
                    </div>
                    <div className="py-1.5">
                      <button
                        onClick={handleAccountSettings}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-primary/5 hover:text-primary transition-colors text-left">
                        <UserPen size={15} className="shrink-0" />
                        账户设置
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
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden w-9 h-9 flex items-center justify-center text-foreground rounded-lg hover:bg-muted transition-colors">
            <Menu size={22} />
          </button>
        </div>
      </div>
    </nav>

    {/* Mobile slide-in menu overlay */}
    {mobileOpen && (
      <div className="fixed inset-0 z-[60] md:hidden">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />

        {/* Slide-in panel */}
        <div className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <SiteLogo size={24} />
              <span className="font-black text-primary text-base">{siteName}</span>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* User info / login prompt */}
          {!user && (!userLoading || !getAccessToken()) ? (
            <div className="px-5 py-4 bg-primary/5 border-b border-slate-100">
              <button
                onClick={() => { setMobileOpen(false); navigate("/login"); }}
                className="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-colors">
                立即登录
              </button>
            </div>
          ) : (
            <div className="px-5 py-4 bg-primary/5 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
                {avatar ? (
                  <img src={avatar} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-black text-primary">{name?.[0] ?? "新"}</span>
                )}
              </div>
              <div>
                <p className="font-bold text-foreground text-sm">{name}</p>
                <p className="text-[10px] text-secondary font-semibold uppercase tracking-wider mt-0.5">
                  {certSummary}
                </p>
              </div>
              {unreadCount > 0 && (
                <span className="ml-auto bg-destructive text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                  {unreadCount > 99 ? "99+" : unreadCount}条消息
                </span>
              )}
            </div>
          )}

          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto py-3">
            {navLinks.map(link => {
              const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
              return (
                <button
                  key={link.href}
                  onClick={() => handleNav(link.href)}
                  className={`w-full text-left px-5 py-3.5 text-sm font-bold transition-colors ${
                    isActive
                      ? "text-primary bg-primary/8"
                      : "text-slate-600 hover:text-primary hover:bg-primary/5"
                  }`}>
                  {link.label}
                </button>
              );
            })}
          </nav>

          {/* Actions — only shown when logged in */}
          {user && (
            <div className="border-t border-slate-100 py-3">
              <button
                onClick={handleAccountSettings}
                className="w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-primary/5 hover:text-primary transition-colors">
                <UserPen size={15} className="shrink-0" />
                账户设置
              </button>
              <button
                onClick={() => { setMobileOpen(false); setShowChangePw(true); }}
                className="w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-primary/5 hover:text-primary transition-colors">
                <KeyRound size={15} className="shrink-0" />
                修改密码
              </button>
              <div className="mx-5 my-1 border-t border-slate-100" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors">
                <LogOut size={15} className="shrink-0" />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    )}

    {showChangePw && <ChangePasswordDialog onClose={() => setShowChangePw(false)} />}
    </>
  );
}
