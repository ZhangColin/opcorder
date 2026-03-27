import { useCurrentUser } from "@/hooks/use-current-user";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { HelpDialog } from "@/components/HelpDialog";
import { PublisherHeaderUser } from '@/components/publisher/PublisherHeaderUser';
import {
  LayoutDashboard, Users, BarChart2, FileText, PlusCircle,
  HelpCircle, LogOut, Search, Bell, ShieldCheck,
  Gavel, TrendingUp, AlertTriangle, Timer, CheckCircle2,
  FileText as FileIcon, UserPlus, Send, RotateCcw,
  SplitSquareHorizontal, ChevronRight, List, Eye,
} from "lucide-react";

/* ─── Same static data as OPC disputes ─────────── */

const CASES = [
  {
    id: "#DS-8821",
    project: "AI教育课程体系开发",
    issuer: "海创元运营团队",
    opc: "张明远",
    reason: "质量问题",
    reasonCls: "bg-red-100 text-red-700",
    status: "调解中",
    statusDot: "bg-secondary animate-pulse",
    escrow: "¥ 12,500",
    priority: "高",
    milestones: [
      { label: "Sprint 1：架构设计", done: true },
      { label: "Sprint 2：API 集成（存疑）", done: false },
    ],
    chats: [
      { initials: "海", side: "left" as const, text: "API 接口文档与实际返回不符，/auth 路由持续 404。" },
      { initials: "张", side: "right" as const, text: "上周五已按变更日志更新了接口，请检查您的调用实现。" },
    ],
    aiTag: "AI 推荐",
    timeLeft: "48小时",
  },
  {
    id: "#DS-9042",
    project: "智慧物流 AI 优化",
    issuer: "海创元运营团队",
    opc: "李思齐",
    reason: "交付延误",
    reasonCls: "bg-slate-100 text-slate-600",
    status: "证据收集",
    statusDot: "bg-amber-500",
    escrow: "¥ 28,000",
    priority: "中",
    milestones: [
      { label: "阶段一：需求分析", done: true },
      { label: "阶段二：核心开发（延误）", done: false },
    ],
    chats: [
      { initials: "海", side: "left" as const, text: "距截止日期已过去 10 天，仍未收到可交付成果。" },
      { initials: "李", side: "right" as const, text: "遭遇了技术阻塞，预计本周内完成交付。" },
    ],
    aiTag: null,
    timeLeft: "72小时",
  },
  {
    id: "#DS-7741",
    project: "零售 CRM 插件开发",
    issuer: "海创元运营团队",
    opc: "王子豪",
    reason: "付款纠纷",
    reasonCls: "bg-slate-100 text-slate-600",
    status: "新建",
    statusDot: "bg-blue-500",
    escrow: "¥ 8,400",
    priority: "低",
    milestones: [
      { label: "设计交付", done: true },
      { label: "前端集成（待支付）", done: false },
    ],
    chats: [
      { initials: "王", side: "right" as const, text: "里程碑二已完成，请核实付款状态。" },
      { initials: "海", side: "left" as const, text: "系统中未检测到付款，正在排查。" },
    ],
    aiTag: null,
    timeLeft: "24小时",
  },
];

const STATS = [
  { label: "总争议数",     value: "1,284", sub: "+12% 较上月", subCls: "text-secondary", icon: TrendingUp },
  { label: "待处理案件",   value: "42",    sub: "8 件紧急",    subCls: "text-destructive", icon: AlertTriangle },
  { label: "平均处理时长", value: "3.4天", sub: "-18h 较上周", subCls: "text-secondary",  icon: Timer, accent: true },
  { label: "已结算金额",   value: "¥142,800", sub: "94% 成功率", subCls: "text-blue-200", icon: CheckCircle2, dark: true },
];

/* ─── Sidebar ─────────────────────────────────── */

function Sidebar({ onLogout }: { onLogout: () => void }) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <>
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}
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
          { icon: Gavel,           label: "争议处理", href: "/publisher/disputes", active: true },
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
        <button
          onClick={() => setShowHelp(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:text-primary hover:bg-primary/5 transition-all"
        >
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
    </>
  );
}

/* ─── Page ────────────────────────────────────── */

export default function PublisherDisputes() {
  const [, navigate] = useLocation();
  const { } = useCurrentUser();
  const [selectedId, setSelectedId] = useState(CASES[0].id);
  const focused = CASES.find(c => c.id === selectedId) ?? CASES[0];

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
              placeholder="搜索争议 ID、用户或项目…"
              className="w-full bg-slate-100 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-4 ml-6">
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
            </button>
            <PublisherHeaderUser onLogout={logout} />
          </div>
        </header>

        {/* Body */}
        <div className="pt-24 px-8 pb-12 space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-blue-900 font-display mb-2">
              争议处理看板
            </h1>
            <p className="text-slate-500 max-w-2xl">
              监控并处理 OPC 生态系统内的活跃争议。基于证据的调解与最终裁定均在此管理。
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {STATS.map(s => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className={`p-6 rounded-2xl flex flex-col justify-between shadow-sm ${
                    s.dark ? "bg-primary text-white" : s.accent ? "bg-white border-l-4 border-secondary" : "bg-white"
                  }`}
                >
                  <div>
                    <span className={`text-xs font-bold uppercase tracking-widest mb-2 block ${s.dark ? "text-blue-200" : "text-slate-500"}`}>
                      {s.label}
                    </span>
                    <h3 className={`text-4xl font-extrabold font-display ${s.dark ? "text-white" : "text-blue-900"}`}>
                      {s.value}
                    </h3>
                  </div>
                  <div className={`mt-4 flex items-center gap-2 text-sm font-medium ${s.dark ? s.subCls : s.subCls}`}>
                    <Icon size={14} />
                    <span>{s.sub}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Queue table */}
            <div className="lg:col-span-2 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold font-display flex items-center gap-2">
                  <List size={20} className="text-primary" /> 活跃争议队列
                </h2>
                <div className="flex gap-2">
                  <button className="bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200">筛选</button>
                  <button className="bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200">导出</button>
                </div>
              </div>

              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-400 uppercase text-[10px] font-bold tracking-widest">
                    <tr>
                      <th className="px-6 py-4">案件 ID</th>
                      <th className="px-6 py-4">项目 / 双方</th>
                      <th className="px-6 py-4">原因</th>
                      <th className="px-6 py-4">状态</th>
                      <th className="px-6 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {CASES.map(c => (
                      <tr
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={`transition-colors cursor-pointer group ${
                          c.id === selectedId ? "bg-primary/5" : "hover:bg-slate-50/70"
                        }`}
                      >
                        <td className="px-6 py-5 align-top">
                          <span className="font-mono text-xs font-bold text-primary">{c.id}</span>
                        </td>
                        <td className="px-6 py-5">
                          <p className="font-bold text-sm text-blue-900 mb-1">{c.project}</p>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 flex-wrap">
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded italic">发单方: {c.issuer}</span>
                            <span>vs</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded italic">OPC: {c.opc}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${c.reasonCls}`}>
                            {c.reason}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${c.statusDot}`} />
                            <span className="text-xs font-medium">{c.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button className="text-primary hover:bg-primary/10 p-2 rounded-xl transition-colors">
                            <ChevronRight size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Case Focus Panel */}
            <div className="space-y-5">
              <h2 className="text-xl font-bold font-display flex items-center gap-2">
                <Eye size={20} className="text-primary" /> 案件详情
              </h2>

              <div className="bg-white rounded-2xl shadow-lg border border-primary/10 overflow-hidden">
                <div className="p-6 bg-primary text-white">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg font-display">{focused.id} 详情</h3>
                      <p className="text-xs opacity-80">调解阶段 · 剩余 {focused.timeLeft}</p>
                    </div>
                    {focused.aiTag && (
                      <span className="px-2 py-1 rounded bg-secondary/20 text-secondary text-[10px] font-extrabold border border-secondary/30">
                        {focused.aiTag}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-5">
                    <div className="flex-1">
                      <p className="text-[10px] uppercase font-bold text-blue-200 mb-1">托管金额</p>
                      <p className="text-xl font-bold">{focused.escrow}</p>
                    </div>
                    <div className="flex-1 border-l border-white/20 pl-4">
                      <p className="text-[10px] uppercase font-bold text-blue-200 mb-1">优先级</p>
                      <p className="text-xl font-bold">{focused.priority}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-3">里程碑进度</p>
                    <div className="space-y-3">
                      {focused.milestones.map((m, i) => (
                        <div key={i} className={`flex items-center gap-3 ${!m.done ? "opacity-40" : ""}`}>
                          <CheckCircle2 size={16} className={m.done ? "text-secondary fill-secondary/20" : "text-slate-400"} />
                          <span className="text-xs font-medium">{m.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold transition-all">
                      <FileIcon size={16} /> 证据材料
                    </button>
                    <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold transition-all">
                      <UserPlus size={16} /> 邀请调解
                    </button>
                    <button className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-destructive/20 text-destructive hover:bg-destructive/5 text-sm font-bold transition-all">
                      <Gavel size={16} /> 提请仲裁
                    </button>
                  </div>

                  <div className="pt-5 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-4">资金处置</p>
                    <div className="space-y-2">
                      <button className="w-full text-left p-3 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary flex items-center justify-between group transition-all">
                        <div>
                          <p className="text-sm font-bold">全额释放给 OPC</p>
                          <p className="text-[10px] opacity-70">100% 支付给 {focused.opc}</p>
                        </div>
                        <Send size={16} className="group-hover:translate-x-1 transition-transform shrink-0" />
                      </button>
                      <button className="w-full text-left p-3 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-between group transition-all">
                        <div>
                          <p className="text-sm font-bold">全额退款给发单方</p>
                          <p className="text-[10px] text-slate-400">100% 退还给 {focused.issuer}</p>
                        </div>
                        <RotateCcw size={16} className="group-hover:translate-x-1 transition-transform shrink-0" />
                      </button>
                      <button className="w-full text-left p-3 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-between group transition-all">
                        <div>
                          <p className="text-sm font-bold">自定义分配比例</p>
                          <p className="text-[10px] text-slate-400">按双方协议分配</p>
                        </div>
                        <SplitSquareHorizontal size={16} className="group-hover:translate-x-1 transition-transform shrink-0" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat preview */}
              <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
                <h4 className="text-sm font-bold font-display uppercase tracking-wider text-slate-500">
                  最近沟通记录
                </h4>
                <div className="space-y-3">
                  {focused.chats.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.side === "right" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-[10px] ${
                        msg.side === "right" ? "bg-primary text-white" : "bg-slate-100"
                      }`}>
                        {msg.initials}
                      </div>
                      <div className={`p-3 text-xs leading-relaxed max-w-[80%] ${
                        msg.side === "right"
                          ? "bg-blue-50 rounded-tl-xl rounded-br-xl rounded-bl-xl"
                          : "bg-slate-100 rounded-tr-xl rounded-br-xl rounded-bl-xl"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
                <button className="w-full text-center text-xs font-bold text-primary py-2 hover:underline">
                  查看全部沟通记录
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
