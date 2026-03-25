import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  LayoutDashboard, Users, FileText, ShoppingBag,
  Wallet, Network, GraduationCap, Shield, BarChart3,
  TrendingUp, TrendingDown, ShieldCheck, LogOut,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Search, Bell, Settings, RefreshCw, Download, Eye, Ban, Check, Star,
  BookOpen, PlayCircle, Award, Flag, Megaphone,
  Activity, ArrowUpRight, ArrowDownRight, Zap,
  CreditCard, Receipt, BadgeCheck, UserX, UserCheck,
  Gavel, AlertCircle, Loader2, Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ─── API helpers ────────────────────────────────── */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getAdminHeaders() {
  const userId = localStorage.getItem("jdb_user_id");
  return {
    "Content-Type": "application/json",
    ...(userId ? { Authorization: `Bearer ${userId}` } : {}),
  };
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: getAdminHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `请求失败 (${res.status})`);
  }
  return res.json();
}

async function adminPatch(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: getAdminHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error ?? "操作失败");
  }
  return res.json();
}

async function adminDelete(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: getAdminHeaders(),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error ?? "删除失败");
  }
  return res.json();
}

/* ─── Types ──────────────────────────────────────── */

type Module =
  | "dashboard" | "users" | "demands" | "orders"
  | "finance"   | "ecosystem" | "training" | "content";

const NAV: { key: Module; icon: React.ElementType; label: string }[] = [
  { key: "dashboard",  icon: LayoutDashboard, label: "数据看板" },
  { key: "users",      icon: Users,           label: "用户管理" },
  { key: "demands",    icon: FileText,         label: "需求管理" },
  { key: "orders",     icon: ShoppingBag,      label: "订单管理" },
  { key: "finance",    icon: Wallet,           label: "财务管理" },
  { key: "ecosystem",  icon: Network,          label: "OPC 生态池" },
  { key: "training",   icon: GraduationCap,    label: "认证培训" },
  { key: "content",    icon: Shield,           label: "内容审核" },
];

/* ─── Shared components ─────────────────────────── */

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

function LoadingRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-6 py-12 text-center text-slate-400">
        <div className="flex items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">加载中…</span>
        </div>
      </td>
    </tr>
  );
}

function EmptyRow({ cols, text }: { cols: number; text?: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-6 py-10 text-center text-sm text-slate-400">
        {text ?? "暂无数据"}
      </td>
    </tr>
  );
}

/* ─── Module: 数据看板 ─────────────────────────── */

interface AdminStats {
  totalOrders: number;
  totalAmount: number;
  completionRate: number;
  activeOpcs: number;
  inProgressOrders: number;
  disputedOrders: number;
  pendingDemands: number;
  totalPosts: number;
}

function Dashboard() {
  const { data, isLoading, refetch } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: () => adminGet("/api/admin/stats"),
  });

  const kpis = data ? [
    { label: "活跃 OPC 总数",  value: data.activeOpcs.toLocaleString(),      icon: Users },
    { label: "订单完成率",     value: `${data.completionRate}%`,              icon: CheckCircle2 },
    { label: "进行中订单",     value: data.inProgressOrders.toLocaleString(), icon: Activity },
    { label: "结算总额",       value: `¥${(data.totalAmount / 10000).toFixed(1)}万`, icon: Wallet, accent: true },
  ] : [];

  const metrics = data ? [
    { label: "总订单数",   value: data.totalOrders.toLocaleString(),   up: true },
    { label: "待审核需求", value: data.pendingDemands.toLocaleString(), up: data.pendingDemands === 0 },
    { label: "社区帖子数", value: data.totalPosts.toLocaleString(),      up: true },
    { label: "争议订单",   value: data.disputedOrders.toLocaleString(), up: data.disputedOrders === 0 },
  ] : [];

  return (
    <div className="space-y-8">
      <SectionHeader
        title="数据看板"
        sub="核心运营指标实时总览"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold hover:bg-slate-200"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> 刷新
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={32} className="animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            {kpis.map(k => <StatCard key={k.label} {...k} />)}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map(m => (
              <div key={m.label} className="bg-white p-5 rounded-2xl shadow-sm flex items-center gap-4">
                <div className={`p-2.5 rounded-xl ${m.up ? "bg-secondary/10" : "bg-destructive/10"}`}>
                  {m.up ? <TrendingUp size={20} className="text-secondary" /> : <TrendingDown size={20} className="text-destructive" />}
                </div>
                <div>
                  <p className="text-slate-500 text-xs font-medium">{m.label}</p>
                  <p className="text-blue-900 text-xl font-extrabold font-display">{m.value}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Module: 用户管理 ─────────────────────────── */

interface AdminUser {
  id: number;
  nickname: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  opcLevel: string | null;
  creditScore: number | null;
  totalOrders: number | null;
}

function UserManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users", filter],
    queryFn: () => adminGet(`/api/admin/users?role=${filter === "all" ? "" : filter}`),
  });

  const mutate = useMutation({
    mutationFn: ({ id, action, value }: { id: number; action: string; value?: string }) =>
      adminPatch(`/api/admin/users/${id}`, { action, value }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "操作成功" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const FILTERS = ["all", "opc", "publisher"];
  const FILTER_LABELS: Record<string, string> = { all: "全部", opc: "OPC", publisher: "发单方" };

  const roleLabel = (r: string) => ({ opc: "OPC", publisher: "发单方", admin: "管理员" }[r] ?? r);
  const roleColor = (r: string) => ({ opc: "bg-secondary/10 text-secondary", publisher: "bg-primary/10 text-primary", admin: "bg-purple-100 text-purple-700" }[r] ?? "bg-slate-100 text-slate-500");
  const statusColor = (s: string) => s === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
  const statusLabel = (s: string) => s === "active" ? "正常" : "封禁";

  return (
    <div className="space-y-6">
      <SectionHeader title="用户管理" sub="OPC 账户审核、角色权限配置、认证等级调整、封禁/解封" />
      <div className="flex gap-3 mb-2">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === f ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>
      <TableShell headers={["用户", "邮箱", "身份", "等级", "信用分", "注册日期", "状态", "操作"]}>
        {isLoading ? <LoadingRow cols={8} /> : users.length === 0 ? <EmptyRow cols={8} /> :
          users.map(u => (
            <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{u.nickname[0]}</div>
                  <span className="font-bold text-sm text-blue-900">{u.nickname}</span>
                </div>
              </td>
              <td className="px-6 py-4 text-xs text-slate-400">{u.email || "—"}</td>
              <td className="px-6 py-4"><StatusBadge label={roleLabel(u.role)} color={roleColor(u.role)} /></td>
              <td className="px-6 py-4">
                {u.opcLevel ? (
                  <select defaultValue={u.opcLevel} onChange={e => mutate.mutate({ id: u.id, action: "setLevel", value: e.target.value })}
                    className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {["C", "B", "A"].map(l => <option key={l} value={l}>{l}级</option>)}
                  </select>
                ) : <span className="text-slate-400 text-sm">—</span>}
              </td>
              <td className="px-6 py-4">
                {u.creditScore !== null ? (
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${u.creditScore >= 4 ? "bg-secondary" : u.creditScore >= 3 ? "bg-amber-400" : "bg-destructive"}`}
                        style={{ width: `${(u.creditScore / 5) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600">{u.creditScore?.toFixed(1)}</span>
                  </div>
                ) : <span className="text-slate-400 text-sm">—</span>}
              </td>
              <td className="px-6 py-4 text-xs text-slate-400">{new Date(u.createdAt).toLocaleDateString("zh-CN")}</td>
              <td className="px-6 py-4"><StatusBadge label={statusLabel(u.status)} color={statusColor(u.status)} /></td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1">
                  {u.status === "active" ? (
                    <button onClick={() => mutate.mutate({ id: u.id, action: "ban" })}
                      title="封禁" className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-destructive transition-colors">
                      <UserX size={15} />
                    </button>
                  ) : (
                    <button onClick={() => mutate.mutate({ id: u.id, action: "unban" })}
                      title="解封" className="p-2 rounded-xl hover:bg-green-50 text-slate-400 hover:text-secondary transition-colors">
                      <UserCheck size={15} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))
        }
      </TableShell>
    </div>
  );
}

/* ─── Module: 需求管理 ─────────────────────────── */

interface AdminDemand {
  id: number;
  demandNo: string;
  title: string;
  status: string;
  mode: string;
  budgetMin: number;
  budgetMax: number;
  isUrgent: boolean;
  createdAt: string;
  publisherName: string;
  deadline: string;
}

function DemandManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");

  const { data: demands = [], isLoading } = useQuery<AdminDemand[]>({
    queryKey: ["admin-demands", filter],
    queryFn: () => adminGet(`/api/admin/demands?status=${filter === "all" ? "" : filter}`),
  });

  const mutate = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      adminPatch(`/api/admin/demands/${id}`, { action }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-demands"] }); toast({ title: "操作成功" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const STATUS_FILTERS = [
    { val: "all", label: "全部" },
    { val: "pending_review", label: "待审核" },
    { val: "published", label: "已发布" },
    { val: "in_progress", label: "进行中" },
    { val: "completed", label: "已完成" },
    { val: "closed", label: "已关闭" },
  ];

  const statusCN: Record<string, string> = {
    draft: "草稿", pending_review: "待审核", published: "已发布",
    matched: "已匹配", in_progress: "进行中", pending_acceptance: "待验收",
    completed: "已完成", closed: "已关闭",
  };
  const statusColor = (s: string) => ({
    pending_review: "bg-amber-100 text-amber-700",
    published: "bg-blue-100 text-blue-700",
    in_progress: "bg-indigo-100 text-indigo-700",
    completed: "bg-green-100 text-green-700",
    closed: "bg-slate-100 text-slate-500",
    matched: "bg-purple-100 text-purple-700",
  }[s] ?? "bg-slate-100 text-slate-500");

  return (
    <div className="space-y-6">
      <SectionHeader title="需求管理" sub="需求审核、状态变更、强制关闭、紧急标记" />
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.val} onClick={() => setFilter(f.val)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === f.val ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <TableShell headers={["需求标题", "编号", "发单方", "预算", "创建日期", "状态", "操作"]}>
        {isLoading ? <LoadingRow cols={7} /> : demands.length === 0 ? <EmptyRow cols={7} /> :
          demands.map(d => (
            <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-blue-900">{d.title}</span>
                  {d.isUrgent && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full animate-pulse">紧急</span>}
                </div>
              </td>
              <td className="px-6 py-4 font-mono text-xs text-slate-400">{d.demandNo}</td>
              <td className="px-6 py-4 text-sm text-slate-500">{d.publisherName}</td>
              <td className="px-6 py-4 font-bold text-sm text-blue-900">¥{((d.budgetMin ?? 0) / 10000).toFixed(0)}–{((d.budgetMax ?? 0) / 10000).toFixed(0)}万</td>
              <td className="px-6 py-4 text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString("zh-CN")}</td>
              <td className="px-6 py-4"><StatusBadge label={statusCN[d.status] ?? d.status} color={statusColor(d.status)} /></td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1">
                  {d.status === "pending_review" && (
                    <button onClick={() => mutate.mutate({ id: d.id, action: "approve" })}
                      title="通过审核" className="p-2 rounded-xl hover:bg-green-50 text-slate-400 hover:text-secondary transition-colors">
                      <CheckCircle2 size={15} />
                    </button>
                  )}
                  {d.status === "pending_review" && (
                    <button onClick={() => mutate.mutate({ id: d.id, action: "reject" })}
                      title="拒绝" className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-destructive transition-colors">
                      <XCircle size={15} />
                    </button>
                  )}
                  {!d.isUrgent ? (
                    <button onClick={() => mutate.mutate({ id: d.id, action: "markUrgent" })}
                      title="标记紧急" className="p-2 rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                      <Megaphone size={15} />
                    </button>
                  ) : (
                    <button onClick={() => mutate.mutate({ id: d.id, action: "removeUrgent" })}
                      title="取消紧急" className="p-2 rounded-xl hover:bg-slate-100 text-amber-500 transition-colors">
                      <Flag size={15} />
                    </button>
                  )}
                  {d.status !== "closed" && d.status !== "completed" && (
                    <button onClick={() => { if (confirm("确认强制关闭此需求？")) mutate.mutate({ id: d.id, action: "forceClose" }); }}
                      title="强制关闭" className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-destructive transition-colors">
                      <XCircle size={15} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))
        }
      </TableShell>
    </div>
  );
}

/* ─── Module: 订单管理 ─────────────────────────── */

interface AdminOrder {
  id: number;
  orderNo: string;
  status: string;
  amount: number;
  opcShare: number;
  opcName: string;
  publisherName: string;
  demandTitle: string;
  totalMilestones: number;
  completedMilestones: number;
  daysSinceCreated: number;
  createdAt: string;
}

function OrderManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");

  const { data: orders = [], isLoading } = useQuery<AdminOrder[]>({
    queryKey: ["admin-orders", filter],
    queryFn: () => adminGet(`/api/admin/orders?status=${filter === "all" ? "" : filter}`),
  });

  const mutate = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      adminPatch(`/api/admin/orders/${id}`, { action }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-orders"] }); toast({ title: "操作成功" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const STATUS_FILTERS = [
    { val: "all", label: "全部" }, { val: "in_progress", label: "进行中" },
    { val: "disputed", label: "争议中" }, { val: "pending_acceptance", label: "待验收" },
    { val: "completed", label: "已完成" },
  ];

  const statusCN: Record<string, string> = {
    in_progress: "进行中", pending_acceptance: "待验收",
    completed: "已完成", closed: "已关闭", disputed: "争议中",
  };
  const statusColor = (s: string) => ({
    in_progress: "bg-blue-100 text-blue-700",
    disputed: "bg-red-100 text-red-700",
    pending_acceptance: "bg-purple-100 text-purple-700",
    completed: "bg-green-100 text-green-700",
    closed: "bg-slate-100 text-slate-500",
  }[s] ?? "bg-slate-100 text-slate-500");

  return (
    <div className="space-y-6">
      <SectionHeader title="订单管理" sub="订单全生命周期跟踪、争议介入、强制结算" />
      <div className="flex gap-2">
        {STATUS_FILTERS.map(f => (
          <button key={f.val} onClick={() => setFilter(f.val)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === f.val ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <TableShell headers={["订单号", "关联需求", "OPC", "金额", "里程碑", "已进行", "状态", "操作"]}>
        {isLoading ? <LoadingRow cols={8} /> : orders.length === 0 ? <EmptyRow cols={8} /> :
          orders.map(o => (
            <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-6 py-4 font-mono text-xs font-bold text-primary">{o.orderNo}</td>
              <td className="px-6 py-4 text-sm text-blue-900 font-medium max-w-[160px]">
                <span className="line-clamp-1">{o.demandTitle}</span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-500">{o.opcName}</td>
              <td className="px-6 py-4 font-bold text-sm text-blue-900">¥{o.amount?.toLocaleString()}</td>
              <td className="px-6 py-4">
                <span className={`text-xs font-bold ${o.totalMilestones > 0 ? "text-secondary" : "text-slate-400"}`}>
                  {o.totalMilestones > 0 ? `${o.completedMilestones}/${o.totalMilestones}` : "—"}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className={`text-sm font-bold ${o.daysSinceCreated > 60 ? "text-destructive" : "text-slate-600"}`}>
                  {o.daysSinceCreated}天
                </span>
              </td>
              <td className="px-6 py-4"><StatusBadge label={statusCN[o.status] ?? o.status} color={statusColor(o.status)} /></td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1">
                  {o.status !== "disputed" && (
                    <button onClick={() => mutate.mutate({ id: o.id, action: "markDisputed" })}
                      title="标记争议" className="p-2 rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                      <Gavel size={15} />
                    </button>
                  )}
                  {o.status === "disputed" && (
                    <button onClick={() => mutate.mutate({ id: o.id, action: "resolveDispute" })}
                      title="解决争议" className="p-2 rounded-xl hover:bg-green-50 text-slate-400 hover:text-secondary transition-colors">
                      <CheckCircle2 size={15} />
                    </button>
                  )}
                  {o.status !== "completed" && o.status !== "closed" && (
                    <button onClick={() => { if (confirm("确认强制结算此订单？")) mutate.mutate({ id: o.id, action: "forceSettle" }); }}
                      title="强制结算" className="p-2 rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                      <CreditCard size={15} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))
        }
      </TableShell>
    </div>
  );
}

/* ─── Module: 财务管理 ─────────────────────────── */

interface FinanceData {
  totalSettled: number;
  platformFee: number;
  opcShare: number;
  pendingEscrow: number;
  transactions: Array<{
    id: number;
    orderNo: string;
    amount: number;
    opcShare: number;
    platformFee: number;
    status: string;
    opcName: string;
    publisherName: string;
    createdAt: string;
  }>;
}

function FinanceManagement() {
  const { data, isLoading } = useQuery<FinanceData>({
    queryKey: ["admin-finance"],
    queryFn: () => adminGet("/api/admin/finance"),
  });

  const stats = data ? [
    { label: "累计已结算",  value: `¥${data.totalSettled.toLocaleString()}`,  icon: Wallet },
    { label: "平台手续费",  value: `¥${data.platformFee.toLocaleString()}`,   icon: CreditCard },
    { label: "托管中金额",  value: `¥${data.pendingEscrow.toLocaleString()}`, icon: Activity },
    { label: "OPC 总分润",  value: `¥${data.opcShare.toLocaleString()}`,      icon: Receipt, accent: true },
  ] : [];

  const statusColor = (s: string) => ({
    completed: "bg-green-100 text-green-700",
    in_progress: "bg-amber-100 text-amber-700",
    pending_acceptance: "bg-blue-100 text-blue-700",
    closed: "bg-slate-100 text-slate-500",
  }[s] ?? "bg-slate-100 text-slate-500");
  const statusCN: Record<string, string> = { completed: "已完成", in_progress: "进行中", pending_acceptance: "待验收", closed: "已关闭", disputed: "争议中" };

  return (
    <div className="space-y-6">
      <SectionHeader title="财务管理" sub="分成结算报表、资金流水、对账报表" />
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={32} className="animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            {stats.map(s => <StatCard key={s.label} {...s} />)}
          </div>
          <TableShell headers={["订单号", "OPC 接单方", "发单方", "订单金额", "OPC 分润", "平台费", "日期", "状态"]}>
            {(data?.transactions ?? []).length === 0 ? <EmptyRow cols={8} /> :
              data?.transactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-bold text-primary">{t.orderNo}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{t.opcName}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{t.publisherName}</td>
                  <td className="px-6 py-4 font-extrabold text-sm text-blue-900">¥{t.amount?.toLocaleString()}</td>
                  <td className="px-6 py-4 font-bold text-sm text-secondary">¥{t.opcShare?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">¥{t.platformFee?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString("zh-CN")}</td>
                  <td className="px-6 py-4"><StatusBadge label={statusCN[t.status] ?? t.status} color={statusColor(t.status)} /></td>
                </tr>
              ))
            }
          </TableShell>
        </>
      )}
    </div>
  );
}

/* ─── Module: OPC 生态池管理 ───────────────────── */

interface OpcEcoItem {
  id: number;
  nickname: string;
  email: string;
  status: string;
  created_at: string;
  level: string | null;
  credit_score: number | null;
  total_orders: number | null;
  completion_rate: number | null;
  avg_rating: number | null;
  skill_tags: string[];
}

function EcosystemManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: opcs = [], isLoading } = useQuery<OpcEcoItem[]>({
    queryKey: ["admin-ecosystem"],
    queryFn: () => adminGet("/api/admin/ecosystem"),
  });

  const mutate = useMutation({
    mutationFn: ({ id, action, value }: { id: number; action: string; value?: string | number }) =>
      adminPatch(`/api/admin/ecosystem/${id}`, { action, value }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-ecosystem"] }); toast({ title: "操作成功" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const [pendingLevel, setPendingLevel] = useState<Record<number, string>>({});

  return (
    <div className="space-y-6">
      <SectionHeader title="OPC 生态池管理" sub="能力标签管理、信用分调整、升降级审批、生态池数据统计" />
      <div className="grid grid-cols-3 gap-5">
        <StatCard label="生态池总 OPC" value={opcs.length.toString()} icon={Users} />
        <StatCard label="A 级 OPC" value={opcs.filter(o => o.level === "A").length.toString()} icon={ArrowUpRight} />
        <StatCard label="信用分预警 (<3.5)" value={opcs.filter(o => (o.credit_score ?? 5) < 3.5).length.toString()} icon={AlertCircle} accent />
      </div>
      <TableShell headers={["OPC", "等级", "信用分", "完成订单", "完成率", "技能标签", "状态", "操作"]}>
        {isLoading ? <LoadingRow cols={8} /> : opcs.length === 0 ? <EmptyRow cols={8} /> :
          opcs.map(o => (
            <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary">{o.nickname[0]}</div>
                  <span className="font-bold text-sm text-blue-900">{o.nickname}</span>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <select
                    value={pendingLevel[o.id] ?? o.level ?? "C"}
                    onChange={e => setPendingLevel(prev => ({ ...prev, [o.id]: e.target.value }))}
                    className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {["C", "B", "A"].map(l => <option key={l} value={l}>{l}级</option>)}
                  </select>
                  {pendingLevel[o.id] && pendingLevel[o.id] !== o.level && (
                    <button onClick={() => { mutate.mutate({ id: o.id, action: "setLevel", value: pendingLevel[o.id] }); setPendingLevel(prev => { const n = { ...prev }; delete n[o.id]; return n; }); }}
                      className="px-2 py-1 bg-primary text-white text-[10px] font-bold rounded-lg">确认</button>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${(o.credit_score ?? 0) >= 4 ? "bg-secondary" : (o.credit_score ?? 0) >= 3 ? "bg-amber-400" : "bg-destructive"}`}
                      style={{ width: `${((o.credit_score ?? 0) / 5) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-600">{(o.credit_score ?? 0).toFixed(1)}</span>
                  <button onClick={() => mutate.mutate({ id: o.id, action: "addCredit", value: 0.1 })}
                    title="+0.1" className="p-1 rounded hover:bg-green-50 text-slate-300 hover:text-secondary"><ArrowUpRight size={12} /></button>
                  <button onClick={() => mutate.mutate({ id: o.id, action: "subtractCredit", value: 0.1 })}
                    title="-0.1" className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-destructive"><ArrowDownRight size={12} /></button>
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-slate-500">{o.total_orders ?? 0}</td>
              <td className="px-6 py-4 text-sm text-slate-500">{((o.completion_rate ?? 0) * 100).toFixed(0)}%</td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  {(o.skill_tags ?? []).slice(0, 3).map(t => (
                    <span key={t} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">{t}</span>
                  ))}
                  {(o.skill_tags ?? []).length > 3 && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[10px] font-bold rounded-full">+{(o.skill_tags ?? []).length - 3}</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <StatusBadge label={o.status === "active" ? "正常" : "封禁"}
                  color={o.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} />
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1">
                  <button onClick={() => mutate.mutate({ id: o.id, action: "addCredit", value: 0.5 })}
                    title="+0.5 信用分" className="p-2 rounded-xl hover:bg-green-50 text-slate-400 hover:text-secondary transition-colors">
                    <Star size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))
        }
      </TableShell>
    </div>
  );
}

/* ─── Module: 认证培训管理 ─────────────────────── */

interface TrainingData {
  courses: Array<{
    id: number;
    title: string;
    category: string;
    required_level: string;
    duration_minutes: number;
    description: string;
    badge: string | null;
    rating: number | null;
    learners_count: number;
    is_required: boolean;
    enrolled_count: number;
    passed_count: number;
  }>;
  totalEnrollments: number;
  totalPassed: number;
}

function TrainingManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<TrainingData>({
    queryKey: ["admin-training"],
    queryFn: () => adminGet("/api/admin/training"),
  });

  const mutate = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      adminPatch(`/api/admin/training/courses/${id}`, { action }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-training"] }); toast({ title: "操作成功" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const statusCN: Record<string, string> = { published: "开放中", draft: "草稿", closed: "已结课" };
  const statusColor = (s: string) => ({ published: "bg-green-100 text-green-700", draft: "bg-amber-100 text-amber-700", closed: "bg-slate-100 text-slate-500" }[s] ?? "bg-slate-100 text-slate-500");

  return (
    <div className="space-y-6">
      <SectionHeader title="认证培训管理" sub="课程发布、报名管理、结业证书发放、认证自动同步" />
      <div className="grid grid-cols-3 gap-5">
        <StatCard label="必修课程数" value={(data?.courses.filter(c => c.is_required).length ?? 0).toString()} icon={BookOpen} />
        <StatCard label="总报名人次" value={(data?.totalEnrollments ?? 0).toString()} icon={Users} />
        <StatCard label="证书已发放" value={(data?.totalPassed ?? 0).toString()} icon={Award} accent />
      </div>
      <TableShell headers={["课程名称", "分类", "所需级别", "时长(分钟)", "报名人数", "通过人数", "通过率", "必修", "操作"]}>
        {isLoading ? <LoadingRow cols={9} /> : (data?.courses ?? []).length === 0 ? <EmptyRow cols={9} /> :
          data?.courses.map(c => (
            <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-6 py-4 font-bold text-sm text-blue-900 max-w-[200px]">
                <span className="line-clamp-1">{c.title}</span>
              </td>
              <td className="px-6 py-4 text-xs text-slate-500">{c.category}</td>
              <td className="px-6 py-4">
                <StatusBadge label={`${c.required_level ?? "—"}级`} color="bg-primary/10 text-primary" />
              </td>
              <td className="px-6 py-4 text-sm text-slate-500">{c.duration_minutes}</td>
              <td className="px-6 py-4 text-sm font-medium text-blue-900">{Number(c.enrolled_count)}</td>
              <td className="px-6 py-4 text-sm font-medium text-secondary">{Number(c.passed_count)}</td>
              <td className="px-6 py-4">
                {Number(c.enrolled_count) > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-secondary rounded-full" style={{ width: `${Math.round(Number(c.passed_count) / Number(c.enrolled_count) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-secondary">{Math.round(Number(c.passed_count) / Number(c.enrolled_count) * 100)}%</span>
                  </div>
                ) : <span className="text-xs text-slate-400">—</span>}
              </td>
              <td className="px-6 py-4"><StatusBadge label={c.is_required ? "必修" : "选修"} color={c.is_required ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"} /></td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1">
                  {!c.is_required && (
                    <button onClick={() => mutate.mutate({ id: c.id, action: "publish" })}
                      title="设为必修" className="p-2 rounded-xl hover:bg-green-50 text-slate-400 hover:text-secondary transition-colors">
                      <PlayCircle size={15} />
                    </button>
                  )}
                  {c.is_required && (
                    <button onClick={() => mutate.mutate({ id: c.id, action: "close" })}
                      title="取消必修" className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors">
                      <XCircle size={15} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))
        }
      </TableShell>
    </div>
  );
}

/* ─── Module: 内容审核 ─────────────────────────── */

interface AdminPost {
  id: number;
  title: string;
  content: string;
  tags: string[];
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  authorName: string;
  createdAt: string;
}

function ContentReview() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: posts = [], isLoading } = useQuery<AdminPost[]>({
    queryKey: ["admin-content"],
    queryFn: () => adminGet("/api/admin/content"),
  });

  const deletePost = useMutation({
    mutationFn: (id: number) => adminDelete(`/api/admin/content/posts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-content"] }); toast({ title: "帖子已删除" }); },
    onError: (e: Error) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <SectionHeader title="内容审核" sub="社区帖子管理、内容删除、举报处理"
        action={
          <div className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <BarChart3 size={13} /> 共 {posts.length} 篇帖子
          </div>
        }
      />
      <TableShell headers={["编号", "帖子标题", "作者", "标签", "点赞", "评论", "发布日期", "操作"]}>
        {isLoading ? <LoadingRow cols={8} /> : posts.length === 0 ? <EmptyRow cols={8} /> :
          posts.map(p => (
            <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-6 py-4 font-mono text-xs text-slate-400">#{p.id}</td>
              <td className="px-6 py-4 text-sm text-blue-900 font-medium max-w-[240px]">
                <span className="line-clamp-1">{p.title || p.content.slice(0, 40)}</span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-500">{p.authorName}</td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  {(p.tags ?? []).slice(0, 2).map(t => (
                    <span key={t} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">{t}</span>
                  ))}
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-slate-500">{p.likesCount ?? 0}</td>
              <td className="px-6 py-4 text-sm text-slate-500">{p.commentsCount ?? 0}</td>
              <td className="px-6 py-4 text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString("zh-CN")}</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { if (confirm("确认删除此帖子？删除后不可恢复。")) deletePost.mutate(p.id); }}
                    title="删除" className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-destructive transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))
        }
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
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const role = localStorage.getItem("jdb_role");
  if (role && role !== "admin") {
    return (
      <div className="min-h-screen bg-[#f3f3f6] flex items-center justify-center">
        <div className="text-center">
          <ShieldCheck size={48} className="text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-blue-900 mb-2">权限不足</h2>
          <p className="text-slate-500 text-sm mb-6">此页面仅限平台管理员访问</p>
          <button onClick={() => navigate("/login")}
            className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm">返回登录</button>
        </div>
      </div>
    );
  }

  const adminNickname = localStorage.getItem("jdb_nickname") ?? "管理员";

  function handleLogout() {
    localStorage.removeItem("jdb_user_id");
    localStorage.removeItem("jdb_role");
    localStorage.removeItem("jdb_nickname");
    toast({ title: "已退出登录" });
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-[#f3f3f6] text-[#1a1c1e]">

      {/* Sidebar */}
      <aside className="w-64 fixed left-0 top-0 h-screen z-50 bg-slate-900 flex flex-col p-4">
        <div className="flex items-center gap-3 px-2 mb-8 mt-2">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
            <ShieldCheck size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-white text-sm font-extrabold font-display leading-tight">接单吧</p>
            <p className="text-slate-500 text-[10px] uppercase tracking-widest font-medium">管理后台</p>
          </div>
        </div>

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

        <div className="border-t border-white/10 pt-4 flex flex-col gap-1">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={17} /> 退出登录
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-64 min-h-screen flex flex-col">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md shadow-sm flex justify-between items-center px-8 py-3">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">管理后台</span>
            <span className="text-slate-300">/</span>
            <span className="text-blue-900 text-sm font-bold">
              {NAV.find(n => n.key === active)?.label}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-blue-900">{adminNickname}</p>
                <p className="text-[10px] text-slate-500">平台管理员</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                {adminNickname[0]}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 px-8 py-8">
          <ModuleContent module={active} />
        </div>
      </main>
    </div>
  );
}
