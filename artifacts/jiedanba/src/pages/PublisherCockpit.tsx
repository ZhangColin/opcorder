import { useLocation, Link } from "wouter";
import {
  LayoutDashboard, Users, BarChart2, FileText, PlusCircle,
  HelpCircle, LogOut, Search, Bell, Settings, ShieldCheck,
  Wallet, Lock, Clock, CreditCard, TrendingUp, Download,
  BarChart3, Gavel, Zap, ArrowDownLeft, Landmark, Percent,
  MoreHorizontal, Gauge,
} from "lucide-react";

/* ─── Static data (shared with OPC Cockpit) ─────── */

const STAT_CARDS = [
  { label: "总结算量",    value: "¥14,290,000", badge: "+12.5%",  badgeCls: "text-secondary",     BadgeIcon: TrendingUp, icon: Wallet,     iconCls: "bg-primary/10 text-primary",   bar: 75, barCls: "bg-primary" },
  { label: "托管余额",    value: "¥3,450,200",  badge: "托管中",  badgeCls: "text-muted-foreground", BadgeIcon: null,       icon: Lock,       iconCls: "bg-secondary/10 text-secondary", sub: "锁定待验收" },
  { label: "待支付金额",  value: "¥892,400",    badge: "14件到期", badgeCls: "text-destructive",    BadgeIcon: Clock,      icon: Clock,      iconCls: "bg-emerald-900/10 text-emerald-900", sub: "等待里程碑4" },
  { label: "平台手续费",  value: "¥421,000",    badge: "本月累计", badgeCls: "text-secondary font-bold", BadgeIcon: null, icon: CreditCard, iconCls: "bg-blue-900/10 text-blue-900", bars: true },
];

const SETTLEMENTS = [
  { project: "云基础设施迁移", id: "#JD-2024-001", opc: "深圳科技OPC",        initials: "深", milestone: "3/4",  pct: 75,  barCls: "bg-secondary",     textCls: "text-secondary",    status: "托管中",  statusCls: "bg-green-100 text-green-700" },
  { project: "ML模型优化",     id: "#JD-2024-089", opc: "AI创新有限公司",      initials: "AI", milestone: "1/5",  pct: 20,  barCls: "bg-primary",       textCls: "text-primary",      status: "已释放",  statusCls: "bg-blue-50 text-blue-700" },
  { project: "数据治理审计",   id: "#JD-2024-112", opc: "SecureOps Global",    initials: "SO", milestone: "争议", pct: 100, barCls: "bg-destructive",   textCls: "text-destructive",  status: "争议中",  statusCls: "bg-red-100 text-red-700" },
];

const TRANSACTIONS = [
  { Icon: ArrowDownLeft, iconCls: "bg-secondary/10 text-secondary", borderCls: "border-secondary", title: "里程碑支付: OPC-9921",       meta: "2024年10月24日 · 14:22 · 批次ID: 772183", amount: "+¥124,000.00", status: "已完成", statusCls: "text-secondary" },
  { Icon: Landmark,      iconCls: "bg-primary/10 text-primary",     borderCls: "border-primary",   title: "托管存款: 项目「天剑」",       meta: "2024年10月23日 · 09:15 · 交易ID: 110928",  amount: "-¥500,000.00", status: "处理中", statusCls: "text-primary" },
  { Icon: Percent,       iconCls: "bg-slate-100 text-slate-500",    borderCls: "border-slate-300", title: "平台服务费: 10月第3周",        meta: "2024年10月21日 · 18:00 · 参考号: FEE-882", amount: "¥12,400.00",   status: "已对账", statusCls: "text-muted-foreground" },
];

/* ─── Sidebar ─────────────────────────────────── */

function Sidebar({ onLogout }: { onLogout: () => void }) {
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
        {[
          { icon: LayoutDashboard, label: "工作台",  href: "/publisher" },
          { icon: FileText,        label: "我的需求", href: "#" },
          { icon: Users,           label: "OPC 人才库", href: "#" },
          { icon: BarChart2,       label: "数据分析", href: "#" },
          { icon: FileText,        label: "项目报告", href: "#" },
          { icon: Gauge,           label: "驾驶舱",   href: "/publisher/cockpit", active: true },
          { icon: Gavel,           label: "争议处理", href: "/publisher/disputes" },
        ].map(item => (
          <Link key={item.label} href={item.href}>
            <div className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all hover:translate-x-0.5 cursor-pointer ${
              item.active ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-primary"
            }`}>
              <item.icon size={18} />
              {item.label}
            </div>
          </Link>
        ))}
      </nav>

      <Link href="/publisher/demand/1">
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

/* ─── Page ────────────────────────────────────── */

export default function PublisherCockpit() {
  const [, navigate] = useLocation();

  const logout = () => {
    localStorage.removeItem("jdb_role");
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-[#f9f9fc] text-[#1a1c1e]">
      <Sidebar onLogout={logout} />

      <main className="flex-1 ml-64 min-h-screen">
        {/* Top bar */}
        <header className="fixed top-0 right-0 left-64 z-40 bg-white/80 backdrop-blur-md shadow-sm flex justify-between items-center px-8 py-3">
          <div className="relative w-full max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="搜索交易记录…"
              className="w-full bg-slate-100 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-4 ml-6">
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Settings size={20} />
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-blue-900">海创元运营团队</p>
                <p className="text-[10px] text-slate-500 font-medium">项目经理</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                海
              </div>
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="pt-24 px-8 pb-12 space-y-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-primary font-display">
                机构驾驶舱
              </h1>
              <p className="text-slate-500 mt-1">实时财务对账与项目结算全局监控。</p>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl text-sm font-semibold">
                <ShieldCheck size={16} className="shrink-0" />
                国资级安全防护已激活
              </div>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm shadow-sm hover:bg-primary/90 transition-colors">
                <Download size={16} /> 导出对账单
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {STAT_CARDS.map(s => {
              const Icon = s.icon;
              const BadgeIcon = s.BadgeIcon;
              return (
                <div key={s.label} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`p-2 rounded-xl ${s.iconCls}`}>
                      <Icon size={20} />
                    </span>
                    <span className={`text-xs font-bold flex items-center gap-1 ${s.badgeCls}`}>
                      {BadgeIcon && <BadgeIcon size={12} />}
                      {s.badge}
                    </span>
                  </div>
                  <p className="text-slate-500 text-sm font-medium">{s.label}</p>
                  <h3 className="text-2xl font-bold text-blue-900 mt-1">{s.value}</h3>
                  {s.bar !== undefined && (
                    <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className={`${s.barCls} h-full rounded-full`} style={{ width: `${s.bar}%` }} />
                    </div>
                  )}
                  {s.sub && <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-widest">{s.sub}</p>}
                  {s.bars && (
                    <div className="mt-4 flex gap-1">
                      <div className="h-1.5 flex-1 bg-secondary rounded-full" />
                      <div className="h-1.5 flex-1 bg-secondary/40 rounded-full" />
                      <div className="h-1.5 flex-1 bg-secondary/20 rounded-full" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* Left */}
            <div className="lg:col-span-9 space-y-10">

              {/* Settlement status table */}
              <section>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold font-display flex items-center gap-2">
                    <BarChart3 size={20} className="text-primary" /> 结算状态追踪
                  </h2>
                  <button className="text-sm text-primary font-semibold hover:underline">查看全部项目</button>
                </div>
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4 font-bold">项目 / 编号</th>
                        <th className="px-6 py-4 font-bold">负责 OPC</th>
                        <th className="px-6 py-4 font-bold">里程碑</th>
                        <th className="px-6 py-4 font-bold">支付状态</th>
                        <th className="px-6 py-4 font-bold">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {SETTLEMENTS.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-6 py-5">
                            <p className="font-bold text-blue-900">{row.project}</p>
                            <p className="text-xs text-slate-400">{row.id}</p>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                {row.initials}
                              </div>
                              <span className="text-sm font-medium">{row.opc}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${row.textCls}`}>{row.milestone}</span>
                              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`${row.barCls} h-full rounded-full`} style={{ width: `${row.pct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${row.statusCls}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <button className="text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors">
                              <MoreHorizontal size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Transaction history */}
              <section>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold font-display">交易历史</h2>
                  <div className="flex gap-2">
                    <select className="text-xs bg-slate-100 border-none rounded-lg py-1.5 px-3 outline-none">
                      <option>全部日期</option>
                      <option>最近7天</option>
                      <option>最近30天</option>
                    </select>
                    <select className="text-xs bg-slate-100 border-none rounded-lg py-1.5 px-3 outline-none">
                      <option>全部类型</option>
                      <option>支付</option>
                      <option>充值</option>
                      <option>手续费</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-3">
                  {TRANSACTIONS.map((tx, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 bg-white rounded-2xl hover:bg-slate-50 transition-all border-l-4 shadow-sm ${tx.borderCls}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.iconCls}`}>
                          <tx.Icon size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-blue-900 text-sm">{tx.title}</p>
                          <p className="text-xs text-slate-400">{tx.meta}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-extrabold text-blue-900">{tx.amount}</p>
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${tx.statusCls}`}>
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right Sidebar */}
            <aside className="lg:col-span-3 space-y-6">

              {/* Settlement Model */}
              <div className="bg-primary text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                <h3 className="text-base font-bold mb-6 flex items-center gap-2 font-display">
                  <BarChart3 size={18} /> 结算分配模型
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-end border-b border-white/20 pb-3">
                    <div>
                      <p className="text-[10px] uppercase opacity-70 mb-1">OPC 分配比例</p>
                      <p className="font-bold text-xl">50–70%</p>
                    </div>
                    <span className="text-2xl opacity-50">⚙</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-white/20 pb-3">
                    <div>
                      <p className="text-[10px] uppercase opacity-70 mb-1">发单方退款/再融资</p>
                      <p className="font-bold text-xl">20–40%</p>
                    </div>
                    <span className="text-2xl opacity-50">🏦</span>
                  </div>
                  <div className="flex justify-between items-end pb-2">
                    <div>
                      <p className="text-[10px] uppercase opacity-70 mb-1">平台服务费</p>
                      <p className="font-bold text-xl text-emerald-300">10%</p>
                    </div>
                    <ShieldCheck size={20} className="text-emerald-300" />
                  </div>
                </div>
                <div className="mt-6 p-3 bg-white/10 rounded-xl text-[11px] leading-relaxed opacity-90">
                  比例根据 OPC 评级与项目复杂度评分动态计算。
                </div>
              </div>

              {/* Compliance Monitor */}
              <div className="bg-white p-6 rounded-2xl border border-slate-100">
                <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2 font-display">
                  <ShieldCheck size={16} className="text-secondary" /> 合规监控
                </h3>
                <div className="space-y-5">
                  <div className="flex items-start gap-3">
                    <Landmark size={18} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold">国资级安全</p>
                      <p className="text-xs text-slate-500">资金存放于一类国有银行账户。</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Gavel size={18} className="text-secondary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold">税务代扣代缴</p>
                      <p className="text-xs text-slate-500">增值税/个税自动化处理，覆盖全部支付。</p>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl text-center">
                    <div className="w-24 h-24 mx-auto mb-2 bg-slate-200 rounded-lg flex items-center justify-center">
                      <ShieldCheck size={40} className="text-primary opacity-30" />
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">验证账本完整性</p>
                  </div>
                </div>
              </div>

              {/* AI Forecast */}
              <div className="bg-gradient-to-br from-emerald-900 to-emerald-700 p-6 rounded-2xl text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={16} className="text-emerald-300" />
                  <span className="text-xs font-bold uppercase tracking-widest text-emerald-300">AI 预测</span>
                </div>
                <p className="text-sm font-medium leading-snug">
                  根据当前开放竞标情况，预计 Q4 结算量将增长 <strong>22.4%</strong>。
                </p>
                <button className="mt-4 w-full py-2 bg-emerald-300 text-emerald-900 font-bold text-xs rounded-xl hover:brightness-110 transition-all">
                  下载分析报告
                </button>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
