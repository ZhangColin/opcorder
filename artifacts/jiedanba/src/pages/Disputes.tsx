import { useState } from "react";
import {
  Gavel, TrendingUp, AlertTriangle, Timer, CheckCircle2,
  FileText, UserPlus, Send, RotateCcw, SplitSquareHorizontal,
  ChevronRight, List, Eye, Search,
} from "lucide-react";

/* ─── Static data ───────────────────────────────── */

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
      { initials: "海", side: "left", text: "API 接口文档与实际返回不符，/auth 路由持续 404。" },
      { initials: "张", side: "right", text: "上周五已按变更日志更新了接口，请检查您的调用实现。" },
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
      { initials: "海", side: "left", text: "距截止日期已过去 10 天，仍未收到可交付成果。" },
      { initials: "李", side: "right", text: "遭遇了技术阻塞，预计本周内完成交付。" },
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
      { initials: "王", side: "right", text: "里程碑二已完成，请核实付款状态。" },
      { initials: "海", side: "left", text: "系统中未检测到付款，正在排查。" },
    ],
    aiTag: null,
    timeLeft: "24小时",
  },
];

const STATS = [
  { label: "总争议数",     value: "1,284", sub: "+12% 较上月", subCls: "text-secondary", icon: TrendingUp },
  { label: "待处理案件",   value: "42",    sub: "8 件紧急",    subCls: "text-destructive", icon: AlertTriangle },
  { label: "平均处理时长", value: "3.4天", sub: "-18h 较上周", subCls: "text-secondary",  icon: Timer, accent: true },
  { label: "已结算金额",   value: "¥142,800", sub: "94% 成功率", subCls: "text-blue-100", icon: CheckCircle2, dark: true },
];

/* ─── Page ────────────────────────────────────── */

export default function Disputes() {
  const [selectedId, setSelectedId] = useState(CASES[0].id);
  const focused = CASES.find(c => c.id === selectedId) ?? CASES[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground font-display mb-2">
          争议处理看板
        </h1>
        <p className="text-muted-foreground max-w-2xl">
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
                <span className={`text-xs font-bold uppercase tracking-widest mb-2 block ${s.dark ? "text-blue-200" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
                <h3 className={`text-4xl font-extrabold font-display ${s.dark ? "text-white" : "text-foreground"}`}>
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

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Queue Table */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold font-display flex items-center gap-2">
              <List size={20} className="text-primary" /> 活跃争议队列
            </h2>
            <div className="flex gap-2">
              <button className="bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">筛选</button>
              <button className="bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">导出</button>
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
                      <p className="font-bold text-sm text-foreground mb-1">{c.project}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
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
            {/* Header */}
            <div className="p-6 bg-primary text-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg font-display">{focused.id} 详情</h3>
                  <p className="text-xs opacity-80">调解阶段 · 剩余 {focused.timeLeft}</p>
                </div>
                {focused.aiTag && (
                  <span className="px-2 py-1 rounded bg-secondary/20 text-secondary text-[10px] font-extrabold uppercase tracking-tight border border-secondary/30">
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
              {/* Milestone Progress */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase mb-3">里程碑进度</p>
                <div className="space-y-3">
                  {focused.milestones.map((m, i) => (
                    <div key={i} className={`flex items-center gap-3 ${!m.done ? "opacity-40" : ""}`}>
                      <CheckCircle2 size={16} className={m.done ? "text-secondary fill-secondary/20" : "text-muted-foreground"} />
                      <span className="text-xs font-medium">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold transition-all">
                  <FileText size={16} /> 证据材料
                </button>
                <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-bold transition-all">
                  <UserPlus size={16} /> 邀请调解
                </button>
                <button className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-destructive/20 text-destructive hover:bg-destructive/5 text-sm font-bold transition-all">
                  <Gavel size={16} /> 提请仲裁
                </button>
              </div>

              {/* Adjudication Actions */}
              <div className="pt-5 border-t border-slate-100">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-4">资金处置</p>
                <div className="space-y-2">
                  <button className="w-full text-left p-3 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-secondary flex items-center justify-between group transition-all">
                    <div>
                      <p className="text-sm font-bold">全额释放给 OPC</p>
                      <p className="text-[10px] opacity-70">将 100% 资金支付给 {focused.opc}</p>
                    </div>
                    <Send size={16} className="group-hover:translate-x-1 transition-transform shrink-0" />
                  </button>
                  <button className="w-full text-left p-3 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-between group transition-all">
                    <div>
                      <p className="text-sm font-bold">全额退款给发单方</p>
                      <p className="text-[10px] text-muted-foreground">将 100% 退还给 {focused.issuer}</p>
                    </div>
                    <RotateCcw size={16} className="group-hover:translate-x-1 transition-transform shrink-0" />
                  </button>
                  <button className="w-full text-left p-3 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-between group transition-all">
                    <div>
                      <p className="text-sm font-bold">自定义分配比例</p>
                      <p className="text-[10px] text-muted-foreground">按双方协议自定义分配</p>
                    </div>
                    <SplitSquareHorizontal size={16} className="group-hover:translate-x-1 transition-transform shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Chat Preview */}
          <div className="bg-white p-6 rounded-2xl shadow-sm space-y-4">
            <h4 className="text-sm font-bold font-display uppercase tracking-wider text-muted-foreground">
              最近沟通记录
            </h4>
            <div className="space-y-3">
              {focused.chats.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.side === "right" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-[10px] ${
                    msg.side === "right" ? "bg-primary text-white" : "bg-slate-100 text-foreground"
                  }`}>
                    {msg.initials}
                  </div>
                  <div className={`p-3 text-xs leading-relaxed max-w-[80%] ${
                    msg.side === "right"
                      ? "bg-blue-50 text-foreground rounded-tl-xl rounded-br-xl rounded-bl-xl"
                      : "bg-slate-100 text-foreground rounded-tr-xl rounded-br-xl rounded-bl-xl"
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
  );
}
