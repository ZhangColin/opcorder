import { useLocation } from "wouter";
import {
  CheckCircle2, ShieldCheck, Globe, HelpCircle, ArrowRight,
  Building2, User, BadgeCheck, Banknote, ListChecks, ChartBar,
  Cpu, Lock, MessageSquare, TrendingUp, CalendarDays,
  LayoutDashboard,
} from "lucide-react";

export default function Login() {
  const [, navigate] = useLocation();

  const enter = (role: "opc" | "publisher") => {
    navigate(`/auth/${role}`);
  };

  return (
    <div className="min-h-screen flex flex-col font-body text-on-surface relative overflow-hidden" style={{ backgroundColor: "#f9f9fc" }}>
      {/* Background mesh */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            radial-gradient(at 0% 0%, rgba(0,50,125,0.05) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(0,107,90,0.05) 0px, transparent 50%)
          `,
        }} />
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-24 w-64 h-64 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      {/* Top App Bar */}
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-8 py-4 bg-[#f9f9fc]/80 backdrop-blur-md">
        <span className="text-2xl font-extrabold text-primary tracking-tight font-display">接单吧</span>
        <div className="hidden md:flex items-center gap-6">
          <a href="#" className="text-slate-500 font-medium hover:text-secondary transition-colors text-sm">帮助</a>
          <a href="#" className="text-slate-500 font-medium hover:text-secondary transition-colors text-sm">关于</a>
          <div className="flex items-center gap-2 ml-2">
            <button className="p-2 text-primary hover:scale-95 transition-transform rounded-full hover:bg-primary/5">
              <Globe size={20} />
            </button>
            <button className="p-2 text-primary hover:scale-95 transition-transform rounded-full hover:bg-primary/5">
              <HelpCircle size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-grow flex flex-col items-center justify-center px-6 pt-24 pb-12">
        {/* Logo Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 shadow-sm" style={{ backgroundColor: "#0047ab" }}>
            <ShieldCheck size={40} className="text-white" strokeWidth={2} />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold font-display text-primary mb-3 tracking-tight">
            接单吧
          </h1>
          <p className="text-on-surface-variant text-lg max-w-md mx-auto">
            请选择您的身份登录
          </p>
        </div>

        {/* Identity Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">

          {/* ── OPC Card ── */}
          <div className="group relative bg-white rounded-xl overflow-hidden border border-outline-variant/20 hover:border-secondary/40 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
            {/* Watermark */}
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <User size={96} className="text-secondary" />
            </div>

            <div className="p-8 h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-secondary/10 to-secondary/30 flex items-center justify-center text-secondary shrink-0">
                  <ListChecks size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold font-display text-primary">我是 OPC 超级个体</h2>
                  <p className="text-sm text-on-surface-variant">专业服务提供方</p>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-5 mb-10 flex-grow">
                {[
                  {
                    icon: CheckCircle2,
                    title: "抢单接单",
                    desc: "浏览并接受高价值政企专业任务",
                  },
                  {
                    icon: ChartBar,
                    title: "管理里程碑",
                    desc: "分阶段追踪复杂项目的交付进度",
                  },
                  {
                    icon: Banknote,
                    title: "查看收益",
                    desc: "实时透明的收益结算与财务面板",
                  },
                ].map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex items-start gap-3">
                    <Icon size={20} className="text-secondary mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-primary block text-sm">{title}</span>
                      <span className="text-sm text-on-surface-variant leading-relaxed">{desc}</span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => enter("opc")}
                className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(to right, #006b5a, #005143)" }}
              >
                以 OPC 身份进入
                <ArrowRight size={18} />
              </button>
            </div>

            {/* Bottom accent */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-secondary-container to-secondary" />
          </div>

          {/* ── Issuer Card ── */}
          <div className="group relative bg-white rounded-xl overflow-hidden border border-outline-variant/20 hover:border-primary/40 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
            {/* Watermark */}
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <Building2 size={96} className="text-primary" />
            </div>

            <div className="p-8 h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary shrink-0">
                  <Cpu size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold font-display text-primary">我是需求发布方</h2>
                  <p className="text-sm text-on-surface-variant">企业需求方</p>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-5 mb-10 flex-grow">
                {[
                  {
                    icon: BadgeCheck,
                    title: "发布需求",
                    desc: "精准描述项目需求，向平台发起任务",
                  },
                  {
                    icon: Cpu,
                    title: "AI 智能匹配",
                    desc: "快速匹配最优 OPC 服务提供方",
                  },
                  {
                    icon: Lock,
                    title: "资金托管",
                    desc: "机构级协议保障资金安全与合规",
                  },
                ].map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex items-start gap-3">
                    <Icon size={20} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-primary block text-sm">{title}</span>
                      <span className="text-sm text-on-surface-variant leading-relaxed">{desc}</span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => enter("publisher")}
                className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(to right, #00327d, #0047ab)" }}
              >
                以发单方身份进入
                <ArrowRight size={18} />
              </button>
            </div>

            {/* Bottom accent */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary-container to-primary" />
          </div>

          {/* ── Community Card ── */}
          <div className="group relative bg-white rounded-xl overflow-hidden border border-outline-variant/20 hover:border-amber-400/50 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1">
            {/* Watermark */}
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <Globe size={96} className="text-amber-500" />
            </div>

            <div className="p-8 h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <MessageSquare size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold font-display text-primary">社区逛逛</h2>
                  <p className="text-sm text-on-surface-variant">访客浏览 · 无需注册</p>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-5 mb-10 flex-grow">
                {[
                  {
                    icon: TrendingUp,
                    title: "浏览热门话题",
                    desc: "探索 VibeCoding、AIGC、政企数字化等前沿讨论",
                  },
                  {
                    icon: Globe,
                    title: "探索 OPC 生态",
                    desc: "了解平台贡献榜、认证路径与顶尖 OPC 动态",
                  },
                  {
                    icon: CalendarDays,
                    title: "参与社区活动",
                    desc: "查看线上沙龙、直播活动与技术分享信息",
                  },
                ].map(({ icon: Icon, title, desc }) => (
                  <li key={title} className="flex items-start gap-3">
                    <Icon size={20} className="text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-primary block text-sm">{title}</span>
                      <span className="text-sm text-on-surface-variant leading-relaxed">{desc}</span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => navigate("/community")}
                className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(to right, #b45309, #d97706)" }}
              >
                访客浏览社区
                <ArrowRight size={18} />
              </button>
            </div>

            {/* Bottom accent */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-500" />
          </div>
        </div>

        {/* Admin Backend Entry */}
        <div className="mt-8 w-full max-w-6xl">
          <div
            className="group relative flex items-center justify-between gap-4 px-6 py-4 rounded-2xl border border-violet-200/60 bg-gradient-to-r from-violet-50 to-indigo-50 hover:from-violet-100 hover:to-indigo-100 hover:border-violet-300 transition-all duration-300 cursor-pointer"
            onClick={() => navigate("/auth/admin")}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                <LayoutDashboard size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-violet-900">管理后台</p>
                <p className="text-xs text-violet-500">仅限平台授权管理员访问 · 需验证账号权限</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-violet-600 font-semibold text-sm group-hover:gap-3 transition-all">
              进入后台
              <ArrowRight size={16} />
            </div>
            <div className="absolute inset-0 rounded-2xl ring-1 ring-violet-200/40 pointer-events-none" />
          </div>
        </div>

        {/* Ecosystem anchor */}
        <div className="mt-10 flex items-center gap-4 py-3 px-6 bg-surface-container-low rounded-full border border-outline-variant/10">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">赋能平台</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <ShieldCheck size={12} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold text-primary font-display">海创元数字生态</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-6 bg-[#f3f3f6] flex flex-col md:flex-row justify-between items-center px-8 gap-4">
        <span className="text-xs font-medium text-slate-400">
          © 2026 接单吧 · 数字交易架构完整性的践行者
        </span>
        <div className="flex gap-6 items-center">
          {["隐私政策", "服务条款", "联系支持"].map(link => (
            <a key={link} href="#" className="text-xs font-medium text-slate-400 hover:text-primary transition-colors">
              {link}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
