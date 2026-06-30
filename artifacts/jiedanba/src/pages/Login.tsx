import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  Eye, EyeOff, ArrowRight,
  Mail, Lock, User, Building2,
  CheckCircle2, AlertCircle, Compass, Phone, ShieldCheck,
} from "lucide-react";
import { ForgotPasswordDialog } from "@/components/ForgotPasswordDialog";
import { SiteLogo, useSiteName } from "@/components/SiteLogo";
import { storeSession, clearSession } from "@/lib/auth";

type Tab = "login" | "register";
type RegRole = "opc" | "publisher";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Login() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("login");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [smsCode,  setSmsCode]  = useState("");
  const [smsCooldown, setSmsCooldown] = useState(0);
  const [smsSending,  setSmsSending]  = useState(false);
  const [regRole,  setRegRole]  = useState<RegRole>("opc");
  const [showPw,   setShowPw]   = useState(false);
  const [showPw2,  setShowPw2]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [regOk,    setRegOk]    = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const siteName = useSiteName();
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const startCooldown = () => {
    setSmsCooldown(60);
    cooldownRef.current = setInterval(() => {
      setSmsCooldown(v => {
        if (v <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return v - 1;
      });
    }, 1000);
  };

  const handleSendSmsCode = async () => {
    if (!phone.trim()) { setError("请先填写手机号"); return; }
    if (smsCooldown > 0 || smsSending) return;
    setError("");
    setSmsSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/send-sms-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "发送失败，请稍后重试"); return; }
      startCooldown();
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setSmsSending(false);
    }
  };

  const switchTab = (t: Tab) => {
    setTab(t); setError(""); setRegOk(false);
    setIdentifier(""); setPassword(""); setPassword2(""); setName(""); setPhone("");
    setSmsCode(""); setSmsCooldown(0);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!identifier.trim() || !password) { setError("请填写账号和密码"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "登录失败，请重试"); return; }
      storeSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      const dest = data.user.role === "admin" ? "/admin" : data.user.role === "opc" ? "/" : "/pub";
      navigate(dest);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim())         { setError("请填写姓名"); return; }
    if (!phone.trim())        { setError("请填写手机号"); return; }
    if (!smsCode.trim())      { setError("请填写短信验证码"); return; }
    if (!identifier.trim())   { setError("请填写邮箱"); return; }
    if (password.length < 6)  { setError("密码至少 6 位"); return; }
    if (password !== password2) { setError("两次密码不一致"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: name.trim(), email: identifier.trim().toLowerCase(), phone: phone.trim(), smsCode: smsCode.trim(), password, role: regRole }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "注册失败，请重试"); return; }
      setRegOk(true);
      setTimeout(() => switchTab("login"), 1800);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-body text-[#1a1c1e]">
      {/* ── Forgot Password Modal ── */}
      {showForgot && <ForgotPasswordDialog onClose={() => setShowForgot(false)} />}

      {/* ── Left: Brand Visual ── */}
      <section className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-primary">
        <img
          src="https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&h=900&fit=crop"
          alt="接单吧"
          className="absolute inset-0 w-full h-full object-cover opacity-40"
        />
        <div
          className="absolute inset-0 flex flex-col justify-center px-16 xl:px-24"
          style={{ background: "linear-gradient(135deg, rgba(0,50,125,0.90) 0%, rgba(0,71,171,0.65) 100%)" }}
        >
          <div className="absolute top-12 left-16 xl:left-24 flex items-center gap-3">
            <SiteLogo size={32} imgClassName="drop-shadow-lg" />
            <span className="text-white font-extrabold text-xl tracking-tight font-display">{siteName}</span>
          </div>

          <div className="mb-12">
            <span className="text-emerald-300 font-bold tracking-widest text-xs uppercase font-display">
              OPC 接单平台
            </span>
            <h1 className="text-white text-4xl xl:text-5xl font-extrabold mt-4 leading-tight tracking-tight font-display">
              连接需求方<br />与超级个体
            </h1>
            <p className="text-blue-200 text-base mt-5 max-w-md font-light leading-relaxed">
              机构级资金托管 · AI 智能匹配 · 里程碑交付保障
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-10 border-t border-white/10">
            {[
              { value: "99.9%", label: "系统可用率" },
              { value: "一类",  label: "资金安全级别" },
            ].map(s => (
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

          <header className="mb-8">
            <h2 className="text-[#1a1c1e] font-extrabold text-2xl tracking-tight font-display">
              {tab === "login" ? "欢迎回来" : "创建账号"}
            </h2>
            <p className="text-slate-500 mt-1.5 text-sm">
              {tab === "login" ? "输入账号和密码以继续" : "注册后即可使用平台全部功能"}
            </p>
          </header>

          {/* Tabs */}
          <div className="flex gap-1 mb-8 bg-slate-100 p-1 rounded-xl">
            {(["login", "register"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                  tab === t ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-foreground"
                }`}
              >
                {t === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          {/* Success banner */}
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

          {/* ── Login form ── */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">邮箱 / 手机号</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="邮箱或手机号"
                    autoComplete="username"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none placeholder:text-slate-400 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">密码</label>
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowForgot(true)}
                    className="text-xs font-semibold text-secondary hover:underline"
                  >忘记密码？</button>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full pl-11 pr-11 py-3.5 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none placeholder:text-slate-400 text-sm"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: "linear-gradient(to right, #00327d, #0047ab)" }}
              >
                {loading ? "登录中…" : "登录"}
                {!loading && <ArrowRight size={18} />}
              </button>

              {/* Quick hint */}
              <p className="text-center text-xs text-slate-400 pt-1">
                OPC · 发单方 · 管理员均可从此登录
              </p>

              <p className="text-center text-xs text-slate-500 leading-relaxed">
                登录即表示您同意接单吧的
                <a href="/terms" className="text-blue-600 underline hover:text-blue-800 mx-0.5">服务条款</a>
                与
                <a href="/privacy" className="text-blue-600 underline hover:text-blue-800 mx-0.5">隐私政策</a>
              </p>
            </form>
          )}

          {/* ── Register form ── */}
          {tab === "register" && (
            <form onSubmit={handleRegister} className="space-y-5">
              {/* Role selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">注册身份</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: "opc" as RegRole, label: "OPC 超级个体", Icon: User, color: "border-emerald-400 bg-emerald-50 text-emerald-700" },
                    { key: "publisher" as RegRole, label: "需求发布方", Icon: Building2, color: "border-primary bg-blue-50 text-primary" },
                  ]).map(({ key, label, Icon, color }) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setRegRole(key)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                        regRole === key ? color : "border-slate-200 text-slate-500 hover:border-slate-300"
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">姓名</label>
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

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">手机号 <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
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
                  <button
                    type="button"
                    onClick={handleSendSmsCode}
                    disabled={smsCooldown > 0 || smsSending}
                    className="shrink-0 px-4 py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: smsCooldown > 0 ? "#e2e8f0" : "linear-gradient(to right, #00327d, #0047ab)", color: smsCooldown > 0 ? "#94a3b8" : "white" }}
                  >
                    {smsSending ? "发送中…" : smsCooldown > 0 ? `${smsCooldown}s` : "发验证码"}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">短信验证码 <span className="text-red-500">*</span></label>
                <div className="relative">
                  <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={smsCode}
                    onChange={e => setSmsCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="6 位验证码"
                    autoComplete="one-time-code"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none placeholder:text-slate-400 text-sm tracking-widest"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">邮箱</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="name@enterprise.com"
                    autoComplete="email"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none placeholder:text-slate-400 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">密码</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••（至少 6 位）"
                    autoComplete="new-password"
                    className="w-full pl-11 pr-11 py-3.5 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-primary/30 outline-none placeholder:text-slate-400 text-sm"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#1a1c1e] uppercase tracking-wider block">确认密码</label>
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
                  <button type="button" onClick={() => setShowPw2(v => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-foreground transition-colors">
                    {showPw2 ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl font-bold text-white text-base flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: regRole === "opc" ? "linear-gradient(to right, #006b5a, #005143)" : "linear-gradient(to right, #00327d, #0047ab)" }}
              >
                {loading ? "注册中…" : "立即注册"}
                {!loading && <ArrowRight size={18} />}
              </button>

              <p className="text-center text-xs text-slate-500 leading-relaxed">
                注册即表示您同意接单吧的
                <a href="/terms" className="text-blue-600 underline hover:text-blue-800 mx-0.5">服务条款</a>
                与
                <a href="/privacy" className="text-blue-600 underline hover:text-blue-800 mx-0.5">隐私政策</a>
              </p>
            </form>
          )}

          {/* Footer links */}
          <div className="mt-8 pt-6 border-t border-slate-100 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{tab === "login" ? "还没有账号？" : "已有账号？"}</span>
              <button
                onClick={() => switchTab(tab === "login" ? "register" : "login")}
                className="font-bold text-primary flex items-center gap-1 group hover:underline"
              >
                {tab === "login" ? "立即注册" : "立即登录"}
                <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">管理员入口</span>
              <button
                onClick={() => navigate("/auth/admin")}
                className="font-bold text-violet-600 hover:underline"
              >
                后台登录
              </button>
            </div>
          </div>

          {/* Guest entry */}
          <button
            onClick={() => {
              clearSession();
              navigate("/community");
            }}
            className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-300 text-slate-500 text-sm font-semibold hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all"
          >
            <Compass size={15} />
            随便逛逛，先看看社区
          </button>
        </div>

        <p className="mt-8 text-[10px] text-slate-400 text-center uppercase tracking-widest">
          © 2026 接单吧 · 机构级 OPC 交易平台
        </p>
      </section>
    </div>
  );
}
