import { useState } from "react";
import {
  LayoutDashboard, Users, FileText, ShoppingBag,
  Wallet, Network, GraduationCap, Shield, BarChart3,
  TrendingUp, TrendingDown, ShieldCheck, LogOut,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Search, Bell, Settings, ChevronDown, MoreHorizontal,
  RefreshCw, Download, Eye, Ban, Check, Star,
  BookOpen, PlayCircle, Award, Flag, Megaphone,
  Activity, ArrowUpRight, ArrowDownRight, Zap,
  CreditCard, Receipt, BadgeCheck, UserX, UserCheck,
  Gavel, AlertCircle,
} from "lucide-react";

/* ─── Types & nav ────────────────────────────── */

type Module =
  | "dashboard" | "users" | "demands" | "orders"
  | "finance"   | "ecosystem" | "training" | "content";

const NAV: { key: Module; icon: React.ElementType; label: string }[] = [
  { key: "dashboard",  icon: LayoutDashboard, label: "数据看板" },
  { key: "users",      icon: Users,           label: "用户管理" },
  { key: "demands",    icon: FileText,         label: "需求管理" },
  { key: "orders",     icon: ShoppingBag,      label: "订单管理" },
  { key: "finance",    icon: Wallet,           label: "财务管理" },
  { key: "ecosystem",  icon: Network,          label: "OPC 生态池管理" },
  { key: "training",   icon: GraduationCap,    label: "认证培训管理" },
  { key: "content",    icon: Shield,           label: "内容审核" },
];

/* ─── Shared components ─────────────────────── */

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${color}`}>
      {label}
    </span>
  );
}

function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-2xl font-extrabold text-blue-900 font-display">{title}</h2>
        {sub && <p className="text-slate-500 text-sm mt-1">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function StatCard({
  label, value, delta, deltaUp, icon: Icon, accent,
}: {
  label: string; value: string; delta?: string; deltaUp?: boolean;
  icon: React.ElementType; accent?: boolean;
}) {
  return (
    <div className={`p-6 rounded-2xl shadow-sm flex flex-col justify-between ${accent ? "bg-primary text-white" : "bg-white"}`}>
      <div className="flex items-start justify-between mb-4">
        <span className={`p-2 rounded-xl ${accent ? "bg-white/20" : "bg-primary/10"}`}>
          <Icon size={20} className={accent ? "text-white" : "text-primary"} />
        </span>
        {delta && (
          <span className={`text-xs font-bold flex items-center gap-1 ${
            deltaUp ? (accent ? "text-emerald-300" : "text-secondary") : "text-destructive"
          }`}>
            {deltaUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {delta}
          </span>
        )}
      </div>
      <p className={`text-sm font-medium ${accent ? "text-blue-200" : "text-slate-500"}`}>{label}</p>
      <h3 className={`text-3xl font-extrabold font-display mt-1 ${accent ? "text-white" : "text-blue-900"}`}>{value}</h3>
    </div>
  );
}

function TableShell({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
          <tr>{headers.map(h => <th key={h} className="px-6 py-4">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-50">{children}</tbody>
      </table>
    </div>
  );
}

function ActionMenu({ actions }: { actions: { label: string; cls?: string; icon: React.ElementType }[] }) {
  return (
    <div className="flex items-center gap-1">
      {actions.map(a => (
        <button key={a.label} title={a.label}
          className={`p-2 rounded-xl transition-colors ${a.cls ?? "hover:bg-slate-100 text-slate-500 hover:text-primary"}`}>
          <a.icon size={15} />
        </button>
      ))}
    </div>
  );
}

/* ─── Module: 数据看板 ─────────────────────────── */

function Dashboard() {
  const kpis = [
    { label: "本月派单量",    value: "1,482",       delta: "+18.3%", deltaUp: true,  icon: FileText  },
    { label: "订单完成率",   value: "89.4%",        delta: "+2.1%",  deltaUp: true,  icon: CheckCircle2 },
    { label: "活跃 OPC 数",  value: "3,216",        delta: "+124",   deltaUp: true,  icon: Users     },
    { label: "本月结算收入", value: "¥2,840,000",   delta: "+22.4%", deltaUp: true,  icon: Wallet, accent: true },
  ];

  const trends = [
    { label: "平均完单时长",   value: "4.2天",  sub: "-0.8天 较上月",  up: true  },
    { label: "用户投诉率",    value: "1.3%",   sub: "+0.2% 较上月",   up: false },
    { label: "培训通过率",    value: "76.5%",  sub: "+3.1% 较上月",   up: true  },
    { label: "平台费收入",    value: "¥284K",  sub: "+22% 较上月",    up: true  },
    { label: "新增 OPC",     value: "312",    sub: "+45 较上月",     up: true  },
    { label: "争议处理量",    value: "42",     sub: "-8 较上月",      up: true  },
  ];

  return (
    <div className="space-y-8">
      <SectionHeader
        title="数据看板"
        sub="核心运营指标实时总览 · 截至今日"
        action={
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold hover:bg-slate-200">
              <RefreshCw size={14} /> 刷新
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90">
              <Download size={14} /> 导出报表
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {kpis.map(k => <StatCard key={k.label} {...k} />)}
      </div>

      {/* Trend grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {trends.map(t => (
          <div key={t.label} className="bg-white p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${t.up ? "bg-secondary/10" : "bg-destructive/10"}`}>
              {t.up ? <TrendingUp size={20} className="text-secondary" /> : <TrendingDown size={20} className="text-destructive" />}
            </div>
            <div>
              <p className="text-slate-500 text-xs font-medium">{t.label}</p>
              <p className="text-blue-900 text-xl font-extrabold font-display">{t.value}</p>
              <p className={`text-[10px] font-semibold mt-0.5 ${t.up ? "text-secondary" : "text-destructive"}`}>{t.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div>
        <h3 className="text-base font-bold text-blue-900 mb-4 font-display">近期系统动态</h3>
        <div className="space-y-2">
          {[
            { icon: UserCheck, cls: "bg-secondary/10 text-secondary", text: "新 OPC「王子豪」通过等级 B → A 审批", time: "3 分钟前" },
            { icon: AlertTriangle, cls: "bg-amber-100 text-amber-600", text: "需求 #JD-2024-312「金融风控平台」被标记为紧急", time: "17 分钟前" },
            { icon: Gavel, cls: "bg-destructive/10 text-destructive", text: "争议 #DS-8821 进入仲裁阶段", time: "1 小时前" },
            { icon: Award, cls: "bg-blue-100 text-blue-700", text: "20 名 OPC 完成「AI智能体开发」课程认证", time: "2 小时前" },
            { icon: CreditCard, cls: "bg-primary/10 text-primary", text: "批次结算完成，共释放 ¥340,000 至 18 名 OPC", time: "4 小时前" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.cls}`}>
                <item.icon size={16} />
              </div>
              <p className="text-sm text-blue-900 flex-1">{item.text}</p>
              <span className="text-[11px] text-slate-400 shrink-0">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Module: 用户管理 ─────────────────────────── */

function UserManagement() {
  const users = [
    { name: "张明远", id: "OPC-10021", type: "OPC", level: "A", status: "正常", certs: 4, joined: "2023-08-15" },
    { name: "李思齐", id: "OPC-10043", type: "OPC", level: "B", status: "正常", certs: 2, joined: "2024-01-03" },
    { name: "王子豪", id: "OPC-10087", type: "OPC", level: "C", status: "审核中", certs: 0, joined: "2024-09-22" },
    { name: "海创元运营团队", id: "PUB-00001", type: "发单方", level: "—", status: "正常", certs: 0, joined: "2022-06-01" },
    { name: "深圳科技OPC", id: "OPC-10102", type: "OPC", level: "A", status: "封禁", certs: 6, joined: "2022-11-18" },
    { name: "AI创新有限公司", id: "PUB-00023", type: "发单方", level: "—", status: "正常", certs: 0, joined: "2023-03-07" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="用户管理" sub="OPC 账户审核、角色权限配置、认证等级调整、封禁/解封" action={
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold">
          <Download size={14} /> 导出名单
        </button>
      } />

      <div className="flex gap-3 mb-2">
        {["全部", "OPC", "发单方", "审核中", "封禁"].map(f => (
          <button key={f} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            f === "全部" ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}>{f}</button>
        ))}
      </div>

      <TableShell headers={["用户", "账号 ID", "身份", "等级", "持证数", "注册日期", "状态", "操作"]}>
        {users.map(u => (
          <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
            <td className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {u.name[0]}
                </div>
                <span className="font-bold text-sm text-blue-900">{u.name}</span>
              </div>
            </td>
            <td className="px-6 py-4 font-mono text-xs text-slate-400">{u.id}</td>
            <td className="px-6 py-4">
              <StatusBadge label={u.type} color={u.type === "OPC" ? "bg-secondary/10 text-secondary" : "bg-primary/10 text-primary"} />
            </td>
            <td className="px-6 py-4">
              <span className={`font-bold text-sm ${u.level === "A" ? "text-amber-500" : u.level === "B" ? "text-primary" : "text-slate-400"}`}>
                {u.level === "—" ? "—" : `Lv.${u.level}`}
              </span>
            </td>
            <td className="px-6 py-4 text-sm text-slate-500">{u.certs}</td>
            <td className="px-6 py-4 text-xs text-slate-400">{u.joined}</td>
            <td className="px-6 py-4">
              <StatusBadge label={u.status}
                color={u.status === "正常" ? "bg-green-100 text-green-700" : u.status === "审核中" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"} />
            </td>
            <td className="px-6 py-4">
              <ActionMenu actions={[
                { label: "查看", icon: Eye },
                { label: "审批", icon: UserCheck },
                { label: "封禁", icon: UserX, cls: "hover:bg-red-50 text-slate-400 hover:text-destructive" },
              ]} />
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

/* ─── Module: 需求管理 ─────────────────────────── */

function DemandManagement() {
  const demands = [
    { title: "AI教育课程体系开发", id: "#JD-2024-312", publisher: "海创元", budget: "¥120,000", status: "招募中", urgent: true, created: "2024-10-25" },
    { title: "智慧物流AI优化",      id: "#JD-2024-298", publisher: "深圳科技",  budget: "¥280,000", status: "进行中", urgent: false, created: "2024-10-18" },
    { title: "数据治理审计",        id: "#JD-2024-277", publisher: "AI创新",   budget: "¥85,000",  status: "争议中", urgent: true, created: "2024-10-10" },
    { title: "零售CRM插件",        id: "#JD-2024-251", publisher: "海创元",    budget: "¥45,000",  status: "待验收", urgent: false, created: "2024-09-30" },
    { title: "区块链合规审查",      id: "#JD-2024-234", publisher: "全球合规",  budget: "¥160,000", status: "已完成", urgent: false, created: "2024-09-15" },
  ];

  const statusColor = (s: string) => ({
    "招募中": "bg-amber-100 text-amber-700",
    "进行中": "bg-blue-100 text-blue-700",
    "待验收": "bg-purple-100 text-purple-700",
    "已完成": "bg-green-100 text-green-700",
    "争议中": "bg-red-100 text-red-700",
  }[s] ?? "bg-slate-100 text-slate-500");

  return (
    <div className="space-y-6">
      <SectionHeader title="需求管理" sub="需求审核、状态变更、强制关闭、紧急标记" />
      <TableShell headers={["需求标题", "编号", "发单方", "预算", "创建日期", "状态", "操作"]}>
        {demands.map(d => (
          <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
            <td className="px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-blue-900">{d.title}</span>
                {d.urgent && (
                  <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full animate-pulse">紧急</span>
                )}
              </div>
            </td>
            <td className="px-6 py-4 font-mono text-xs text-slate-400">{d.id}</td>
            <td className="px-6 py-4 text-sm text-slate-500">{d.publisher}</td>
            <td className="px-6 py-4 font-bold text-sm text-blue-900">{d.budget}</td>
            <td className="px-6 py-4 text-xs text-slate-400">{d.created}</td>
            <td className="px-6 py-4"><StatusBadge label={d.status} color={statusColor(d.status)} /></td>
            <td className="px-6 py-4">
              <ActionMenu actions={[
                { label: "查看", icon: Eye },
                { label: "标记紧急", icon: Megaphone },
                { label: "强制关闭", icon: XCircle, cls: "hover:bg-red-50 text-slate-400 hover:text-destructive" },
              ]} />
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

/* ─── Module: 订单管理 ─────────────────────────── */

function OrderManagement() {
  const orders = [
    { id: "#ORD-88012", demand: "AI教育课程",    opc: "张明远",   amount: "¥120,000", milestone: "3/5", status: "进行中",  days: 24 },
    { id: "#ORD-87654", demand: "智慧物流AI",    opc: "李思齐",   amount: "¥280,000", milestone: "争议", status: "争议中",  days: 45 },
    { id: "#ORD-86001", demand: "零售CRM插件",   opc: "王子豪",   amount: "¥45,000",  milestone: "4/4", status: "待结算", days: 62 },
    { id: "#ORD-84229", demand: "区块链合规",     opc: "深圳科技", amount: "¥160,000", milestone: "5/5", status: "已完成", days: 38 },
    { id: "#ORD-82100", demand: "数据治理审计",   opc: "SecureOps", amount: "¥85,000", milestone: "1/3", status: "延误中", days: 91 },
  ];

  const statusColor = (s: string) => ({
    "进行中": "bg-blue-100 text-blue-700",
    "争议中": "bg-red-100 text-red-700",
    "待结算": "bg-purple-100 text-purple-700",
    "已完成": "bg-green-100 text-green-700",
    "延误中": "bg-amber-100 text-amber-700",
  }[s] ?? "bg-slate-100 text-slate-500");

  return (
    <div className="space-y-6">
      <SectionHeader title="订单管理" sub="订单全生命周期跟踪、争议介入、强制结算" />
      <TableShell headers={["订单号", "关联需求", "负责 OPC", "金额", "里程碑", "已进行天数", "状态", "操作"]}>
        {orders.map(o => (
          <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
            <td className="px-6 py-4 font-mono text-xs font-bold text-primary">{o.id}</td>
            <td className="px-6 py-4 text-sm text-blue-900 font-medium">{o.demand}</td>
            <td className="px-6 py-4 text-sm text-slate-500">{o.opc}</td>
            <td className="px-6 py-4 font-bold text-sm text-blue-900">{o.amount}</td>
            <td className="px-6 py-4">
              <span className={`text-xs font-bold ${o.milestone === "争议" ? "text-destructive" : "text-secondary"}`}>
                {o.milestone}
              </span>
            </td>
            <td className="px-6 py-4">
              <span className={`text-sm font-bold ${o.days > 60 ? "text-destructive" : "text-slate-600"}`}>{o.days}天</span>
            </td>
            <td className="px-6 py-4"><StatusBadge label={o.status} color={statusColor(o.status)} /></td>
            <td className="px-6 py-4">
              <ActionMenu actions={[
                { label: "查看", icon: Eye },
                { label: "争议介入", icon: Gavel },
                { label: "强制结算", icon: CreditCard, cls: "hover:bg-amber-50 text-slate-400 hover:text-amber-600" },
              ]} />
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

/* ─── Module: 财务管理 ─────────────────────────── */

function FinanceManagement() {
  const stats = [
    { label: "本月结算总额", value: "¥2,840,000", delta: "+22%",  deltaUp: true,  icon: Wallet },
    { label: "平台手续费",   value: "¥284,000",   delta: "+22%",  deltaUp: true,  icon: CreditCard },
    { label: "托管余额",     value: "¥3,450,200", delta: "锁定中", deltaUp: true,  icon: Activity },
    { label: "待结发票",     value: "38 张",       delta: "7 张逾期", deltaUp: false, icon: Receipt, accent: true },
  ];

  const txs = [
    { id: "TXN-77821", type: "里程碑支付", party: "张明远 (OPC)",    amount: "+¥24,000",  status: "已完成", date: "2024-10-24" },
    { id: "TXN-77719", type: "托管存款",   party: "海创元运营团队",   amount: "-¥120,000", status: "处理中", date: "2024-10-23" },
    { id: "TXN-77580", type: "平台手续费", party: "系统自动",        amount: "¥12,400",   status: "已对账", date: "2024-10-21" },
    { id: "TXN-77412", type: "争议退款",   party: "AI创新有限公司",  amount: "+¥45,000",  status: "已完成", date: "2024-10-19" },
    { id: "TXN-77200", type: "发票开具",   party: "深圳科技OPC",     amount: "¥68,000",   status: "待确认", date: "2024-10-16" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="财务管理" sub="分成结算报表、资金流水、发票管理、对账报表"
        action={<button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold"><Download size={14} />导出报表</button>}
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <TableShell headers={["交易 ID", "类型", "对方", "金额", "日期", "状态", "操作"]}>
        {txs.map(t => (
          <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
            <td className="px-6 py-4 font-mono text-xs text-slate-400">{t.id}</td>
            <td className="px-6 py-4 text-sm font-medium text-blue-900">{t.type}</td>
            <td className="px-6 py-4 text-sm text-slate-500">{t.party}</td>
            <td className="px-6 py-4 font-extrabold text-sm text-blue-900">{t.amount}</td>
            <td className="px-6 py-4 text-xs text-slate-400">{t.date}</td>
            <td className="px-6 py-4">
              <StatusBadge label={t.status} color={
                t.status === "已完成" ? "bg-green-100 text-green-700" :
                t.status === "已对账" ? "bg-blue-100 text-blue-700" :
                t.status === "处理中" ? "bg-amber-100 text-amber-700" :
                "bg-slate-100 text-slate-500"
              } />
            </td>
            <td className="px-6 py-4">
              <ActionMenu actions={[{ label: "查看", icon: Eye }, { label: "对账", icon: Check }, { label: "发票", icon: Receipt }]} />
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

/* ─── Module: OPC 生态池管理 ───────────────────── */

function EcosystemManagement() {
  const opcs = [
    { name: "张明远", id: "OPC-10021", level: "A", credit: 96, tags: ["架构设计", "AI智能体", "政企数字化"], status: "正常", pending: false },
    { name: "李思齐", id: "OPC-10043", level: "B", credit: 82, tags: ["数据治理", "Python"],               status: "正常", pending: false },
    { name: "王子豪", id: "OPC-10087", level: "C", credit: 71, tags: ["前端开发"],                         status: "升级审核", pending: true },
    { name: "深圳科技OPC", id: "OPC-10102", level: "A", credit: 34, tags: ["运维", "云迁移"],               status: "信用警告", pending: false },
    { name: "SecureOps", id: "OPC-10198", level: "B", credit: 60, tags: ["安全审计", "合规"],               status: "正常", pending: false },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="OPC 生态池管理" sub="能力标签管理、信用分调整、升降级审批、生态池数据统计" />

      <div className="grid grid-cols-3 gap-5">
        {[
          { label: "生态池总 OPC", value: "3,216", icon: Users },
          { label: "升级申请待审", value: "28",    icon: ArrowUpRight },
          { label: "信用分预警",   value: "14",    icon: AlertCircle, accent: true },
        ].map(s => <StatCard key={s.label} {...s} delta={undefined} deltaUp={undefined} />)}
      </div>

      <TableShell headers={["OPC", "账号", "等级", "信用分", "能力标签", "状态", "操作"]}>
        {opcs.map(o => (
          <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
            <td className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary">
                  {o.name[0]}
                </div>
                <span className="font-bold text-sm text-blue-900">{o.name}</span>
              </div>
            </td>
            <td className="px-6 py-4 font-mono text-xs text-slate-400">{o.id}</td>
            <td className="px-6 py-4">
              <span className={`font-extrabold text-lg font-display ${o.level === "A" ? "text-amber-500" : o.level === "B" ? "text-primary" : "text-slate-400"}`}>
                {o.level}
              </span>
            </td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${o.credit >= 80 ? "bg-secondary" : o.credit >= 60 ? "bg-amber-400" : "bg-destructive"}`}
                    style={{ width: `${o.credit}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-600">{o.credit}</span>
              </div>
            </td>
            <td className="px-6 py-4">
              <div className="flex flex-wrap gap-1">
                {o.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">{t}</span>
                ))}
              </div>
            </td>
            <td className="px-6 py-4">
              <StatusBadge label={o.status} color={
                o.status === "正常" ? "bg-green-100 text-green-700" :
                o.status === "升级审核" ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-700"
              } />
            </td>
            <td className="px-6 py-4">
              <ActionMenu actions={[
                { label: "查看", icon: Eye },
                { label: "调整信用分", icon: Star },
                { label: o.pending ? "审批升级" : "调整等级", icon: BadgeCheck },
              ]} />
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

/* ─── Module: 认证培训管理 ─────────────────────── */

function TrainingManagement() {
  const courses = [
    { title: "AI智能体系统架构师认证",   code: "CERT-AI-001", instructor: "张教授", enrolled: 312, passed: 239, status: "开放中" },
    { title: "政企数字化转型实战营",      code: "CERT-DT-002", instructor: "李讲师", enrolled: 187, passed: 142, status: "开放中" },
    { title: "OPC合规与资金托管规范",    code: "CERT-FN-003", instructor: "王合规", enrolled: 94,  passed: 78,  status: "开放中" },
    { title: "VibeCoding快速交付认证",   code: "CERT-VC-004", instructor: "陈老师", enrolled: 428, passed: 311, status: "已结课" },
    { title: "数据安全与隐私合规专项",   code: "CERT-DS-005", instructor: "系统",   enrolled: 0,   passed: 0,   status: "草稿" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="认证培训管理" sub="课程发布、报名管理、结业证书发放、认证自动同步"
        action={<button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold"><PlayCircle size={14} />发布新课程</button>}
      />

      <div className="grid grid-cols-3 gap-5">
        {[
          { label: "在开课程数",  value: "4",    icon: BookOpen },
          { label: "总报名人次",  value: "1,021", icon: Users },
          { label: "证书已发放",  value: "770",  icon: Award, accent: true },
        ].map(s => <StatCard key={s.label} {...s} delta={undefined} deltaUp={undefined} />)}
      </div>

      <TableShell headers={["课程名称", "课程编号", "讲师", "报名人数", "通过人数", "通过率", "状态", "操作"]}>
        {courses.map(c => (
          <tr key={c.code} className="hover:bg-slate-50/60 transition-colors">
            <td className="px-6 py-4 font-bold text-sm text-blue-900">{c.title}</td>
            <td className="px-6 py-4 font-mono text-xs text-slate-400">{c.code}</td>
            <td className="px-6 py-4 text-sm text-slate-500">{c.instructor}</td>
            <td className="px-6 py-4 text-sm font-medium text-blue-900">{c.enrolled}</td>
            <td className="px-6 py-4 text-sm font-medium text-secondary">{c.passed}</td>
            <td className="px-6 py-4">
              {c.enrolled > 0 ? (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-secondary rounded-full" style={{ width: `${Math.round(c.passed / c.enrolled * 100)}%` }} />
                  </div>
                  <span className="text-xs font-bold text-secondary">{Math.round(c.passed / c.enrolled * 100)}%</span>
                </div>
              ) : <span className="text-xs text-slate-400">—</span>}
            </td>
            <td className="px-6 py-4">
              <StatusBadge label={c.status} color={
                c.status === "开放中" ? "bg-green-100 text-green-700" :
                c.status === "已结课" ? "bg-slate-100 text-slate-500" :
                "bg-amber-100 text-amber-700"
              } />
            </td>
            <td className="px-6 py-4">
              <ActionMenu actions={[
                { label: "查看", icon: Eye },
                { label: "发证", icon: Award },
                { label: "管理报名", icon: Users },
              ]} />
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

/* ─── Module: 内容审核 ─────────────────────────── */

function ContentReview() {
  const items = [
    { id: "CNT-3821", type: "社区帖子", title: "关于VibeCoding的争议——真的能交付企业级项目吗？", author: "王子豪", reported: 3,  status: "待审核", risk: "中" },
    { id: "CNT-3800", type: "作品集",   title: "张明远-AI系统架构师作品集 v3.0",               author: "张明远", reported: 0,  status: "待审核", risk: "低" },
    { id: "CNT-3776", type: "举报",     title: "举报：账号 OPC-10201 疑似虚假资质认证",         author: "系统",   reported: 12, status: "处理中", risk: "高" },
    { id: "CNT-3741", type: "社区帖子", title: "政企数字化项目实战心得分享",                    author: "李思齐", reported: 0,  status: "已通过", risk: "低" },
    { id: "CNT-3712", type: "作品集",   title: "区块链合规审查完整方案",                        author: "SecureOps", reported: 1, status: "已拒绝", risk: "中" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="内容审核" sub="社区内容审核、作品集审核、举报处理"
        action={
          <div className="flex gap-3">
            <div className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle size={13} /> 16 条待审核
            </div>
          </div>
        }
      />

      <div className="flex gap-3 mb-2">
        {["全部", "社区帖子", "作品集", "举报"].map(f => (
          <button key={f} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
            f === "全部" ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}>{f}</button>
        ))}
      </div>

      <TableShell headers={["编号", "类型", "内容标题", "提交方", "举报次数", "风险", "状态", "操作"]}>
        {items.map(item => (
          <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
            <td className="px-6 py-4 font-mono text-xs text-slate-400">{item.id}</td>
            <td className="px-6 py-4">
              <StatusBadge label={item.type} color={
                item.type === "社区帖子" ? "bg-blue-100 text-blue-700" :
                item.type === "作品集"   ? "bg-purple-100 text-purple-700" :
                "bg-red-100 text-red-700"
              } />
            </td>
            <td className="px-6 py-4 text-sm text-blue-900 font-medium max-w-[240px]">
              <span className="line-clamp-1">{item.title}</span>
            </td>
            <td className="px-6 py-4 text-sm text-slate-500">{item.author}</td>
            <td className="px-6 py-4">
              {item.reported > 0 ? (
                <span className={`font-bold text-sm ${item.reported >= 5 ? "text-destructive" : "text-amber-600"}`}>
                  {item.reported}次
                </span>
              ) : <span className="text-slate-300">—</span>}
            </td>
            <td className="px-6 py-4">
              <StatusBadge label={item.risk} color={
                item.risk === "高" ? "bg-red-100 text-red-700" :
                item.risk === "中" ? "bg-amber-100 text-amber-700" :
                "bg-green-100 text-green-700"
              } />
            </td>
            <td className="px-6 py-4">
              <StatusBadge label={item.status} color={
                item.status === "待审核" ? "bg-amber-100 text-amber-700" :
                item.status === "处理中" ? "bg-blue-100 text-blue-700" :
                item.status === "已通过" ? "bg-green-100 text-green-700" :
                "bg-red-100 text-red-700"
              } />
            </td>
            <td className="px-6 py-4">
              <ActionMenu actions={[
                { label: "查看", icon: Eye },
                { label: "通过", icon: Check, cls: "hover:bg-green-50 text-slate-400 hover:text-secondary" },
                { label: "拒绝", icon: Ban, cls: "hover:bg-red-50 text-slate-400 hover:text-destructive" },
              ]} />
            </td>
          </tr>
        ))}
      </TableShell>
    </div>
  );
}

/* ─── Module renderer ─────────────────────────── */

function ModuleContent({ module }: { module: Module }) {
  switch (module) {
    case "dashboard":  return <Dashboard />;
    case "users":      return <UserManagement />;
    case "demands":    return <DemandManagement />;
    case "orders":     return <OrderManagement />;
    case "finance":    return <FinanceManagement />;
    case "ecosystem":  return <EcosystemManagement />;
    case "training":   return <TrainingManagement />;
    case "content":    return <ContentReview />;
  }
}

/* ─── Page ────────────────────────────────────── */

export default function Admin() {
  const [active, setActive] = useState<Module>("dashboard");

  return (
    <div className="flex min-h-screen bg-[#f3f3f6] text-[#1a1c1e]">

      {/* Sidebar */}
      <aside className="w-64 fixed left-0 top-0 h-screen z-50 bg-slate-900 flex flex-col p-4">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 mb-8 mt-2">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
            <ShieldCheck size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-white text-sm font-extrabold font-display leading-tight">接单吧</p>
            <p className="text-slate-500 text-[10px] uppercase tracking-widest font-medium">管理后台</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-0.5">
          {NAV.map(item => (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left ${
                active === item.key
                  ? "bg-primary text-white shadow-lg shadow-primary/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon size={17} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 pt-4 flex flex-col gap-1">
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
            <Settings size={17} /> 系统设置
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={17} /> 退出登录
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 min-h-screen flex flex-col">

        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md shadow-sm flex justify-between items-center px-8 py-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">管理后台</span>
            <span className="text-slate-300">/</span>
            <span className="text-blue-900 text-sm font-bold">
              {NAV.find(n => n.key === active)?.label}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="全局搜索…"
                className="bg-slate-100 border-none rounded-full py-2 pl-9 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none placeholder:text-slate-400 w-52"
              />
            </div>
            <button className="relative p-2 text-slate-500 hover:bg-slate-50 rounded-full transition-colors">
              <Bell size={18} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full border-2 border-white" />
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-blue-900">运营管理员</p>
                <p className="text-[10px] text-slate-500">平台管理员</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                管
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 px-8 py-8">
          <ModuleContent module={active} />
        </div>
      </main>
    </div>
  );
}
