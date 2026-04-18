import { useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  Eye, EyeOff, ArrowRight,
  Mail, Lock, User, Building2, CheckCircle2, AlertCircle, Phone,
} from "lucide-react";
import { HelpDialog } from "@/components/HelpDialog";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import { SiteLogo, useSiteName } from "@/components/SiteLogo";
import { storeSession } from "@/lib/auth";

/* ─── Types ─────────────────────────────────── */

type Role = "opc" | "publisher" | "admin";
type Tab  = "login" | "register";

/* ─── Helpers ───────────────────────────────── */

const ROLE_COPY: Record<Role, { label: string; sub: string; color: string }> = {
  opc: {
    label: "OPC 超级个体",
    sub:   "专业服务提供方",
    color: "text-emerald-300",
  },
  publisher: {
    label: "需求发布方",
    sub:   "企业需求方",
    color: "text-blue-200",
  },
  admin: {
    label: "平台管理员",
    sub:   "后台运营专员",
    color: "text-purple-300",
  },
};

const STATS = [
  { value: "99.9%", label: "系统可用率" },
  { value: "一类",  label: "资金安全级别" },
];

/* ─── Page ────────────────────────────────────── */

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Auth() {
  const { role: rawRole } = useParams<{ role: string }>();
  const role: Role = rawRole === "publisher" ? "publisher" : rawRole === "admin" ? "admin" : "opc";
  const [, navigate]   = useLocation();
  const [tab, setTab]  = useState<Tab>("login");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [showPw2,  setShowPw2]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [regOk,    setRegOk]    = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const siteName = useSiteName();

  const roleCopy = ROLE_COPY[role];

  const switchTab = (t: Tab) => {
    setTab(t);
    setError("");
    setRegOk(false);
    setIdentifier(""); setPassword(""); setPassword2(""); setName(""); setPhone("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (tab === "register") {
      if (!name.trim())         { setError("请填写姓名"); return; }
      if (!phone.trim())        { setError("请填写手机号"); return; }
      if (!identifier.trim())   { setError("请填写邮箱"); return; }
      if (password.length < 6)  { setError("密码至少 6 位"); return; }
      if (password !== password2) { setError("两次密码不一致"); return; }

      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nickname: name.trim(), email: identifier.trim().toLowerCase(), phone: phone.trim(), password, role }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "注册失败，请重试"); return; }
        setRegOk(true);
        setError("");
        setTimeout(() => switchTab("login"), 1800);
      } catch {
        setError("网络错误，请稍后重试");
      } finally {
        setLoading(false);
      }
      return;
    }

    /* ── Login ── */
    if (!identifier.trim() || !password) { setError("请填写账号和密码"); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password, role }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "登录失败，请重试"); return; }

      const userRole = data.user?.role ?? data.role;
      if (userRole === "admin" && role !== "admin") {
        setError("此账号为管理员账号，请通过管理后台专属入口登录");
        return;
      }

      storeSession(data);
      const dest = userRole === "admin" ? "/admin" : userRole === "opc" ? "/" : "/publisher";
      navigate(dest);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9fc] text-[#1a1c1e]">
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
      {showForgot && <ForgotPasswordDialog onClose={() => setShowForgot(false)} />}
      <main className="flex-grow flex items-stretch min-h-screen">

        {/* ── Left: Visual Narrative ── */}
        <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
          {/* Background image */}
          <img
            src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&h=900&fit=crop"
            alt="现代化建筑"
            className="absolute inset-0 w-full h-full object-cover opacity-40"
          />

          {/* Glass overlay */}
          <div className="absolute inset-0 flex flex-col justify-center px-16 xl:px-24"
               style={{ background: "linear-gradient(135deg, rgba(0,50,125,0.88) 0%, rgba(0,71,171,0.65) 100%)", backdropFilter: "blur(6px)" }}>

            {/* Brand */}
            <div className="absolute top-12 left-16 xl:left-24 flex items-center gap-3">
              <SiteLogo size={32} imgClassName="drop-shadow-lg" />
              <span className="text-white font-extrabold text-xl tracking-tight font-display">{siteName}</span>
            </div>

            {/* Hero copy */}
            <div className="mb-12">
              <span className="text-emerald-300 font-bold tracking-widest text-xs uppercase font-display">
                机构智能生态
              </span>
              <h1 className="text-white text-4xl xl:text-5xl font-extrabold mt-4 leading-tight tracking-tight font-display">
                加入数字架构师<br />交易生态系统
              </h1>
              <p className="text-blue-200 text-base mt-5 max-w-md font-light leading-relaxed">
                将传统稳健与 AI 驱动创新深度融合，构建多维专业化工作平台。
              </p>

              {/* Role badge */}
              <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full border border-white/20">
                {role === "opc" ? <User size={16} className="text-emerald-300" /> : <Building2 size={16} className="text-blue-200" />}
                <span className={`text-sm font-bold ${roleCopy.color}`}>{roleCopy.label}</span>
                <span className="text-white/60 text-xs">· {roleCopy.sub}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-8 pt-10 border-t border-white/10">
              {STATS.map(s => (
                <div key={s.label}>
                  <div className="text-white font-extrabold text-2xl font-display">{s.value}</div>
                  <div className="text-white/60 text-sm mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Right: Form ── */}
        <section className="w-full lg:w-1/2 flex flex-col bg-[#f3f3f6] justify-center items-center px-6 md:px-12 lg:px-16 xl:px-24 py-12">

          {/* Mobile logo */}
          <div className="lg:hidden mb-10 flex items-center gap-3">
            <SiteLogo size={28} />
            <span className="text-primary font-extrabold text-lg tracking-tight font-display">{siteName}</span>
          </div>

          <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-2xl shadow-sm border border-slate-100">

            {/* Header */}
            <header className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  role === "opc" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                }`}>
                  {roleCopy.label}
                </span>
              </div>
              <h2 className="text-[#1a1c1e] font-extrabold text-2xl tracking-tight font-display">
                {tab === "login" ? "欢迎回来" : "创建账号"}
              </h2>
              <p className="text-slate-500 mt-1.5 text-sm">
                {tab === "login"
                  ? "请输入您的登录凭证，访问专属终端。"
                  : "注册后即可以" + roleCopy.label + "身份使用全部功能。"}
              </p>
            </header>

            {/* Tabs — hidden for admin (login only) */}
            {role !== "admin" && (
              <div className="flex gap-1 mb-8 bg-slate-100 p-1 rounded-xl">
                {(["login", "register"] as Tab[]).map(t => (
                  <button
                    key={t}
                    onClick={() => switchTab(t)}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                      tab === t
                        ? "bg-white text-primary shadow-sm"
                        : "text-slate-500 hover:text-foreground"
                    }`}
                  >
                    {t === "login" ? "登录" : "注册"}
                  </button>
                ))}
              </div>
            )}

            {/* Registration success */}
            {regOk && (
              <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <p className="text-sm font-semibold text-emerald-700">注册成功！正在跳转到登录…</p>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="mb-5 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Name field (register only) */}
              {tab === "register" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">
                    姓名
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="张明远"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none placeholder:text-slate-400 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Phone (register only) */}
              {tab === "register" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">
                    手机号 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="13800138000"
                      autoComplete="tel"
                      className="w-full pl-11 pr-4 py-3.5 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none placeholder:text-slate-400 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Email (register) / Email or Phone (login) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">
                  {tab === "login" ? "邮箱 / 手机号" : "邮箱"}
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={tab === "login" ? "text" : "email"}
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder={tab === "login" ? "邮箱或手机号" : "name@enterprise.com"}
                    autoComplete={tab === "login" ? "username" : "email"}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none placeholder:text-slate-400 text-sm"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">
                    密码
                  </label>
                  {tab === "login" && (
                    <button type="button" onClick={() => setShowForgot(true)} className="text-xs font-semibold text-secondary hover:underline">忘记密码？</button>
                  )}
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={tab === "login" ? "current-password" : "new-password"}
                    className="w-full pl-11 pr-11 py-3.5 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none placeholder:text-slate-400 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm password (register only) */}
              {tab === "register" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">
                    确认密码
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type={showPw2 ? "text" : "password"}
                      value={password2}
                      onChange={e => setPassword2(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      className="w-full pl-11 pr-11 py-3.5 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none placeholder:text-slate-400 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw2(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors"
                    >
                      {showPw2 ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Remember me (login only) */}
              {tab === "login" && (
                <div className="flex items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    id="remember"
                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                  />
                  <label htmlFor="remember" className="text-sm text-slate-500">记住此设备 30 天</label>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: role === "opc"
                    ? "linear-gradient(to right, #006b5a, #005143)"
                    : role === "admin"
                    ? "linear-gradient(to right, #4f1d96, #7c3aed)"
                    : "linear-gradient(to right, #00327d, #0047ab)",
                }}
              >
                {loading ? "处理中…" : tab === "login" ? "登录进入" : "立即注册"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>

            {/* Footer links */}
            <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {tab === "login" ? "还没有账号？" : "已有账号？"}
                </span>
                <button
                  onClick={() => switchTab(tab === "login" ? "register" : "login")}
                  className="font-bold text-primary flex items-center gap-1 group hover:underline"
                >
                  {tab === "login" ? "立即注册" : "立即登录"}
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">需要技术支持？</span>
                <button type="button" onClick={() => setShowHelp(true)} className="font-bold text-secondary hover:underline">帮助中心</button>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">更换身份？</span>
                <button
                  onClick={() => navigate("/login")}
                  className="font-bold text-slate-500 hover:text-primary hover:underline transition-colors"
                >
                  返回选择页面
                </button>
              </div>
            </div>
          </div>

          {/* Security notice */}
          <div className="mt-8 text-center max-w-xs">
            <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-widest font-medium">
              采用企业级 SSL 加密与多因素身份验证协议
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-8 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <span className="text-[10px] text-slate-400 font-medium">
          © 2026 接单吧 · 机构级 OPC 交易平台
        </span>
        <nav className="flex gap-6 flex-wrap justify-center">
          <a href="/terms" className="text-[10px] text-slate-400 font-medium hover:text-primary transition-colors tracking-wide">服务条款</a>
          <a href="/privacy" className="text-[10px] text-slate-400 font-medium hover:text-primary transition-colors tracking-wide">隐私政策</a>
          <a href="mailto:support@jiedanba.com" className="text-[10px] text-slate-400 font-medium hover:text-primary transition-colors tracking-wide">机构支持</a>
          <a href="/terms#regulatory" className="text-[10px] text-slate-400 font-medium hover:text-primary transition-colors tracking-wide">监管披露</a>
        </nav>
      </footer>
    </div>
  );
}
