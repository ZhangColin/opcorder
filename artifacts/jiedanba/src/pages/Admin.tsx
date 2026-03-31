import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SiteLogo, useSiteName } from "@/components/SiteLogo";
import {
  LayoutDashboard, Users, FileText, ShoppingBag,
  Wallet, Network, GraduationCap, Shield, BarChart3,
  TrendingUp, TrendingDown, LogOut,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Search, Bell, Settings, RefreshCw, Download, Eye, Ban, Check, Star,
  BookOpen, PlayCircle, Award, Flag, Megaphone,
  Activity, ArrowUpRight, ArrowDownRight, Zap,
  CreditCard, Receipt, BadgeCheck, UserX, UserCheck,
  Gavel, AlertCircle, Loader2, Trash2,
  SlidersHorizontal, Upload, ImageIcon, Save,
  Plus, Edit2, ChevronDown, ChevronUp, DollarSign, BadgeCent, FileCheck, ClipboardList, X, Trophy, RotateCcw,
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

async function adminPost(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error ?? "操作失败");
  }
  return res.json();
}

async function adminPut(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: getAdminHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error ?? "更新失败");
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
  | "finance"   | "ecosystem" | "training" | "content"
  | "cockpit"   | "disputes"  | "settings" | "levelcert";

const NAV: { key: Module; icon: React.ElementType; label: string }[] = [
  { key: "dashboard",  icon: LayoutDashboard,    label: "数据看板" },
  { key: "cockpit",    icon: BarChart3,           label: "平台驾驶舱" },
  { key: "users",      icon: Users,              label: "用户管理" },
  { key: "demands",    icon: FileText,            label: "需求管理" },
  { key: "orders",     icon: ShoppingBag,         label: "订单管理" },
  { key: "disputes",   icon: Gavel,               label: "争议管理" },
  { key: "finance",    icon: Wallet,              label: "财务管理" },
  { key: "ecosystem",  icon: Network,             label: "OPC 生态池" },
  { key: "training",   icon: GraduationCap,       label: "认证培训" },
  { key: "levelcert",  icon: Trophy,              label: "等级认证" },
  { key: "content",    icon: Shield,              label: "内容审核" },
  { key: "settings",   icon: SlidersHorizontal,   label: "站点设置" },
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
  const [, navigate] = useLocation();
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
              <td className="px-6 py-4 font-bold text-sm text-blue-900">¥{(d.budgetMin ?? 0).toLocaleString()}–¥{(d.budgetMax ?? 0).toLocaleString()}</td>
              <td className="px-6 py-4 text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString("zh-CN")}</td>
              <td className="px-6 py-4"><StatusBadge label={statusCN[d.status] ?? d.status} color={statusColor(d.status)} /></td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1">
                  <button onClick={() => navigate(`/publisher/demand/${d.id}`)}
                    title="查看详情" className="p-2 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors">
                    <Eye size={15} />
                  </button>
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
                  {d.status === "published" && (
                    <button
                      onClick={() => { if (confirm(`确认将需求「${d.title}」退回到草稿编辑模式？发单方将需要重新提交审核。`)) mutate.mutate({ id: d.id, action: "revertToDraft" }); }}
                      title="退回编辑"
                      className="p-2 rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                      <RotateCcw size={15} />
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
              <td className="px-6 py-4 text-sm text-slate-500">{(o.completion_rate ?? 0).toFixed(1)}%</td>
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

interface AdminCourse {
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
  status: string;
  price: number;
  syllabus_url: string | null;
  instructor: string | null;
  max_enrollments: number | null;
  enrolled_count: number;
  passed_count: number;
  cert_issued_count: number;
  total_revenue: number;
}

interface TrainingData {
  courses: AdminCourse[];
  totalEnrollments: number;
  totalPassed: number;
  totalCerts: number;
  totalRevenue: number;
}

interface CourseEnrollment {
  id: number;
  user_id: number;
  nickname: string;
  email: string;
  progress_pct: number;
  completed_at: string | null;
  payment_status: string;
  cert_issued: boolean;
  cert_issued_at: string | null;
  created_at: string;
}

const CATEGORY_MAP: Record<string, string> = { tech: "技术", strategy: "战略", compliance: "合规", operations: "运营" };
const STATUS_LABEL: Record<string, string> = { draft: "草稿", published: "开放报名", closed: "已结课" };
const STATUS_COLOR: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700",
  published: "bg-green-100 text-green-700",
  closed: "bg-slate-100 text-slate-500",
};
const PAY_LABEL: Record<string, string> = { free: "免费", pending: "待支付", paid: "已支付" };
const PAY_COLOR: Record<string, string> = { free: "bg-slate-100 text-slate-500", pending: "bg-amber-100 text-amber-700", paid: "bg-green-100 text-green-700" };

type CourseForm = {
  title: string; category: string; requiredLevel: string; durationMinutes: string;
  description: string; badge: string; rating: string; isRequired: boolean;
  status: string; price: string; syllabusUrl: string; instructor: string; maxEnrollments: string;
};

const BLANK_FORM: CourseForm = {
  title: "", category: "tech", requiredLevel: "C", durationMinutes: "60",
  description: "", badge: "", rating: "", isRequired: false,
  status: "draft", price: "0", syllabusUrl: "", instructor: "", maxEnrollments: "",
};

function courseToForm(c: AdminCourse): CourseForm {
  return {
    title: c.title, category: c.category, requiredLevel: c.required_level,
    durationMinutes: String(c.duration_minutes), description: c.description,
    badge: c.badge ?? "", rating: c.rating != null ? String(c.rating) : "",
    isRequired: c.is_required, status: c.status, price: String(c.price),
    syllabusUrl: c.syllabus_url ?? "", instructor: c.instructor ?? "",
    maxEnrollments: c.max_enrollments != null ? String(c.max_enrollments) : "",
  };
}

function CourseModal({
  open, onClose, onSave, initialForm, isEdit,
}: {
  open: boolean; onClose: () => void;
  onSave: (form: CourseForm) => void;
  initialForm: CourseForm; isEdit: boolean;
}) {
  const [form, setForm] = useState<CourseForm>(initialForm);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const fileRef = { current: null as HTMLInputElement | null };

  useEffect(() => { if (open) setForm(initialForm); }, [open, initialForm]);

  if (!open) return null;

  const set = (k: keyof CourseForm, v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const handleSyllabusUpload = async (file: File) => {
    setUploading(true);
    try {
      const reqRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...Object.fromEntries(Object.entries(getAdminHeaders()).filter(([k]) => k !== "Content-Type")) },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!reqRes.ok) throw new Error("上传请求失败");
      const { uploadURL, objectPath } = await reqRes.json();
      const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("文件上传失败");
      const url = `${BASE}/api/storage${objectPath}`;
      set("syllabusUrl", url);
      toast({ title: "课纲上传成功" });
    } catch (e: unknown) {
      toast({ title: "上传失败", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">{isEdit ? "编辑课程" : "新建课程"}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">课程名称 <span className="text-red-500">*</span></label>
              <input value={form.title} onChange={e => set("title", e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="请输入课程名称" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">课程分类</label>
              <select value={form.category} onChange={e => set("category", e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                <option value="tech">技术</option>
                <option value="strategy">战略</option>
                <option value="compliance">合规</option>
                <option value="operations">运营</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">所需等级</label>
              <select value={form.requiredLevel} onChange={e => set("requiredLevel", e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                <option value="C">C级·新手</option>
                <option value="B">B级·进阶</option>
                <option value="A">A级·专家</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">发布状态</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                <option value="draft">草稿</option>
                <option value="published">开放报名</option>
                <option value="closed">已结课</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">时长（分钟）</label>
              <input type="number" value={form.durationMinutes} onChange={e => set("durationMinutes", e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="60" min="0" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">价格（元）</label>
              <input type="number" value={form.price} onChange={e => set("price", e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="0 表示免费" min="0" step="0.01" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">最大报名人数</label>
              <input type="number" value={form.maxEnrollments} onChange={e => set("maxEnrollments", e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="不限制留空" min="1" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">讲师</label>
              <input value={form.instructor} onChange={e => set("instructor", e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="讲师姓名" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">徽章/标签</label>
              <input value={form.badge} onChange={e => set("badge", e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="如：热门、新课" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">课程简介</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="请输入课程简介..." />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">课纲文件（PDF/DOCX）</label>
            <input ref={r => { fileRef.current = r; }} type="file" accept=".pdf,.doc,.docx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleSyllabusUpload(f); }} />
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-500 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? "上传中..." : "上传课纲"}
              </button>
              {form.syllabusUrl ? (
                <div className="flex items-center gap-2 flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <FileCheck size={16} className="text-secondary shrink-0" />
                  <span className="text-xs text-slate-600 truncate flex-1">已上传课纲</span>
                  <button onClick={() => set("syllabusUrl", "")} className="text-slate-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                </div>
              ) : (
                <input value={form.syllabusUrl} onChange={e => set("syllabusUrl", e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="或直接填写课纲链接" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button type="button"
              onClick={() => set("isRequired", !form.isRequired)}
              className={`w-10 h-6 rounded-full transition-colors relative ${form.isRequired ? "bg-primary" : "bg-slate-200"}`}>
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isRequired ? "translate-x-4" : "translate-x-0"}`} />
            </button>
            <span className="text-sm font-semibold text-slate-700">设为必修课程</span>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-100">
          <button onClick={onClose}
            className="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors">
            取消
          </button>
          <button onClick={() => onSave(form)}
            disabled={!form.title.trim()}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
            <Save size={15} />
            {isEdit ? "保存更改" : "创建课程"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EnrollmentPanel({ course, onClose }: { course: AdminCourse; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: enrollments = [], isLoading } = useQuery<CourseEnrollment[]>({
    queryKey: ["admin-course-enrollments", course.id],
    queryFn: () => adminGet(`/api/admin/training/courses/${course.id}/enrollments`),
  });

  const payMutation = useMutation({
    mutationFn: (enrollId: number) => adminPost(`/api/admin/training/enrollments/${enrollId}/pay`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-course-enrollments", course.id] }); toast({ title: "已确认支付" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const certMutation = useMutation({
    mutationFn: (enrollId: number) => adminPost(`/api/admin/training/enrollments/${enrollId}/issue-cert`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-course-enrollments", course.id] });
      qc.invalidateQueries({ queryKey: ["admin-training"] });
      toast({ title: "证书已发放" });
    },
    onError: (e: Error) => toast({ title: "发证失败", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">报名管理 · {course.title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">共 {enrollments.length} 人报名</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {["学员", "报名时间", "进度", "支付状态", "认证证书", "操作"].map(h => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">加载中...</td></tr>
              ) : enrollments.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">暂无报名记录</td></tr>
              ) : enrollments.map(e => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-800">{e.nickname}</div>
                    <div className="text-xs text-slate-400">{e.email}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-500">{new Date(e.created_at).toLocaleDateString("zh-CN")}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${e.progress_pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-slate-600">{e.progress_pct}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge label={PAY_LABEL[e.payment_status] ?? e.payment_status} color={PAY_COLOR[e.payment_status] ?? "bg-slate-100 text-slate-500"} />
                  </td>
                  <td className="px-5 py-4">
                    {e.cert_issued ? (
                      <div className="flex items-center gap-1.5">
                        <Award size={14} className="text-secondary" />
                        <span className="text-xs font-semibold text-secondary">已发证</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">未发证</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      {e.payment_status === "pending" && (
                        <button
                          onClick={() => payMutation.mutate(e.id)}
                          disabled={payMutation.isPending}
                          title="确认收款（演示）"
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition-colors disabled:opacity-50">
                          <BadgeCent size={13} />
                          确认收款
                        </button>
                      )}
                      {!e.cert_issued && (e.payment_status === "free" || e.payment_status === "paid") && (
                        <button
                          onClick={() => certMutation.mutate(e.id)}
                          disabled={certMutation.isPending}
                          title="发放证书"
                          className="flex items-center gap-1 px-3 py-1.5 bg-secondary/10 text-secondary rounded-lg text-xs font-bold hover:bg-secondary/20 transition-colors disabled:opacity-50">
                          <Award size={13} />
                          发放证书
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TrainingManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<AdminCourse | null>(null);
  const [enrollCourse, setEnrollCourse] = useState<AdminCourse | null>(null);

  const { data, isLoading } = useQuery<TrainingData>({
    queryKey: ["admin-training"],
    queryFn: () => adminGet("/api/admin/training"),
  });

  const createMutation = useMutation({
    mutationFn: (form: CourseForm) => adminPost("/api/admin/training/courses", {
      title: form.title, category: form.category, requiredLevel: form.requiredLevel,
      durationMinutes: Number(form.durationMinutes) || 60,
      description: form.description, badge: form.badge || null,
      rating: form.rating ? Number(form.rating) : null,
      isRequired: form.isRequired, status: form.status,
      price: Number(form.price) || 0,
      syllabusUrl: form.syllabusUrl || null,
      instructor: form.instructor || null,
      maxEnrollments: form.maxEnrollments ? Number(form.maxEnrollments) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-training"] });
      toast({ title: "课程已创建" });
      setModalOpen(false);
    },
    onError: (e: Error) => toast({ title: "创建失败", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, form }: { id: number; form: CourseForm }) => adminPut(`/api/admin/training/courses/${id}`, {
      title: form.title, category: form.category, requiredLevel: form.requiredLevel,
      durationMinutes: Number(form.durationMinutes) || 60,
      description: form.description, badge: form.badge || null,
      rating: form.rating ? Number(form.rating) : null,
      isRequired: form.isRequired, status: form.status,
      price: Number(form.price) || 0,
      syllabusUrl: form.syllabusUrl || null,
      instructor: form.instructor || null,
      maxEnrollments: form.maxEnrollments ? Number(form.maxEnrollments) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-training"] });
      toast({ title: "课程已更新" });
      setEditCourse(null);
    },
    onError: (e: Error) => toast({ title: "更新失败", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminDelete(`/api/admin/training/courses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-training"] }); toast({ title: "课程已删除" }); },
    onError: (e: Error) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      adminPatch(`/api/admin/training/courses/${id}`, { action }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-training"] }); toast({ title: "操作成功" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const courses = data?.courses ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="认证培训管理"
        sub="课程发布、分类管理、课纲上传、线上报名收款、证书发放与等级认证"
        action={
          <button onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm">
            <Plus size={15} /> 新建课程
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="开放课程数" value={courses.filter(c => c.status === "published").length.toString()} icon={BookOpen} />
        <StatCard label="总报名人次" value={(data?.totalEnrollments ?? 0).toString()} icon={Users} />
        <StatCard label="证书已发放" value={(data?.totalCerts ?? 0).toString()} icon={Award} accent />
        <StatCard label="课程收入(元)" value={(data?.totalRevenue ?? 0).toFixed(0)} icon={DollarSign} />
      </div>

      <TableShell headers={["课程名称", "分类", "等级", "讲师", "时长", "价格", "状态", "报名/发证", "操作"]}>
        {isLoading ? <LoadingRow cols={9} /> : courses.length === 0 ? <EmptyRow cols={9} /> :
          courses.map(c => (
            <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-5 py-4 max-w-[200px]">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800 line-clamp-1">{c.title}</div>
                    {c.badge && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{c.badge}</span>}
                  </div>
                  {c.syllabus_url && (
                    <a href={c.syllabus_url} target="_blank" rel="noreferrer" title="查看课纲" className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors shrink-0">
                      <FileCheck size={13} />
                    </a>
                  )}
                </div>
              </td>
              <td className="px-5 py-4">
                <StatusBadge label={CATEGORY_MAP[c.category] ?? c.category}
                  color={({ tech: "bg-blue-100 text-blue-700", strategy: "bg-emerald-100 text-emerald-700", compliance: "bg-violet-100 text-violet-700", operations: "bg-orange-100 text-orange-700" })[c.category] ?? "bg-slate-100 text-slate-500"} />
              </td>
              <td className="px-5 py-4">
                <StatusBadge label={c.required_level + "级"} color="bg-primary/10 text-primary" />
                {c.is_required && <StatusBadge label="必修" color="bg-red-100 text-red-600" />}
              </td>
              <td className="px-5 py-4 text-xs text-slate-500">{c.instructor || "—"}</td>
              <td className="px-5 py-4 text-xs text-slate-500">{c.duration_minutes}分钟</td>
              <td className="px-5 py-4 text-sm font-bold text-slate-700">
                {Number(c.price) === 0 ? <span className="text-secondary font-bold">免费</span> : `¥${Number(c.price).toFixed(0)}`}
              </td>
              <td className="px-5 py-4">
                <StatusBadge label={STATUS_LABEL[c.status] ?? c.status} color={STATUS_COLOR[c.status] ?? "bg-slate-100 text-slate-500"} />
              </td>
              <td className="px-5 py-4">
                <button onClick={() => setEnrollCourse(c)}
                  className="flex items-center gap-1.5 text-xs text-primary font-bold hover:underline">
                  <ClipboardList size={13} />
                  {Number(c.enrolled_count)}人报名 / {Number(c.cert_issued_count)}证书
                </button>
                {Number(c.enrolled_count) > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-14 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-secondary rounded-full" style={{ width: `${Math.round(Number(c.passed_count) / Number(c.enrolled_count) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400">{Math.round(Number(c.passed_count) / Number(c.enrolled_count) * 100)}%通过</span>
                  </div>
                )}
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditCourse(c)} title="编辑"
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-primary transition-colors">
                    <Edit2 size={13} />
                  </button>
                  {c.status === "draft" && (
                    <button onClick={() => actionMutation.mutate({ id: c.id, action: "publish" })} title="发布课程"
                      className="p-1.5 rounded-lg hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors">
                      <PlayCircle size={13} />
                    </button>
                  )}
                  {c.status === "published" && (
                    <button onClick={() => actionMutation.mutate({ id: c.id, action: "close" })} title="结课"
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                      <XCircle size={13} />
                    </button>
                  )}
                  {!c.is_required && c.status === "published" && (
                    <button onClick={() => actionMutation.mutate({ id: c.id, action: "required" })} title="设为必修"
                      className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                      <Star size={13} />
                    </button>
                  )}
                  {c.is_required && (
                    <button onClick={() => actionMutation.mutate({ id: c.id, action: "optional" })} title="取消必修"
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                    </button>
                  )}
                  <button onClick={() => {
                    if (confirm(`确定要删除课程「${c.title}」吗？此操作不可恢复。`)) {
                      deleteMutation.mutate(c.id);
                    }
                  }} title="删除"
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))
        }
      </TableShell>

      <CourseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={(form) => createMutation.mutate(form)}
        initialForm={BLANK_FORM}
        isEdit={false}
      />

      {editCourse && (
        <CourseModal
          open={true}
          onClose={() => setEditCourse(null)}
          onSave={(form) => editMutation.mutate({ id: editCourse.id, form })}
          initialForm={courseToForm(editCourse)}
          isEdit={true}
        />
      )}

      {enrollCourse && (
        <EnrollmentPanel
          course={enrollCourse}
          onClose={() => setEnrollCourse(null)}
        />
      )}
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

/* ─── Module: 平台驾驶舱 ──────────────────────────── */

function PlatformCockpit() {
  const { data: stats } = useQuery<{
    totalOrders: number; totalAmount: number; completionRate: number;
    activeOpcs: number; inProgressOrders: number; disputedOrders: number;
    pendingDemands: number; totalPosts: number;
  }>({
    queryKey: ["admin-stats"],
    queryFn: () => adminGet("/api/admin/stats"),
  });

  const { data: finance } = useQuery<{
    totalSettled: number; totalPlatformFee: number; totalOpcIncome: number;
    pendingSettlement: number; transactions: Array<{
      id: number; orderNo: string; amount: number; opcShare: number;
      platformFee: number; status: string; createdAt: string;
      opcName: string; publisherName: string;
    }>;
  }>({
    queryKey: ["admin-finance"],
    queryFn: () => adminGet("/api/admin/finance"),
  });

  const kpis = [
    { label: "平台总结算",   value: `¥${((finance?.totalSettled ?? 0) / 10000).toFixed(1)}万`,   icon: Wallet,     color: "bg-primary/10 text-primary" },
    { label: "平台抽佣收入", value: `¥${((finance?.totalPlatformFee ?? 0) / 10000).toFixed(1)}万`, icon: CreditCard, color: "bg-violet-100 text-violet-600" },
    { label: "OPC 净收入",  value: `¥${((finance?.totalOpcIncome ?? 0) / 10000).toFixed(1)}万`,   icon: TrendingUp, color: "bg-secondary/10 text-secondary" },
    { label: "待结算金额",   value: `¥${((finance?.pendingSettlement ?? 0) / 10000).toFixed(1)}万`, icon: Clock,      color: "bg-amber-100 text-amber-600" },
    { label: "订单完成率",   value: `${stats?.completionRate ?? 0}%`,     icon: Activity,   color: "bg-green-100 text-green-600" },
    { label: "进行中订单",   value: String(stats?.inProgressOrders ?? 0), icon: ShoppingBag, color: "bg-blue-100 text-blue-600" },
    { label: "活跃 OPC 数", value: String(stats?.activeOpcs ?? 0),        icon: Users,      color: "bg-indigo-100 text-indigo-600" },
    { label: "争议订单",     value: String(stats?.disputedOrders ?? 0),   icon: Gavel,      color: "bg-red-100 text-red-600" },
  ];

  return (
    <div className="space-y-8">
      <SectionHeader title="平台驾驶舱" sub="全平台核心业务指标实时监控 · 资金流水总览" />

      <div className="grid grid-cols-4 gap-4">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.color}`}>
                  <Icon size={18} />
                </div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{k.label}</span>
              </div>
              <p className="text-2xl font-extrabold text-blue-900 font-display">{k.value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-blue-900">近期结算流水</h3>
          <StatusBadge label={`共 ${finance?.transactions.length ?? 0} 笔`} color="bg-slate-100 text-slate-500" />
        </div>
        <TableShell headers={["订单编号", "发单方", "OPC", "订单金额", "平台佣金", "OPC分成", "状态", "时间"]}>
          {(finance?.transactions ?? []).length === 0 ? <EmptyRow cols={8} /> :
            finance?.transactions.slice(0, 20).map(t => (
              <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-slate-400">{t.orderNo}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{t.publisherName}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{t.opcName}</td>
                <td className="px-6 py-4 font-bold text-sm text-blue-900">¥{t.amount.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm font-medium text-violet-600">¥{t.platformFee.toLocaleString()}</td>
                <td className="px-6 py-4 text-sm font-medium text-secondary">¥{t.opcShare.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <StatusBadge
                    label={t.status === "completed" ? "已结算" : t.status === "in_progress" ? "进行中" : t.status}
                    color={t.status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}
                  />
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">{new Date(t.createdAt).toLocaleDateString("zh-CN")}</td>
              </tr>
            ))
          }
        </TableShell>
      </div>
    </div>
  );
}

/* ─── Module: 争议管理 ──────────────────────────── */

function DisputeManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: orders = [], isLoading } = useQuery<Array<{
    id: number; orderNo: string; status: string; amount: number;
    opcName: string; publisherName: string; demandTitle: string;
    daysSinceCreated: number; createdAt: string;
    totalMilestones: number; completedMilestones: number;
  }>>({
    queryKey: ["admin-orders-disputed"],
    queryFn: () => adminGet("/api/admin/orders?status=disputed"),
  });

  const allOrders = useQuery<Array<{
    id: number; orderNo: string; status: string; amount: number;
    opcName: string; publisherName: string; demandTitle: string;
    daysSinceCreated: number; createdAt: string;
  }>>({
    queryKey: ["admin-orders-all-for-dispute"],
    queryFn: () => adminGet("/api/admin/orders"),
  });

  const mutate = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      adminPatch(`/api/admin/orders/${id}`, { action }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders-disputed"] });
      qc.invalidateQueries({ queryKey: ["admin-orders-all-for-dispute"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "操作成功" });
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const disputed = orders.filter(o => o.status === "disputed");
  const allDisputed = allOrders.data?.filter(o => o.status === "disputed") ?? disputed;

  return (
    <div className="space-y-6">
      <SectionHeader title="争议管理" sub="处理平台争议订单 · 强制结算或关闭仲裁" />

      <div className="grid grid-cols-3 gap-5">
        <StatCard label="当前争议订单" value={String(allDisputed.length)} icon={Gavel} />
        <StatCard label="争议金额合计" value={`¥${allDisputed.reduce((s, o) => s + o.amount, 0).toLocaleString()}`} icon={AlertCircle} />
        <StatCard label="待裁决" value={String(allDisputed.length)} icon={Clock} accent />
      </div>

      <TableShell headers={["订单编号", "需求标题", "发单方", "OPC", "金额", "在途天数", "状态", "操作"]}>
        {isLoading ? <LoadingRow cols={8} /> : allDisputed.length === 0 ? (
          <tr><td colSpan={8} className="py-16 text-center text-slate-400 text-sm">暂无争议订单</td></tr>
        ) : allDisputed.map(o => (
          <tr key={o.id} className="hover:bg-red-50/30 transition-colors">
            <td className="px-6 py-4 font-mono text-xs text-slate-400">{o.orderNo}</td>
            <td className="px-6 py-4 text-sm font-bold text-blue-900 max-w-[160px]">
              <span className="line-clamp-1">{o.demandTitle}</span>
            </td>
            <td className="px-6 py-4 text-sm text-slate-600">{o.publisherName}</td>
            <td className="px-6 py-4 text-sm text-slate-600">{o.opcName}</td>
            <td className="px-6 py-4 font-bold text-sm text-blue-900">¥{o.amount.toLocaleString()}</td>
            <td className="px-6 py-4">
              <span className={`text-sm font-bold ${o.daysSinceCreated > 30 ? "text-red-600" : "text-amber-600"}`}>
                {o.daysSinceCreated} 天
              </span>
            </td>
            <td className="px-6 py-4">
              <StatusBadge label="争议中" color="bg-red-100 text-red-600" />
            </td>
            <td className="px-6 py-4">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => mutate.mutate({ id: o.id, action: "forceSettle" })}
                  title="强制结算给OPC"
                  className="px-3 py-1.5 text-xs font-bold bg-secondary/10 text-secondary hover:bg-secondary/20 rounded-lg transition-colors"
                >
                  强制结算
                </button>
                <button
                  onClick={() => mutate.mutate({ id: o.id, action: "resolveDispute" })}
                  title="关闭争议，恢复进行中"
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  关闭仲裁
                </button>
              </div>
            </td>
          </tr>
        ))}
      </TableShell>

      {/* All orders that could be marked as disputed */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500" />
          <h3 className="font-bold text-blue-900">可标记争议的订单</h3>
          <p className="text-xs text-slate-400">（进行中的订单可被标记为争议）</p>
        </div>
        <TableShell headers={["订单编号", "需求标题", "金额", "状态", "操作"]}>
          {allOrders.isLoading ? <LoadingRow cols={5} /> :
            (allOrders.data ?? []).filter(o => o.status === "in_progress").length === 0 ? <EmptyRow cols={5} /> :
            (allOrders.data ?? []).filter(o => o.status === "in_progress").map(o => (
              <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-slate-400">{o.orderNo}</td>
                <td className="px-6 py-4 text-sm font-bold text-blue-900 max-w-[200px]">
                  <span className="line-clamp-1">{o.demandTitle}</span>
                </td>
                <td className="px-6 py-4 font-bold text-sm text-blue-900">¥{o.amount.toLocaleString()}</td>
                <td className="px-6 py-4"><StatusBadge label="进行中" color="bg-blue-100 text-blue-600" /></td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => mutate.mutate({ id: o.id, action: "markDisputed" })}
                    className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    标记争议
                  </button>
                </td>
              </tr>
            ))
          }
        </TableShell>
      </div>
    </div>
  );
}

/* ─── Site Settings ──────────────────────────────── */

function SiteSettingsManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery<Record<string, string>>({
    queryKey: ["admin-settings"],
    queryFn: () => adminGet("/api/admin/settings"),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (settings && Object.keys(form).length === 0) {
      setForm({ ...settings });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/admin/settings`, {
        method: "PUT",
        headers: getAdminHeaders(),
        body: JSON.stringify(form),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      toast({ title: "站点设置已保存" });
    },
    onError: (e: Error) => toast({ title: "保存失败", description: e.message, variant: "destructive" }),
  });

  async function handleImageUpload(fieldKey: string, file: File) {
    setUploading(v => ({ ...v, [fieldKey]: true }));
    try {
      const res = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!res.ok) throw new Error(`请求上传地址失败: ${res.status}`);
      const { uploadURL, objectPath } = await res.json();
      const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error(`上传文件失败: ${putRes.status}`);
      const imageUrl = `${BASE}/api/storage${objectPath}`;
      setForm(v => ({ ...v, [fieldKey]: imageUrl }));
      toast({ title: "图片上传成功" });
    } catch (e) {
      toast({ title: "上传失败", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(v => ({ ...v, [fieldKey]: false }));
    }
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  const imageFields: { key: string; label: string; hint: string; accept: string }[] = [
    { key: "site_logo",    label: "Logo 图标",  hint: "建议尺寸 200×60px，PNG/SVG",  accept: "image/*" },
    { key: "site_favicon", label: "Favicon",    hint: "建议尺寸 32×32px，ICO/PNG",   accept: "image/*" },
  ];

  const footerLinkGroups = [
    {
      title: "平台资源（左侧三条链接）",
      links: [
        { textKey: "footer_resource1_text", urlKey: "footer_resource1_url", label: "链接 1" },
        { textKey: "footer_resource2_text", urlKey: "footer_resource2_url", label: "链接 2" },
        { textKey: "footer_resource3_text", urlKey: "footer_resource3_url", label: "链接 3" },
      ],
    },
    {
      title: "关于我们（右侧三条链接）",
      links: [
        { textKey: "footer_about1_text", urlKey: "footer_about1_url", label: "链接 1" },
        { textKey: "footer_about2_text", urlKey: "footer_about2_url", label: "链接 2" },
        { textKey: "footer_about3_text", urlKey: "footer_about3_url", label: "链接 3" },
      ],
    },
  ];

  function field(key: string, placeholder: string, className = "w-full") {
    return (
      <input
        value={form[key] ?? ""}
        onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))}
        placeholder={placeholder}
        className={`${className} border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition`}
      />
    );
  }

  return (
    <div className="max-w-2xl">
      <SectionHeader title="站点设置" sub="配置平台品牌、页脚信息及视觉元素" />

      <div className="space-y-6">
        {/* 基本信息 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">基本信息</h3>
          {[
            { key: "site_name",    label: "站点名称",   placeholder: "接单吧" },
            { key: "site_subtitle",label: "站点副标题", placeholder: "OPC撮合交易平台" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-sm font-bold text-blue-900 mb-1.5">{label}</label>
              {field(key, placeholder)}
            </div>
          ))}
        </div>

        {/* 图片资源 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">图片资源</h3>
          {imageFields.map(({ key, label, hint, accept }) => (
            <div key={key}>
              <label className="block text-sm font-bold text-blue-900 mb-2">{label}</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-14 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                  {form[key] ? (
                    <img src={form[key]} alt={label} className="w-full h-full object-contain p-1" />
                  ) : (
                    <ImageIcon size={22} className="text-slate-300" />
                  )}
                </div>
                <div className="flex-1">
                  <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
                    uploading[key] ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}>
                    {uploading[key] ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploading[key] ? "上传中…" : "上传图片"}
                    <input
                      type="file" accept={accept} className="hidden"
                      disabled={uploading[key]}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(key, f); }}
                    />
                  </label>
                  <input
                    value={form[key] ?? ""}
                    onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))}
                    placeholder="或直接粘贴图片 URL"
                    className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 text-slate-500 transition"
                  />
                  <p className="text-xs text-slate-400 mt-1">{hint}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 页脚配置 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">页脚配置</h3>

          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">品牌标语</label>
            {field("footer_slogan", "引领企业数字生态转型的超级个体撮合交易平台…")}
            <p className="text-xs text-slate-400 mt-1">显示在页脚左侧 Logo 下方</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">版权声明</label>
            {field("footer_copyright", "© 2026 海创元数字交易中心. 保留所有权利.")}
            <p className="text-xs text-slate-400 mt-1">显示在页脚右下角订阅区</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">ICP 备案号</label>
            {field("icp_number", "粤ICP备XXXXXXXX号")}
            <p className="text-xs text-slate-400 mt-1">填写后紧跟版权声明显示</p>
          </div>
        </div>

        {/* 页脚链接 */}
        {footerLinkGroups.map(group => (
          <div key={group.title} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">{group.title}</h3>
            {group.links.map(({ textKey, urlKey, label }) => (
              <div key={textKey}>
                <label className="block text-xs font-bold text-blue-900 mb-1.5">{label}</label>
                <div className="flex gap-2">
                  <input
                    value={form[textKey] ?? ""}
                    onChange={e => setForm(v => ({ ...v, [textKey]: e.target.value }))}
                    placeholder="链接文字"
                    className="w-2/5 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition"
                  />
                  <input
                    value={form[urlKey] ?? ""}
                    onChange={e => setForm(v => ({ ...v, [urlKey]: e.target.value }))}
                    placeholder="链接地址（如 https://… 或 #）"
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition"
                  />
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saveMutation.isPending ? "保存中…" : "保存设置"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Module: 等级认证审核 ─────────────────────── */

interface LevelCertRow {
  id: number;
  title: string;
  type: string;
  description: string;
  cover_image: string | null;
  project_url: string | null;
  apply_level: "A" | "B" | "C";
  level_apply_status: "pending" | "approved" | "downgraded" | "rejected";
  level_apply_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  user_id: number;
  nickname: string;
  email: string;
  current_level: string | null;
  credit_score: number | null;
}

const LEVEL_STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending:    { text: "待审核", color: "bg-amber-100 text-amber-700" },
  approved:   { text: "已通过", color: "bg-green-100 text-green-700" },
  downgraded: { text: "降级通过", color: "bg-blue-100 text-blue-700" },
  rejected:   { text: "未通过", color: "bg-red-100 text-red-700" },
};

function LevelCertReview() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "reviewed">("all");

  const { data = [], isLoading, refetch } = useQuery<LevelCertRow[]>({
    queryKey: ["admin-level-certs"],
    queryFn: () => adminGet("/api/admin/level-certs"),
  });

  const reviewMut = useMutation({
    mutationFn: ({ portfolioId, result }: { portfolioId: number; result: string }) =>
      adminPost(`/api/admin/level-certs/${portfolioId}/review`, { result, note: reviewNote }),
    onSuccess: () => {
      toast({ title: "评审已提交", description: "评审结果已发送通知给OPC" });
      setReviewing(null);
      setReviewNote("");
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-level-certs"] });
    },
    onError: () => toast({ title: "提交失败", variant: "destructive" }),
  });

  const filtered = data.filter(r =>
    filterStatus === "all" ? true :
    filterStatus === "pending" ? r.level_apply_status === "pending" :
    r.level_apply_status !== "pending"
  );

  const pendingCount = data.filter(r => r.level_apply_status === "pending").length;

  return (
    <div>
      <SectionHeader
        title="作品等级认证审核"
        sub={`共 ${data.length} 条申请，其中 ${pendingCount} 条待审`}
        action={
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as never)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
              <option value="all">全部</option>
              <option value="pending">待审核</option>
              <option value="reviewed">已审核</option>
            </select>
            <button onClick={() => refetch()}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <RefreshCw size={16} className="text-slate-500" />
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={18} className="animate-spin" />加载中…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">暂无等级认证申请</div>
      ) : (
        <div className="space-y-4">
          {filtered.map(row => {
            const isOpen = expanded === row.id;
            const isReviewing = reviewing === row.id;
            const statusInfo = LEVEL_STATUS_LABELS[row.level_apply_status];
            return (
              <div key={row.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
                {/* 主行 */}
                <div
                  className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : row.id)}>
                  {row.cover_image && (
                    <img src={row.cover_image} alt="cover" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  )}
                  {!row.cover_image && (
                    <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <ImageIcon size={20} className="text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-blue-900 text-sm truncate">{row.title}</p>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                        {statusInfo.text}
                      </span>
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        申请 {row.apply_level} 级
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>{row.nickname}</span>
                      <span>·</span>
                      <span>当前等级: {row.current_level ?? "无"}</span>
                      <span>·</span>
                      <span>信用 {row.credit_score ?? 0}</span>
                      <span>·</span>
                      <span>{new Date(row.created_at).toLocaleDateString("zh-CN")}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {row.level_apply_status === "pending" && (
                      <button
                        onClick={e => { e.stopPropagation(); setReviewing(isReviewing ? null : row.id); setExpanded(row.id); setReviewNote(""); }}
                        className="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors">
                        评审
                      </button>
                    )}
                    {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </div>

                {/* 展开详情 */}
                {isOpen && (
                  <div className="border-t border-slate-100 px-6 py-4 space-y-4">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">作品简介</p>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{row.description}</p>
                    </div>
                    {row.project_url && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">项目链接</p>
                        <a href={row.project_url} target="_blank" rel="noreferrer"
                          className="text-sm text-primary underline break-all">{row.project_url}</a>
                      </div>
                    )}
                    {row.level_apply_note && (
                      <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-xs font-bold text-slate-500 mb-0.5">历史评审意见</p>
                        <p className="text-sm text-slate-700">{row.level_apply_note}</p>
                        {row.reviewed_at && (
                          <p className="text-[11px] text-slate-400 mt-1">评审于 {new Date(row.reviewed_at).toLocaleDateString("zh-CN")}</p>
                        )}
                      </div>
                    )}

                    {/* 评审操作区 */}
                    {isReviewing && row.level_apply_status === "pending" && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                        <p className="text-sm font-bold text-amber-800">评审该作品 · 申请 {row.apply_level} 级</p>
                        <textarea
                          rows={3}
                          value={reviewNote}
                          onChange={e => setReviewNote(e.target.value)}
                          placeholder="请填写评审意见（将在通知中发送给OPC，可留空）"
                          className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300 resize-none bg-white" />
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => reviewMut.mutate({ portfolioId: row.id, result: "approved" })}
                            disabled={reviewMut.isPending}
                            className="py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5">
                            <CheckCircle2 size={14} />
                            认证通过 · 获得 {row.apply_level} 级
                          </button>
                          <button
                            onClick={() => reviewMut.mutate({ portfolioId: row.id, result: "downgraded" })}
                            disabled={reviewMut.isPending}
                            className="py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5">
                            <Award size={14} />
                            降级通过 · 获得 {row.apply_level === "A" ? "B" : row.apply_level === "B" ? "C" : "C"} 级
                          </button>
                          <button
                            onClick={() => reviewMut.mutate({ portfolioId: row.id, result: "rejected" })}
                            disabled={reviewMut.isPending}
                            className="py-2.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-colors flex items-center justify-center gap-1.5">
                            <XCircle size={14} />
                            还需努力
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModuleContent({ module }: { module: Module }) {
  switch (module) {
    case "dashboard":  return <Dashboard />;
    case "cockpit":    return <PlatformCockpit />;
    case "users":      return <UserManagement />;
    case "demands":    return <DemandManagement />;
    case "orders":     return <OrderManagement />;
    case "disputes":   return <DisputeManagement />;
    case "finance":    return <FinanceManagement />;
    case "ecosystem":  return <EcosystemManagement />;
    case "training":   return <TrainingManagement />;
    case "levelcert":  return <LevelCertReview />;
    case "content":    return <ContentReview />;
    case "settings":   return <SiteSettingsManagement />;
  }
}

/* ─── Sidebar Logo ───────────────────────────── */

function AdminSidebarLogo() {
  const siteName = useSiteName();
  return (
    <div className="flex items-center gap-3 px-2 mb-8 mt-2">
      <SiteLogo size={30} />
      <div>
        <p className="text-white text-sm font-extrabold font-display leading-tight">{siteName}</p>
        <p className="text-slate-500 text-[10px] uppercase tracking-widest font-medium">管理后台</p>
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────── */

export default function Admin() {
  const [active, setActive] = useState<Module>("dashboard");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const role = localStorage.getItem("jdb_role");
  if (!role || role !== "admin") {
    return (
      <div className="min-h-screen bg-[#f3f3f6] flex items-center justify-center">
        <div className="text-center">
          <ShieldCheck size={48} className="text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-blue-900 mb-2">
            {role ? "权限不足" : "请先登录"}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {role ? "此页面仅限平台管理员访问" : "需要管理员账号才能进入后台"}
          </p>
          <button onClick={() => navigate("/auth/admin")}
            className="px-6 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-colors">
            前往管理员登录
          </button>
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
        <AdminSidebarLogo />

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
