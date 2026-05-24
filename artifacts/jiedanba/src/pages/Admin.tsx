import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import AdminActivities from "./AdminActivities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatBudget } from "@/lib/utils";
import { useLocation } from "wouter";
import { SiteLogo, useSiteName } from "@/components/SiteLogo";
import { clearSession, getAccessToken, getStoredUser } from "@/lib/auth";
import {
  LayoutDashboard, Users, FileText, ShoppingBag,
  Wallet, Network, GraduationCap, Shield, BarChart3,
  TrendingUp, TrendingDown, LogOut,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Search, Bell, Settings, RefreshCw, Download, Eye, Ban, Check, Star,
  BookOpen, PlayCircle, Award, Flag, Megaphone, Mail,
  Activity, ArrowUpRight, ArrowDownRight, Zap,
  CreditCard, Receipt, BadgeCheck, UserX, UserCheck,
  Gavel, AlertCircle, Loader2, Trash2,
  SlidersHorizontal, Upload, ImageIcon, Save,
  Plus, Edit2, ChevronDown, ChevronUp, DollarSign, BadgeCent, FileCheck, ClipboardList, X, Trophy, RotateCcw, Undo2,
  Flame, Filter, ShieldCheck, Lock, EyeOff, KeyRound, UserCog, ShieldAlert, ChevronRight, Monitor, Bot, Tablet, Video,
  Pin, Paperclip, ScrollText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { MarkdownContent } from "@/components/MarkdownContent";

/* ─── API helpers ────────────────────────────────── */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getAdminHeaders() {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export type Module =
  | "dashboard" | "users" | "demands" | "orders"
  | "finance"   | "ecosystem" | "training" | "content"
  | "cockpit"   | "disputes"  | "settings" | "levelcert"
  | "sensitivewords" | "payments" | "activities"
  | "roles" | "adminusers" | "screen" | "screenvideos" | "agent" | "settlement" | "quotecard" | "syslogs"
  | "platform_config" | "catcategories" | "cattags" | "creditlevels" | "creditrules"
  | "demands_orders" | "opc_management" | "system_management";

type NavChild = { key: string; label: string; icon: React.ElementType; href?: string; moduleKey?: Module; superAdminOnly?: boolean };
type NavItem = { key: Module; icon: React.ElementType; label: string; superAdminOnly?: boolean; permKey?: string; children?: NavChild[] };

const NAV: NavItem[] = [
  { key: "dashboard", icon: LayoutDashboard, label: "数据看板",   permKey: "dashboard" },
  { key: "cockpit",   icon: BarChart3,       label: "平台驾驶舱", permKey: "cockpit" },
  { key: "users",     icon: Users,           label: "用户管理",   permKey: "users" },
  { key: "finance",   icon: Wallet,          label: "财务管理",   permKey: "finance" },
  { key: "content",   icon: Shield,          label: "内容审核",   permKey: "content" },
  { key: "activities",icon: ClipboardList,   label: "活动报名",   permKey: "activities" },

  {
    key: "demands_orders", icon: FileText, label: "需求与订单", permKey: "demands",
    children: [
      { key: "demands",  label: "需求管理", moduleKey: "demands"  as Module, icon: FileText  },
      { key: "orders",   label: "订单管理", moduleKey: "orders"   as Module, icon: ShoppingBag },
      { key: "disputes", label: "争议管理", moduleKey: "disputes" as Module, icon: Gavel },
    ],
  },

  {
    key: "opc_management", icon: Network, label: "OPC 管理", permKey: "ecosystem",
    children: [
      { key: "ecosystem",  label: "OPC 生态池",   moduleKey: "ecosystem"  as Module, icon: Network },
      { key: "training",   label: "认证培训",     moduleKey: "training"   as Module, icon: GraduationCap },
      { key: "levelcert",  label: "等级认证",     moduleKey: "levelcert"  as Module, icon: Trophy },
      { key: "settlement", label: "结算账户审核", moduleKey: "settlement" as Module, icon: CreditCard },
    ],
  },

  {
    key: "platform_config", icon: Settings, label: "平台配置", permKey: "settings",
    children: [
      { key: "catcategories", label: "需求分类管理", moduleKey: "catcategories" as Module, icon: Filter },
      { key: "cattags",       label: "分类标签管理", moduleKey: "cattags"       as Module, icon: Flag },
      { key: "creditlevels",  label: "信用等级配置", moduleKey: "creditlevels"  as Module, icon: BadgeCheck },
      { key: "creditrules",   label: "积分规则配置", moduleKey: "creditrules"   as Module, icon: Zap },
      { key: "quotecard",     label: "报价卡配置",   moduleKey: "quotecard"     as Module, icon: BadgeCent },
      { key: "agent",         label: "智能体配置",   moduleKey: "agent"         as Module, icon: Bot },
      { key: "sensitivewords",label: "敏感词管理",   moduleKey: "sensitivewords"as Module, icon: Flame },
    ],
  },

  {
    key: "system_management", icon: SlidersHorizontal, label: "系统管理", permKey: "settings",
    children: [
      { key: "settings",   label: "站点设置",   moduleKey: "settings"   as Module, icon: SlidersHorizontal },
      { key: "roles",      label: "角色管理",   moduleKey: "roles"      as Module, icon: KeyRound,   superAdminOnly: true },
      { key: "adminusers", label: "管理员管理", moduleKey: "adminusers" as Module, icon: UserCog,    superAdminOnly: true },
      { key: "syslogs",    label: "系统日志",   moduleKey: "syslogs"    as Module, icon: ScrollText, superAdminOnly: true },
    ],
  },

  {
    key: "screen", icon: Monitor, label: "数据大屏", permKey: "screen",
    children: [
      { key: "screen_h",     label: "横屏大屏", href: "/screen",     icon: Monitor },
      { key: "screen_v",     label: "竖屏大屏", href: "/miniscreen", icon: Tablet },
      { key: "screenvideos", label: "视频管理", moduleKey: "screenvideos" as Module, icon: Video },
    ],
  },
];

/* ─── Admin profile hook ─────────────────────────── */

type AdminProfile = {
  id: number;
  nickname: string;
  email: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

function useAdminProfile() {
  const tokenHint = getAccessToken()?.slice(-12) ?? "none";
  return useQuery<AdminProfile>({
    queryKey: ["admin-profile", tokenHint],
    queryFn: () => adminGet("/api/admin/profile"),
    staleTime: 60_000,
    retry: false,
  });
}

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

function safeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  // Allow trusted internal storage paths (relative, from Replit object storage)
  if (/^\/.*\/api\/storage\//i.test(trimmed) || trimmed.startsWith("/api/storage/")) return trimmed;
  // Allow absolute http/https URLs
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return trimmed;
  } catch {
    // invalid URL
  }
  return undefined;
}

function AdminPagination({ page, pageSize, total, onPage, onPageSize }: {
  page: number; pageSize: number; total: number;
  onPage: (p: number) => void; onPageSize?: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end   = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  return (
    <div className="flex items-center justify-between mt-4 px-1 flex-wrap gap-2">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span>共 <b className="text-slate-600">{total}</b> 条</span>
        <span>·</span>
        <span>第 <b className="text-slate-600">{page}</b> / <b className="text-slate-600">{totalPages}</b> 页</span>
        {onPageSize && (
          <>
            <span>·</span>
            <label className="flex items-center gap-1">
              每页
              <select
                value={pageSize}
                onChange={e => { onPageSize(Number(e.target.value)); }}
                className="border border-slate-200 rounded-lg px-1.5 py-0.5 text-xs text-slate-600 outline-none focus:ring-2 focus:ring-primary/20 bg-white">
                {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              条
            </label>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPage(1)}
          className="px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition-colors">
          «
        </button>
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition-colors">
          ‹ 上一页
        </button>
        {pages.map(p => (
          <button key={p} onClick={() => onPage(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${p === page ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {p}
          </button>
        ))}
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition-colors">
          下一页 ›
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(totalPages)}
          className="px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition-colors">
          »
        </button>
      </div>
    </div>
  );
}

/* ─── Shared hook: admin list state ─────────────── */

function useAdminListState<F extends string = string>(defaultFilter: F = "" as F, defaultLevel = "all", defaultPageSize = 10) {
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [filter, setFilter] = useState<F>(defaultFilter);
  const [level, setLevel] = useState(defaultLevel);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize);

  const commitSearch = () => { setQ(qInput); setPage(1); };
  const clearSearch = () => { setQ(""); setQInput(""); setPage(1); };
  const applyFilter = (f: string) => { setFilter(f as F); setPage(1); };
  const applyLevel = (l: string) => { setLevel(l); setPage(1); };
  const setPageSize = (s: number) => { setPageSizeRaw(s); setPage(1); };

  return { q, qInput, setQInput, filter, level, page, pageSize, setPage, setPageSize, commitSearch, clearSearch, applyFilter, applyLevel };
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
  phone: string | null;
  role: string;
  status: string;
  createdAt: string;
  opcLevel: string | null;
  creditScore: number | null;
  totalOrders: number | null;
}

interface PagedResp<T> { data: T[]; total: number; page: number; pageSize: number; }

function UserManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { q, qInput, setQInput, page, pageSize, setPage, setPageSize, commitSearch, clearSearch } = useAdminListState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [showBulkNotify, setShowBulkNotify] = useState(false);
  const [expandedOpcId, setExpandedOpcId] = useState<number | null>(null);

  const { data: resp, isLoading } = useQuery<PagedResp<AdminUser>>({
    queryKey: ["admin-users", roleFilter, statusFilter, q, page, pageSize],
    queryFn: () => adminGet(`/api/admin/users?role=${roleFilter === "all" ? "" : roleFilter}&status=${statusFilter === "all" ? "" : statusFilter}&q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`),
  });
  const users = resp?.data ?? [];

  const mutate = useMutation({
    mutationFn: ({ id, action, value }: { id: number; action: string; value?: string }) =>
      adminPatch(`/api/admin/users/${id}`, { action, value }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "操作成功" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const ROLE_FILTERS = ["all", "opc", "publisher"];
  const ROLE_LABELS: Record<string, string> = { all: "全部角色", opc: "OPC", publisher: "发单方" };
  const STATUS_FILTERS = ["all", "active", "suspended"];
  const STATUS_LABELS: Record<string, string> = { all: "全部状态", active: "正常", suspended: "封禁" };

  const roleLabel = (r: string) => ({ opc: "OPC", publisher: "发单方", admin: "管理员" }[r] ?? r);
  const roleColor = (r: string) => ({ opc: "bg-secondary/10 text-secondary", publisher: "bg-primary/10 text-primary", admin: "bg-purple-100 text-purple-700" }[r] ?? "bg-slate-100 text-slate-500");
  const statusColor = (s: string) => s === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
  const statusLabel = (s: string) => s === "active" ? "正常" : "封禁";

  return (
    <div className="space-y-6">
      {showBulkEmail && <UserBulkEmailModal onClose={() => setShowBulkEmail(false)} />}
      {showBulkNotify && <UserBulkNotifyModal onClose={() => setShowBulkNotify(false)} />}
      <SectionHeader title="用户管理" sub="OPC 账户审核、角色权限配置、认证等级调整、封禁/解封" />
      <div className="flex items-center gap-3 flex-wrap">
        {ROLE_FILTERS.map(f => (
          <button key={f} onClick={() => { setRoleFilter(f); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${roleFilter === f ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {ROLE_LABELS[f]}
          </button>
        ))}
        <div className="w-px h-4 bg-slate-200" />
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${statusFilter === s ? (s === "suspended" ? "bg-red-500 text-white" : "bg-green-600 text-white") : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {STATUS_LABELS[s]}
          </button>
        ))}
        <form onSubmit={e => { e.preventDefault(); commitSearch(); }} className="flex items-center gap-1 ml-auto">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={qInput} onChange={e => setQInput(e.target.value)} placeholder="搜索用户名/邮箱…"
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 w-44" />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">搜索</button>
          {q && <button type="button" onClick={clearSearch} className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs transition-colors">×</button>}
        </form>
        <button
          onClick={() => setShowBulkEmail(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors"
        >
          <Mail size={13} /> 群发邮件
        </button>
        <button
          onClick={() => setShowBulkNotify(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-secondary/10 text-secondary rounded-xl text-xs font-bold hover:bg-secondary/20 transition-colors"
        >
          <Bell size={13} /> 群发站内信
        </button>
      </div>
      <TableShell headers={["用户", "邮箱", "手机号", "身份", "等级", "信用分", "注册日期", "状态", "操作"]}>
        {isLoading ? <LoadingRow cols={9} /> : users.length === 0 ? <EmptyRow cols={9} /> :
          users.map(u => (
            <Fragment key={u.id}>
              <tr className={`hover:bg-slate-50/60 transition-colors ${expandedOpcId === u.id ? "bg-slate-50/40" : ""}`}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{u.nickname[0]}</div>
                    <span className="font-bold text-sm text-blue-900">{u.nickname}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">{u.email || "—"}</td>
                <td className="px-6 py-4 text-xs text-slate-400">{u.phone || "—"}</td>
                <td className="px-6 py-4"><StatusBadge label={roleLabel(u.role)} color={roleColor(u.role)} /></td>
                <td className="px-6 py-4">
                  {u.opcLevel ? (
                    <select defaultValue={u.opcLevel} onChange={e => mutate.mutate({ id: u.id, action: "setLevel", value: e.target.value })}
                      className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30">
                      {[{ v: "newbie", label: "新手" }, { v: "C", label: "C级·基础" }, { v: "B", label: "B级·进阶" }, { v: "A", label: "A级·专家" }].map(l => <option key={l.v} value={l.v}>{l.label}</option>)}
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
                    {u.role === "opc" && (
                      <button
                        onClick={() => setExpandedOpcId(expandedOpcId === u.id ? null : u.id)}
                        title="查看OPC详情"
                        className={`p-2 rounded-xl transition-colors ${expandedOpcId === u.id ? "bg-primary/10 text-primary" : "hover:bg-slate-100 text-slate-400"}`}
                      >
                        {expandedOpcId === u.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    )}
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
              {expandedOpcId === u.id && u.role === "opc" && (
                <tr>
                  <td colSpan={9} className="p-0">
                    <OpcUserDetail userId={u.id} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))
        }
      </TableShell>
      <AdminPagination page={page} pageSize={pageSize} total={resp?.total ?? 0} onPage={setPage} onPageSize={setPageSize} />
    </div>
  );
}

/* ─── OPC User Detail (inline expand) ───────────── */

interface OpcDetail {
  creditLevelId: number | null;
  creditPoints: number;
  creditLevelName: string | null;
  creditLevelColor: string | null;
  trackCerts: Array<{
    id: number;
    cat_category_id: number;
    cat_category_name: string | null;
    level: string;
    status: string;
    certified_at: string;
  }>;
}

function OpcUserDetail({ userId }: { userId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editCredit, setEditCredit] = useState(false);
  const [newCreditLevelId, setNewCreditLevelId] = useState<number | null>(null);
  const [newCreditPoints, setNewCreditPoints] = useState(0);

  const { data: detail, isLoading } = useQuery<OpcDetail>({
    queryKey: ["admin-opc-detail", userId],
    queryFn: () => adminGet(`/api/admin/users/${userId}/opc-detail`),
  });

  const { data: creditLevels = [] } = useQuery<CreditLevelItem[]>({
    queryKey: ["admin-credit-levels"],
    queryFn: () => adminGet("/api/admin/credit-levels"),
    staleTime: 60_000,
  });

  const setCreditMut = useMutation({
    mutationFn: (body: { creditLevelId: number | null; creditPoints: number }) =>
      adminPut(`/api/admin/users/${userId}/credit-level`, body),
    onSuccess: () => {
      toast({ title: "信用等级已更新" });
      setEditCredit(false);
      qc.invalidateQueries({ queryKey: ["admin-opc-detail", userId] });
    },
    onError: (e: any) => toast({ title: "更新失败", description: e?.message, variant: "destructive" }),
  });

  const TRACK_LEVEL_LABELS: Record<string, string> = { A: "A级·专家", B: "B级·进阶", C: "C级·基础", newbie: "新手" };

  const startEdit = () => {
    setNewCreditLevelId(detail?.creditLevelId ?? null);
    setNewCreditPoints(detail?.creditPoints ?? 0);
    setEditCredit(true);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-5 text-slate-400 gap-2 bg-slate-50/70 border-t border-slate-100">
      <Loader2 size={15} className="animate-spin" /><span className="text-sm">加载中…</span>
    </div>
  );
  if (!detail) return (
    <div className="py-4 text-center text-sm text-slate-400 bg-slate-50/70 border-t border-slate-100">
      无OPC档案
    </div>
  );

  return (
    <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 space-y-4">
      {/* Credit Level */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">信用等级</p>
        {editCredit ? (
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={newCreditLevelId ?? ""}
              onChange={e => setNewCreditLevelId(e.target.value === "" ? null : Number(e.target.value))}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            >
              <option value="">（无等级）</option>
              {creditLevels.filter(l => l.isActive).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={newCreditPoints}
              onChange={e => setNewCreditPoints(parseInt(e.target.value) || 0)}
              placeholder="积分"
              className="w-24 border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 bg-white"
            />
            <span className="text-xs text-slate-400">积分</span>
            <button
              onClick={() => setCreditMut.mutate({ creditLevelId: newCreditLevelId, creditPoints: newCreditPoints })}
              disabled={setCreditMut.isPending}
              className="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {setCreditMut.isPending ? "保存…" : "保存"}
            </button>
            <button
              onClick={() => setEditCredit(false)}
              className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-300 transition-colors"
            >
              取消
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {detail.creditLevelName ? (
              <span
                className="px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: detail.creditLevelColor ?? "#94a3b8" }}
              >
                {detail.creditLevelName}
              </span>
            ) : (
              <span className="text-sm text-slate-400">未分配等级</span>
            )}
            <span className="text-xs text-slate-500 font-semibold">{detail.creditPoints} 积分</span>
            <button
              onClick={startEdit}
              className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
              title="修改信用等级"
            >
              <Edit2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Track Certs */}
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          赛道认证（{detail.trackCerts.length} 项）
        </p>
        {detail.trackCerts.length === 0 ? (
          <p className="text-sm text-slate-400 italic">暂无赛道认证</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {detail.trackCerts.map(cert => (
              <div
                key={cert.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
                  cert.status === "active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-400 border border-slate-200"
                }`}
              >
                <Award size={12} />
                <span>{cert.cat_category_name ?? `分类#${cert.cat_category_id}`}</span>
                <span className="opacity-50">·</span>
                <span>{TRACK_LEVEL_LABELS[cert.level] ?? cert.level}</span>
                <span className="opacity-40 font-normal ml-1 text-[10px]">
                  {new Date(cert.certified_at).toLocaleDateString("zh-CN")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── User Bulk Email Modal ──────────────────────── */

function UserBulkEmailModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [subject, setSubject]   = useState("");
  const [body, setBody]         = useState("");

  // filter states
  const [filterRole,             setFilterRole]             = useState("all");
  const [filterStatus,           setFilterStatus]           = useState("all");
  const [filterNames,            setFilterNames]            = useState("");
  const [filterEmails,           setFilterEmails]           = useState("");
  const [filterPhones,           setFilterPhones]           = useState("");
  const [filterLevels,           setFilterLevels]           = useState<string[]>([]);
  const [filterRegisteredFrom,   setFilterRegisteredFrom]   = useState("");
  const [filterRegisteredTo,     setFilterRegisteredTo]     = useState("");

  const OPC_LEVELS = [
    { v: "newbie", label: "新手" },
    { v: "C",      label: "C级·基础" },
    { v: "B",      label: "B级·进阶" },
    { v: "A",      label: "A级·专家" },
  ];

  const toggleLevel = (v: string) =>
    setFilterLevels(prev => prev.includes(v) ? prev.filter(l => l !== v) : [...prev, v]);

  const sendMutation = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/admin/users/bulk-email`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({
          subject, body,
          filterRole, filterStatus,
          filterNames, filterEmails, filterPhones,
          filterLevels: filterLevels.join(","),
          filterRegisteredFrom, filterRegisteredTo,
        }),
      }).then(async r => {
        const text = await r.text();
        let data: any;
        try { data = JSON.parse(text); } catch { throw new Error("服务器返回异常，请稍后重试"); }
        if (!r.ok) throw new Error(data.error ?? "发送失败");
        return data;
      }),
    onSuccess: (data) => {
      if (data.total === 0) {
        toast({ title: "没有符合条件的用户", description: "请调整过滤条件后重试", variant: "destructive" });
      } else {
        toast({ title: "群发任务已启动", description: `共 ${data.total} 位收件人，正在后台发送，结果将记录到系统日志` });
        onClose();
      }
    },
    onError: (e: Error) => toast({ title: "发送失败", description: e.message, variant: "destructive" }),
  });

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sendMutation.isPending;

  const inputCls = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Mail size={18} className="text-primary" /> 群发邮件 · 用户管理
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Email content */}
          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">邮件主题 <span className="text-red-500">*</span></label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="请输入邮件主题" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">邮件正文 <span className="text-red-500">*</span></label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="请输入邮件正文内容…" rows={5}
              className={`${inputCls} resize-none`} />
          </div>

          {/* Filters */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">过滤条件（不填/不选即发送全部）</p>

            {/* Role + Status row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">角色</label>
                <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className={inputCls}>
                  <option value="all">全部角色</option>
                  <option value="opc">OPC</option>
                  <option value="publisher">发单方</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">账号状态</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls}>
                  <option value="all">全部状态</option>
                  <option value="active">正常</option>
                  <option value="suspended">封禁</option>
                </select>
              </div>
            </div>

            {/* Names */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">用户名（多个用逗号隔开）</label>
              <input value={filterNames} onChange={e => setFilterNames(e.target.value)}
                placeholder="如：张三,李四"
                className={inputCls} />
            </div>

            {/* Emails */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">邮箱（多个用逗号隔开）</label>
              <input value={filterEmails} onChange={e => setFilterEmails(e.target.value)}
                placeholder="如：user@example.com"
                className={inputCls} />
            </div>

            {/* Phones */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">手机号（多个用逗号隔开）</label>
              <input value={filterPhones} onChange={e => setFilterPhones(e.target.value)}
                placeholder="如：138xxxx,139xxxx"
                className={inputCls} />
            </div>

            {/* OPC Level */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">OPC 等级（可多选，不选则全部）</label>
              <div className="flex flex-wrap gap-2">
                {OPC_LEVELS.map(l => (
                  <button key={l.v} type="button" onClick={() => toggleLevel(l.v)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                      filterLevels.includes(l.v)
                        ? "bg-secondary text-white border-secondary"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:border-secondary/50"
                    }`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Registration date range */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">注册日期范围</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={filterRegisteredFrom} onChange={e => setFilterRegisteredFrom(e.target.value)}
                  className={inputCls} />
                <input type="date" value={filterRegisteredTo} onChange={e => setFilterRegisteredTo(e.target.value)}
                  className={inputCls} />
              </div>
              <p className="text-xs text-slate-400 mt-1">左为开始日期，右为结束日期，不填则不限</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-400">所有过滤条件取交集（AND 关系）</p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition-colors">取消</button>
            <button onClick={() => sendMutation.mutate()} disabled={!canSend}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {sendMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
              {sendMutation.isPending ? "发送中…" : "发送邮件"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── User Bulk Notify Modal ─────────────────────── */

function UserBulkNotifyModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle]   = useState("");
  const [content, setContent] = useState("");

  const [filterRole,           setFilterRole]           = useState("all");
  const [filterStatus,         setFilterStatus]         = useState("all");
  const [filterNames,          setFilterNames]          = useState("");
  const [filterEmails,         setFilterEmails]         = useState("");
  const [filterPhones,         setFilterPhones]         = useState("");
  const [filterLevels,         setFilterLevels]         = useState<string[]>([]);
  const [filterRegisteredFrom, setFilterRegisteredFrom] = useState("");
  const [filterRegisteredTo,   setFilterRegisteredTo]   = useState("");

  const OPC_LEVELS = [
    { v: "newbie", label: "新手" }, { v: "C", label: "C级·基础" },
    { v: "B", label: "B级·进阶" }, { v: "A", label: "A级·专家" },
  ];
  const toggleLevel = (v: string) =>
    setFilterLevels(prev => prev.includes(v) ? prev.filter(l => l !== v) : [...prev, v]);

  const sendMutation = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/admin/users/bulk-notify`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({
          title, content,
          filterRole, filterStatus,
          filterNames, filterEmails, filterPhones,
          filterLevels: filterLevels.join(","),
          filterRegisteredFrom, filterRegisteredTo,
        }),
      }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "发送失败");
        return data;
      }),
    onSuccess: (data) => {
      if (data.total === 0) {
        toast({ title: "没有符合条件的用户", description: "请调整过滤条件后重试", variant: "destructive" });
      } else {
        toast({ title: `群发完成：已向 ${data.sent} 位用户发送站内信` });
        onClose();
      }
    },
    onError: (e: Error) => toast({ title: "发送失败", description: e.message, variant: "destructive" }),
  });

  const canSend = title.trim().length > 0 && content.trim().length > 0 && !sendMutation.isPending;
  const inputCls = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Bell size={18} className="text-primary" /> 群发站内信 · 用户管理
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">消息标题 <span className="text-red-500">*</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="请输入消息标题" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">消息内容 <span className="text-red-500">*</span></label>
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="请输入消息内容…" rows={5}
              className={`${inputCls} resize-none`} />
          </div>
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">过滤条件（不填/不选即发送全部）</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">角色</label>
                <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className={inputCls}>
                  <option value="all">全部角色</option>
                  <option value="opc">OPC</option>
                  <option value="publisher">发单方</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">账号状态</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={inputCls}>
                  <option value="all">全部状态</option>
                  <option value="active">正常</option>
                  <option value="suspended">封禁</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">用户名（多个用逗号隔开）</label>
              <input value={filterNames} onChange={e => setFilterNames(e.target.value)} placeholder="如：张三,李四" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">邮箱（多个用逗号隔开）</label>
              <input value={filterEmails} onChange={e => setFilterEmails(e.target.value)} placeholder="如：user@example.com" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">手机号（多个用逗号隔开）</label>
              <input value={filterPhones} onChange={e => setFilterPhones(e.target.value)} placeholder="如：138xxxx,139xxxx" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">OPC 等级（可多选，不选则全部）</label>
              <div className="flex flex-wrap gap-2">
                {OPC_LEVELS.map(l => (
                  <button key={l.v} type="button" onClick={() => toggleLevel(l.v)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                      filterLevels.includes(l.v)
                        ? "bg-secondary text-white border-secondary"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:border-secondary/50"
                    }`}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">注册日期范围</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={filterRegisteredFrom} onChange={e => setFilterRegisteredFrom(e.target.value)} className={inputCls} />
                <input type="date" value={filterRegisteredTo} onChange={e => setFilterRegisteredTo(e.target.value)} className={inputCls} />
              </div>
              <p className="text-xs text-slate-400 mt-1">左为开始日期，右为结束日期，不填则不限</p>
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <p className="text-xs text-slate-400">所有过滤条件取交集（AND 关系）</p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition-colors">取消</button>
            <button onClick={() => sendMutation.mutate()} disabled={!canSend}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {sendMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />}
              {sendMutation.isPending ? "发送中…" : "发送站内信"}
            </button>
          </div>
        </div>
      </div>
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
  budget: number;
  budgetMin?: number | null;
  budgetMax?: number | null;
  isUrgent: boolean;
  createdAt: string;
  publisherName: string;
  deadline: string;
}

interface AdminDemandPayment {
  id: number;
  method: "online" | "offline";
  status: string;
  amount: number;
  paymentOrderNo: string | null;
  refundOrderNo: string | null;
  refundReason: string | null;
  refundRequestedAt: string | null;
  refundRejectReason: string | null;
  refundReceiptUrl: string | null;
  refundedAt: string | null;
  receiptUrl: string | null;
}

interface AdminDemandDetail extends AdminDemand {
  description: string;
  type: string;
  skillTags: string[];
  opcLevel: string;
  milestones: Array<{ name: string; deadline: string; deliverableDesc?: string }>;
  attachments: Array<{ name: string; url: string; type: string }>;
  bidDeadline: string | null;
  publisherEmail: string | null;
  publisherPhone: string | null;
  rejectionReason: string | null;
  payment: AdminDemandPayment | null;
}

const DEMAND_TYPE_CN: Record<string, string> = {
  education: "教育培训", software: "软件开发", marketing: "营销", content: "内容设计", other: "其他",
};

function AdminDemandDetailPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const { toast } = useToast();
  const { askConfirm, confirmDialog } = useConfirm();
  const qc = useQueryClient();
  const { data: d, isLoading, refetch } = useQuery<AdminDemandDetail>({
    queryKey: ["admin-demand-detail", id],
    queryFn: () => adminGet(`/api/admin/demands/${id}`),
  });

  // Admin actions mutation
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const actionMut = useMutation({
    mutationFn: ({ action, reason }: { action: string; reason?: string }) =>
      adminPatch(`/api/admin/demands/${id}`, { action, reason }),
    onSuccess: () => {
      toast({ title: "操作成功" });
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-demands"] });
      setShowRejectForm(false);
      setRejectReason("");
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  // Refund management
  const [showRefundRejectForm, setShowRefundRejectForm] = useState(false);
  const [refundRejectReason, setRefundRejectReason] = useState("");
  const [showOfflineRefundForm, setShowOfflineRefundForm] = useState(false);
  const [offlineRefundReceiptUrl, setOfflineRefundReceiptUrl] = useState("");
  const [offlineRefundUploading, setOfflineRefundUploading] = useState(false);

  const approveRefundMut = useMutation({
    mutationFn: () => adminPost(`/api/admin/demands/${id}/approve-refund`, {}),
    onSuccess: () => { toast({ title: "退款已批准" }); refetch(); qc.invalidateQueries({ queryKey: ["admin-demands"] }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const rejectRefundMut = useMutation({
    mutationFn: (reason: string) => adminPost(`/api/admin/demands/${id}/reject-refund`, { reason }),
    onSuccess: () => {
      toast({ title: "退款已拒绝" });
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-demands"] });
      setShowRefundRejectForm(false);
      setRefundRejectReason("");
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const confirmOfflineRefundMut = useMutation({
    mutationFn: (refundReceiptUrl: string) => adminPost(`/api/admin/demands/${id}/confirm-offline-refund`, { refundReceiptUrl }),
    onSuccess: () => {
      toast({ title: "线下退款已确认" });
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-demands"] });
      setShowOfflineRefundForm(false);
      setOfflineRefundReceiptUrl("");
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const handleRefundReceiptUpload = async (file: File) => {
    setOfflineRefundUploading(true);
    try {
      const reqRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!reqRes.ok) throw new Error("上传请求失败");
      const { uploadURL, objectPath, sessionToken } = await reqRes.json();
      const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("上传失败");
      const verifyRes = await fetch(`${BASE}/api/storage/uploads/verify`, {
        method: "POST", headers: getAdminHeaders(),
        body: JSON.stringify({ sessionToken }),
      });
      if (!verifyRes.ok) throw new Error("文件验证失败");
      setOfflineRefundReceiptUrl(`${BASE}/api/storage${objectPath}`);
      toast({ title: "凭证上传成功" });
    } catch (e: any) {
      toast({ title: "上传失败", description: e.message, variant: "destructive" });
    } finally {
      setOfflineRefundUploading(false);
    }
  };

  // Inline send-email form state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const emailMut = useMutation({
    mutationFn: () => fetch(`${BASE}/api/admin/demands/${id}/send-email`, {
      method: "POST", headers: getAdminHeaders(),
      body: JSON.stringify({ subject: emailSubject, content: emailContent }),
    }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); return b; }),
    onSuccess: () => { toast({ title: "邮件已发送" }); setShowEmailForm(false); setEmailSubject(""); setEmailContent(""); },
    onError: (e: Error) => toast({ title: "发送失败", description: e.message, variant: "destructive" }),
  });

  // Inline send-notify form state
  const [showNotifyForm, setShowNotifyForm] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyContent, setNotifyContent] = useState("");
  const notifyMut = useMutation({
    mutationFn: () => fetch(`${BASE}/api/admin/demands/${id}/notify`, {
      method: "POST", headers: getAdminHeaders(),
      body: JSON.stringify({ title: notifyTitle, content: notifyContent }),
    }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); return b; }),
    onSuccess: () => { toast({ title: "站内信已发送" }); setShowNotifyForm(false); setNotifyTitle(""); setNotifyContent(""); },
    onError: (e: Error) => toast({ title: "发送失败", description: e.message, variant: "destructive" }),
  });

  const statusCN: Record<string, string> = {
    draft: "草稿", pending_review: "待审核", pending_payment: "待缴保证金", published: "已发布",
    matched: "已匹配", in_progress: "进行中", pending_acceptance: "待验收",
    completed: "已完成", closed: "已关闭",
    refund_pending: "退款审核中", refunding: "退款中", refunded: "已退款",
  };

  const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 bg-white transition";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-extrabold text-blue-900">需求详情</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><X size={18} /></button>
        </div>
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : !d ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400">加载失败</div>
        ) : (
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* ── Action bar ── */}
            {(d.status === "pending_review" || d.status === "published" || (d.status !== "closed" && d.status !== "completed")) && (
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-2">
                {d.status === "pending_review" && (
                  <>
                    <button
                      onClick={() => actionMut.mutate({ action: "approve" })}
                      disabled={actionMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle2 size={13} /> 通过审核
                    </button>
                    <button
                      onClick={() => { setShowRejectForm(v => !v); setShowEmailForm(false); setShowNotifyForm(false); }}
                      disabled={actionMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <XCircle size={13} /> 审核不通过
                    </button>
                  </>
                )}
                {!d.isUrgent ? (
                  <button
                    onClick={() => actionMut.mutate({ action: "markUrgent" })}
                    disabled={actionMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                  >
                    <Megaphone size={13} /> 标记紧急
                  </button>
                ) : (
                  <button
                    onClick={() => actionMut.mutate({ action: "removeUrgent" })}
                    disabled={actionMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-300 disabled:opacity-50 transition-colors"
                  >
                    <Flag size={13} /> 取消紧急
                  </button>
                )}
                {d.status === "published" && (
                  <button
                    onClick={() => askConfirm({ title: `退回需求「${d.title}」到草稿`, description: "发单方将需要重新提交审核。", confirmLabel: "确认退回", confirmVariant: "default", onConfirm: () => actionMut.mutate({ action: "revertToDraft" }) })}
                    disabled={actionMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold hover:bg-amber-200 disabled:opacity-50 transition-colors"
                  >
                    <RotateCcw size={13} /> 退回编辑
                  </button>
                )}
                {d.status !== "closed" && d.status !== "completed" && d.status !== "refund_pending" && d.status !== "refunding" && d.status !== "refunded" && (
                  <button
                    onClick={() => askConfirm({ title: "强制关闭需求", description: "关闭后不可撤销，发单方和 OPC 均会收到通知。", confirmLabel: "强制关闭", confirmVariant: "destructive", onConfirm: () => actionMut.mutate({ action: "forceClose" }) })}
                    disabled={actionMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-colors border border-red-200"
                  >
                    <XCircle size={13} /> 强制关闭
                  </button>
                )}
                {d.status === "refund_pending" && (
                  <>
                    <button
                      onClick={() => askConfirm({ title: "批准退款申请", description: "确认后将向发布方发起退款，此操作不可撤销。", confirmLabel: "批准退款", confirmVariant: "default", onConfirm: () => approveRefundMut.mutate() })}
                      disabled={approveRefundMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                    >
                      {approveRefundMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={13} />} 批准退款
                    </button>
                    <button
                      onClick={() => { setShowRefundRejectForm(v => !v); setShowRejectForm(false); }}
                      disabled={rejectRefundMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <XCircle size={13} /> 拒绝退款
                    </button>
                  </>
                )}
                {d.status === "refunding" && d.payment?.method === "offline" && (
                  <button
                    onClick={() => setShowOfflineRefundForm(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    <CheckCircle2 size={13} /> 确认线下退款
                  </button>
                )}
              </div>
            )}
            {/* ── Reject review inline form ── */}
            {showRejectForm && (
              <div className="px-6 py-4 bg-red-50 border-b border-red-100 space-y-2">
                <p className="text-xs font-bold text-red-700">填写审核不通过原因</p>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="请说明不通过原因，将通知发单方…"
                  rows={2}
                  className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 bg-white resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowRejectForm(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
                  <button
                    onClick={() => { if (rejectReason.trim()) actionMut.mutate({ action: "reject", reason: rejectReason.trim() }); }}
                    disabled={!rejectReason.trim() || actionMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-red-700 transition-colors"
                  >
                    {actionMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />} 确认不通过
                  </button>
                </div>
              </div>
            )}
            {/* ── Reject refund inline form ── */}
            {showRefundRejectForm && (
              <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 space-y-2">
                <p className="text-xs font-bold text-orange-700">填写拒绝退款原因（将通过站内信和邮件通知发单方）</p>
                <textarea
                  value={refundRejectReason}
                  onChange={e => setRefundRejectReason(e.target.value)}
                  placeholder="请说明拒绝退款的原因…"
                  rows={2}
                  className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200 bg-white resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowRefundRejectForm(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
                  <button
                    onClick={() => { if (refundRejectReason.trim()) rejectRefundMut.mutate(refundRejectReason.trim()); }}
                    disabled={!refundRejectReason.trim() || rejectRefundMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-red-700 transition-colors"
                  >
                    {rejectRefundMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />} 确认拒绝退款
                  </button>
                </div>
              </div>
            )}
            {/* ── Offline refund confirmation form ── */}
            {showOfflineRefundForm && (
              <div className="px-6 py-4 bg-emerald-50 border-b border-emerald-100 space-y-2">
                <p className="text-xs font-bold text-emerald-700">上传线下退款凭证以确认退款完成</p>
                {offlineRefundReceiptUrl ? (
                  <img src={offlineRefundReceiptUrl} alt="退款凭证" className="max-h-32 rounded-xl border border-emerald-200" />
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-emerald-200 rounded-xl px-4 py-3 hover:bg-emerald-100/50 transition-colors">
                    {offlineRefundUploading ? <Loader2 size={14} className="animate-spin text-emerald-500" /> : <Upload size={14} className="text-emerald-500" />}
                    <span className="text-xs text-emerald-700">{offlineRefundUploading ? "上传中…" : "点击上传凭证图片"}</span>
                    <input type="file" accept="image/*" className="hidden" disabled={offlineRefundUploading}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleRefundReceiptUpload(f); }} />
                  </label>
                )}
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowOfflineRefundForm(false); setOfflineRefundReceiptUrl(""); }} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
                  <button
                    onClick={() => { if (offlineRefundReceiptUrl) confirmOfflineRefundMut.mutate(offlineRefundReceiptUrl); }}
                    disabled={!offlineRefundReceiptUrl || confirmOfflineRefundMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-emerald-700 transition-colors"
                  >
                    {confirmOfflineRefundMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />} 确认退款完成
                  </button>
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Title */}
            <div>
              <div className="flex items-start gap-2 flex-wrap">
                <h3 className="text-lg font-extrabold text-blue-900 leading-tight">{d.title}</h3>
                {d.isUrgent && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full">紧急</span>}
              </div>
              <p className="text-xs text-slate-400 mt-1 font-mono">{d.demandNo}</p>
            </div>

            {/* Publisher contact */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">发单方信息</p>
              <div className="space-y-1.5 text-sm mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-14 shrink-0">用户名</span>
                  <span className="font-bold text-blue-900">{d.publisherName}</span>
                </div>
                {d.publisherEmail && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-14 shrink-0">邮箱</span>
                    <span className="text-slate-700 break-all">{d.publisherEmail}</span>
                  </div>
                )}
                {d.publisherPhone && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 w-14 shrink-0">手机号</span>
                    <span className="text-slate-700">{d.publisherPhone}</span>
                  </div>
                )}
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowEmailForm(!showEmailForm); setShowNotifyForm(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-colors"
                >
                  <Mail size={12} /> 发邮件
                </button>
                <button
                  onClick={() => { setShowNotifyForm(!showNotifyForm); setShowEmailForm(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/10 text-secondary rounded-lg text-xs font-bold hover:bg-secondary/20 transition-colors"
                >
                  <Bell size={12} /> 发站内信
                </button>
              </div>
              {/* Inline email form */}
              {showEmailForm && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                  <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                    placeholder="邮件主题" className={inputCls} />
                  <textarea value={emailContent} onChange={e => setEmailContent(e.target.value)}
                    placeholder="邮件内容…" rows={3} className={`${inputCls} resize-none`} />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowEmailForm(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
                    <button
                      onClick={() => emailMut.mutate()}
                      disabled={!emailSubject.trim() || !emailContent.trim() || emailMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-primary/90 transition-colors"
                    >
                      {emailMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                      发送
                    </button>
                  </div>
                </div>
              )}
              {/* Inline notify form */}
              {showNotifyForm && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                  <input value={notifyTitle} onChange={e => setNotifyTitle(e.target.value)}
                    placeholder="消息标题" className={inputCls} />
                  <textarea value={notifyContent} onChange={e => setNotifyContent(e.target.value)}
                    placeholder="消息内容…" rows={3} className={`${inputCls} resize-none`} />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowNotifyForm(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
                    <button
                      onClick={() => notifyMut.mutate()}
                      disabled={!notifyTitle.trim() || !notifyContent.trim() || notifyMut.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-secondary/90 transition-colors"
                    >
                      {notifyMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
                      发送
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Rejection reason banner */}
            {d.rejectionReason && (
              <div className="border border-red-200 bg-red-50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle size={14} className="text-destructive shrink-0" />
                  <p className="text-xs font-bold text-destructive">审核不通过原因</p>
                </div>
                <p className="text-sm text-red-800 whitespace-pre-wrap leading-relaxed">{d.rejectionReason}</p>
              </div>
            )}

            {/* Demand meta grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-0.5">状态</p>
                <p className="font-bold text-blue-900">{statusCN[d.status] ?? d.status}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-0.5">发布模式</p>
                <p className="font-bold text-blue-900">{d.mode === "open" ? "公开抢单" : "定向派单"}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-0.5">需求类型</p>
                <p className="font-bold text-blue-900">{DEMAND_TYPE_CN[d.type] ?? d.type}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-0.5">OPC等级要求</p>
                <p className="font-bold text-blue-900">{d.opcLevel === "any" ? "不限" : `${d.opcLevel} 级及以上`}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-0.5">预算范围</p>
                <p className="font-bold text-blue-900">{formatBudget(d.budgetMin, d.budgetMax, d.budget)}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-0.5">交付截止</p>
                <p className="font-bold text-blue-900">{d.deadline ? new Date(d.deadline).toLocaleDateString("zh-CN") : "—"}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-400 mb-0.5">发布时间</p>
                <p className="font-bold text-blue-900">{new Date(d.createdAt).toLocaleDateString("zh-CN")}</p>
              </div>
            </div>

            {d.skillTags?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 mb-2">技能标签</p>
                <div className="flex flex-wrap gap-1.5">
                  {d.skillTags.map(t => (
                    <span key={t} className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full">{t}</span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-slate-400 mb-2">需求描述</p>
              <div className="bg-slate-50 rounded-xl p-4">
                <MarkdownContent content={d.description} className="text-sm" />
              </div>
            </div>
            {d.milestones && d.milestones.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 mb-2">里程碑节点（{d.milestones.length} 个）</p>
                <div className="space-y-2">
                  {d.milestones.map((m, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0 mt-0.5">{i + 1}</div>
                      <div>
                        <p className="text-sm font-bold text-blue-900">{m.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">截止：{m.deadline ? new Date(m.deadline).toLocaleDateString("zh-CN") : "—"}</p>
                        {m.deliverableDesc && <p className="text-xs text-slate-500 mt-0.5">{m.deliverableDesc}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {d.attachments && d.attachments.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 mb-2">附件（{d.attachments.length} 个）</p>
                <div className="space-y-1.5">
                  {d.attachments.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl text-xs text-blue-700 hover:bg-blue-50 transition-colors">
                      <FileText size={13} />{a.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* ── Refund info ── */}
            {d.payment && ["refund_pending", "refunding", "refunded"].includes(d.status) && (
              <div className="border border-orange-200 rounded-xl p-4 bg-orange-50/50">
                <p className="text-xs font-bold text-orange-600 mb-3 uppercase tracking-wider">退款信息</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 w-20 shrink-0">退款状态</span>
                    <span className={`font-bold ${d.status === "refunded" ? "text-emerald-600" : "text-orange-600"}`}>
                      {statusCN[d.status] ?? d.status}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-slate-400 w-20 shrink-0">支付方式</span>
                    <span className="font-bold text-blue-900">{d.payment.method === "online" ? "在线支付" : "线下转账"}</span>
                  </div>
                  {d.payment.amount != null && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-400 w-20 shrink-0">退款金额</span>
                      <span className="font-bold text-blue-900">¥{(d.payment.amount / 100).toLocaleString()}</span>
                    </div>
                  )}
                  {d.payment.refundReason && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-400 w-20 shrink-0">退款原因</span>
                      <span className="text-slate-700">{d.payment.refundReason}</span>
                    </div>
                  )}
                  {d.payment.refundRequestedAt && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-400 w-20 shrink-0">申请时间</span>
                      <span className="text-slate-700">{new Date(d.payment.refundRequestedAt).toLocaleString("zh-CN")}</span>
                    </div>
                  )}
                  {d.payment.refundRejectReason && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-400 w-20 shrink-0">拒绝原因</span>
                      <span className="text-red-600">{d.payment.refundRejectReason}</span>
                    </div>
                  )}
                  {d.payment.refundOrderNo && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-400 w-20 shrink-0">退款单号</span>
                      <span className="font-mono text-xs text-slate-700 break-all">{d.payment.refundOrderNo}</span>
                    </div>
                  )}
                  {d.payment.refundedAt && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-400 w-20 shrink-0">退款完成时间</span>
                      <span className="text-emerald-600 font-bold">{new Date(d.payment.refundedAt).toLocaleString("zh-CN")}</span>
                    </div>
                  )}
                  {d.payment.refundReceiptUrl && (
                    <div className="flex items-start gap-2">
                      <span className="text-slate-400 w-20 shrink-0">退款凭证</span>
                      <a href={d.payment.refundReceiptUrl} target="_blank" rel="noreferrer" className="text-blue-700 underline text-xs break-all">
                        查看凭证
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          </div>
        )}
      </div>
      {confirmDialog}
    </div>
  );
}

function DemandManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm, confirmDialog } = useConfirm();
  const [detailId, setDetailId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { q, qInput, setQInput, filter, page, pageSize, setPage, setPageSize, commitSearch, clearSearch, applyFilter } = useAdminListState("all");

  const { data: resp, isLoading } = useQuery<PagedResp<AdminDemand>>({
    queryKey: ["admin-demands", filter, q, page, pageSize],
    queryFn: () => adminGet(`/api/admin/demands?status=${filter === "all" ? "" : filter}&q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`),
  });
  const demands = resp?.data ?? [];

  const mutate = useMutation({
    mutationFn: ({ id, action, reason }: { id: number; action: string; reason?: string }) =>
      adminPatch(`/api/admin/demands/${id}`, { action, reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-demands"] }); toast({ title: "操作成功" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const STATUS_FILTERS = [
    { val: "all", label: "全部" },
    { val: "pending_review", label: "待审核" },
    { val: "pending_payment", label: "待缴保证金" },
    { val: "published", label: "已发布" },
    { val: "in_progress", label: "进行中" },
    { val: "completed", label: "已完成" },
    { val: "closed", label: "已关闭" },
    { val: "refund_pending", label: "退款审核中" },
    { val: "refunding", label: "退款中" },
    { val: "refunded", label: "已退款" },
  ];

  const statusCN: Record<string, string> = {
    draft: "草稿", pending_review: "待审核", pending_payment: "待缴保证金", published: "已发布",
    matched: "已匹配", in_progress: "进行中", pending_acceptance: "待验收",
    completed: "已完成", closed: "已关闭",
    refund_pending: "退款审核中", refunding: "退款中", refunded: "已退款",
  };
  const statusColor = (s: string) => ({
    pending_review: "bg-amber-100 text-amber-700",
    pending_payment: "bg-orange-100 text-orange-700",
    published: "bg-blue-100 text-blue-700",
    in_progress: "bg-indigo-100 text-indigo-700",
    completed: "bg-green-100 text-green-700",
    closed: "bg-slate-100 text-slate-500",
    matched: "bg-purple-100 text-purple-700",
    refund_pending: "bg-rose-100 text-rose-700",
    refunding: "bg-rose-200 text-rose-800",
    refunded: "bg-emerald-100 text-emerald-700",
  }[s] ?? "bg-slate-100 text-slate-500");

  return (
    <div className="space-y-6">
      <SectionHeader title="需求管理" sub="需求审核、状态变更、强制关闭、紧急标记" />
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.val} onClick={() => applyFilter(f.val)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === f.val ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {f.label}
          </button>
        ))}
        <form onSubmit={e => { e.preventDefault(); commitSearch(); }} className="flex items-center gap-1 ml-auto">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={qInput} onChange={e => setQInput(e.target.value)} placeholder="搜索标题/需求编号…"
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 w-44" />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">搜索</button>
          {q && <button type="button" onClick={clearSearch} className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs transition-colors">×</button>}
        </form>
      </div>
      <TableShell headers={["需求标题", "编号", "发单方", "预算", "创建日期", "状态", "操作"]}>
        {isLoading ? <LoadingRow cols={7} /> : demands.length === 0 ? <EmptyRow cols={7} /> :
          demands.map(d => (
            <tr key={d.id} className="hover:bg-slate-50/60 transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDetailId(d.id)}
                    className="font-bold text-sm text-blue-900 hover:text-primary hover:underline text-left"
                  >{d.title}</button>
                  {d.isUrgent && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full animate-pulse">紧急</span>}
                </div>
              </td>
              <td className="px-6 py-4 font-mono text-xs text-slate-400">{d.demandNo}</td>
              <td className="px-6 py-4 text-sm text-slate-500">{d.publisherName}</td>
              <td className="px-6 py-4 font-bold text-sm text-blue-900">{formatBudget(d.budgetMin, d.budgetMax, d.budget)}</td>
              <td className="px-6 py-4 text-xs text-slate-400">{new Date(d.createdAt).toLocaleDateString("zh-CN")}</td>
              <td className="px-6 py-4"><StatusBadge label={statusCN[d.status] ?? d.status} color={statusColor(d.status)} /></td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1">
                  <button onClick={() => setDetailId(d.id)}
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
                    <button onClick={() => { setRejectingId(d.id); setRejectReason(""); }}
                      title="审核不通过" className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-destructive transition-colors">
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
                      onClick={() => askConfirm({ title: `退回需求「${d.title}」到草稿`, description: "发单方将需要重新提交审核。", confirmLabel: "确认退回", confirmVariant: "default", onConfirm: () => mutate.mutate({ id: d.id, action: "revertToDraft" }) })}
                      title="退回编辑"
                      className="p-2 rounded-xl hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors">
                      <RotateCcw size={15} />
                    </button>
                  )}
                  {d.status !== "closed" && d.status !== "completed" && (
                    <button onClick={() => askConfirm({ title: "强制关闭需求", description: "关闭后不可撤销，相关方均会收到通知。", confirmLabel: "强制关闭", confirmVariant: "destructive", onConfirm: () => mutate.mutate({ id: d.id, action: "forceClose" }) })}
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
      <AdminPagination page={page} pageSize={pageSize} total={resp?.total ?? 0} onPage={setPage} onPageSize={setPageSize} />
      {detailId !== null && <AdminDemandDetailPanel id={detailId} onClose={() => setDetailId(null)} />}

      {/* Reject reason dialog */}
      {rejectingId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setRejectingId(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <XCircle size={20} className="text-destructive" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-blue-900">审核不通过</h3>
                <p className="text-xs text-slate-400">请填写不通过原因，系统将同步通知发单方</p>
              </div>
            </div>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="请填写审核不通过的原因，便于发单方参考修改后重新提交…"
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-destructive/20 focus:border-destructive/50 resize-none transition"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setRejectingId(null)} className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">取消</button>
              <button
                onClick={() => {
                  if (!rejectReason.trim()) return;
                  mutate.mutate({ id: rejectingId, action: "reject", reason: rejectReason });
                  setRejectingId(null);
                  setRejectReason("");
                }}
                disabled={!rejectReason.trim() || mutate.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-destructive text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-destructive/90 transition-colors"
              >
                {mutate.isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                确认不通过
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmDialog}
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
  paymentMethod?: string | null;
  paymentReceiptUrl?: string | null;
  paymentRejectReason?: string | null;
}

function OrderManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm, confirmDialog } = useConfirm();
  const { q, qInput, setQInput, filter, page, pageSize, setPage, setPageSize, commitSearch, clearSearch, applyFilter } = useAdminListState("all");

  const [rejectOrderId, setRejectOrderId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: resp, isLoading } = useQuery<PagedResp<AdminOrder>>({
    queryKey: ["admin-orders", filter, q, page, pageSize],
    queryFn: () => adminGet(`/api/admin/orders?status=${filter === "all" ? "" : filter}&q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`),
  });
  const orders = resp?.data ?? [];

  // Pending offline payment receipt orders
  const { data: pendingPayResp, refetch: refetchPendingPay } = useQuery<PagedResp<AdminOrder>>({
    queryKey: ["admin-orders-pending-pay"],
    queryFn: () => adminGet(`/api/admin/orders?status=pending_payment&pageSize=50`),
    refetchInterval: 30000,
  });
  const pendingPayOrders = (pendingPayResp?.data ?? []).filter(o => o.paymentMethod === "offline" && o.paymentReceiptUrl);

  const confirmPayMut = useMutation({
    mutationFn: (orderId: number) => adminPost(`/api/admin/orders/${orderId}/confirm-payment`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders-pending-pay"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "已确认收款", description: "订单正式开始，OPC 和发单方均已收到通知" });
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const rejectPayMut = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: number; reason: string }) =>
      adminPost(`/api/admin/orders/${orderId}/reject-payment`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-orders-pending-pay"] });
      setRejectOrderId(null);
      setRejectReason("");
      toast({ title: "已拒绝凭证", description: "已通知发单方重新提交付款凭证" });
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const mutate = useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      adminPatch(`/api/admin/orders/${id}`, { action }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-orders"] }); toast({ title: "操作成功" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const STATUS_FILTERS = [
    { val: "all", label: "全部" }, { val: "pending_payment", label: "待付款" },
    { val: "in_progress", label: "进行中" },
    { val: "disputed", label: "争议中" }, { val: "pending_acceptance", label: "待验收" },
    { val: "completed", label: "已完成" },
  ];

  const statusCN: Record<string, string> = {
    pending_payment: "待付款",
    in_progress: "进行中", pending_acceptance: "待验收",
    completed: "已完成", closed: "已关闭", disputed: "争议中",
  };
  const statusColor = (s: string) => ({
    pending_payment: "bg-orange-100 text-orange-700",
    in_progress: "bg-blue-100 text-blue-700",
    disputed: "bg-red-100 text-red-700",
    pending_acceptance: "bg-purple-100 text-purple-700",
    completed: "bg-green-100 text-green-700",
    closed: "bg-slate-100 text-slate-500",
  }[s] ?? "bg-slate-100 text-slate-500");

  return (
    <div className="space-y-6">
      {confirmDialog}

      {/* Reject payment dialog */}
      {rejectOrderId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4">
            <h3 className="text-base font-bold text-slate-800">拒绝付款凭证</h3>
            <p className="text-sm text-slate-500">请填写拒绝原因，发单方将收到通知并可重新提交凭证。</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="例：转账金额不符、截图模糊无法核验…"
              rows={3}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-red-200 resize-none"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setRejectOrderId(null); setRejectReason(""); }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => rejectPayMut.mutate({ orderId: rejectOrderId, reason: rejectReason.trim() || "凭证审核未通过" })}
                disabled={rejectPayMut.isPending}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {rejectPayMut.isPending ? "提交中…" : "确认拒绝"}
              </button>
            </div>
          </div>
        </div>
      )}

      <SectionHeader title="订单管理" sub="订单全生命周期跟踪、争议介入、强制结算" />

      {/* ── 待审核付款凭证 ── */}
      {pendingPayOrders.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-orange-700">待审核付款凭证</span>
            <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">{pendingPayOrders.length}</span>
            <button onClick={() => refetchPendingPay()} className="ml-auto text-xs text-slate-400 hover:text-slate-600 transition-colors">刷新</button>
          </div>
          <div className="grid gap-3">
            {pendingPayOrders.map(o => (
              <div key={o.id} className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex flex-wrap gap-4 items-start">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-primary">{o.orderNo}</span>
                    <span className="text-xs text-slate-500">{o.publisherName}</span>
                    <span className="text-xs text-slate-400">→</span>
                    <span className="text-xs text-slate-600">{o.opcName}</span>
                  </div>
                  <p className="text-sm text-slate-700 font-medium line-clamp-1">{o.demandTitle}</p>
                  <p className="text-sm font-bold text-blue-900">¥{o.amount?.toLocaleString()}</p>
                </div>
                {o.paymentReceiptUrl && (
                  <a href={o.paymentReceiptUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                    <img
                      src={o.paymentReceiptUrl}
                      alt="付款凭证"
                      className="w-24 h-24 object-contain rounded-xl border border-orange-200 bg-white hover:opacity-90 transition-opacity cursor-zoom-in"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </a>
                )}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => askConfirm({
                      title: "确认收款",
                      description: `确认已到账 ¥${o.amount?.toLocaleString()}？订单将正式开始，双方均会收到通知。`,
                      confirmLabel: "确认收款",
                      confirmVariant: "default",
                      onConfirm: () => confirmPayMut.mutate(o.id),
                    })}
                    disabled={confirmPayMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle2 size={13} />
                    确认收款
                  </button>
                  <button
                    onClick={() => { setRejectOrderId(o.id); setRejectReason(""); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-700 text-xs font-bold rounded-xl hover:bg-red-200 transition-colors"
                  >
                    <X size={13} />
                    拒绝凭证
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.val} onClick={() => applyFilter(f.val)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === f.val ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {f.label}
          </button>
        ))}
        <form onSubmit={e => { e.preventDefault(); commitSearch(); }} className="flex items-center gap-1 ml-auto">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={qInput} onChange={e => setQInput(e.target.value)} placeholder="搜索订单号/需求/OPC…"
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 w-44" />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">搜索</button>
          {q && <button type="button" onClick={clearSearch} className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs transition-colors">×</button>}
        </form>
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
                    <button onClick={() => askConfirm({ title: "强制结算订单", description: "结算后不可撤销，OPC 和发单方均会收到通知。", confirmLabel: "强制结算", confirmVariant: "default", onConfirm: () => mutate.mutate({ id: o.id, action: "forceSettle" }) })}
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
      <AdminPagination page={page} pageSize={pageSize} total={resp?.total ?? 0} onPage={setPage} onPageSize={setPageSize} />
      {confirmDialog}
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
  transactionsTotal: number;
  transactionsPage: number;
  transactionsPageSize: number;
}

function FinanceManagement() {
  const { filter: txStatus, page, pageSize, setPage, setPageSize, applyFilter } = useAdminListState("all");

  const { data, isLoading } = useQuery<FinanceData>({
    queryKey: ["admin-finance", txStatus, page, pageSize],
    queryFn: () => adminGet(`/api/admin/finance?status=${txStatus === "all" ? "" : txStatus}&page=${page}&pageSize=${pageSize}`),
  });

  const stats = data ? [
    { label: "累计已结算",  value: `¥${data.totalSettled.toLocaleString()}`,  icon: Wallet },
    { label: "平台手续费",  value: `¥${data.platformFee.toLocaleString()}`,   icon: CreditCard },
    { label: "托管中金额",  value: `¥${data.pendingEscrow.toLocaleString()}`, icon: Activity },
    { label: "OPC 总分润",  value: `¥${data.opcShare.toLocaleString()}`,      icon: Receipt, accent: true },
  ] : [];

  const statusColor = (s: string) => ({
    pending_payment: "bg-orange-100 text-orange-700",
    completed: "bg-green-100 text-green-700",
    in_progress: "bg-amber-100 text-amber-700",
    pending_acceptance: "bg-blue-100 text-blue-700",
    closed: "bg-slate-100 text-slate-500",
  }[s] ?? "bg-slate-100 text-slate-500");
  const statusCN: Record<string, string> = { pending_payment: "待付款", completed: "已完成", in_progress: "进行中", pending_acceptance: "待验收", closed: "已关闭", disputed: "争议中" };

  const TX_FILTERS = [
    { val: "all", label: "全部" }, { val: "completed", label: "已完成" },
    { val: "in_progress", label: "进行中" }, { val: "pending_acceptance", label: "待验收" },
    { val: "disputed", label: "争议中" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="财务管理" sub="分成结算报表、资金流水、对账报表" />
      {isLoading && !data ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={32} className="animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            {stats.map(s => <StatCard key={s.label} {...s} />)}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {TX_FILTERS.map(f => (
              <button key={f.val} onClick={() => applyFilter(f.val)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${txStatus === f.val ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                {f.label}
              </button>
            ))}
          </div>
          <TableShell headers={["订单号", "OPC 接单方", "发单方", "订单金额", "OPC 分润", "平台费", "日期", "状态"]}>
            {isLoading ? <LoadingRow cols={8} /> :
              (data?.transactions ?? []).length === 0 ? <EmptyRow cols={8} /> :
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
          <AdminPagination page={page} pageSize={pageSize} total={data?.transactionsTotal ?? 0} onPage={setPage} onPageSize={setPageSize} />
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
  const { q, qInput, setQInput, level: levelFilter, page, pageSize, setPage, setPageSize, commitSearch, clearSearch, applyLevel } = useAdminListState("all", "all");

  const { data: resp, isLoading } = useQuery<PagedResp<OpcEcoItem>>({
    queryKey: ["admin-ecosystem", q, levelFilter, page, pageSize],
    queryFn: () => adminGet(`/api/admin/ecosystem?q=${encodeURIComponent(q)}&level=${levelFilter === "all" ? "" : levelFilter}&page=${page}&pageSize=${pageSize}`),
  });
  const opcs = resp?.data ?? [];

  const mutate = useMutation({
    mutationFn: ({ id, action, value }: { id: number; action: string; value?: string | number }) =>
      adminPatch(`/api/admin/ecosystem/${id}`, { action, value }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-ecosystem"] }); toast({ title: "操作成功" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const [pendingLevel, setPendingLevel] = useState<Record<number, string>>({});

  const LEVEL_FILTERS = [
    { val: "all", label: "全部" }, { val: "A", label: "A 级" },
    { val: "B", label: "B 级" }, { val: "C", label: "C 级" }, { val: "newbie", label: "新手" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="OPC 生态池管理" sub="能力标签管理、信用分调整、升降级审批、生态池数据统计" />
      <div className="grid grid-cols-3 gap-5">
        <StatCard label="生态池总 OPC" value={(resp?.total ?? 0).toString()} icon={Users} />
        <StatCard label="A 级 OPC" value={opcs.filter(o => o.level === "A").length.toString()} icon={ArrowUpRight} />
        <StatCard label="信用分预警 (<3.5)" value={opcs.filter(o => (o.credit_score ?? 5) < 3.5).length.toString()} icon={AlertCircle} accent />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {LEVEL_FILTERS.map(f => (
          <button key={f.val} onClick={() => applyLevel(f.val)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${levelFilter === f.val ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {f.label}
          </button>
        ))}
        <form onSubmit={e => { e.preventDefault(); commitSearch(); }} className="flex items-center gap-1 ml-auto">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={qInput} onChange={e => setQInput(e.target.value)} placeholder="搜索用户名/邮箱…"
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 w-44" />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">搜索</button>
          {q && <button type="button" onClick={clearSearch} className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs transition-colors">×</button>}
        </form>
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
                    value={pendingLevel[o.id] ?? o.level ?? "newbie"}
                    onChange={e => setPendingLevel(prev => ({ ...prev, [o.id]: e.target.value }))}
                    className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {[{ v: "newbie", label: "新手" }, { v: "C", label: "C级·基础" }, { v: "B", label: "B级·进阶" }, { v: "A", label: "A级·专家" }].map(l => <option key={l.v} value={l.v}>{l.label}</option>)}
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
      <AdminPagination page={page} pageSize={pageSize} total={resp?.total ?? 0} onPage={setPage} onPageSize={setPageSize} />
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
  coursesTotal: number;
  coursesPage: number;
  coursesPageSize: number;
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
const PAY_LABEL: Record<string, string> = { free: "免费", pending: "待支付", paid: "已支付", refund_pending: "退款审核中", refunded: "已退款" };
const PAY_COLOR: Record<string, string> = { free: "bg-slate-100 text-slate-500", pending: "bg-amber-100 text-amber-700", paid: "bg-green-100 text-green-700", refund_pending: "bg-orange-100 text-orange-700", refunded: "bg-slate-100 text-slate-500" };

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
  const prevOpen = useRef(false);

  useEffect(() => {
    if (open && !prevOpen.current) {
      setForm(initialForm);
    }
    prevOpen.current = open;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
      const { uploadURL, objectPath, sessionToken } = await reqRes.json();
      const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("文件上传失败");
      const verifyRes = await fetch(`${BASE}/api/storage/uploads/verify`, {
        method: "POST", headers: getAdminHeaders(),
        body: JSON.stringify({ sessionToken }),
      });
      if (!verifyRes.ok) throw new Error("文件验证失败");
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
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">课纲文件（PDF / Word / PPT / Excel）</label>
            <input ref={r => { fileRef.current = r; }} type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.key,.pages,.numbers,.odp,.odt,.ods"
              className="hidden"
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

function BulkEmailModal({ courseId, onClose }: { courseId: number; onClose: () => void }) {
  const { toast } = useToast();
  const [subject, setSubject]             = useState("");
  const [body, setBody]                   = useState("");
  const [filterNames, setFilterNames]     = useState("");
  const [filterStatus, setFilterStatus]   = useState("all");

  const sendMutation = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/admin/training/courses/${courseId}/bulk-email`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ subject, body, filterNames, filterPaymentStatus: filterStatus }),
      }).then(async r => {
        const text = await r.text();
        let data: any;
        try { data = JSON.parse(text); } catch { throw new Error("服务器返回异常，请稍后重试"); }
        if (!r.ok) throw new Error(data.error ?? "发送失败");
        return data;
      }),
    onSuccess: (data) => {
      if (data.total === 0) {
        toast({ title: "没有符合条件的学员", description: "请调整过滤条件后重试", variant: "destructive" });
      } else {
        toast({ title: "群发任务已启动", description: `共 ${data.total} 位收件人，正在后台发送，结果将记录到系统日志` });
        onClose();
      }
    },
    onError: (e: Error) => toast({ title: "发送失败", description: e.message, variant: "destructive" }),
  });

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sendMutation.isPending;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Mail size={18} className="text-primary" /> 群发邮件</h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">邮件主题 <span className="text-red-500">*</span></label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="请输入邮件主题"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">邮件正文 <span className="text-red-500">*</span></label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="请输入邮件正文内容…"
              rows={6}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition resize-none"
            />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">过滤条件（不填即发送全部）</p>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">学员名称</label>
              <input
                value={filterNames}
                onChange={e => setFilterNames(e.target.value)}
                placeholder="多个名称用逗号隔开，如：张三,李四"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">支付状态</label>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition"
              >
                <option value="all">全部</option>
                <option value="paid">已支付</option>
                <option value="pending">待支付</option>
                <option value="free">免费</option>
                <option value="refund_pending">退款审核中</option>
                <option value="refunded">已退款</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100 transition-colors">取消</button>
          <button
            onClick={() => sendMutation.mutate()}
            disabled={!canSend}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {sendMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
            {sendMutation.isPending ? "发送中…" : "发送邮件"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EnrollmentPanel({ course, onClose }: { course: AdminCourse; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showBulkEmail, setShowBulkEmail] = useState(false);

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
    <>
      {showBulkEmail && <BulkEmailModal courseId={course.id} onClose={() => setShowBulkEmail(false)} />}
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">报名管理 · {course.title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">共 {enrollments.length} 人报名</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkEmail(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-bold hover:bg-primary/20 transition-colors"
            >
              <Mail size={15} /> 群发邮件
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
          </div>
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
    </>
  );
}

/* ─── Course Refund Management ─────────────────── */

type CourseRefundRow = {
  id: number;
  courseId: number;
  courseTitle: string | null;
  courseCategory: string | null;
  coursePrice: number | null;
  userId: number;
  userNickname: string | null;
  userEmail: string | null;
  paymentStatus: string;
  paymentOrderNo: string | null;
  refundReason: string | null;
  refundRequestedAt: string | null;
  refundRejectReason: string | null;
  createdAt: string;
};

function CourseRefundManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [rejectModal, setRejectModal] = useState<{ id: number; courseTitle: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: refunds = [], isLoading } = useQuery<CourseRefundRow[]>({
    queryKey: ["admin-course-refunds"],
    queryFn: () => adminGet("/api/admin/training/refunds"),
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => adminPost(`/api/admin/training/enrollments/${id}/approve-refund`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-course-refunds"] });
      toast({ title: "退款已批准", description: "已自动向支付平台发起退款" });
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      adminPost(`/api/admin/training/enrollments/${id}/reject-refund`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-course-refunds"] });
      setRejectModal(null);
      setRejectReason("");
      toast({ title: "退款已拒绝", description: "已通知用户" });
    },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-slate-600">退款审核中的课程报名</span>
        {refunds.length > 0 && (
          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">{refunds.length}</span>
        )}
      </div>

      <TableShell headers={["课程", "用户", "金额", "退款原因", "申请时间", "操作"]}>
        {isLoading ? <LoadingRow cols={6} /> : refunds.length === 0 ? (
          <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400 text-sm">暂无待审核的退款申请</td></tr>
        ) : refunds.map(r => (
          <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
            <td className="px-5 py-4">
              <div className="font-bold text-sm text-slate-800 line-clamp-1 max-w-[200px]">{r.courseTitle ?? `课程 #${r.courseId}`}</div>
              <div className="text-xs text-slate-400">{r.courseCategory ?? ""}</div>
            </td>
            <td className="px-5 py-4">
              <div className="text-sm font-semibold text-slate-700">{r.userNickname ?? "-"}</div>
              <div className="text-xs text-slate-400">{r.userEmail ?? ""}</div>
            </td>
            <td className="px-5 py-4">
              <span className="text-sm font-extrabold text-primary">
                ¥{(r.coursePrice ?? 0).toFixed(0)}
              </span>
            </td>
            <td className="px-5 py-4 max-w-[200px]">
              <p className="text-xs text-slate-600 line-clamp-2">{r.refundReason ?? "-"}</p>
            </td>
            <td className="px-5 py-4 text-xs text-slate-500">
              {r.refundRequestedAt ? new Date(r.refundRequestedAt).toLocaleString("zh-CN") : "-"}
            </td>
            <td className="px-5 py-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => approveMutation.mutate(r.id)}
                  disabled={approveMutation.isPending}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  <Check size={13} /> 批准退款
                </button>
                <button
                  onClick={() => { setRejectModal({ id: r.id, courseTitle: r.courseTitle ?? `课程 #${r.courseId}` }); setRejectReason(""); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                >
                  <XCircle size={13} /> 拒绝
                </button>
              </div>
            </td>
          </tr>
        ))}
      </TableShell>

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">拒绝退款申请</h3>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{rejectModal.courseTitle}</p>
              </div>
              <button onClick={() => setRejectModal(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">拒绝原因（将通知用户）</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="请输入拒绝原因…"
                  rows={4}
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400 transition-colors"
                />
              </div>
              <div className="flex items-center gap-3 justify-end">
                <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">取消</button>
                <button
                  onClick={() => { if (rejectReason.trim()) rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason.trim() }); }}
                  disabled={!rejectReason.trim() || rejectMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white font-bold text-sm rounded-xl hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  {rejectMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                  确认拒绝
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type DemandRefundItem = {
  id: number;
  demandNo: string;
  title: string;
  status: string;
  budget: number;
  publisherName: string;
  publisherEmail: string | null;
  updatedAt: string;
  payment: {
    id: number;
    method: "online" | "offline";
    amount: number;
    refundReason: string | null;
    refundRequestedAt: string | null;
    refundRejectReason: string | null;
    refundReceiptUrl: string | null;
    refundOrderNo: string | null;
    refundedAt: string | null;
  } | null;
};

function DemandRefundManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("refund_pending");
  const [rejectModal, setRejectModal] = useState<DemandRefundItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [offlineReceiptModal, setOfflineReceiptModal] = useState<DemandRefundItem | null>(null);
  const [offlineReceipt, setOfflineReceipt] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const { data: resp, isLoading } = useQuery<{ data: DemandRefundItem[]; total: number }>({
    queryKey: ["admin-demand-refunds", statusFilter],
    queryFn: () => adminGet(`/api/admin/demand-refunds?status=${statusFilter}&pageSize=50`),
    refetchInterval: 30_000,
  });
  const items = resp?.data ?? [];

  const approveMut = useMutation({
    mutationFn: (id: number) => adminPost(`/api/admin/demands/${id}/approve-refund`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-demand-refunds"] }); toast({ title: "退款已批准", description: "系统已自动处理退款流程" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => adminPost(`/api/admin/demands/${id}/reject-refund`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-demand-refunds"] }); setRejectModal(null); setRejectReason(""); toast({ title: "退款已拒绝", description: "已通知发单方" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const confirmOfflineMut = useMutation({
    mutationFn: ({ id, url }: { id: number; url: string }) => adminPost(`/api/admin/demands/${id}/confirm-offline-refund`, { refundReceiptUrl: url }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-demand-refunds"] }); setOfflineReceiptModal(null); setOfflineReceipt(""); toast({ title: "线下退款已确认", description: "已通知发单方退款完成" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const handleReceiptUpload = async (file: File) => {
    setUploadingReceipt(true);
    try {
      const reqRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!reqRes.ok) throw new Error("上传请求失败");
      const { uploadURL, objectPath, sessionToken } = await reqRes.json();
      const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("文件上传失败");
      const verifyRes = await fetch(`${BASE}/api/storage/uploads/verify`, {
        method: "POST", headers: getAdminHeaders(),
        body: JSON.stringify({ sessionToken }),
      });
      if (!verifyRes.ok) throw new Error("文件验证失败");
      setOfflineReceipt(`${BASE}/api/storage${objectPath}`);
      toast({ title: "凭证上传成功" });
    } catch (err: any) {
      toast({ title: "上传失败", description: err.message, variant: "destructive" });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const STATUS_TABS = [
    { val: "refund_pending", label: "待审核" },
    { val: "refunding", label: "退款中" },
    { val: "refunded", label: "已退款" },
    { val: "all", label: "全部" },
  ];

  const statusBadge = (s: string) => ({
    refund_pending: "bg-rose-100 text-rose-700",
    refunding: "bg-indigo-100 text-indigo-700",
    refunded: "bg-emerald-100 text-emerald-700",
  }[s] ?? "bg-slate-100 text-slate-500");

  const statusLabel = (s: string) => ({ refund_pending: "退款审核中", refunding: "退款中", refunded: "已退款" }[s] ?? s);

  return (
    <div className="space-y-4 mt-8">
      <SectionHeader title="需求退款申请" sub="审核发单方的保证金退款申请，批准或拒绝" />
      <div className="flex items-center gap-2">
        {STATUS_TABS.map(t => (
          <button key={t.val} onClick={() => setStatusFilter(t.val)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${statusFilter === t.val ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <TableShell headers={["需求标题", "发单方", "金额", "支付方式", "退款原因", "申请时间", "状态", "操作"]}>
        {isLoading ? <LoadingRow cols={8} /> : items.length === 0 ? (
          <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400 text-sm">暂无退款申请</td></tr>
        ) : items.map(item => (
          <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
            <td className="px-5 py-4">
              <div className="font-bold text-sm text-slate-800 line-clamp-1 max-w-[180px]">{item.title}</div>
              <div className="text-xs text-slate-400 font-mono">{item.demandNo}</div>
            </td>
            <td className="px-5 py-4">
              <div className="text-sm font-semibold text-slate-700">{item.publisherName}</div>
              <div className="text-xs text-slate-400">{item.publisherEmail ?? ""}</div>
            </td>
            <td className="px-5 py-4">
              <span className="text-sm font-extrabold text-primary">¥{(item.payment?.amount ?? item.budget).toLocaleString()}</span>
            </td>
            <td className="px-5 py-4">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.payment?.method === "online" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                {item.payment?.method === "online" ? "在线支付" : "线下转账"}
              </span>
            </td>
            <td className="px-5 py-4 max-w-[160px]">
              <p className="text-xs text-slate-600 line-clamp-2">{item.payment?.refundReason ?? "-"}</p>
            </td>
            <td className="px-5 py-4 text-xs text-slate-500">
              {item.payment?.refundRequestedAt ? new Date(item.payment.refundRequestedAt).toLocaleString("zh-CN") : "-"}
            </td>
            <td className="px-5 py-4">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadge(item.status)}`}>
                {statusLabel(item.status)}
              </span>
            </td>
            <td className="px-5 py-4">
              {item.status === "refund_pending" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approveMut.mutate(item.id)}
                    disabled={approveMut.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    {approveMut.isPending ? <Loader2 size={11} className="animate-spin" /> : <Check size={13} />} 批准退款
                  </button>
                  <button
                    onClick={() => { setRejectModal(item); setRejectReason(""); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                  >
                    <XCircle size={13} /> 拒绝
                  </button>
                </div>
              )}
              {item.status === "refunding" && item.payment?.method === "offline" && (
                <button
                  onClick={() => { setOfflineReceiptModal(item); setOfflineReceipt(""); }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                >
                  <Upload size={13} /> 上传凭证
                </button>
              )}
              {item.status === "refunding" && item.payment?.method === "online" && (
                <span className="text-xs text-slate-400">退款处理中…</span>
              )}
              {item.status === "refunded" && (
                <span className="text-xs text-emerald-600 font-semibold">已完成</span>
              )}
            </td>
          </tr>
        ))}
      </TableShell>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">拒绝退款申请</h3>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{rejectModal.title}</p>
              </div>
              <button onClick={() => setRejectModal(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">拒绝原因（将通过站内信和邮件通知发单方）</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="请说明拒绝退款的原因…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">取消</button>
                <button
                  onClick={() => { if (rejectReason.trim()) rejectMut.mutate({ id: rejectModal.id, reason: rejectReason.trim() }); }}
                  disabled={!rejectReason.trim() || rejectMut.isPending}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-colors"
                >
                  {rejectMut.isPending ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null} 确认拒绝
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline receipt upload modal */}
      {offlineReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOfflineReceiptModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">上传线下退款凭证</h3>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{offlineReceiptModal.title}</p>
              </div>
              <button onClick={() => setOfflineReceiptModal(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1.5">退款凭证图片</label>
                {offlineReceipt ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                    <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                    <span className="text-xs text-green-700 font-semibold flex-1 truncate">凭证已上传</span>
                    <button onClick={() => setOfflineReceipt("")} className="text-xs text-slate-400 hover:text-slate-600">更换</button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-6 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors">
                    {uploadingReceipt ? (
                      <Loader2 size={24} className="text-primary animate-spin" />
                    ) : (
                      <>
                        <Upload size={24} className="text-slate-300" />
                        <span className="text-xs text-slate-400">点击上传退款凭证截图</span>
                      </>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(f); }} />
                  </label>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setOfflineReceiptModal(null)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">取消</button>
                <button
                  onClick={() => { if (offlineReceipt && offlineReceiptModal) confirmOfflineMut.mutate({ id: offlineReceiptModal.id, url: offlineReceipt }); }}
                  disabled={!offlineReceipt || confirmOfflineMut.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {confirmOfflineMut.isPending ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null} 确认退款完成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrainingManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm, confirmDialog } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<AdminCourse | null>(null);
  const [enrollCourse, setEnrollCourse] = useState<AdminCourse | null>(null);
  const [trainingTab, setTrainingTab] = useState<"courses" | "refunds">("courses");
  const { q, qInput, setQInput, filter: courseStatus, level: courseLevel, page, pageSize, setPage, setPageSize, commitSearch, clearSearch, applyFilter: applyStatus, applyLevel } = useAdminListState("all", "all");

  const { data, isLoading } = useQuery<TrainingData>({
    queryKey: ["admin-training", q, courseStatus, courseLevel, page, pageSize],
    queryFn: () => adminGet(`/api/admin/training?q=${encodeURIComponent(q)}&status=${courseStatus === "all" ? "" : courseStatus}&level=${courseLevel === "all" ? "" : courseLevel}&page=${page}&pageSize=${pageSize}`),
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

  const COURSE_STATUS_FILTERS = [
    { val: "all", label: "全部" }, { val: "published", label: "开放中" },
    { val: "draft", label: "草稿" }, { val: "closed", label: "已结课" },
  ];
  const COURSE_LEVEL_FILTERS = [
    { val: "all", label: "全部等级" }, { val: "C", label: "C 级" },
    { val: "B", label: "B 级" }, { val: "A", label: "A 级" },
  ];

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

      {/* Sub-tabs */}
      <div className="flex items-center bg-slate-100 rounded-2xl p-1 gap-1 w-fit">
        <button
          onClick={() => setTrainingTab("courses")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            trainingTab === "courses" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <BookOpen size={14} /> 课程列表
        </button>
        <button
          onClick={() => setTrainingTab("refunds")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            trainingTab === "refunds" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <RotateCcw size={14} /> 退款管理
        </button>
      </div>

      {trainingTab === "refunds" ? (
        <CourseRefundManagement />
      ) : (<>

      <div className="flex items-center gap-2 flex-wrap">
        {COURSE_STATUS_FILTERS.map(f => (
          <button key={f.val} onClick={() => applyStatus(f.val)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${courseStatus === f.val ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {f.label}
          </button>
        ))}
        <span className="text-slate-200">|</span>
        {COURSE_LEVEL_FILTERS.map(f => (
          <button key={f.val} onClick={() => applyLevel(f.val)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${courseLevel === f.val ? "bg-secondary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
            {f.label}
          </button>
        ))}
        <form onSubmit={e => { e.preventDefault(); commitSearch(); }} className="flex items-center gap-1 ml-auto">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={qInput} onChange={e => setQInput(e.target.value)} placeholder="搜索课程名称…"
              className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 w-44" />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">搜索</button>
          {q && <button type="button" onClick={clearSearch} className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs transition-colors">×</button>}
        </form>
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
                  <button onClick={() => askConfirm({ title: `删除课程「${c.title}」`, description: "删除后不可恢复，已报名的学员将失去访问权限。", confirmLabel: "确认删除", confirmVariant: "destructive", onConfirm: () => deleteMutation.mutate(c.id) })} title="删除"
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))
        }
      </TableShell>
      <AdminPagination page={page} pageSize={pageSize} total={data?.coursesTotal ?? 0} onPage={setPage} onPageSize={setPageSize} />

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
      </>)}
      {confirmDialog}
    </div>
  );
}

/* ─── Module: 学习资源管理 ───────────────────────── */

interface LearningResource {
  id: number;
  title: string;
  fileUrl: string;
  fileType: string;
  fileSize: number | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function fileTypeLabel(ft: string) {
  if (ft === "pdf") return "PDF 文档";
  if (ft === "docx" || ft === "doc") return "Word 文档";
  if (ft === "mp4" || ft === "video") return "视频";
  if (ft === "pptx" || ft === "ppt") return "PPT";
  if (ft === "xlsx" || ft === "xls") return "Excel";
  return ft.toUpperCase();
}

type ResourceForm = { title: string; fileUrl: string; fileType: string; fileSize: number; description: string; sortOrder: number };
const EMPTY_RESOURCE_FORM: ResourceForm = { title: "", fileUrl: "", fileType: "file", fileSize: 0, description: "", sortOrder: 0 };

function ResourceModal({
  open, title: modalTitle, form, setForm, uploading, onUpload, onClose, onSave, saving, disableSave,
}: {
  open: boolean; title: string; form: ResourceForm; setForm: React.Dispatch<React.SetStateAction<ResourceForm>>;
  uploading: boolean; onUpload: (f: File) => void; onClose: () => void; onSave: () => void; saving: boolean; disableSave: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-extrabold text-blue-900">{modalTitle}</h3>
          <button onClick={onClose}><X size={20} className="text-muted-foreground" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">资源名称 *</label>
            <input
              className="mt-1.5 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="如：A 级认证考核指南"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">简介说明</label>
            <textarea
              className="mt-1.5 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              placeholder="一句话描述该资源的内容和用途（可选）"
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">文件</label>
            <div className="mt-1.5">
              {form.fileUrl ? (
                <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg">
                  <FileText size={14} className="text-primary shrink-0" />
                  <span className="text-xs text-foreground flex-1 truncate">{form.fileType.toUpperCase()}{form.fileSize ? ` · ${formatBytes(form.fileSize)}` : ""}</span>
                  <button onClick={() => setForm(f => ({ ...f, fileUrl: "", fileType: "file", fileSize: 0 }))} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                </div>
              ) : (
                <label className={`flex flex-col items-center gap-2 border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:bg-muted/30 transition-colors ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                  {uploading ? <Loader2 size={24} className="animate-spin text-primary" /> : <Upload size={24} className="text-muted-foreground" />}
                  <span className="text-xs text-muted-foreground">{uploading ? "上传中..." : "点击选择文件（PDF、DOCX、MP4 等）"}</span>
                  <input type="file" className="hidden" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
                </label>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">排序权重</label>
            <input
              type="number"
              className="mt-1.5 w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="0（数值越小越靠前）"
              value={form.sortOrder}
              onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-border rounded-xl py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted/30 transition-colors">取消</button>
          <button
            onClick={onSave}
            disabled={disableSave || saving}
            className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResourceManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LearningResource | null>(null);
  const [uploading, setUploading] = useState(false);
  const [addForm, setAddForm] = useState<ResourceForm>(EMPTY_RESOURCE_FORM);
  const [editForm, setEditForm] = useState<ResourceForm>(EMPTY_RESOURCE_FORM);

  const { data: resources = [], isLoading } = useQuery<LearningResource[]>({
    queryKey: ["admin-learning-resources"],
    queryFn: () => adminGet("/api/admin/learning-resources"),
  });

  const addMutation = useMutation({
    mutationFn: (data: ResourceForm) => adminPost("/api/admin/learning-resources", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-learning-resources"] });
      toast({ title: "资源已添加" });
      setAddOpen(false);
      setAddForm(EMPTY_RESOURCE_FORM);
    },
    onError: (e: Error) => toast({ title: "添加失败", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ResourceForm }) => adminPut(`/api/admin/learning-resources/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-learning-resources"] });
      toast({ title: "资源已更新" });
      setEditTarget(null);
    },
    onError: (e: Error) => toast({ title: "更新失败", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminDelete(`/api/admin/learning-resources/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-learning-resources"] });
      toast({ title: "资源已删除" });
    },
    onError: (e: Error) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  const openEdit = (r: LearningResource) => {
    setEditTarget(r);
    setEditForm({ title: r.title, fileUrl: r.fileUrl, fileType: r.fileType, fileSize: r.fileSize ?? 0, description: r.description ?? "", sortOrder: r.sortOrder });
  };

  const makeUploadHandler = (setForm: React.Dispatch<React.SetStateAction<ResourceForm>>) => async (file: File) => {
    setUploading(true);
    try {
      const reqRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...Object.fromEntries(Object.entries(getAdminHeaders()).filter(([k]) => k !== "Content-Type")) },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!reqRes.ok) throw new Error("上传请求失败");
      const { uploadURL, objectPath, sessionToken } = await reqRes.json();
      const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error("文件上传失败");
      const verifyRes = await fetch(`${BASE}/api/storage/uploads/verify`, {
        method: "POST", headers: getAdminHeaders(),
        body: JSON.stringify({ sessionToken }),
      });
      if (!verifyRes.ok) throw new Error("文件验证失败");
      const url = `${BASE}/api/storage${objectPath}`;
      const ext = file.name.split(".").pop()?.toLowerCase() || "file";
      setForm(f => ({ ...f, fileUrl: url, fileType: ext, fileSize: file.size }));
      toast({ title: "文件上传成功" });
    } catch (e: unknown) {
      toast({ title: "上传失败", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-10">
      <SectionHeader
        title="学习资源"
        sub="管理展示在 OPC 学习中心的下载资料和视频"
        action={
          <button onClick={() => { setAddForm(EMPTY_RESOURCE_FORM); setAddOpen(true); }} className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
            <Plus size={16} /> 添加资源
          </button>
        }
      />

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">加载中...</div>
      ) : resources.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-white rounded-2xl border border-border/40">
          <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无学习资源，点击「添加资源」开始配置</p>
        </div>
      ) : (
        <div className="space-y-3">
          {resources.map(r => (
            <div key={r.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-border/40 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  {r.fileType === "mp4" || r.fileType === "video"
                    ? <PlayCircle size={20} className="text-green-500" />
                    : r.fileType === "pdf"
                    ? <FileText size={20} className="text-red-500" />
                    : <FileText size={20} className="text-blue-500" />}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{r.title}</p>
                  {r.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.description}</p>}
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mt-0.5">
                    {fileTypeLabel(r.fileType)}{r.fileSize ? ` · ${formatBytes(r.fileSize)}` : ""} · 排序 {r.sortOrder}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                  <Download size={16} />
                </a>
                <button onClick={() => openEdit(r)} className="text-muted-foreground hover:text-blue-500 transition-colors">
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(r.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ResourceModal
        open={addOpen}
        title="添加学习资源"
        form={addForm}
        setForm={setAddForm}
        uploading={uploading}
        onUpload={makeUploadHandler(setAddForm)}
        onClose={() => setAddOpen(false)}
        onSave={() => addMutation.mutate(addForm)}
        saving={addMutation.isPending}
        disableSave={!addForm.title || !addForm.fileUrl}
      />

      <ResourceModal
        open={!!editTarget}
        title="编辑学习资源"
        form={editForm}
        setForm={setEditForm}
        uploading={uploading}
        onUpload={makeUploadHandler(setEditForm)}
        onClose={() => setEditTarget(null)}
        onSave={() => editTarget && editMutation.mutate({ id: editTarget.id, data: editForm })}
        saving={editMutation.isPending}
        disableSave={!editForm.title || !editForm.fileUrl}
      />
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
  isFeatured: boolean;
  authorName: string;
  createdAt: string;
}

interface AdminComment {
  id: number;
  postId: number;
  postTitle: string | null;
  authorName: string | null;
  content: string;
  createdAt: string;
}

function ContentReview() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm, confirmDialog } = useConfirm();
  const [previewPost, setPreviewPost] = useState<AdminPost | null>(null);
  const [contentTab, setContentTab] = useState<"posts" | "comments">("posts");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(10);
  const [cPage, setCPage] = useState(1);
  const [cPageSize, setCPageSizeRaw] = useState(10);
  const [cQ, setCQ] = useState("");
  const [cQInput, setCQInput] = useState("");
  const setPageSize = (s: number) => { setPageSizeRaw(s); setPage(1); };
  const setCPageSize = (s: number) => { setCPageSizeRaw(s); setCPage(1); };

  const { data: postsResp, isLoading } = useQuery<PagedResp<AdminPost>>({
    queryKey: ["admin-content", q, page, pageSize],
    queryFn: () => adminGet(`/api/admin/content?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`),
  });
  const posts = postsResp?.data ?? [];

  const { data: commentsResp, isLoading: commentsLoading } = useQuery<PagedResp<AdminComment>>({
    queryKey: ["admin-content-comments", cQ, cPage, cPageSize],
    queryFn: () => adminGet(`/api/admin/content/comments?q=${encodeURIComponent(cQ)}&page=${cPage}&pageSize=${cPageSize}`),
    enabled: contentTab === "comments",
  });
  const comments = commentsResp?.data ?? [];

  const deletePost = useMutation({
    mutationFn: (id: number) => adminDelete(`/api/admin/content/posts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-content"] });
      setPreviewPost(null);
      toast({ title: "帖子已删除" });
    },
    onError: (e: Error) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  const deleteComment = useMutation({
    mutationFn: (id: number) => adminDelete(`/api/admin/content/comments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-content-comments"] });
      qc.invalidateQueries({ queryKey: ["admin-content"] });
      toast({ title: "回复已删除" });
    },
    onError: () => toast({ title: "删除失败", variant: "destructive" }),
  });

  const featurePost = useMutation({
    mutationFn: ({ id, isFeatured }: { id: number; isFeatured: boolean }) =>
      fetch(`${BASE}/api/admin/content/${id}/feature`, {
        method: "PATCH",
        headers: getAdminHeaders(),
        body: JSON.stringify({ isFeatured }),
      }).then(r => r.json()),
    onSuccess: (data, { id, isFeatured }) => {
      qc.invalidateQueries({ queryKey: ["admin-content"] });
      if (previewPost?.id === id) setPreviewPost(prev => prev ? { ...prev, isFeatured } : prev);
      toast({ title: isFeatured ? "已设为热门推荐" : "已取消热门推荐" });
    },
    onError: () => toast({ title: "操作失败", variant: "destructive" }),
  });

  const featuredCount = posts.filter(p => p.isFeatured).length;

  return (
    <>
      {previewPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setPreviewPost(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-100 gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {previewPost.isFeatured && (
                    <span className="flex items-center gap-0.5 px-2 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px] font-bold shrink-0">
                      <Flame size={10} /> 热门推荐
                    </span>
                  )}
                  <span className="font-mono text-xs text-slate-400">#{previewPost.id}</span>
                </div>
                <h3 className="text-lg font-extrabold text-blue-900 leading-snug">{previewPost.title}</h3>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span>作者：<span className="font-bold text-slate-600">{previewPost.authorName}</span></span>
                  <span>{new Date(previewPost.createdAt).toLocaleString("zh-CN")}</span>
                </div>
              </div>
              <button
                onClick={() => setPreviewPost(null)}
                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors shrink-0"
              >
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            {/* Tags */}
            {previewPost.tags?.length > 0 && (
              <div className="px-6 pt-4 flex flex-wrap gap-2">
                {previewPost.tags.map(t => (
                  <span key={t} className="text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1 rounded-full">{t}</span>
                ))}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{previewPost.content}</p>
            </div>

            {/* Stats + Actions */}
            <div className="p-6 border-t border-slate-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>👍 {previewPost.likesCount}</span>
                <span>💬 {previewPost.commentsCount}</span>
                <span>👁 {previewPost.viewsCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => featurePost.mutate({ id: previewPost.id, isFeatured: !previewPost.isFeatured })}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                    previewPost.isFeatured
                      ? "bg-orange-100 text-orange-600 hover:bg-orange-200"
                      : "bg-slate-100 text-slate-500 hover:bg-orange-50 hover:text-orange-600"
                  }`}
                >
                  <Flame size={14} /> {previewPost.isFeatured ? "取消热门" : "设为热门"}
                </button>
                <button
                  onClick={() => askConfirm({ title: "删除帖子", description: "删除后不可恢复，所有评论也将一并删除。", confirmLabel: "确认删除", confirmVariant: "destructive", onConfirm: () => deletePost.mutate(previewPost.id) })}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={14} /> 删除帖子
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    <div className="space-y-6">
      <SectionHeader title="内容审核" sub="管理社区帖子和回复，点亮🔥设为热门推荐"
        action={
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <Flame size={13} /> 热门 {featuredCount} 篇
            </div>
            <div className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <BarChart3 size={13} /> 共 {postsResp?.total ?? posts.length} 篇
            </div>
          </div>
        }
      />

      {/* Tab switcher */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setContentTab("posts")}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${contentTab === "posts" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            帖子
          </button>
          <button
            onClick={() => setContentTab("comments")}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${contentTab === "comments" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            回复管理
          </button>
        </div>
        {contentTab === "posts" ? (
          <form onSubmit={e => { e.preventDefault(); setQ(qInput); setPage(1); }} className="flex items-center gap-1 ml-auto">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={qInput} onChange={e => setQInput(e.target.value)} placeholder="搜索标题/内容/作者…"
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 w-44" />
            </div>
            <button type="submit" className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">搜索</button>
            {q && <button type="button" onClick={() => { setQ(""); setQInput(""); setPage(1); }} className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs transition-colors">×</button>}
          </form>
        ) : (
          <form onSubmit={e => { e.preventDefault(); setCQ(cQInput); setCPage(1); }} className="flex items-center gap-1 ml-auto">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={cQInput} onChange={e => setCQInput(e.target.value)} placeholder="搜索回复内容/作者…"
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 w-44" />
            </div>
            <button type="submit" className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">搜索</button>
            {cQ && <button type="button" onClick={() => { setCQ(""); setCQInput(""); setCPage(1); }} className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs transition-colors">×</button>}
          </form>
        )}
      </div>

      {contentTab === "posts" ? (
        <>
        <TableShell headers={["编号", "帖子标题", "作者", "标签", "点赞", "评论", "发布日期", "操作"]}>
          {isLoading ? <LoadingRow cols={8} /> : posts.length === 0 ? <EmptyRow cols={8} /> :
            posts.map(p => (
              <tr key={p.id} className={`hover:bg-slate-50/60 transition-colors ${p.isFeatured ? "bg-orange-50/40" : ""}`}>
                <td className="px-6 py-4 font-mono text-xs text-slate-400">#{p.id}</td>
                <td className="px-6 py-4 text-sm text-blue-900 font-medium max-w-[240px]">
                  <button
                    onClick={() => setPreviewPost(p)}
                    className="flex items-center gap-1.5 text-left hover:text-primary transition-colors group"
                    title="点击查看全文"
                  >
                    {p.isFeatured && <Flame size={13} className="text-orange-500 shrink-0" />}
                    <span className="line-clamp-1 group-hover:underline underline-offset-2">{p.title || p.content.slice(0, 40)}</span>
                  </button>
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
                      onClick={() => featurePost.mutate({ id: p.id, isFeatured: !p.isFeatured })}
                      title={p.isFeatured ? "取消热门" : "设为热门"}
                      className={`p-2 rounded-xl transition-colors ${p.isFeatured ? "bg-orange-100 text-orange-500 hover:bg-orange-200" : "hover:bg-orange-50 text-slate-400 hover:text-orange-500"}`}
                    >
                      <Flame size={15} />
                    </button>
                    <button
                      onClick={() => askConfirm({ title: "删除帖子", description: "删除后不可恢复，所有评论也将一并删除。", confirmLabel: "确认删除", confirmVariant: "destructive", onConfirm: () => deletePost.mutate(p.id) })}
                      title="删除" className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-destructive transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          }
        </TableShell>
        <AdminPagination page={page} pageSize={pageSize} total={postsResp?.total ?? 0} onPage={setPage} onPageSize={setPageSize} />
        </>
      ) : (
        <>
        <TableShell headers={["编号", "所属帖子", "评论者", "回复内容", "发布日期", "操作"]}>
          {commentsLoading ? <LoadingRow cols={6} /> : comments.length === 0 ? <EmptyRow cols={6} /> :
            comments.map(c => (
              <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-6 py-4 font-mono text-xs text-slate-400">#{c.id}</td>
                <td className="px-6 py-4 text-sm text-blue-900 font-medium max-w-[180px]">
                  <span className="line-clamp-1">{c.postTitle ?? `帖子#${c.postId}`}</span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{c.authorName ?? "—"}</td>
                <td className="px-6 py-4 text-sm text-slate-700 max-w-[280px]">
                  <span className="line-clamp-2">{c.content}</span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-400">{new Date(c.createdAt).toLocaleDateString("zh-CN")}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => askConfirm({ title: "删除回复", description: "删除后不可恢复。", confirmLabel: "确认删除", confirmVariant: "destructive", onConfirm: () => deleteComment.mutate(c.id) })}
                    title="删除" className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-destructive transition-colors">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))
          }
        </TableShell>
        <AdminPagination page={cPage} pageSize={cPageSize} total={commentsResp?.total ?? 0} onPage={setCPage} onPageSize={setCPageSize} />
        </>
      )}
    </div>
    {confirmDialog}
    </>
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

type DisputeOrder = {
  id: number; orderNo: string; status: string; amount: number;
  opcName: string; publisherName: string; demandTitle: string;
  daysSinceCreated: number; createdAt: string;
  totalMilestones: number; completedMilestones: number;
};

function DisputeManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: disputedResp, isLoading } = useQuery<PagedResp<DisputeOrder>>({
    queryKey: ["admin-orders-disputed"],
    queryFn: () => adminGet("/api/admin/orders?status=disputed&pageSize=200"),
  });

  const allOrdersResp = useQuery<PagedResp<DisputeOrder>>({
    queryKey: ["admin-orders-all-for-dispute"],
    queryFn: () => adminGet("/api/admin/orders?pageSize=200"),
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

  const allDisputed = disputedResp?.data ?? [];

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
          {allOrdersResp.isLoading ? <LoadingRow cols={5} /> :
            (allOrdersResp.data?.data ?? []).filter(o => o.status === "in_progress").length === 0 ? <EmptyRow cols={5} /> :
            (allOrdersResp.data?.data ?? []).filter(o => o.status === "in_progress").map(o => (
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

/* ─── Quote Card Config ──────────────────────────── */

type AdminTier = { id: number; tier: string; tierLabel: string; basePrice: number; coefficient: number | null; sortOrder: number };
type AdminDim = { id: number; code: string; label: string; sortOrder: number; isActive: boolean; tiers: AdminTier[] };
type AdminCatConfig = { category: string; base: AdminDim[]; adjustment: AdminDim[]; optional: AdminDim[] };

function QuoteCardConfigManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: catCategories = [] } = useQuery<CatCategory[]>({
    queryKey: ["admin-cat-categories"],
    queryFn: () => adminGet("/api/admin/cat-categories"),
    staleTime: 60_000,
  });

  const CAT_CODE_TO_LEGACY: Record<string, string> = { CG: "content", SA: "software", TK: "education", BO: "marketing", OTHER: "other" };
  const legacyKeys = catCategories.length > 0
    ? catCategories.map(c => ({ key: CAT_CODE_TO_LEGACY[c.code] ?? c.code.toLowerCase(), label: c.name, id: c.id }))
    : [
        { key: "software", label: "软件开发", id: 0 }, { key: "education", label: "教育培训", id: 0 },
        { key: "marketing", label: "营销", id: 0 }, { key: "content", label: "内容设计", id: 0 }, { key: "other", label: "其他", id: 0 },
      ];
  const CAT_LABELS: Record<string, string> = Object.fromEntries(legacyKeys.map(c => [c.key, c.label]));
  const CAT_ID_MAP: Record<string, number> = Object.fromEntries(legacyKeys.filter(c => c.id).map(c => [c.key, c.id]));
  const [activeCategory, setActiveCategory] = useState("software");
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const [addingDim, setAddingDim] = useState<{ layer: string } | null>(null);
  const [newDimForm, setNewDimForm] = useState({ code: "", label: "" });
  const [addingTier, setAddingTier] = useState<{ dimId: number; layer: string } | null>(null);
  const [newTierForm, setNewTierForm] = useState({ tier: "", tierLabel: "", basePrice: "0", coefficient: "1.00" });
  const [dimBusy, setDimBusy] = useState(false);
  const [tierBusy, setTierBusy] = useState(false);
  const [opBusyId, setOpBusyId] = useState<number | null>(null);

  const { data: configs = [], isLoading } = useQuery<AdminCatConfig[]>({
    queryKey: ["admin-quote-card-v2"],
    queryFn: () => adminGet("/api/admin/quote-card/config"),
    staleTime: 30_000,
  });

  const activeCfg = configs.find(c => c.category === activeCategory);

  const saveTierField = async (tierId: number, layer: string) => {
    const key = String(tierId);
    const editVal = localEdits[key];
    if (editVal === undefined) return;
    const parsed = parseFloat(editVal) || 0;
    const body = layer === "base" ? { basePrice: parsed } : { coefficient: parsed };
    try {
      await adminPut(`/api/admin/quote-card/tiers/${tierId}`, body);
      await queryClient.invalidateQueries({ queryKey: ["admin-quote-card-v2"] });
    } catch (err: any) {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    }
  };

  const deleteDim = async (dimId: number) => {
    if (!window.confirm("确定删除此维度及其所有档位？此操作不可撤销。")) return;
    if (opBusyId !== null) return;
    setOpBusyId(dimId);
    try {
      const res = await fetch(`${BASE}/api/admin/quote-card/dimensions/${dimId}`, { method: "DELETE", headers: getAdminHeaders() });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "删除失败"); }
      await queryClient.invalidateQueries({ queryKey: ["admin-quote-card-v2"] });
      toast({ title: "维度已删除" });
    } catch (err: any) { toast({ title: "删除失败", description: err.message, variant: "destructive" }); }
    finally { setOpBusyId(null); }
  };

  const deleteTier = async (tierId: number) => {
    if (!window.confirm("确定删除此档位？")) return;
    if (opBusyId !== null) return;
    setOpBusyId(tierId);
    try {
      const res = await fetch(`${BASE}/api/admin/quote-card/tiers/${tierId}`, { method: "DELETE", headers: getAdminHeaders() });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "删除失败"); }
      await queryClient.invalidateQueries({ queryKey: ["admin-quote-card-v2"] });
      toast({ title: "档位已删除" });
    } catch (err: any) { toast({ title: "删除失败", description: err.message, variant: "destructive" }); }
    finally { setOpBusyId(null); }
  };

  const addDim = async (layer: string) => {
    if (dimBusy) return;
    if (!newDimForm.code.trim() || !newDimForm.label.trim()) { toast({ title: "请填写代码和名称", variant: "destructive" }); return; }
    setDimBusy(true);
    try {
      const catCategoryId = CAT_ID_MAP[activeCategory] ?? undefined;
      await adminPost("/api/admin/quote-card/dimensions", { category: activeCategory, layer, code: newDimForm.code.trim(), label: newDimForm.label.trim(), ...(catCategoryId ? { catCategoryId } : {}) });
      await queryClient.invalidateQueries({ queryKey: ["admin-quote-card-v2"] });
      setAddingDim(null); setNewDimForm({ code: "", label: "" });
      toast({ title: "维度已添加" });
    } catch (err: any) { toast({ title: "添加失败", description: err.message, variant: "destructive" }); }
    finally { setDimBusy(false); }
  };

  const addTier = async (dimId: number, layer: string) => {
    if (tierBusy) return;
    if (!newTierForm.tier.trim() || !newTierForm.tierLabel.trim()) { toast({ title: "请填写档位代码和标签", variant: "destructive" }); return; }
    setTierBusy(true);
    const body: Record<string, unknown> = { dimensionId: dimId, tier: newTierForm.tier.trim(), tierLabel: newTierForm.tierLabel.trim() };
    if (layer === "base") body.basePrice = parseFloat(newTierForm.basePrice) || 0;
    else body.coefficient = parseFloat(newTierForm.coefficient) || 1.00;
    try {
      await adminPost("/api/admin/quote-card/tiers", body);
      await queryClient.invalidateQueries({ queryKey: ["admin-quote-card-v2"] });
      setAddingTier(null); setNewTierForm({ tier: "", tierLabel: "", basePrice: "0", coefficient: "1.00" });
      toast({ title: "档位已添加" });
    } catch (err: any) { toast({ title: "添加失败", description: err.message, variant: "destructive" }); }
    finally { setTierBusy(false); }
  };

  const renderSection = (dims: AdminDim[], layer: "base" | "adjustment" | "optional") => {
    const isBase = layer === "base";
    const isOptional = layer === "optional";
    const sectionLabel = isBase ? "基准层 · 价格累加" : isOptional ? "可选层 · 费率叠加（维护包等）" : "调整层 · 系数相乘";
    const sectionColor = isBase ? "text-primary" : isOptional ? "text-green-700" : "text-amber-600";
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className={`text-xs font-black uppercase tracking-widest ${sectionColor}`}>{sectionLabel}</h3>
          <button
            onClick={() => { setAddingDim({ layer }); setNewDimForm({ code: "", label: "" }); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
          ><Plus size={12} /> 添加维度</button>
        </div>

        {dims.length === 0 && addingDim?.layer !== layer && (
          <p className="text-sm text-slate-400 text-center py-6 bg-white rounded-2xl border border-dashed border-slate-200">暂无维度</p>
        )}

        {dims.map(dim => (
          <div key={dim.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className={`px-5 py-3 flex items-center gap-3 border-b border-slate-100 ${isBase ? "bg-slate-50" : isOptional ? "bg-green-50/60" : "bg-amber-50/60"}`}>
              <span className={`text-xs font-black px-2 py-0.5 rounded-md ${isBase ? "text-primary bg-primary/10" : isOptional ? "text-green-700 bg-green-100" : "text-amber-700 bg-amber-100"}`}>{dim.code}</span>
              <span className="font-bold text-slate-800 text-sm flex-1">{dim.label}</span>
              {!isBase && <span className={`text-xs ${isOptional ? "text-green-600" : "text-slate-400"}`}>{isOptional ? "费率 ×" : "系数 ×"}</span>}
              <button onClick={() => deleteDim(dim.id)} disabled={opBusyId === dim.id} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-40 transition-colors" title="删除维度"><Trash2 size={13} /></button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50 bg-slate-50/50">
                  <th className="px-5 py-2 text-left text-xs font-bold text-slate-400 uppercase tracking-wider w-20">档位</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">标签</th>
                  <th className="px-4 py-2 text-right text-xs font-bold text-slate-400 uppercase tracking-wider w-44">{isBase ? "价格（元）" : isOptional ? "费率（× 如 0.15=+15%）" : "系数（×）"}</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {dim.tiers.map(t => {
                  const key = String(t.id);
                  const displayVal = localEdits[key] !== undefined ? localEdits[key] : (isBase ? String(t.basePrice) : String(t.coefficient ?? 0));
                  return (
                    <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-2.5">
                        <span className={`inline-block text-xs font-black px-2 py-0.5 rounded ${isBase ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"}`}>{t.tier}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700">{t.tierLabel}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="relative inline-flex items-center">
                          <span className={`absolute left-3 text-sm font-bold pointer-events-none ${isBase ? "text-slate-400" : isOptional ? "text-green-600" : "text-amber-500"}`}>{isBase ? "¥" : "×"}</span>
                          <input
                            type="number"
                            min={isBase ? 0 : 0}
                            max={isBase ? undefined : isOptional ? 1 : 10}
                            step={isBase ? 100 : isOptional ? 0.01 : 0.05}
                            value={displayVal}
                            onChange={e => setLocalEdits(prev => ({ ...prev, [key]: e.target.value }))}
                            onBlur={() => saveTierField(t.id, layer)}
                            className={`w-28 border border-slate-200 rounded-lg pl-7 pr-3 py-1.5 text-sm text-right outline-none transition ${isBase ? "focus:ring-2 focus:ring-primary/20 focus:border-primary" : isOptional ? "focus:ring-2 focus:ring-green-300/40 focus:border-green-500" : "focus:ring-2 focus:ring-amber-300/40 focus:border-amber-400"}`}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => deleteTier(t.id)} disabled={opBusyId === t.id} className="p-1 text-slate-300 hover:text-red-400 disabled:opacity-40 transition-colors" title="删除档位"><X size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
                {addingTier?.dimId === dim.id ? (
                  <tr className="border-b border-slate-50 bg-primary/5">
                    <td className="px-3 py-2.5">
                      <input type="text" placeholder="代码" value={newTierForm.tier} onChange={e => setNewTierForm(p => ({...p, tier: e.target.value}))}
                        className="w-14 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary" />
                    </td>
                    <td className="px-3 py-2.5">
                      <input type="text" placeholder="标签描述" value={newTierForm.tierLabel} onChange={e => setNewTierForm(p => ({...p, tierLabel: e.target.value}))}
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-primary" />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {isBase
                        ? <input type="number" placeholder="0" min={0} step={100} value={newTierForm.basePrice} onChange={e => setNewTierForm(p => ({...p, basePrice: e.target.value}))}
                            className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-right outline-none focus:border-primary" />
                        : <input type="number" placeholder="1.00" min={0.01} max={10} step={0.05} value={newTierForm.coefficient} onChange={e => setNewTierForm(p => ({...p, coefficient: e.target.value}))}
                            className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-right outline-none focus:border-amber-400" />
                      }
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => addTier(dim.id, layer)} disabled={tierBusy} className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-40 transition-colors"><CheckCircle2 size={14} /></button>
                        <button onClick={() => setAddingTier(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded transition-colors"><X size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-2">
                      <button
                        onClick={() => { setAddingTier({ dimId: dim.id, layer }); setNewTierForm({ tier: "", tierLabel: "", basePrice: "0", coefficient: "1.00" }); }}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-primary transition-colors"
                      ><Plus size={12} /> 添加档位</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}

        {addingDim?.layer === layer && (
          <div className="bg-white rounded-2xl border-2 border-dashed border-primary/30 p-5">
            <p className="text-sm font-bold text-slate-700 mb-3">新建维度</p>
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-xs text-slate-500 font-bold block mb-1">代码（如 D6 / A4）</label>
                <input type="text" placeholder="D6" value={newDimForm.code} onChange={e => setNewDimForm(p => ({...p, code: e.target.value}))}
                  className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-slate-500 font-bold block mb-1">名称</label>
                <input type="text" placeholder="维度名称" value={newDimForm.label} onChange={e => setNewDimForm(p => ({...p, label: e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <button onClick={() => addDim(layer)} disabled={dimBusy} className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors">{dimBusy ? "…" : "确认"}</button>
              <button onClick={() => setAddingDim(null)} className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-200 transition-colors">取消</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="报价卡配置"
        sub="为五类需求（软件开发、教育培训、营销、内容设计、其他）配置报价维度和档位；OPC 报价时自动按需求类型呈现对应报价卡"
      />

      <div className="flex gap-2 flex-wrap">
        {Object.entries(CAT_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              activeCategory === key
                ? "bg-primary text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:border-primary/40 hover:bg-primary/5"
            }`}
          >{label}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-slate-400"><Loader2 className="animate-spin mx-auto mb-2" size={24} />加载中…</div>
      ) : activeCategory === "other" ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-5">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex-shrink-0 w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 text-sm font-bold">?</span>
            <div>
              <p className="font-bold text-slate-800 mb-1">「其他」类型说明</p>
              <p className="text-sm text-slate-500 leading-relaxed">此类型作为兜底分类，适用于不属于教育培训、软件开发、营销、内容设计的 AI 相关需求。OPC 对此类需求报价时没有标准报价卡，需与需求方直接协商定价。</p>
              <p className="text-sm text-slate-400 mt-2">运营人员可在下方添加维度和档位，作为 OPC 报价时的参考指引；也可保持空白，让 OPC 完全自定义报价。</p>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>{renderSection(activeCfg?.base ?? [], "base")}</div>
            <div>{renderSection(activeCfg?.adjustment ?? [], "adjustment")}</div>
          </div>
          <div>{renderSection(activeCfg?.optional ?? [], "optional")}</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>{renderSection(activeCfg?.base ?? [], "base")}</div>
            <div>{renderSection(activeCfg?.adjustment ?? [], "adjustment")}</div>
          </div>
          <div>{renderSection(activeCfg?.optional ?? [], "optional")}</div>
        </>
      )}

      <p className="text-xs text-slate-400 text-center">
        价格/系数输入框失焦后自动保存 · 删除操作不可撤销
      </p>
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
      const { uploadURL, objectPath, sessionToken } = await res.json();
      const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error(`上传文件失败: ${putRes.status}`);
      const verifyRes = await fetch(`${BASE}/api/storage/uploads/verify`, {
        method: "POST", headers: getAdminHeaders(),
        body: JSON.stringify({ sessionToken }),
      });
      if (!verifyRes.ok) throw new Error(`文件验证失败: ${verifyRes.status}`);
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

        {/* 发单方注册欢迎邮件 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">发单方注册欢迎邮件</h3>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-bold">发单方</span>
          </div>
          <p className="text-xs text-slate-400 -mt-2">发单方（企业/个人）注册成功后自动发送此邮件</p>

          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">邮件主题</label>
            {field("welcome_email_subject", "【接单吧】欢迎加入 OPC 撮合交易平台")}
            <p className="text-xs text-slate-400 mt-1">收件人看到的邮件标题</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">正文内容</label>
            <textarea
              value={form["welcome_email_body"] ?? ""}
              onChange={e => setForm(v => ({ ...v, welcome_email_body: e.target.value }))}
              rows={4}
              placeholder="欢迎加入接单吧！…"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition resize-y"
            />
            <p className="text-xs text-slate-400 mt-1">支持换行，每段独立渲染为一行文字</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">入群引导语</label>
            {field("welcome_email_group_tip", "扫码加入官方微信交流群，与更多 OPC 伙伴一起交流成长：")}
            <p className="text-xs text-slate-400 mt-1">显示在二维码图片上方（二维码为空时不显示）</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-blue-900 mb-2">微信入群二维码</label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                {form["wechat_group_qr"] ? (
                  <img src={form["wechat_group_qr"]} alt="微信入群二维码" className="w-full h-full object-contain p-1" />
                ) : (
                  <ImageIcon size={22} className="text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
                  uploading["wechat_group_qr"] ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}>
                  {uploading["wechat_group_qr"] ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading["wechat_group_qr"] ? "上传中…" : "上传图片"}
                  <input
                    type="file" accept="image/*" className="hidden"
                    disabled={uploading["wechat_group_qr"]}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload("wechat_group_qr", f); }}
                  />
                </label>
                <input
                  value={form["wechat_group_qr"] ?? ""}
                  onChange={e => setForm(v => ({ ...v, wechat_group_qr: e.target.value }))}
                  placeholder="或直接粘贴图片 URL"
                  className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 text-slate-500 transition"
                />
                <p className="text-xs text-slate-400 mt-1">上传后发单方注册欢迎邮件中将自动显示此二维码</p>
              </div>
            </div>
          </div>
        </div>

        {/* 接单方（OPC）注册欢迎邮件 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">接单方注册欢迎邮件</h3>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold">OPC 接单方</span>
          </div>
          <p className="text-xs text-slate-400 -mt-2">OPC 超级个体注册成功后自动发送此邮件</p>

          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">邮件主题</label>
            {field("opc_welcome_email_subject", "【接单吧】欢迎成为 OPC 超级个体")}
            <p className="text-xs text-slate-400 mt-1">收件人看到的邮件标题</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">正文内容</label>
            <textarea
              value={form["opc_welcome_email_body"] ?? ""}
              onChange={e => setForm(v => ({ ...v, opc_welcome_email_body: e.target.value }))}
              rows={4}
              placeholder="欢迎加入接单吧！您已成功注册为 OPC 超级个体…"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition resize-y"
            />
            <p className="text-xs text-slate-400 mt-1">支持换行，每段独立渲染为一行文字</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">入群引导语</label>
            {field("opc_welcome_email_group_tip", "扫码加入 OPC 专属交流群，与更多超级个体一起交流成长：")}
            <p className="text-xs text-slate-400 mt-1">显示在二维码图片上方（二维码为空时不显示）</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-blue-900 mb-2">微信入群二维码</label>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                {form["opc_wechat_group_qr"] ? (
                  <img src={form["opc_wechat_group_qr"]} alt="OPC微信入群二维码" className="w-full h-full object-contain p-1" />
                ) : (
                  <ImageIcon size={22} className="text-slate-300" />
                )}
              </div>
              <div className="flex-1">
                <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer transition-colors ${
                  uploading["opc_wechat_group_qr"] ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                }`}>
                  {uploading["opc_wechat_group_qr"] ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading["opc_wechat_group_qr"] ? "上传中…" : "上传图片"}
                  <input
                    type="file" accept="image/*" className="hidden"
                    disabled={uploading["opc_wechat_group_qr"]}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload("opc_wechat_group_qr", f); }}
                  />
                </label>
                <input
                  value={form["opc_wechat_group_qr"] ?? ""}
                  onChange={e => setForm(v => ({ ...v, opc_wechat_group_qr: e.target.value }))}
                  placeholder="或直接粘贴图片 URL"
                  className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 text-slate-500 transition"
                />
                <p className="text-xs text-slate-400 mt-1">上传后 OPC 注册欢迎邮件中将自动显示此二维码</p>
              </div>
            </div>
          </div>
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

        {/* 法律文档 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">法律文档</h3>
          <p className="text-xs text-slate-400 -mt-2">编辑后保存即可生效，无需重新部署。内容支持 HTML 标记；留空则显示系统默认静态内容。</p>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-blue-900">服务条款（/terms）</h4>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">最后更新日期</label>
              {field("legal_terms_updated", "2026 年 1 月 1 日")}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">正文内容（HTML）</label>
              <textarea
                value={form["legal_terms_content"] ?? ""}
                onChange={e => setForm(v => ({ ...v, legal_terms_content: e.target.value }))}
                rows={10}
                placeholder="留空则使用系统默认静态内容。可粘贴 HTML 代码，例如：<section><h2>1. 总则</h2><p>…</p></section>"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition resize-y font-mono"
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h4 className="text-sm font-bold text-blue-900">隐私政策（/privacy）</h4>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">最后更新日期</label>
              {field("legal_privacy_updated", "2026 年 1 月 1 日")}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">正文内容（HTML）</label>
              <textarea
                value={form["legal_privacy_content"] ?? ""}
                onChange={e => setForm(v => ({ ...v, legal_privacy_content: e.target.value }))}
                rows={10}
                placeholder="留空则使用系统默认静态内容。可粘贴 HTML 代码，例如：<section><h2>1. 引言</h2><p>…</p></section>"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition resize-y font-mono"
              />
            </div>
          </div>
        </div>

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

        {/* 官方公告管理 */}
        <AnnouncementsManagement />

        {/* 修改密码 */}
        <ChangePasswordCard />
      </div>
    </div>
  );
}

/* ─── Announcements Management ───────────────────── */

type AnnRow = {
  id: number;
  title: string;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  isPinned: boolean;
  createdAt: string;
};

function AnnouncementsManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: annList = [], isLoading: annLoading } = useQuery<AnnRow[]>({
    queryKey: ["admin-announcements"],
    queryFn: () => adminGet("/api/admin/announcements"),
  });

  const [newTitle, setNewTitle] = useState("");
  const [newFileUrl, setNewFileUrl] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [newFileType, setNewFileType] = useState("");
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [fileUploading, setFileUploading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  async function handleFileUpload(file: File) {
    setFileUploading(true);
    try {
      const res = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!res.ok) throw new Error(`请求上传地址失败: ${res.status}`);
      const { uploadURL, objectPath, sessionToken } = await res.json();
      const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!putRes.ok) throw new Error(`上传文件失败: ${putRes.status}`);
      const verifyRes = await fetch(`${BASE}/api/storage/uploads/verify`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ sessionToken }),
      });
      if (!verifyRes.ok) {
        const e = await verifyRes.json().catch(() => ({}));
        throw new Error(e.error ?? `文件验证失败: ${verifyRes.status}`);
      }
      setNewFileUrl(`${BASE}/api/storage${objectPath}`);
      setNewFileName(file.name);
      setNewFileType(file.type);
      toast({ title: "附件上传成功" });
    } catch (e) {
      toast({ title: "上传失败", description: (e as Error).message, variant: "destructive" });
    } finally {
      setFileUploading(false);
    }
  }

  async function addAnn() {
    if (!newTitle.trim()) return;
    setAddLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/announcements`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({
          title: newTitle.trim(),
          fileUrl: newFileUrl || null,
          fileName: newFileName || null,
          fileType: newFileType || null,
          isPinned: newIsPinned,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "发布失败");
      }
      toast({ title: "公告已发布" });
      setNewTitle("");
      setNewFileUrl("");
      setNewFileName("");
      setNewFileType("");
      setNewIsPinned(false);
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    } catch (e) {
      toast({ title: "发布失败", description: (e as Error).message, variant: "destructive" });
    } finally {
      setAddLoading(false);
    }
  }

  async function togglePin(id: number, isPinned: boolean) {
    try {
      await fetch(`${BASE}/api/admin/announcements/${id}`, {
        method: "PATCH",
        headers: getAdminHeaders(),
        body: JSON.stringify({ isPinned }),
      });
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    } catch {
      toast({ title: "操作失败", variant: "destructive" });
    }
  }

  async function deleteAnn(id: number) {
    try {
      await fetch(`${BASE}/api/admin/announcements/${id}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      toast({ title: "公告已删除" });
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    } catch {
      toast({ title: "删除失败", variant: "destructive" });
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
      <div>
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Megaphone size={14} /> 官方公告管理
        </h3>
        <p className="text-xs text-slate-400 mt-1">公告显示在话题广场侧边栏，置顶公告永远排在最前</p>
      </div>

      {/* 现有公告列表 */}
      {annLoading ? (
        <div className="flex items-center gap-2 text-slate-400 text-xs py-3"><Loader2 size={14} className="animate-spin" /> 加载中…</div>
      ) : annList.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">暂无公告，请在下方发布</p>
      ) : (
        <div className="space-y-2">
          {annList.map(ann => (
            <div key={ann.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ann.isPinned && <Pin size={11} className="text-amber-500 shrink-0" />}
                  <span className="text-sm font-bold text-slate-700 truncate">{ann.title}</span>
                  {ann.isPinned && (
                    <span className="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-bold shrink-0">置顶</span>
                  )}
                </div>
                {ann.fileUrl && (
                  <a
                    href={ann.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
                  >
                    <Paperclip size={10} />
                    <span className="truncate max-w-[220px]">{ann.fileName ?? "附件"}</span>
                  </a>
                )}
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {new Date(ann.createdAt).toLocaleDateString("zh-CN")}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => togglePin(ann.id, !ann.isPinned)}
                  title={ann.isPinned ? "取消置顶" : "设为置顶"}
                  className={`p-1.5 rounded-lg transition-colors ${
                    ann.isPinned
                      ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                      : "text-slate-300 hover:bg-slate-100 hover:text-amber-500"
                  }`}
                >
                  <Pin size={14} />
                </button>
                <button
                  onClick={() => deleteAnn(ann.id)}
                  title="删除公告"
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 发布新公告 */}
      <div className="border-t border-slate-100 pt-5 space-y-3">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">发布新公告</h4>

        <div>
          <label className="block text-xs font-bold text-blue-900 mb-1.5">公告标题 <span className="text-red-400">*</span></label>
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="请输入公告标题"
            maxLength={200}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-blue-900 mb-1.5">附件（可选）</label>
          {newFileUrl ? (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-primary/20 bg-primary/5">
              <Paperclip size={14} className="text-primary shrink-0" />
              <span className="text-sm text-primary font-medium flex-1 truncate">{newFileName}</span>
              <button
                onClick={() => { setNewFileUrl(""); setNewFileName(""); setNewFileType(""); }}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-colors border border-dashed ${
              fileUploading ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed" : "border-slate-300 text-slate-500 hover:border-primary hover:text-primary hover:bg-primary/5"
            }`}>
              {fileUploading ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
              {fileUploading ? "上传中…" : "点击上传附件"}
              <input
                type="file"
                className="hidden"
                disabled={fileUploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
              />
            </label>
          )}
          <p className="text-xs text-slate-400 mt-1">支持 PDF、Word、图片等各类文件</p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newIsPinned}
              onChange={e => setNewIsPinned(e.target.checked)}
              className="w-4 h-4 accent-amber-500 rounded"
            />
            <span className="text-slate-600 font-medium">永久置顶</span>
            <Pin size={12} className="text-amber-500" />
          </label>
          <button
            onClick={addAnn}
            disabled={!newTitle.trim() || addLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {addLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            发布公告
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent]         = useState(false);
  const [showNew, setShowNew]                 = useState(false);

  const changePwd = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/admin/change-password`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "修改失败");
        return data;
      }),
    onSuccess: () => {
      toast({ title: "密码已修改成功" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) => toast({ title: "修改失败", description: e.message, variant: "destructive" }),
  });

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = currentPassword.length > 0 && newPassword.length >= 6 && newPassword === confirmPassword && !changePwd.isPending;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5 border-t-4 border-amber-400">
      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
        <Lock size={14} /> 修改登录密码
      </h3>

      <div>
        <label className="block text-sm font-bold text-blue-900 mb-1.5">当前密码</label>
        <div className="relative">
          <input
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="请输入当前密码"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition"
          />
          <button type="button" onClick={() => setShowCurrent(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-blue-900 mb-1.5">新密码</label>
        <div className="relative">
          <input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="至少6位"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition"
          />
          <button type="button" onClick={() => setShowNew(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-blue-900 mb-1.5">确认新密码</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="再次输入新密码"
          className={`w-full border rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 bg-slate-50 transition ${
            mismatch ? "border-red-400 focus:ring-red-200" : "border-slate-200 focus:ring-primary/30"
          }`}
        />
        {mismatch && <p className="text-xs text-red-500 mt-1">两次密码不一致</p>}
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => changePwd.mutate()}
          disabled={!canSubmit}
          className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {changePwd.isPending ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
          {changePwd.isPending ? "修改中…" : "确认修改密码"}
        </button>
      </div>
    </div>
  );
}

/* ─── Module: 等级认证审核 ─────────────────────── */

/* ─── Credit Level Config ────────────────────────── */

/* ─── Module: 积分规则配置 ───────────────────── */

const ACTION_TYPE_LABELS: Record<string, string> = {
  order_completed:   "订单成功完成",
  five_star_review:  "客户5星好评",
  bad_review:        "客户差评（1-2星）",
  order_disputed:    "订单进入争议",
  manual_adjustment: "管理员手动调整",
};

interface CreditRule {
  id: number;
  action_type: string;
  points_delta: number;
  description: string | null;
  is_active: boolean;
}

function CreditRulesConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ pointsDelta: 0, description: "", isActive: true });

  const { data: rules = [], isLoading, refetch } = useQuery<CreditRule[]>({
    queryKey: ["admin-credit-rules"],
    queryFn: () => adminGet("/api/admin/credit-rules"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      adminPut(`/api/admin/credit-rules/${id}`, body),
    onSuccess: () => {
      toast({ title: "规则已更新" });
      setEditId(null);
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-credit-rules"] });
    },
    onError: (e: any) => toast({ title: "更新失败", description: e?.message, variant: "destructive" }),
  });

  const startEdit = (row: CreditRule) => {
    setEditId(row.id);
    setEditForm({ pointsDelta: row.points_delta, description: row.description ?? "", isActive: row.is_active });
  };

  const handleSave = () => {
    if (editId === null) return;
    updateMut.mutate({ id: editId, body: {
      pointsDelta: editForm.pointsDelta,
      description: editForm.description.trim() || null,
      isActive: editForm.isActive,
    }});
  };

  return (
    <div>
      <SectionHeader
        title="积分规则配置"
        sub="配置各类行为对应的积分变动值；系统在相关事件发生时自动触发积分更新"
        action={
          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">
            <RefreshCw size={13} />刷新
          </button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={18} className="animate-spin" />加载中…
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100">
          {rules.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              积分规则尚未初始化，请重启服务器以触发迁移
            </div>
          ) : rules.map(row => (
            <div key={row.id}>
              {editId === row.id ? (
                <div className="px-5 py-4 space-y-3">
                  <p className="text-sm font-bold text-slate-700">{ACTION_TYPE_LABELS[row.action_type] ?? row.action_type}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1 font-medium">积分变动（正数＋，负数−）</label>
                      <input
                        type="number"
                        value={editForm.pointsDelta}
                        onChange={e => setEditForm(f => ({ ...f, pointsDelta: parseInt(e.target.value) || 0 }))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1 font-medium">规则状态</label>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="checkbox"
                          id={`rule-active-${row.id}`}
                          checked={editForm.isActive}
                          onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))}
                          className="w-4 h-4 accent-primary"
                        />
                        <label htmlFor={`rule-active-${row.id}`} className="text-sm text-slate-600 cursor-pointer">
                          {editForm.isActive ? "启用" : "停用"}
                        </label>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1 font-medium">规则说明（可选）</label>
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="简短描述此规则的适用场景"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={updateMut.isPending}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                      {updateMut.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}保存
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="px-4 py-2 bg-slate-100 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center shadow-sm ${
                    row.points_delta > 0 ? "bg-emerald-500" :
                    row.points_delta < 0 ? "bg-red-500" : "bg-slate-400"
                  }`}>
                    <Zap size={15} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">
                        {ACTION_TYPE_LABELS[row.action_type] ?? row.action_type}
                      </span>
                      {!row.is_active && (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">已停用</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {row.description ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-lg font-extrabold font-display ${
                      row.points_delta > 0 ? "text-emerald-600" :
                      row.points_delta < 0 ? "text-red-500" : "text-slate-400"
                    }`}>
                      {row.points_delta > 0 ? "+" : ""}{row.points_delta} 分
                    </span>
                    <button
                      onClick={() => startEdit(row)}
                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors">
                      <Edit2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
        <p className="text-xs text-blue-700 font-medium leading-relaxed">
          <span className="font-bold">提示：</span>积分规则会在以下事件自动触发：订单验收完成 → 「订单成功完成」；发单方提交5星评价 → 「客户5星好评」；发单方提交1-2星评价 → 「客户差评」；订单进入争议流程 → 「订单进入争议」。管理员可在 OPC 详情页手动调整积分。停用规则后，对应事件将不再触发积分变动。
        </p>
      </div>
    </div>
  );
}

interface CreditLevelItem {
  id: number;
  code: string;
  name: string;
  minPoints: number;
  sortOrder: number;
  color: string | null;
  isActive: boolean;
  createdAt: string;
}

function CreditLevelForm({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
  isEdit = false,
}: {
  form: { name: string; minPoints: number; sortOrder: number; color: string; isActive: boolean };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isEdit?: boolean;
}) {
  const PRESET_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#ec4899", "#64748b"];
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">等级名称</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
          placeholder="如 新手 / 成长 / 精英 / 专家"
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">最低积分阈值</label>
          <input
            type="number"
            min={0}
            value={form.minPoints}
            onChange={e => setForm((f: any) => ({ ...f, minPoints: parseInt(e.target.value) || 0 }))}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">排序（小的排前）</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={e => setForm((f: any) => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">徽章颜色</label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setForm((f: any) => ({ ...f, color: c }))}
              className={`w-7 h-7 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={form.color}
            onChange={e => setForm((f: any) => ({ ...f, color: e.target.value }))}
            className="w-7 h-7 rounded-full cursor-pointer border-none outline-none p-0"
            title="自定义颜色"
          />
          <span className="text-xs text-slate-400 font-mono">{form.color}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="cl-active"
          checked={form.isActive}
          onChange={e => setForm((f: any) => ({ ...f, isActive: e.target.checked }))}
          className="rounded"
        />
        <label htmlFor="cl-active" className="text-sm text-slate-600">启用此等级</label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
          取消
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50">
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </div>
  );
}

function CreditLevelConfig() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editId, setEditId] = useState<number | "new" | null>(null);
  const [form, setForm] = useState({ name: "", minPoints: 0, sortOrder: 0, color: "#6366f1", isActive: true });

  const { data: levels = [], isLoading, refetch } = useQuery<CreditLevelItem[]>({
    queryKey: ["admin-credit-levels"],
    queryFn: () => adminGet("/api/admin/credit-levels"),
  });

  const createMut = useMutation({
    mutationFn: (body: object) => adminPost("/api/admin/credit-levels", body),
    onSuccess: () => { toast({ title: "创建成功" }); setEditId(null); resetForm(); refetch(); qc.invalidateQueries({ queryKey: ["admin-credit-levels"] }); },
    onError: (e: any) => toast({ title: "创建失败", description: e?.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => adminPut(`/api/admin/credit-levels/${id}`, body),
    onSuccess: () => { toast({ title: "更新成功" }); setEditId(null); refetch(); qc.invalidateQueries({ queryKey: ["admin-credit-levels"] }); },
    onError: (e: any) => toast({ title: "更新失败", description: e?.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminDelete(`/api/admin/credit-levels/${id}`),
    onSuccess: () => { toast({ title: "删除成功" }); refetch(); qc.invalidateQueries({ queryKey: ["admin-credit-levels"] }); },
    onError: (e: any) => toast({ title: "删除失败", description: e?.message, variant: "destructive" }),
  });

  const resetForm = () => setForm({ name: "", minPoints: 0, sortOrder: 0, color: "#6366f1", isActive: true });

  const startEdit = (row: CreditLevelItem) => {
    setEditId(row.id);
    setForm({ name: row.name, minPoints: row.minPoints, sortOrder: row.sortOrder, color: row.color ?? "#6366f1", isActive: row.isActive });
  };

  const handleSubmit = () => {
    const body = { name: form.name.trim(), minPoints: form.minPoints, sortOrder: form.sortOrder, color: form.color || null, isActive: form.isActive };
    if (!body.name) { toast({ title: "名称不能为空", variant: "destructive" }); return; }
    if (editId === "new") createMut.mutate(body);
    else if (typeof editId === "number") updateMut.mutate({ id: editId, body });
  };

  return (
    <div>
      <SectionHeader
        title="信用等级配置"
        sub="配置账号信用等级体系：等级名称、积分阈值、徽章颜色"
        action={
          <button
            onClick={() => { setEditId("new"); resetForm(); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
            <Plus size={15} />新增等级
          </button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={18} className="animate-spin" />加载中…
        </div>
      ) : (
        <div className="space-y-2">
          {editId === "new" && (
            <div className="bg-white rounded-2xl shadow-sm border border-primary/20 p-5">
              <p className="text-sm font-bold text-slate-700 mb-3">新增信用等级</p>
              <CreditLevelForm form={form} setForm={setForm} onSave={handleSubmit} onCancel={() => setEditId(null)} saving={createMut.isPending} />
            </div>
          )}

          {levels.length === 0 && editId !== "new" ? (
            <div className="text-center py-16 text-slate-400">
              暂无信用等级配置，点击「新增等级」开始配置
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100">
              {levels.map(row => (
                <div key={row.id}>
                  {editId === row.id ? (
                    <div className="p-5">
                      <p className="text-sm font-bold text-slate-700 mb-3">编辑：{row.name}</p>
                      <CreditLevelForm form={form} setForm={setForm} onSave={handleSubmit} onCancel={() => setEditId(null)} saving={updateMut.isPending} isEdit />
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div
                        className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-white text-sm font-extrabold shadow-sm"
                        style={{ backgroundColor: row.color ?? "#94a3b8" }}>
                        {row.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-sm">{row.name}</span>
                          {!row.isActive && (
                            <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">已停用</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          最低积分{" "}
                          <span className="font-semibold text-slate-600">{(row.minPoints ?? 0).toLocaleString()}</span>
                          <span className="mx-2">·</span>
                          排序 {row.sortOrder}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(row)}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => { if (confirm(`确认删除等级「${row.name}」？此操作不可撤销。`)) deleteMut.mutate(row.id); }}
                          disabled={deleteMut.isPending}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface LevelCertPastReview {
  apply_level: "A" | "B" | "C";
  note: string | null;
  reviewed_at: string | null;
  status: "rejected" | "downgraded";
}

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
  track_current_level: string | null;
  credit_score: number | null;
  apply_count: number;
  past_reviews: LevelCertPastReview[] | null;
  cat_category_id: number | null;
  effective_cat_category_id: number | null;
  effective_cat_category_name: string | null;
  cat_inferred: boolean;
}

const LEVEL_STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending:    { text: "待审核", color: "bg-amber-100 text-amber-700" },
  approved:   { text: "已通过", color: "bg-green-100 text-green-700" },
  downgraded: { text: "降级通过", color: "bg-blue-100 text-blue-700" },
  rejected:   { text: "未通过", color: "bg-red-100 text-red-700" },
};

const LEVEL_ORDER = ["newbie", "C", "B", "A"] as const;
const LEVEL_LABELS: Record<string, string> = { newbie: "新手（未认证）", C: "C级·基础", B: "B级·进阶", A: "A级·专家" };
const TYPE_LABELS: Record<string, string> = {
  ai_education:     "AI 教育课程开发",
  gov_training:     "政企 AI 培训",
  ai_research:      "AI 研学项目",
  party_building:   "党建数字化",
  livestream_media: "直播与新媒体",
  ai_tool_dev:      "AI 工具开发",
  other:            "综合其他",
};

function LevelCertReview() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCatId, setFilterCatId] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(10);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [settingCatFor, setSettingCatFor] = useState<number | null>(null);
  const [setCatId, setSetCatId] = useState<string>("");
  const [setCatLevel, setSetCatLevel] = useState<string>("");
  const setPageSize = (s: number) => { setPageSizeRaw(s); setPage(1); };

  const { data: resp, isLoading, refetch } = useQuery<PagedResp<LevelCertRow>>({
    queryKey: ["admin-level-certs", filterStatus, filterCatId, page, pageSize],
    queryFn: () => adminGet(`/api/admin/level-certs?status=${filterStatus === "all" ? "" : filterStatus}&catCategoryId=${filterCatId === "all" ? "" : filterCatId}&page=${page}&pageSize=${pageSize}`),
  });

  const { data: catCategories } = useQuery<Array<{ id: number; code: string; name: string }>>({
    queryKey: ["admin-level-cert-categories"],
    queryFn: () => adminGet("/api/admin/level-certs/categories"),
    staleTime: 60000,
  });
  const filtered = resp?.data ?? [];

  // 单独查各状态总数，用于 Tab 角标
  const catParam = filterCatId === "all" ? "" : `&catCategoryId=${filterCatId}`;

  const { data: pendingResp } = useQuery<PagedResp<LevelCertRow>>({
    queryKey: ["admin-level-certs-pending-total", filterCatId],
    queryFn: () => adminGet(`/api/admin/level-certs?status=pending&page=1&pageSize=1${catParam}`),
    refetchInterval: 60000,
  });
  const pendingTotal = pendingResp?.total ?? 0;

  const { data: reviewedResp } = useQuery<PagedResp<LevelCertRow>>({
    queryKey: ["admin-level-certs-reviewed-total", filterCatId],
    queryFn: () => adminGet(`/api/admin/level-certs?status=reviewed&page=1&pageSize=1${catParam}`),
    refetchInterval: 60000,
  });
  const reviewedTotal = reviewedResp?.total ?? 0;

  const { data: rejectedResp } = useQuery<PagedResp<LevelCertRow>>({
    queryKey: ["admin-level-certs-rejected-total", filterCatId],
    queryFn: () => adminGet(`/api/admin/level-certs?status=rejected&page=1&pageSize=1${catParam}`),
    refetchInterval: 60000,
  });
  const rejectedTotal = rejectedResp?.total ?? 0;

  const { data: allResp } = useQuery<PagedResp<LevelCertRow>>({
    queryKey: ["admin-level-certs-all-total", filterCatId],
    queryFn: () => adminGet(`/api/admin/level-certs?status=all&page=1&pageSize=1${catParam}`),
    refetchInterval: 60000,
  });
  const allTotal = allResp?.total ?? 0;

  const reviewMut = useMutation({
    mutationFn: ({ portfolioId, result, downgradeTo, note }: { portfolioId: number; result: string; downgradeTo?: string; note: string }) =>
      adminPost(`/api/admin/level-certs/${portfolioId}/review`, { result, note, downgradeTo }),
    onSuccess: () => {
      toast({ title: "评审已提交", description: "评审结果已发送通知给OPC" });
      setReviewing(null);
      setReviewNote("");
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-level-certs"] });
      qc.invalidateQueries({ queryKey: ["admin-level-certs-pending-total"] });
      qc.invalidateQueries({ queryKey: ["admin-level-certs-reviewed-total"] });
      qc.invalidateQueries({ queryKey: ["admin-level-certs-rejected-total"] });
      qc.invalidateQueries({ queryKey: ["admin-level-certs-all-total"] });
    },
    onError: (e: any) => toast({ title: "提交失败", description: e?.message ?? "请稍后重试", variant: "destructive" }),
  });

  const setCategoryMut = useMutation({
    mutationFn: ({ portfolioId, catCategoryId, grantedLevel }: { portfolioId: number; userId: number; catCategoryId: number; grantedLevel?: string }) =>
      adminPatch(`/api/admin/level-certs/${portfolioId}/category`, { catCategoryId, grantedLevel }),
    onSuccess: (_, variables) => {
      toast({ title: "赛道已设置", description: "OPC赛道认证记录已更新" });
      setSettingCatFor(null);
      setSetCatId("");
      setSetCatLevel("");
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-level-certs"] });
      qc.invalidateQueries({ queryKey: ["admin-opc-detail", variables.userId] });
    },
    onError: (e: any) => toast({ title: "设置失败", description: e?.message ?? "请稍后重试", variant: "destructive" }),
  });

  return (
    <div>
      {/* 封面图放大 lightbox */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}>
          <img
            src={zoomedImage}
            alt="封面大图"
            className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
            onClick={e => e.stopPropagation()} />
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2"
            onClick={() => setZoomedImage(null)}>
            <XCircle size={24} />
          </button>
        </div>
      )}

      <SectionHeader
        title="赛道认证审核"
        sub={`共 ${resp?.total ?? 0} 条申请`}
        action={
          <div className="flex items-center gap-2">
            {catCategories && catCategories.length > 0 && (
              <select
                value={filterCatId}
                onChange={e => { setFilterCatId(e.target.value); setPage(1); }}
                className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-primary/30">
                <option value="all">全部赛道</option>
                {catCategories.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            )}
            <button onClick={() => refetch()} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <RefreshCw size={16} className="text-slate-500" />
            </button>
          </div>
        }
      />

      {/* Tab 过滤器 */}
      <div className="flex gap-1 border-b border-slate-200 mb-4 -mt-2">
        {([
          { val: "all",     label: "全部" },
          { val: "pending", label: "待审核" },
          { val: "reviewed", label: "已通过" },
          { val: "rejected", label: "未通过" },
        ] as const).map(tab => (
          <button
            key={tab.val}
            onClick={() => { setFilterStatus(tab.val); setPage(1); setReviewing(null); setReviewNote(""); }}
            className={`px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              filterStatus === tab.val
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            {tab.val === "all" && allTotal > 0 && (
              <span className="ml-1.5 bg-slate-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {allTotal}
              </span>
            )}
            {tab.val === "pending" && pendingTotal > 0 && filterStatus !== "pending" && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingTotal}
              </span>
            )}
            {tab.val === "reviewed" && reviewedTotal > 0 && filterStatus !== "reviewed" && (
              <span className="ml-1.5 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {reviewedTotal}
              </span>
            )}
            {tab.val === "rejected" && rejectedTotal > 0 && filterStatus !== "rejected" && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {rejectedTotal}
              </span>
            )}
          </button>
        ))}
      </div>

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

            // 计算可用审核选项（基于当前赛道等级，而非全局等级）
            const trackLevelForRow = row.track_current_level ?? null;
            const currentLevelIdx = trackLevelForRow ? LEVEL_ORDER.indexOf(trackLevelForRow as any) : -1;
            const applyLevelIdx = LEVEL_ORDER.indexOf(row.apply_level);
            // 可通过：申请等级必须高于当前赛道等级
            const canApprove = applyLevelIdx > currentLevelIdx;
            // 可降级通过的等级列表：apply_level-1 到 track_current_level+1 之间（且不为 newbie）
            const downgradeLevels: string[] = [];
            for (let i = currentLevelIdx + 1; i < applyLevelIdx; i++) {
              if (LEVEL_ORDER[i] !== "newbie") downgradeLevels.push(LEVEL_ORDER[i]);
            }

            return (
              <div key={row.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
                {/* 主行 */}
                <div
                  className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    if (!isOpen) {
                      setReviewing(null);
                      setReviewNote("");
                    }
                    setExpanded(isOpen ? null : row.id);
                  }}>
                  {row.cover_image ? (
                    <img
                      src={row.cover_image}
                      alt="cover"
                      title="点击放大"
                      className="w-14 h-14 rounded-xl object-cover shrink-0 cursor-zoom-in hover:ring-2 hover:ring-primary/50 transition-all"
                      onClick={e => { e.stopPropagation(); setZoomedImage(row.cover_image!); }} />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <ImageIcon size={20} className="text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-blue-900 text-sm truncate">{row.title}</p>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                        {TYPE_LABELS[row.type] ?? row.type}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                        {statusInfo.text}
                      </span>
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        申请 {row.apply_level} 级
                      </span>
                      {row.apply_count > 1 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                          第 {row.apply_count} 次申请
                        </span>
                      )}
                      {row.effective_cat_category_name ? (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          {row.effective_cat_category_name}
                          {row.cat_inferred && <span className="ml-1 opacity-60 font-normal">·自动推断</span>}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          赛道待确认
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>{row.nickname}</span>
                      <span>·</span>
                      <span>
                        该赛道当前：
                        <span className="font-medium text-slate-600">
                          {row.track_current_level ? `${row.track_current_level} 级` : "暂无认证"}
                        </span>
                        {" → 申请 "}
                        <span className="font-semibold text-amber-700">{row.apply_level} 级</span>
                      </span>
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
                    {/* 封面大图预览 */}
                    {row.cover_image && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">封面图</p>
                        <img
                          src={row.cover_image}
                          alt="封面"
                          title="点击放大"
                          onClick={() => setZoomedImage(row.cover_image!)}
                          className="w-full max-h-64 object-cover rounded-xl cursor-zoom-in hover:opacity-90 transition-opacity" />
                      </div>
                    )}

                    {/* 赛道 + 项目类型 + 当前赛道等级 + 申请等级 */}
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">赛道分类</p>
                        <p className="text-sm text-slate-700 font-medium">
                          {row.effective_cat_category_name ?? "未指定"}
                          {row.cat_inferred && (
                            <span className="ml-1.5 text-[11px] text-purple-500 font-normal">(自动推断)</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">项目类型</p>
                        <p className="text-sm text-slate-700 font-medium">{TYPE_LABELS[row.type] ?? row.type}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">该赛道当前等级</p>
                        <p className="text-sm font-medium text-slate-600">
                          {row.track_current_level ? `${row.track_current_level} 级 · ${LEVEL_LABELS[row.track_current_level] ?? ""}` : "暂无认证"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">申请等级</p>
                        <p className="text-sm font-bold text-amber-700">{row.apply_level} 级 · {LEVEL_LABELS[row.apply_level]}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">作品简介</p>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{row.description}</p>
                    </div>

                    {row.project_url && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">作品链接 / 下载地址</p>
                        <a href={row.project_url} target="_blank" rel="noreferrer"
                          className="text-sm text-primary underline break-all hover:text-primary/80 transition-colors">
                          {row.project_url}
                        </a>
                      </div>
                    )}

                    {/* 过往申请历史 */}
                    {row.past_reviews && row.past_reviews.length > 0 && (
                      <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3 space-y-2">
                        <p className="text-xs font-bold text-orange-700 mb-1">过往申请记录（共 {row.apply_count} 次）</p>
                        {row.past_reviews.map((pr, i) => (
                          <div key={i} className="border-l-2 border-orange-200 pl-3">
                            <div className="flex items-center gap-2 text-xs text-orange-600 font-medium">
                              <span>申请 {pr.apply_level} 级</span>
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                pr.status === "rejected" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                              }`}>
                                {pr.status === "rejected" ? "未通过" : "降级通过"}
                              </span>
                              {pr.reviewed_at && (
                                <span className="text-slate-400">{new Date(pr.reviewed_at).toLocaleDateString("zh-CN")}</span>
                              )}
                            </div>
                            {pr.note && (
                              <p className="text-xs text-slate-600 mt-0.5">{pr.note}</p>
                            )}
                            {!pr.note && (
                              <p className="text-xs text-slate-400 mt-0.5 italic">（无评审意见）</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 本次已审结果（非 pending） */}
                    {row.level_apply_note && row.level_apply_status !== "pending" && (
                      <div className="bg-slate-50 rounded-xl px-4 py-3">
                        <p className="text-xs font-bold text-slate-500 mb-0.5">本次评审意见</p>
                        <p className="text-sm text-slate-700">{row.level_apply_note}</p>
                        {row.reviewed_at && (
                          <p className="text-[11px] text-slate-400 mt-1">评审于 {new Date(row.reviewed_at).toLocaleDateString("zh-CN")}</p>
                        )}
                      </div>
                    )}

                    {/* 评审操作区 */}
                    {isReviewing && row.level_apply_status === "pending" && (
                      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                        {row.cat_inferred && row.effective_cat_category_name && (
                          <div className="flex items-start gap-2 bg-purple-50 border border-purple-200 rounded-xl px-3 py-2.5">
                            <AlertCircle size={15} className="text-purple-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-purple-700 font-medium leading-snug">
                              该作品未手动选择赛道，系统已从项目类型「{row.type}」自动推断为
                              <strong>「{row.effective_cat_category_name}」</strong>赛道。
                              通过认证后将写入该赛道。
                            </p>
                          </div>
                        )}
                        {!row.effective_cat_category_id && (
                          <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5">
                            <AlertCircle size={15} className="text-orange-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-orange-700 font-medium leading-snug">
                              该作品未选择赛道分类，无法写入赛道认证记录。请驳回后让 OPC 重新选择赛道分类后再提交。
                            </p>
                          </div>
                        )}
                        <p className="text-sm font-bold text-amber-800">
                          评审该作品 ·
                          {row.effective_cat_category_name
                            ? <span className="text-amber-700">「{row.effective_cat_category_name}」</span>
                            : " "}
                          申请 <span className="text-amber-900">{row.apply_level} 级</span>
                          <span className="text-xs font-normal text-amber-600 ml-2">
                            （该赛道当前：{row.track_current_level ? `${row.track_current_level} 级` : "暂无认证"}）
                          </span>
                        </p>
                        <textarea
                          rows={3}
                          value={reviewNote}
                          onChange={e => setReviewNote(e.target.value)}
                          placeholder="请填写评审意见（将在通知中发送给OPC，可留空）"
                          className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300 resize-none bg-white" />
                        <div className={`grid gap-2 ${downgradeLevels.length === 0 ? "grid-cols-2" : downgradeLevels.length === 1 ? "grid-cols-3" : "grid-cols-4"}`}>
                          {/* 认证通过 */}
                          {canApprove && (
                            <button
                              onClick={() => reviewMut.mutate({ portfolioId: row.id, result: "approved", note: reviewNote })}
                              disabled={reviewMut.isPending}
                              className="py-2.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                              <CheckCircle2 size={14} />
                              认证通过 · 获得 {row.apply_level} 级
                            </button>
                          )}
                          {/* 降级通过（每个可降等级一个按钮） */}
                          {downgradeLevels.map(lvl => (
                            <button
                              key={lvl}
                              onClick={() => reviewMut.mutate({ portfolioId: row.id, result: "downgraded", downgradeTo: lvl, note: reviewNote })}
                              disabled={reviewMut.isPending}
                              className="py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                              <Award size={14} />
                              降级通过 · {LEVEL_LABELS[lvl] ?? lvl}
                            </button>
                          ))}
                          {/* 还需努力 */}
                          <button
                            onClick={() => reviewMut.mutate({ portfolioId: row.id, result: "rejected", note: reviewNote })}
                            disabled={reviewMut.isPending}
                            className="py-2.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                            <XCircle size={14} />
                            还需努力
                          </button>
                        </div>
                        {!canApprove && downgradeLevels.length === 0 && (
                          <p className="text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
                            ⚠️ 该OPC在「{row.effective_cat_category_name ?? "此赛道"}」已持有 <strong>{trackLevelForRow}</strong> 级认证，申请的 {row.apply_level} 级不高于该赛道已有等级，无法通过（只能拒绝）。
                          </p>
                        )}
                      </div>
                    )}

                    {/* 设置赛道：仅对已通过/降级通过且尚无赛道的认证显示 */}
                    {(row.level_apply_status === "approved" || row.level_apply_status === "downgraded") && !row.effective_cat_category_id && (
                      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
                        <p className="text-sm font-bold text-purple-800">
                          设置赛道
                          <span className="text-xs font-normal text-purple-600 ml-2">该认证尚未关联赛道，设置后将更新 OPC 的赛道等级记录</span>
                        </p>
                        {settingCatFor === row.id ? (
                          <div className="space-y-2">
                            <select
                              value={setCatId}
                              onChange={e => setSetCatId(e.target.value)}
                              className="w-full border border-purple-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-300">
                              <option value="">-- 选择赛道 --</option>
                              {(catCategories ?? []).map(c => (
                                <option key={c.id} value={String(c.id)}>{c.name}</option>
                              ))}
                            </select>
                            {row.level_apply_status === "downgraded" && (
                              <select
                                value={setCatLevel}
                                onChange={e => setSetCatLevel(e.target.value)}
                                className="w-full border border-purple-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-300">
                                <option value="">-- 选择实际授予等级（降级通过）--</option>
                                {(["C", "B", "A"] as const)
                                  .filter(l => l !== row.apply_level)
                                  .map(l => (
                                    <option key={l} value={l}>{LEVEL_LABELS[l] ?? l}</option>
                                  ))}
                              </select>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (!setCatId) return;
                                  setCategoryMut.mutate({
                                    portfolioId: row.id,
                                    userId: row.user_id,
                                    catCategoryId: Number(setCatId),
                                    grantedLevel: row.level_apply_status === "downgraded" ? setCatLevel || undefined : undefined,
                                  });
                                }}
                                disabled={!setCatId || setCategoryMut.isPending || (row.level_apply_status === "downgraded" && !setCatLevel)}
                                className="flex-1 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-colors disabled:opacity-40">
                                确认设置
                              </button>
                              <button
                                onClick={() => { setSettingCatFor(null); setSetCatId(""); setSetCatLevel(""); }}
                                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors">
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setSettingCatFor(row.id); setSetCatId(""); setSetCatLevel(""); }}
                            className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-colors">
                            选择赛道
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <AdminPagination page={page} pageSize={pageSize} total={resp?.total ?? 0} onPage={setPage} onPageSize={setPageSize} />
    </div>
  );
}

/* ─── Module: 敏感词管理 ─────────────────────────── */

interface SensitiveWordRow { id: number; word: string; createdAt: string; }

function SensitiveWordsManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");

  const { data: words = [], isLoading } = useQuery<SensitiveWordRow[]>({
    queryKey: ["admin-sensitive-words"],
    queryFn: () => adminGet("/api/admin/sensitive-words"),
  });

  const addWord = useMutation({
    mutationFn: (word: string) =>
      fetch(`${BASE}/api/admin/sensitive-words`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ word }),
      }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-sensitive-words"] });
      setInput("");
      toast({ title: "敏感词已添加" });
    },
    onError: (e: Error) => toast({ title: "添加失败", description: e.message, variant: "destructive" }),
  });

  const deleteWord = useMutation({
    mutationFn: (id: number) => adminDelete(`/api/admin/sensitive-words/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-sensitive-words"] }); toast({ title: "敏感词已删除" }); },
    onError: () => toast({ title: "删除失败", variant: "destructive" }),
  });

  const filtered = words.filter(w => !search || w.word.includes(search));

  return (
    <div className="space-y-6">
      <SectionHeader
        title="敏感词管理"
        sub="管理社区发帖的内容过滤词库，含有敏感词的帖子将被拦截"
        action={
          <div className="px-3 py-1.5 bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <Flame size={13} /> 词库 {words.length} 个
          </div>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">添加新敏感词</h3>
        <div className="flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && input.trim()) addWord.mutate(input.trim()); }}
            placeholder="输入敏感词，回车或点击添加…"
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={() => { if (input.trim()) addWord.mutate(input.trim()); }}
            disabled={addWord.isPending || !input.trim()}
            className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {addWord.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            添加
          </button>
        </div>
        <p className="text-xs text-slate-400">系统已内置黄赌毒及政治反动类敏感词，可在此继续扩充词库。发帖内容（标题+正文）含有任意敏感词时将被拦截。</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">当前词库</h3>
          <div className="relative">
            <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索词库…"
              className="pl-8 pr-4 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 w-40"
            />
          </div>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" />加载中…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">暂无敏感词</div>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-80 overflow-y-auto">
            {filtered.map(w => (
              <span key={w.id} className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-medium px-3 py-1.5 rounded-full">
                {w.word}
                <button
                  onClick={() => deleteWord.mutate(w.id)}
                  className="ml-0.5 hover:text-red-900 transition-colors"
                  title="删除"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Module: 保证金审核 ─────────────────────────── */

interface PaymentRow {
  id: number;
  demandId: number;
  amount: number;
  method: string;
  status: string;
  receiptUrl?: string | null;
  paymentNote?: string | null;
  rejectReason?: string | null;
  confirmedAt?: string | null;
  createdAt: string;
  demandTitle?: string | null;
  publisherName?: string | null;
  publisherEmail?: string | null;
  publisherPhone?: string | null;
  paymentOrderNo?: string | null;
  refundOrderNo?: string | null;
  refundedAt?: string | null;
}

function DepositPaymentManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"pending" | "confirmed" | "rejected" | "all">("pending");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [refundingId, setRefundingId] = useState<number | null>(null);
  const [refundNote, setRefundNote] = useState("");

  const queryKey = ["admin-demand-payments", statusFilter];
  const { data: payments = [], isLoading } = useQuery<PaymentRow[]>({
    queryKey,
    queryFn: () => adminGet(`/api/admin/demand-payments?status=${statusFilter}`),
  });

  const handleConfirm = async (paymentId: number) => {
    setActionLoading(paymentId);
    try {
      await adminPatch(`/api/admin/demand-payments/${paymentId}`, { action: "confirm" });
      toast({ title: "已确认收款", description: "需求已自动发布至需求大厅" });
      qc.invalidateQueries({ queryKey });
      setExpandedId(null);
    } catch (e: any) {
      toast({ title: "操作失败", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (paymentId: number) => {
    if (!rejectNote.trim()) { toast({ title: "请填写拒绝原因", variant: "destructive" }); return; }
    setActionLoading(paymentId);
    try {
      await adminPatch(`/api/admin/demand-payments/${paymentId}`, { action: "reject", rejectReason: rejectNote.trim() });
      toast({ title: "已拒绝并通知发布方" });
      qc.invalidateQueries({ queryKey });
      setRejectingId(null);
      setRejectNote("");
      setExpandedId(null);
    } catch (e: any) {
      toast({ title: "操作失败", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefund = async (paymentId: number) => {
    setActionLoading(paymentId);
    try {
      await adminPost(`/api/admin/demand-payments/${paymentId}/refund`, { reason: refundNote.trim() || "管理员退款" });
      toast({ title: "退款已发起", description: "退款将在1-3个工作日内到账" });
      qc.invalidateQueries({ queryKey });
      setRefundingId(null);
      setRefundNote("");
      setExpandedId(null);
    } catch (e: any) {
      toast({ title: "退款失败", description: e.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const STATUS_TABS: { key: typeof statusFilter; label: string }[] = [
    { key: "pending",   label: "待审核" },
    { key: "confirmed", label: "已确认" },
    { key: "rejected",  label: "已拒绝" },
    { key: "all",       label: "全部" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="保证金审核"
        sub="审核发布方缴纳的保证金凭证，确认到账后需求自动发布"
        action={
          <div className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <Receipt size={13} />
            待审核 {payments.filter(p => p.status === "pending").length}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-2">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              statusFilter === t.key
                ? "bg-primary text-white shadow-sm"
                : "bg-white text-slate-500 border border-slate-200 hover:border-primary/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" />加载中…
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-slate-400">
          <Receipt size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无{STATUS_TABS.find(t => t.key === statusFilter)?.label}记录</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payments.map(payment => {
            const isExpanded = expandedId === payment.id;
            const isRejecting = rejectingId === payment.id;
            const loading = actionLoading === payment.id;
            return (
              <div key={payment.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <button
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : payment.id)}
                >
                  <div className="flex items-center gap-4 text-left">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {payment.demandTitle ?? `需求 #${payment.demandId}`}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(payment.createdAt).toLocaleString("zh-CN")} ·{" "}
                        {payment.method === "offline" ? "线下转账" : "在线支付"}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      payment.status === "pending" ? "bg-amber-100 text-amber-700" :
                      payment.status === "confirmed" ? "bg-emerald-100 text-emerald-700" :
                      "bg-red-100 text-red-600"
                    }`}>
                      {payment.status === "pending" ? "待审核" : payment.status === "confirmed" ? "已确认" : "已拒绝"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <p className="text-lg font-extrabold text-primary">¥{payment.amount.toLocaleString()}</p>
                    {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-100 px-6 py-5 space-y-4">
                    {/* Publisher info */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">发布方信息</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-slate-400 mb-0.5">姓名 / 昵称</p>
                          <p className="text-sm font-medium text-slate-800">{payment.publisherName ?? "—"}</p>
                        </div>
                        {payment.publisherPhone && (
                          <div>
                            <p className="text-xs text-slate-400 mb-0.5">手机号</p>
                            <p className="text-sm font-medium text-slate-800">{payment.publisherPhone}</p>
                          </div>
                        )}
                        {payment.publisherEmail && (
                          <div className="col-span-2">
                            <p className="text-xs text-slate-400 mb-0.5">邮箱</p>
                            <p className="text-sm font-medium text-slate-800">{payment.publisherEmail}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">需求ID</p>
                        <p className="text-sm text-slate-700">#{payment.demandId}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">保证金金额</p>
                        <p className="text-sm font-bold text-primary">¥{payment.amount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">缴费方式</p>
                        <p className="text-sm text-slate-700">{payment.method === "offline" ? "线下转账" : "在线支付"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">提交时间</p>
                        <p className="text-sm text-slate-700">{new Date(payment.createdAt).toLocaleString("zh-CN")}</p>
                      </div>
                    </div>

                    {safeUrl(payment.receiptUrl) && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">缴费凭证</p>
                        <a href={safeUrl(payment.receiptUrl)} target="_blank" rel="noopener noreferrer">
                          <img
                            src={safeUrl(payment.receiptUrl)}
                            alt="缴费凭证截图"
                            className="max-h-64 rounded-xl border border-slate-200 object-contain bg-slate-50 hover:opacity-90 transition-opacity cursor-zoom-in"
                            onError={e => {
                              const img = e.target as HTMLImageElement;
                              img.style.display = "none";
                              const link = document.createElement("a");
                              link.href = safeUrl(payment.receiptUrl) ?? "#";
                              link.target = "_blank";
                              link.rel = "noopener noreferrer";
                              link.className = "text-sm text-primary underline break-all";
                              link.textContent = "点击查看凭证";
                              img.parentElement?.appendChild(link);
                            }}
                          />
                        </a>
                      </div>
                    )}

                    {payment.paymentNote && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">缴费备注</p>
                        <p className="text-sm text-slate-700 bg-slate-50 rounded-xl p-3">{payment.paymentNote}</p>
                      </div>
                    )}

                    {payment.status === "rejected" && payment.rejectReason && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                        <p className="text-xs font-bold text-red-600 mb-1">拒绝原因</p>
                        <p className="text-sm text-red-700">{payment.rejectReason}</p>
                      </div>
                    )}

                    {payment.status === "confirmed" && payment.confirmedAt && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1">
                        <p className="text-xs font-bold text-emerald-600 mb-1">确认时间</p>
                        <p className="text-sm text-emerald-700">{new Date(payment.confirmedAt).toLocaleString("zh-CN")}</p>
                        {payment.paymentOrderNo && (
                          <p className="text-xs text-slate-500">支付订单号：{payment.paymentOrderNo}</p>
                        )}
                        {payment.refundOrderNo && (
                          <p className="text-xs text-slate-500">退款订单号：{payment.refundOrderNo}</p>
                        )}
                        {payment.refundedAt && (
                          <p className="text-xs text-slate-500">退款时间：{new Date(payment.refundedAt).toLocaleString("zh-CN")}</p>
                        )}
                      </div>
                    )}

                    {payment.status === "confirmed" && payment.method === "online" && !payment.refundOrderNo && (
                      <div className="pt-2">
                        {refundingId === payment.id ? (
                          <div className="space-y-3 border border-orange-200 rounded-xl p-3 bg-orange-50">
                            <p className="text-xs font-bold text-orange-700">发起退款（在线支付订单）</p>
                            <textarea
                              value={refundNote}
                              onChange={e => setRefundNote(e.target.value)}
                              placeholder={'退款原因（选填，留空默认"管理员退款"）'}
                              rows={2}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-orange-200 focus:border-orange-400 outline-none resize-none bg-white"
                            />
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleRefund(payment.id)}
                                disabled={actionLoading === payment.id}
                                className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-700 disabled:opacity-50 transition-colors"
                              >
                                {actionLoading === payment.id ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />}
                                确认退款
                              </button>
                              <button
                                onClick={() => { setRefundingId(null); setRefundNote(""); }}
                                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setRefundingId(payment.id)}
                            className="flex items-center gap-2 border border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                          >
                            <Undo2 size={14} /> 发起退款
                          </button>
                        )}
                      </div>
                    )}

                    {payment.status === "pending" && (
                      <div className="space-y-3 pt-2">
                        {isRejecting ? (
                          <div className="space-y-3">
                            <textarea
                              value={rejectNote}
                              onChange={e => setRejectNote(e.target.value)}
                              placeholder="请填写拒绝原因（将通知发布方）"
                              rows={3}
                              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                            />
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleReject(payment.id)}
                                disabled={loading}
                                className="flex items-center gap-2 bg-red-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 disabled:opacity-50 transition-colors"
                              >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                                确认拒绝
                              </button>
                              <button
                                onClick={() => { setRejectingId(null); setRejectNote(""); }}
                                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleConfirm(payment.id)}
                              disabled={loading}
                              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                              确认收款并发布需求
                            </button>
                            <button
                              onClick={() => setRejectingId(payment.id)}
                              className="flex items-center gap-2 bg-red-50 text-red-600 border border-red-200 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors"
                            >
                              <XCircle size={14} /> 拒绝
                            </button>
                          </div>
                        )}
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

/* ─── RBAC: permission key labels ────────────────── */

const PERM_LABELS: Record<string, string> = {
  dashboard:      "数据看板",
  cockpit:        "平台驾驶舱",
  users:          "用户管理",
  demands:        "需求管理",
  payments:       "保证金审核",
  orders:         "订单管理",
  disputes:       "争议管理",
  finance:        "财务管理",
  ecosystem:      "OPC 生态池",
  training:       "认证培训",
  levelcert:      "等级认证",
  content:        "内容审核",
  sensitivewords: "敏感词管理",
  settings:       "站点设置",
  screen:         "数据大屏",
};

const PERM_SUB: Record<string, string> = {
  finance:  "财务管理 · 结算账户审核",
  settings: "站点设置 · 智能体配置",
  screen:   "横屏大屏 · 竖屏大屏",
};

const ALL_PERM_KEYS = Object.keys(PERM_LABELS);

type AdminRole = {
  id: number; name: string; description: string | null;
  permissions: string[]; memberCount: number;
  createdAt: string; updatedAt: string;
};

type AdminAccount = {
  id: number; nickname: string; email: string;
  isSuperAdmin: boolean; roleIds: number[]; createdAt: string;
};

/* ─── AdminRolesPanel ────────────────────────────── */

function AdminRolesPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm, confirmDialog } = useConfirm();

  const { data: roles = [], isLoading } = useQuery<AdminRole[]>({
    queryKey: ["admin-roles"],
    queryFn: () => adminGet("/api/admin/roles"),
  });

  const [showForm, setShowForm] = useState(false);
  const [editRole, setEditRole] = useState<AdminRole | null>(null);
  const [form, setForm] = useState({ name: "", description: "", permissions: [] as string[] });

  function openCreate() {
    setEditRole(null);
    setForm({ name: "", description: "", permissions: [] });
    setShowForm(true);
  }

  function openEdit(r: AdminRole) {
    setEditRole(r);
    setForm({ name: r.name, description: r.description ?? "", permissions: [...r.permissions] });
    setShowForm(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      if (editRole) {
        return adminPatch(`/api/admin/roles/${editRole.id}`, form);
      }
      return adminPost("/api/admin/roles", form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
      setShowForm(false);
      toast({ title: editRole ? "角色已更新" : "角色已创建" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminDelete(`/api/admin/roles/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
      toast({ title: "角色已删除" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  function togglePerm(key: string) {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter(p => p !== key)
        : [...f.permissions, key],
    }));
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="角色管理"
        sub="创建和管理权限角色，为管理员分配不同的功能模块访问权限"
        action={
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
            <Plus size={15} /> 新建角色
          </button>
        }
      />

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-primary/20">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-blue-900">{editRole ? "编辑角色" : "新建角色"}</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">角色名称 *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例如：运营专员、财务审核"
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">备注说明</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="可选，描述该角色的职责"
                className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">可访问模块</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {ALL_PERM_KEYS.map(key => (
                  <label key={key} className={`flex items-start gap-2 px-3 py-2 rounded-xl border cursor-pointer text-sm transition-colors ${
                    form.permissions.includes(key)
                      ? "bg-primary/10 border-primary text-primary font-bold"
                      : "border-slate-200 text-slate-600 hover:border-primary/40"
                  }`}>
                    <input type="checkbox" className="hidden" checked={form.permissions.includes(key)} onChange={() => togglePerm(key)} />
                    <Check size={13} className={`mt-0.5 shrink-0 ${form.permissions.includes(key) ? "text-primary" : "text-transparent"}`} />
                    <span className="flex flex-col min-w-0">
                      <span>{PERM_LABELS[key]}</span>
                      {PERM_SUB[key] && (
                        <span className={`text-[9px] leading-tight mt-0.5 font-normal truncate ${
                          form.permissions.includes(key) ? "text-primary/60" : "text-slate-400"
                        }`}>{PERM_SUB[key]}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">取消</button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.name.trim()}
                className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-primary/90">
                {saveMutation.isPending ? "保存中…" : "保存角色"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={20} className="animate-spin" /> 加载中…
        </div>
      ) : roles.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-slate-400">
          <KeyRound size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无角色，点击「新建角色」创建第一个角色</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {roles.map(r => (
            <div key={r.id} className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-blue-900">{r.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                      {r.memberCount} 名管理员
                    </span>
                  </div>
                  {r.description && <p className="text-xs text-slate-400 mb-2">{r.description}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {r.permissions.length === 0
                      ? <span className="text-xs text-slate-400">（无权限）</span>
                      : r.permissions.map(p => (
                          <span key={p} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full">
                            {PERM_LABELS[p] ?? p}
                          </span>
                        ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(r)}
                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => {
                      askConfirm({ title: `删除角色「${r.name}」？`, description: "此操作不可恢复，所有使用该角色的管理员将失去对应权限。", confirmLabel: "确认删除", confirmVariant: "destructive", onConfirm: () => deleteMutation.mutate(r.id) });
                    }}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

/* ─── AdminUsersPanel ────────────────────────────── */

function AdminUsersPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm, confirmDialog } = useConfirm();

  const { data: admins = [], isLoading } = useQuery<AdminAccount[]>({
    queryKey: ["rbac-admin-accounts"],
    queryFn: () => adminGet("/api/admin/admin-users"),
  });

  const { data: allRoles = [] } = useQuery<AdminRole[]>({
    queryKey: ["admin-roles"],
    queryFn: () => adminGet("/api/admin/roles"),
  });

  const [showInvite, setShowInvite] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: number; nickname: string; email: string; role: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: number; nickname: string; email: string } | null>(null);
  const [inviteRoles, setInviteRoles] = useState<number[]>([]);
  const [editAdminId, setEditAdminId] = useState<number | null>(null);
  const [editRoles, setEditRoles] = useState<number[]>([]);

  const searchMutation = useMutation({
    mutationFn: (q: string) => adminGet<{ id: number; nickname: string; email: string; role: string }[]>(`/api/admin/admin-users/search-users?q=${encodeURIComponent(q)}`),
    onSuccess: setSearchResults,
  });

  function handleSearch(q: string) {
    setSearchQ(q);
    if (q.trim().length >= 1) searchMutation.mutate(q.trim());
    else setSearchResults([]);
  }

  const promoteMutation = useMutation({
    mutationFn: () => adminPost("/api/admin/admin-users", { userId: selectedUser!.id, roleIds: inviteRoles }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac-admin-accounts"] });
      setShowInvite(false);
      setSelectedUser(null);
      setInviteRoles([]);
      toast({ title: "管理员已添加" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const updateRolesMutation = useMutation({
    mutationFn: ({ id, roles }: { id: number; roles: number[] }) => adminPatch(`/api/admin/admin-users/${id}`, { roleIds: roles }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac-admin-accounts"] });
      setEditAdminId(null);
      toast({ title: "角色已更新" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => adminDelete(`/api/admin/admin-users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac-admin-accounts"] });
      toast({ title: "管理员权限已撤销" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const roleMap = Object.fromEntries(allRoles.map(r => [r.id, r.name]));

  return (
    <div className="space-y-6">
      <SectionHeader
        title="管理员管理"
        sub="添加和管理平台管理员账号，分配角色以控制功能访问权限"
        action={
          <button onClick={() => { setShowInvite(true); setSelectedUser(null); setSearchQ(""); setSearchResults([]); setInviteRoles([]); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
            <Plus size={15} /> 添加管理员
          </button>
        }
      />

      {showInvite && (
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-primary/20">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-blue-900">添加管理员</h3>
            <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <div className="space-y-4">
            {!selectedUser ? (
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">搜索用户（昵称或邮箱）</label>
                <input value={searchQ} onChange={e => handleSearch(e.target.value)}
                  placeholder="输入关键词搜索现有用户…"
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                {searchResults.length > 0 && (
                  <div className="mt-2 border rounded-xl overflow-hidden divide-y">
                    {searchResults.map(u => (
                      <button key={u.id} onClick={() => { setSelectedUser(u); setSearchResults([]); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                          {u.nickname?.[0] ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-blue-900 truncate">{u.nickname}</p>
                          <p className="text-xs text-slate-400 truncate">{u.email} · {u.role}</p>
                        </div>
                        <ChevronRight size={14} className="text-slate-300 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {selectedUser.nickname[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-blue-900">{selectedUser.nickname}</p>
                  <p className="text-xs text-slate-500">{selectedUser.email}</p>
                </div>
                <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-600"><X size={15} /></button>
              </div>
            )}

            {selectedUser && (
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2">分配角色（可多选）</label>
                {allRoles.length === 0
                  ? <p className="text-sm text-slate-400">请先在「角色管理」中创建角色</p>
                  : (
                    <div className="flex flex-wrap gap-2">
                      {allRoles.map(r => (
                        <label key={r.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border cursor-pointer text-sm transition-colors ${
                          inviteRoles.includes(r.id) ? "bg-primary/10 border-primary text-primary font-bold" : "border-slate-200 text-slate-600 hover:border-primary/40"
                        }`}>
                          <input type="checkbox" className="hidden" checked={inviteRoles.includes(r.id)}
                            onChange={() => setInviteRoles(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])} />
                          <Check size={12} className={inviteRoles.includes(r.id) ? "text-primary" : "text-transparent"} />
                          {r.name}
                        </label>
                      ))}
                    </div>
                  )
                }
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowInvite(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">取消</button>
              <button onClick={() => promoteMutation.mutate()} disabled={!selectedUser || promoteMutation.isPending}
                className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-primary/90">
                {promoteMutation.isPending ? "添加中…" : "确认添加"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
          <Loader2 size={20} className="animate-spin" /> 加载中…
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
              <tr>
                <th className="px-6 py-4">管理员</th>
                <th className="px-6 py-4">类型</th>
                <th className="px-6 py-4">已分配角色</th>
                <th className="px-6 py-4">加入时间</th>
                <th className="px-6 py-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {admins.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">暂无数据</td></tr>
              )}
              {admins.map(a => (
                <tr key={a.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                        {a.nickname[0]}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-blue-900">{a.nickname}</p>
                        <p className="text-xs text-slate-400">{a.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {a.isSuperAdmin
                      ? <span className="flex items-center gap-1 text-amber-600 text-xs font-bold"><ShieldAlert size={13} /> 超级管理员</span>
                      : <span className="text-xs text-slate-500">普通管理员</span>
                    }
                  </td>
                  <td className="px-6 py-4">
                    {a.isSuperAdmin
                      ? <span className="text-xs text-slate-400">全部权限</span>
                      : (
                        editAdminId === a.id
                          ? (
                            <div className="flex flex-wrap gap-1">
                              {allRoles.map(r => (
                                <label key={r.id} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border cursor-pointer transition-colors ${
                                  editRoles.includes(r.id) ? "bg-primary/10 border-primary text-primary font-bold" : "border-slate-200 text-slate-500"
                                }`}>
                                  <input type="checkbox" className="hidden" checked={editRoles.includes(r.id)}
                                    onChange={() => setEditRoles(prev => prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id])} />
                                  {r.name}
                                </label>
                              ))}
                            </div>
                          )
                          : (
                            <div className="flex flex-wrap gap-1">
                              {a.roleIds.length === 0
                                ? <span className="text-xs text-slate-400">（未分配角色）</span>
                                : a.roleIds.map(rid => (
                                    <span key={rid} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-full">
                                      {roleMap[rid] ?? `角色${rid}`}
                                    </span>
                                  ))
                              }
                            </div>
                          )
                      )
                    }
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {new Date(a.createdAt).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-6 py-4">
                    {!a.isSuperAdmin && (
                      <div className="flex items-center gap-1">
                        {editAdminId === a.id ? (
                          <>
                            <button onClick={() => updateRolesMutation.mutate({ id: a.id, roles: editRoles })}
                              disabled={updateRolesMutation.isPending}
                              className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-bold disabled:opacity-50 hover:bg-primary/90">
                              保存
                            </button>
                            <button onClick={() => setEditAdminId(null)} className="px-3 py-1 text-slate-400 hover:text-slate-600 text-xs">取消</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditAdminId(a.id); setEditRoles([...a.roleIds]); }}
                              className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => {
                                askConfirm({ title: `撤销「${a.nickname}」的管理员权限？`, description: "该用户将失去所有后台访问权限，恢复为普通用户。", confirmLabel: "确认撤销", confirmVariant: "destructive", onConfirm: () => revokeMutation.mutate(a.id) });
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <UserX size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

/* ─── LlmProviderManagement ──────────────────────── */

type LlmProvider = {
  id: number;
  name: string;
  displayName: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  isActive: boolean;
  remark: string | null;
  createdAt: string;
};

const PRESET_PROVIDERS = [
  { label: "DeepSeek", name: "deepseek", baseUrl: "https://api.deepseek.com", defaultModel: "deepseek-chat" },
  { label: "OpenAI", name: "openai", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o" },
  { label: "Moonshot (Kimi)", name: "moonshot", baseUrl: "https://api.moonshot.cn/v1", defaultModel: "moonshot-v1-8k" },
  { label: "Qwen (通义)", name: "qwen", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-turbo" },
  { label: "Zhipu (智谱)", name: "zhipu", baseUrl: "https://open.bigmodel.cn/api/paas/v4", defaultModel: "glm-4" },
  { label: "自定义", name: "", baseUrl: "", defaultModel: "" },
];

function LlmProviderManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: providers, isLoading } = useQuery<LlmProvider[]>({
    queryKey: ["admin-llm-providers"],
    queryFn: () => adminGet("/api/admin/llm-providers"),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activating, setActivating] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const emptyForm = { name: "", displayName: "", baseUrl: "", apiKey: "", defaultModel: "", remark: "" };
  const [form, setForm] = useState(emptyForm);

  const applyPreset = (preset: typeof PRESET_PROVIDERS[0]) => {
    setForm(prev => ({
      ...prev,
      name: preset.name,
      displayName: preset.label === "自定义" ? prev.displayName : preset.label,
      baseUrl: preset.baseUrl,
      defaultModel: preset.defaultModel,
    }));
  };

  const startEdit = (p: LlmProvider) => {
    setEditingId(p.id);
    setForm({ name: p.name, displayName: p.displayName, baseUrl: p.baseUrl, apiKey: "", defaultModel: p.defaultModel, remark: p.remark ?? "" });
    setShowAdd(false);
  };

  const cancelForm = () => { setShowAdd(false); setEditingId(null); setForm(emptyForm); };

  const submitForm = async () => {
    if (!form.displayName || !form.baseUrl || !form.defaultModel) {
      toast({ title: "请填写必填字段", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      if (editingId !== null) {
        await adminPut(`/api/admin/llm-providers/${editingId}`, form);
        toast({ title: "更新成功" });
      } else {
        if (!form.name || !form.apiKey) { toast({ title: "名称和 API Key 为必填", variant: "destructive" }); return; }
        await adminPost("/api/admin/llm-providers", form);
        toast({ title: "添加成功" });
      }
      await qc.invalidateQueries({ queryKey: ["admin-llm-providers"] });
      cancelForm();
    } catch (err: any) {
      toast({ title: "操作失败", description: err?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const activate = async (id: number) => {
    setActivating(id);
    try {
      await adminPost(`/api/admin/llm-providers/${id}/activate`, {});
      await qc.invalidateQueries({ queryKey: ["admin-llm-providers"] });
      toast({ title: "已切换激活供应商" });
    } catch (err: any) {
      toast({ title: "激活失败", description: err?.message, variant: "destructive" });
    } finally {
      setActivating(null);
    }
  };

  const deleteProvider = async (id: number) => {
    setDeleting(id);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/admin/llm-providers/${id}`, {
        method: "DELETE",
        headers: getAdminHeaders(),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "删除失败"); }
      await qc.invalidateQueries({ queryKey: ["admin-llm-providers"] });
      toast({ title: "已删除供应商" });
    } catch (err: any) {
      toast({ title: "删除失败", description: err?.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const ProviderForm = (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
      <p className="text-sm font-extrabold text-slate-800">{editingId !== null ? "编辑供应商" : "添加供应商"}</p>

      {editingId === null && (
        <div>
          <p className="text-xs font-bold text-slate-500 mb-2">快速预设</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_PROVIDERS.map(p => (
              <button
                key={p.name || "custom"}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-primary/5 hover:border-primary/30 text-slate-600 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">显示名称 *</label>
          <input value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
            placeholder="如：DeepSeek" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
        </div>
        {editingId === null && (
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">唯一标识 *</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="如：deepseek（小写字母）" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
          </div>
        )}
        <div className={editingId !== null ? "col-span-2" : ""}>
          <label className="block text-xs font-bold text-slate-600 mb-1">Base URL *</label>
          <input value={form.baseUrl} onChange={e => setForm(p => ({ ...p, baseUrl: e.target.value }))}
            placeholder="https://api.deepseek.com" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">
            API Key {editingId !== null ? <span className="font-normal text-slate-400">（留空则不修改）</span> : "*"}
          </label>
          <input type="password" value={form.apiKey} onChange={e => setForm(p => ({ ...p, apiKey: e.target.value }))}
            placeholder={editingId !== null ? "不修改请留空" : "sk-..."} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-1">默认模型 *</label>
          <input value={form.defaultModel} onChange={e => setForm(p => ({ ...p, defaultModel: e.target.value }))}
            placeholder="如：deepseek-chat" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-slate-600 mb-1">备注</label>
          <input value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))}
            placeholder="可选" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={submitForm} disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {editingId !== null ? "保存修改" : "添加供应商"}
        </button>
        <button onClick={cancelForm} className="px-5 py-2.5 border border-slate-200 text-slate-500 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
          取消
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-slate-900">大模型供应商</h3>
          <p className="text-xs text-slate-500 mt-0.5">激活哪个，智能体就走哪个接口。支持所有兼容 OpenAI 格式的供应商。</p>
        </div>
        {!showAdd && editingId === null && (
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">
            <Plus size={14} /> 添加供应商
          </button>
        )}
      </div>

      {showAdd && editingId === null && ProviderForm}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-3">
          {(!providers || providers.length === 0) && (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-sm">暂无供应商</div>
          )}
          {providers?.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${p.isActive ? "border-primary/40 shadow-sm shadow-primary/10" : "border-slate-200"}`}>
              {editingId === p.id ? (
                <div className="p-5">{ProviderForm}</div>
              ) : (
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${p.isActive ? "bg-primary text-white" : "bg-slate-100 text-slate-400"}`}>
                    <Bot size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-extrabold text-slate-900">{p.displayName}</p>
                      {p.isActive && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded-full">当前激活</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{p.baseUrl} · <span className="font-mono">{p.defaultModel}</span></p>
                    {p.remark && <p className="text-xs text-slate-400 mt-0.5">{p.remark}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!p.isActive && (
                      <button
                        onClick={() => activate(p.id)}
                        disabled={activating === p.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {activating === p.id ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                        激活
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(p)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit2 size={11} /> 编辑
                    </button>
                    {!p.isActive && (
                      <button
                        onClick={() => deleteProvider(p.id)}
                        disabled={deleting === p.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-400 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {deleting === p.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── AgentConfigManagement ──────────────────────── */

type AgentConfig = {
  id: number;
  name: string;
  sceneKey: string;
  systemPrompt: string;
  isEnabled: boolean;
  model: string;
  createdAt: string;
};

function AgentConfigManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const { data: configs, isLoading } = useQuery<AgentConfig[]>({
    queryKey: ["admin-agent-configs"],
    queryFn: () => adminGet("/api/admin/agent-configs"),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const startEdit = (cfg: AgentConfig) => {
    setEditingId(cfg.id);
    setEditPrompt(cfg.systemPrompt);
    setEditEnabled(cfg.isEnabled);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPrompt("");
  };

  const saveEdit = async (id: number) => {
    setSaving(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${BASE}/api/admin/agent-configs/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ systemPrompt: editPrompt, isEnabled: editEnabled }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `保存失败 (${res.status})`);
      }
      await qc.invalidateQueries({ queryKey: ["admin-agent-configs"] });
      toast({ title: "保存成功", description: "智能体配置已更新" });
      setEditingId(null);
    } catch (err: any) {
      toast({ title: "保存失败", description: err?.message ?? "请稍后重试", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <LlmProviderManagement />

      <div className="border-t border-slate-100 pt-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">智能体场景配置</h3>
            <p className="text-sm text-slate-500 mt-0.5">管理各场景的系统提示词与启用状态</p>
          </div>
        </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      )}

      {!isLoading && (!configs || configs.length === 0) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          <Bot size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无智能体配置</p>
        </div>
      )}

      {configs?.map((cfg) => (
        <div key={cfg.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bot size={18} className="text-primary" />
              </div>
              <div>
                <p className="font-extrabold text-slate-900">{cfg.name}</p>
                <p className="text-xs text-slate-400">{cfg.sceneKey} · {cfg.model}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${cfg.isEnabled ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-400"}`}>
                {cfg.isEnabled ? "已启用" : "已停用"}
              </span>
              {editingId !== cfg.id && (
                <button
                  onClick={() => startEdit(cfg)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <Edit2 size={12} /> 编辑
                </button>
              )}
            </div>
          </div>

          {editingId === cfg.id ? (
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-slate-700">启用状态</label>
                <button
                  type="button"
                  onClick={() => setEditEnabled(prev => !prev)}
                  className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${editEnabled ? "bg-primary" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${editEnabled ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">系统提示词</label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  rows={18}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                />
                <p className="text-xs text-slate-400 mt-1">{editPrompt.length} 字符</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => saveEdit(cfg.id)}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  保存配置
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-5 py-2.5 border border-slate-200 text-slate-500 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-4">
              <p className="text-xs font-bold text-slate-500 mb-2">系统提示词预览</p>
              <pre className="text-xs text-slate-600 bg-slate-50 rounded-xl px-4 py-3 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto border border-slate-100">
                {cfg.systemPrompt}
              </pre>
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}

/* ─── Settlement Account Review ───────────────────────── */

type SettlementRecord = {
  id: number;
  userId: number;
  userNickname: string | null;
  userEmail: string | null;
  companyName: string | null;
  creditCode: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccount: string | null;
  accountName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  businessLicenseUrl: string | null;
  legalRepIdFrontUrl: string | null;
  legalRepIdBackUrl: string | null;
  rejectReason: string | null;
  status: "pending" | "verified" | "rejected";
  createdAt: string;
  updatedAt: string;
};

function DocThumb({ url, label, onClick }: { url: string | null; label: string; onClick: (url: string) => void }) {
  const safe = safeUrl(url);
  if (!safe) {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] text-slate-400 font-medium">{label}</p>
        <div className="w-full h-28 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-1.5">
          <ImageIcon size={18} className="text-slate-300" />
          <span className="text-[11px] text-slate-400">未上传</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] text-slate-400 font-medium">{label}</p>
      <button
        onClick={() => onClick(safe)}
        className="relative w-full h-28 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group hover:border-primary/40 transition-colors"
      >
        <img src={safe} alt={label} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
          <Eye size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>
    </div>
  );
}

function SettlementManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState("");

  const { data: records = [], isLoading, refetch } = useQuery<SettlementRecord[]>({
    queryKey: ["admin-settlement-accounts", statusFilter],
    queryFn: () => adminGet(`/api/admin/settlement-accounts?status=${statusFilter}`),
    staleTime: 30_000,
  });

  function openPreview(url: string, label = "证件图片") {
    setPreviewUrl(url);
    setPreviewLabel(label);
  }

  async function handleAction(id: number, action: "approve" | "reject", reason?: string) {
    setSubmitting(true);
    try {
      await adminPatch(`/api/admin/settlement-accounts/${id}`, { action, rejectReason: reason });
      toast({ title: action === "approve" ? "已审核通过" : "已驳回", description: "操作成功，已通知 OPC" });
      setRejectingId(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin-settlement-accounts"] });
      refetch();
    } catch (err: any) {
      toast({ title: "操作失败", description: err?.message ?? "请稍后重试", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const STATUS_TABS = [
    { key: "all", label: "全部" },
    { key: "pending", label: "待审核" },
    { key: "verified", label: "已通过" },
    { key: "rejected", label: "已驳回" },
  ];

  const statusBadge = (s: string) => {
    if (s === "pending")  return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-200">待审核</span>;
    if (s === "verified") return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-50  text-green-600  border border-green-200">已通过</span>;
    return                       <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50    text-red-600    border border-red-200">已驳回</span>;
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="结算账户审核" sub="审核 OPC 提交的结算账户信息，通过后 OPC 方可抢单" />

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setStatusFilter(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${statusFilter === t.key ? "bg-primary text-white" : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 shadow-sm">
          <CreditCard size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无结算账户记录</p>
        </div>
      ) : (
        <div className="space-y-5">
          {records.map(r => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

              {/* Card header */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-50/60 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center font-extrabold text-primary text-sm">
                    {(r.userNickname ?? "O")[0]}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{r.userNickname ?? `用户 #${r.userId}`}</p>
                    <p className="text-xs text-slate-400">{r.userEmail} · 提交于 {new Date(r.updatedAt).toLocaleDateString("zh-CN")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {statusBadge(r.status)}
                  {r.status === "pending" && (
                    <>
                      <button onClick={() => handleAction(r.id, "approve")} disabled={submitting}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 disabled:opacity-50 transition-colors">
                        <Check size={12} /> 通过
                      </button>
                      <button onClick={() => { setRejectingId(r.id); setRejectReason(""); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors">
                        <XCircle size={12} /> 驳回
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Company & bank info */}
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">企业 & 银行信息</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-sm">
                    <div><p className="text-xs text-slate-400 mb-0.5">企业名称</p><p className="font-medium text-slate-700">{r.companyName || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">统一社会信用代码</p><p className="font-mono text-slate-700 text-xs">{r.creditCode || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">开户名称</p><p className="font-medium text-slate-700">{r.accountName || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">银行账号</p><p className="font-mono text-slate-700 text-xs">{r.bankAccount || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">开户银行</p><p className="font-medium text-slate-700">{r.bankName || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">开户支行</p><p className="font-medium text-slate-700">{r.bankBranch || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">联系人</p><p className="font-medium text-slate-700">{r.contactName || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">联系电话</p><p className="font-medium text-slate-700">{r.contactPhone || "—"}</p></div>
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">证件资料</p>
                  <div className="grid grid-cols-3 gap-4">
                    <DocThumb url={r.businessLicenseUrl} label="营业执照" onClick={u => openPreview(u, "营业执照")} />
                    <DocThumb url={r.legalRepIdFrontUrl} label="法人身份证（正面）" onClick={u => openPreview(u, "法人身份证（正面）")} />
                    <DocThumb url={r.legalRepIdBackUrl}  label="法人身份证（背面）" onClick={u => openPreview(u, "法人身份证（背面）")} />
                  </div>
                </div>

                {/* Reject reason display */}
                {r.status === "rejected" && r.rejectReason && (
                  <div className="flex items-start gap-2 px-4 py-3 bg-red-50 rounded-xl border border-red-100">
                    <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-red-700 mb-0.5">驳回原因</p>
                      <p className="text-sm text-red-600">{r.rejectReason}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Reject reason input */}
              {rejectingId === r.id && (
                <div className="px-6 pb-5 pt-3 bg-red-50/60 border-t border-red-100">
                  <label className="block text-xs font-bold text-red-700 mb-1.5">驳回原因（必填）</label>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                    placeholder="请说明驳回原因，系统将通知 OPC 修改…"
                    className="w-full border border-red-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 resize-none bg-white mb-3" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setRejectingId(null)} className="px-4 py-2 text-sm text-slate-500 hover:bg-white rounded-xl transition-colors">取消</button>
                    <button onClick={() => handleAction(r.id, "reject", rejectReason)}
                      disabled={submitting || !rejectReason.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50 transition-colors">
                      {submitting ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} 确认驳回
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Image preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-white text-sm font-bold">{previewLabel}</span>
              <button onClick={() => setPreviewUrl(null)}
                className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <img src={previewUrl} alt={previewLabel} className="w-full rounded-2xl object-contain bg-white shadow-2xl max-h-[75vh]" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── SystemLogsPanel ────────────────────────────── */

type SysLog = {
  id: number;
  level: "info" | "warn" | "error";
  category: string;
  message: string;
  metadata: Record<string, unknown> | null;
  operatorId: number | null;
  operatorName: string | null;
  createdAt: string;
};

function SystemLogsPanel() {
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading, refetch, isFetching } = useQuery<{ total: number; rows: SysLog[] }>({
    queryKey: ["system-logs", category, level, page],
    queryFn: () => adminGet(
      `/api/admin/system-logs?category=${category}&level=${level}&limit=${pageSize}&offset=${(page - 1) * pageSize}`
    ),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const levelBadge = (l: string) => {
    if (l === "error") return "bg-red-100 text-red-700 border border-red-200";
    if (l === "warn")  return "bg-amber-100 text-amber-700 border border-amber-200";
    return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  };
  const levelLabel = (l: string) => ({ error: "错误", warn: "警告", info: "正常" }[l] ?? l);

  const categoryLabel = (c: string) => ({
    email: "邮件", system: "系统", user: "用户", payment: "支付",
  }[c] ?? c);

  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <SectionHeader title="系统日志" sub="平台操作记录 · 群发邮件任务追踪 · 异常事件审计" />

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">分类</span>
            {["all", "email", "system", "user", "payment"].map(c => (
              <button key={c} onClick={() => { setCategory(c); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  category === c ? "bg-primary text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}>
                {c === "all" ? "全部" : categoryLabel(c)}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">级别</span>
            {["all", "info", "warn", "error"].map(l => (
              <button key={l} onClick={() => { setLevel(l); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  level === l ? "bg-primary text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}>
                {l === "all" ? "全部" : levelLabel(l)}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold transition-colors">
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} /> 刷新
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-400 gap-2">
            <Loader2 size={18} className="animate-spin" /> 加载中…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <ScrollText size={36} className="text-slate-200" />
            <p className="text-sm font-medium">暂无日志记录</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-28">时间</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">级别</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-16">分类</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">消息</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-24">操作人</th>
                <th className="px-3 py-3 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(r => (
                <>
                  <tr key={r.id}
                    className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${expanded === r.id ? "bg-blue-50/40" : ""}`}
                    onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                    <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap font-mono">
                      {new Date(r.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${levelBadge(r.level)}`}>
                        {levelLabel(r.level)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                        {categoryLabel(r.category)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-800 text-sm max-w-md truncate">{r.message}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{r.operatorName ?? "—"}</td>
                    <td className="px-3 py-3 text-slate-400">
                      {r.metadata ? (expanded === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
                    </td>
                  </tr>
                  {expanded === r.id && r.metadata && (
                    <tr key={`${r.id}-detail`} className="bg-blue-50/40">
                      <td colSpan={6} className="px-5 pb-4 pt-0">
                        <pre className="text-xs text-slate-700 bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap break-all font-mono">
                          {JSON.stringify(r.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>共 {total} 条记录</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 text-xs font-bold transition-colors">
              上一页
            </button>
            <span className="px-3 py-1.5 text-xs font-bold">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 text-xs font-bold transition-colors">
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ModuleContent ───────────────────────────────── */

/* ─── Screen Videos Management ──────────────────── */

type ScreenVideo = { id: number; title: string; objectPath: string; sortOrder: number; createdAt: string };

function ScreenVideosModule() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingTitle, setPendingTitle] = useState("");
  const [pendingSortOrder, setPendingSortOrder] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [saveBusy, setSaveBusy] = useState<number | null>(null);
  const [delBusy, setDelBusy] = useState<number | null>(null);

  const { data: videos = [], isLoading } = useQuery<ScreenVideo[]>({
    queryKey: ["admin-screen-videos"],
    queryFn: () => adminGet("/api/admin/screen-videos"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    setPendingTitle(f.name.replace(/\.[^.]+$/, ""));
    setPendingSortOrder(0);
    e.target.value = "";
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const objectPath = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = `${BASE}/api/admin/screen-videos/upload?name=${encodeURIComponent(pendingFile.name)}`;
        xhr.open("POST", url);
        const h = getAdminHeaders();
        if (h.Authorization) xhr.setRequestHeader("Authorization", h.Authorization);
        xhr.setRequestHeader("Content-Type", pendingFile.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText).objectPath); }
            catch { reject(new Error("响应解析失败")); }
          } else {
            try { reject(new Error(JSON.parse(xhr.responseText).error ?? `上传失败 (${xhr.status})`)); }
            catch { reject(new Error(`上传失败 (${xhr.status})`)); }
          }
        };
        xhr.onerror = () => reject(new Error("网络错误，请重试"));
        xhr.send(pendingFile);
      });

      const saveRes = await fetch(`${BASE}/api/admin/screen-videos`, {
        method: "POST", headers: getAdminHeaders(),
        body: JSON.stringify({ title: pendingTitle, objectPath, sortOrder: pendingSortOrder }),
      });
      if (!saveRes.ok) { const b = await saveRes.json(); throw new Error(b.error ?? "保存失败"); }

      toast({ title: "视频上传成功" });
      qc.invalidateQueries({ queryKey: ["admin-screen-videos"] });
      setPendingFile(null); setPendingTitle(""); setPendingSortOrder(0); setUploadProgress(0);
    } catch (e: any) {
      toast({ title: "上传失败", description: e.message, variant: "destructive" });
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (delBusy !== null) return;
    setDelBusy(id);
    try {
      const r = await fetch(`${BASE}/api/admin/screen-videos/${id}`, { method: "DELETE", headers: getAdminHeaders() });
      if (!r.ok) throw new Error("删除失败");
      toast({ title: "已删除" });
      qc.invalidateQueries({ queryKey: ["admin-screen-videos"] });
    } catch (e: any) {
      toast({ title: "删除失败", description: e.message, variant: "destructive" });
    } finally {
      setDelBusy(null);
    }
  };

  const handleSaveEdit = async (id: number) => {
    if (saveBusy !== null) return;
    setSaveBusy(id);
    try {
      const r = await fetch(`${BASE}/api/admin/screen-videos/${id}`, {
        method: "PATCH", headers: getAdminHeaders(),
        body: JSON.stringify({ title: editTitle, sortOrder: editSortOrder }),
      });
      if (!r.ok) throw new Error("保存失败");
      toast({ title: "已保存" });
      qc.invalidateQueries({ queryKey: ["admin-screen-videos"] });
      setEditId(null);
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" });
    } finally {
      setSaveBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-blue-900">大屏视频管理</h2>
          <p className="text-slate-500 text-sm mt-0.5">上传 9:16 竖屏视频，数据大屏右侧将自动循环播放</p>
        </div>
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors">
          <Upload size={15} /> 上传视频
        </button>
        <input ref={fileInputRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={handleFileChange} />
      </div>

      {pendingFile && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-bold text-blue-800 flex items-center gap-2"><Video size={15} /> 待上传：{pendingFile.name}</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">视频标题</label>
              <input value={pendingTitle} onChange={e => setPendingTitle(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">排列顺序（数字越小越靠前）</label>
              <input type="number" value={pendingSortOrder} onChange={e => setPendingSortOrder(Number(e.target.value))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleUpload} disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg text-sm font-bold transition-colors">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? (uploadProgress < 100 ? `上传中 ${uploadProgress}%` : "处理中…") : "确认上传"}
            </button>
            <button onClick={() => setPendingFile(null)} disabled={uploading} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 disabled:opacity-40 rounded-lg hover:bg-slate-100 transition-colors">取消</button>
          </div>
          {uploading && (
            <div className="space-y-1">
              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress < 100 ? uploadProgress : 100}%` }} />
              </div>
              <p className="text-xs text-slate-500">
                {uploadProgress < 100 ? `已传输 ${uploadProgress}%，请勿关闭页面` : "正在服务端校验，请稍候…"}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" /> 加载中…</div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
            <Video size={36} className="text-slate-300" />
            <p className="text-sm">暂无视频，点击右上角上传</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">标题</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-28">排列顺序</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-40">上传时间</th>
                <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-24">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {videos.map(v => (
                <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    {editId === v.id ? (
                      <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                        className="border border-blue-300 rounded-lg px-2 py-1 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    ) : (
                      <span className="font-medium text-slate-800">{v.title || <span className="text-slate-400 italic">无标题</span>}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === v.id ? (
                      <input type="number" value={editSortOrder} onChange={e => setEditSortOrder(Number(e.target.value))}
                        className="border border-blue-300 rounded-lg px-2 py-1 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    ) : (
                      <span className="text-slate-500">{v.sortOrder}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{new Date(v.createdAt).toLocaleDateString("zh-CN")}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {editId === v.id ? (
                        <>
                          <button onClick={() => handleSaveEdit(v.id)} disabled={saveBusy === v.id} className="text-blue-600 hover:text-blue-800 font-bold text-xs px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-40 transition-colors"><Save size={13} /></button>
                          <button onClick={() => setEditId(null)} className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1 rounded hover:bg-slate-100 transition-colors"><X size={13} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditId(v.id); setEditTitle(v.title); setEditSortOrder(v.sortOrder); }}
                            className="text-slate-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50"><Edit2 size={14} /></button>
                          <button onClick={() => handleDelete(v.id)} disabled={delBusy === v.id} className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 disabled:opacity-40"><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ─── Platform Config: 需求分类管理 ─────────────── */

interface CatCategory {
  id: number; code: string; name: string; description: string | null;
  colorHex: string | null; icon: string | null; sortOrder: number; isActive: boolean;
  tags?: CatTag[];
}

interface CatTag {
  id: number; catCategoryId: number; code: string; name: string;
  description: string | null; sortOrder: number; isActive: boolean;
}

function CatCategoryManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: categories = [], isLoading } = useQuery<CatCategory[]>({
    queryKey: ["admin-cat-categories"],
    queryFn: () => adminGet("/api/admin/cat-categories"),
    staleTime: 30_000,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const emptyForm = { name: "", description: "", colorHex: "#6366f1", icon: "", sortOrder: 0, isActive: true };
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const startAdd = () => { setForm({ ...emptyForm }); setEditingId(null); setAddingNew(true); };
  const startEdit = (c: CatCategory) => {
    setForm({ name: c.name, description: c.description ?? "", colorHex: c.colorHex ?? "#6366f1", icon: c.icon ?? "", sortOrder: c.sortOrder, isActive: c.isActive });
    setEditingId(c.id); setAddingNew(false);
  };
  const cancel = () => { setAddingNew(false); setEditingId(null); };

  const save = async () => {
    if (saving) return;
    if (!form.name.trim()) { toast({ title: "名称不能为空", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (addingNew) {
        await adminPost("/api/admin/cat-categories", form);
        toast({ title: "分类已创建" });
      } else if (editingId) {
        await adminPut(`/api/admin/cat-categories/${editingId}`, form);
        toast({ title: "分类已更新" });
      }
      await qc.invalidateQueries({ queryKey: ["admin-cat-categories"] });
      cancel();
    } catch (err: any) { toast({ title: "保存失败", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const toggleActive = async (cat: CatCategory) => {
    if (busyId !== null) return;
    setBusyId(cat.id);
    try {
      await adminPut(`/api/admin/cat-categories/${cat.id}`, { isActive: !cat.isActive });
      await qc.invalidateQueries({ queryKey: ["admin-cat-categories"] });
      toast({ title: cat.isActive ? "分类已禁用" : "分类已启用" });
    } catch (err: any) { toast({ title: "操作失败", description: err.message, variant: "destructive" }); }
    finally { setBusyId(null); }
  };

  const del = async (id: number) => {
    if (!window.confirm("确定删除此分类？该操作会同时删除其下所有标签，且不可撤销。")) return;
    if (busyId !== null) return;
    setBusyId(id);
    try {
      await adminDelete(`/api/admin/cat-categories/${id}`);
      await qc.invalidateQueries({ queryKey: ["admin-cat-categories"] });
      toast({ title: "分类已删除" });
    } catch (err: any) { toast({ title: "删除失败", description: err.message, variant: "destructive" }); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="需求分类管理"
        sub="管理平台需求大类（赛道），支持增删改查、启用/禁用和排序"
        action={
          <button onClick={startAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
            <Plus size={15} /> 新建分类
          </button>
        }
      />

      {(addingNew || editingId !== null) && (
        <div className="bg-white rounded-2xl shadow-sm p-6 border-2 border-primary/20">
          <p className="text-sm font-bold text-slate-700 mb-4">{addingNew ? "新建分类" : "编辑分类"}</p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">名称<span className="text-destructive ml-1">*</span></label>
              <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                placeholder="内容生成" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">颜色（HEX）</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.colorHex} onChange={e => setForm(p => ({...p, colorHex: e.target.value}))}
                  className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-1" />
                <input value={form.colorHex} onChange={e => setForm(p => ({...p, colorHex: e.target.value}))}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">排序（数字越小越靠前）</label>
              <input type="number" value={form.sortOrder} onChange={e => setForm(p => ({...p, sortOrder: parseInt(e.target.value) || 0}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-500 block mb-1">描述</label>
              <input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
                placeholder="分类的简短描述" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <label className="text-xs font-bold text-slate-500">启用状态</label>
              <button type="button" onClick={() => setForm(p => ({...p, isActive: !p.isActive}))}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? "bg-primary" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0"}`} />
              </button>
              <span className="text-xs text-slate-500">{form.isActive ? "启用" : "禁用"}</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors">{saving ? "保存中…" : "保存"}</button>
            <button onClick={cancel} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors">取消</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
              <tr>
                <th className="px-6 py-4">名称</th>
                <th className="px-6 py-4">描述</th>
                <th className="px-6 py-4">标签数</th>
                <th className="px-6 py-4">排序</th>
                <th className="px-6 py-4">状态</th>
                <th className="px-6 py-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {categories.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">暂无分类</td></tr>
              ) : categories.map(cat => (
                <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-800 text-sm">{cat.name}</td>
                  <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">{cat.description ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{cat.tags?.length ?? 0} 个</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{cat.sortOrder}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleActive(cat)} disabled={busyId === cat.id}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors disabled:opacity-50 ${cat.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {busyId === cat.id ? "…" : (cat.isActive ? "启用" : "禁用")}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(cat)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="编辑"><Edit2 size={14} /></button>
                      <button onClick={() => del(cat.id)} disabled={busyId === cat.id} className="p-1.5 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg disabled:opacity-40 transition-colors" title="删除"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Platform Config: 分类标签管理 ─────────────── */

function CatTagManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: categories = [] } = useQuery<CatCategory[]>({
    queryKey: ["admin-cat-categories"],
    queryFn: () => adminGet("/api/admin/cat-categories"),
    staleTime: 30_000,
  });

  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);

  const activeCat = selectedCatId ? categories.find(c => c.id === selectedCatId) : categories[0];
  const tags = activeCat?.tags ?? [];

  const [editingId, setEditingId] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const emptyForm = { name: "", description: "", sortOrder: 0, isActive: true };
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const startAdd = () => { setForm({ ...emptyForm }); setEditingId(null); setAddingNew(true); };
  const startEdit = (t: CatTag) => {
    setForm({ name: t.name, description: t.description ?? "", sortOrder: t.sortOrder, isActive: t.isActive });
    setEditingId(t.id); setAddingNew(false);
  };
  const cancel = () => { setAddingNew(false); setEditingId(null); };

  const save = async () => {
    if (saving) return;
    if (!form.name.trim()) { toast({ title: "名称不能为空", variant: "destructive" }); return; }
    const catId = activeCat?.id;
    if (!catId) { toast({ title: "请先选择大类", variant: "destructive" }); return; }
    setSaving(true);
    try {
      if (addingNew) {
        await adminPost("/api/admin/cat-tags", { ...form, catCategoryId: catId });
        toast({ title: "标签已创建" });
      } else if (editingId) {
        await adminPut(`/api/admin/cat-tags/${editingId}`, form);
        toast({ title: "标签已更新" });
      }
      await qc.invalidateQueries({ queryKey: ["admin-cat-categories"] });
      cancel();
    } catch (err: any) { toast({ title: "保存失败", description: err.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const toggleActive = async (tag: CatTag) => {
    if (busyId !== null) return;
    setBusyId(tag.id);
    try {
      await adminPut(`/api/admin/cat-tags/${tag.id}`, { isActive: !tag.isActive });
      await qc.invalidateQueries({ queryKey: ["admin-cat-categories"] });
      toast({ title: tag.isActive ? "标签已禁用" : "标签已启用" });
    } catch (err: any) { toast({ title: "操作失败", description: err.message, variant: "destructive" }); }
    finally { setBusyId(null); }
  };

  const del = async (id: number) => {
    if (!window.confirm("确定删除此标签？此操作不可撤销。")) return;
    if (busyId !== null) return;
    setBusyId(id);
    try {
      await adminDelete(`/api/admin/cat-tags/${id}`);
      await qc.invalidateQueries({ queryKey: ["admin-cat-categories"] });
      toast({ title: "标签已删除" });
    } catch (err: any) { toast({ title: "删除失败", description: err.message, variant: "destructive" }); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="分类标签管理"
        sub="管理每个大类下的子标签（二级方向），用于更精细的需求分类"
        action={
          <button onClick={startAdd} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
            <Plus size={15} /> 新建标签
          </button>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => { setSelectedCatId(cat.id); cancel(); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              (activeCat?.id ?? -1) === cat.id
                ? "bg-primary text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:border-primary/40"
            }`}
            style={(activeCat?.id ?? -1) !== cat.id ? {} : { backgroundColor: cat.colorHex ?? undefined }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {(addingNew || editingId !== null) && (
        <div className="bg-white rounded-2xl shadow-sm p-6 border-2 border-primary/20">
          <p className="text-sm font-bold text-slate-700 mb-4">
            {addingNew ? `新建标签（归属：${activeCat?.name ?? ""}）` : "编辑标签"}
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">名称<span className="text-destructive ml-1">*</span></label>
              <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                placeholder="商业文案" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">排序</label>
              <input type="number" value={form.sortOrder} onChange={e => setForm(p => ({...p, sortOrder: parseInt(e.target.value) || 0}))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div className="flex items-end gap-3">
              <label className="text-xs font-bold text-slate-500">启用状态</label>
              <button type="button" onClick={() => setForm(p => ({...p, isActive: !p.isActive}))}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? "bg-primary" : "bg-slate-300"}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0"}`} />
              </button>
              <span className="text-xs text-slate-500">{form.isActive ? "启用" : "禁用"}</span>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-500 block mb-1">描述</label>
              <input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
                placeholder="标签描述（可选）" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors">{saving ? "保存中…" : "保存"}</button>
            <button onClick={cancel} className="px-5 py-2 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition-colors">取消</button>
          </div>
        </div>
      )}

      {!activeCat ? (
        <div className="bg-white rounded-2xl shadow-sm p-10 text-center text-slate-400 text-sm">请先选择大类</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black"
              style={{ backgroundColor: (activeCat.colorHex ?? "#6366f1") + "20", color: activeCat.colorHex ?? "#6366f1" }}>
              {activeCat.name}
            </span>
            <span className="ml-auto text-xs text-slate-400">{tags.length} 个标签</span>
          </div>
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
              <tr>
                <th className="px-6 py-4">名称</th>
                <th className="px-6 py-4">描述</th>
                <th className="px-6 py-4">排序</th>
                <th className="px-6 py-4">状态</th>
                <th className="px-6 py-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {tags.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">该分类下暂无标签，点击右上角「新建标签」添加</td></tr>
              ) : tags.map(tag => (
                <tr key={tag.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-800 text-sm">{tag.name}</td>
                  <td className="px-6 py-4 text-xs text-slate-500 max-w-xs truncate">{tag.description ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{tag.sortOrder}</td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleActive(tag)} disabled={busyId === tag.id}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors disabled:opacity-50 ${tag.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      {busyId === tag.id ? "…" : (tag.isActive ? "启用" : "禁用")}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(tag)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="编辑"><Edit2 size={14} /></button>
                      <button onClick={() => del(tag.id)} disabled={busyId === tag.id} className="p-1.5 text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded-lg disabled:opacity-40 transition-colors" title="删除"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ModuleContent({ module }: { module: Module }) {
  switch (module) {
    case "dashboard":      return <Dashboard />;
    case "cockpit":        return <PlatformCockpit />;
    case "users":          return <UserManagement />;
    case "demands":        return <DemandManagement />;
    case "orders":         return <OrderManagement />;
    case "disputes":       return <DisputeManagement />;
    case "finance":        return <FinanceManagement />;
    case "ecosystem":      return <EcosystemManagement />;
    case "training":       return <><TrainingManagement /><ResourceManagement /></>;
    case "levelcert":      return <LevelCertReview />;
    case "creditlevels":   return <CreditLevelConfig />;
    case "creditrules":    return <CreditRulesConfig />;
    case "content":        return <ContentReview />;
    case "sensitivewords": return <SensitiveWordsManagement />;
    case "payments":       return <><DepositPaymentManagement /><DemandRefundManagement /></>;
    case "activities":     return <AdminActivities />;
    case "quotecard":      return <QuoteCardConfigManagement />;
    case "agent":          return <AgentConfigManagement />;
    case "settlement":     return <SettlementManagement />;
    case "settings":       return <SiteSettingsManagement />;
    case "roles":          return <AdminRolesPanel />;
    case "adminusers":     return <AdminUsersPanel />;
    case "syslogs":        return <SystemLogsPanel />;
    case "screen":         return null;
    case "screenvideos":   return <ScreenVideosModule />;
    case "platform_config": return <CatCategoryManagement />;
    case "catcategories":   return <CatCategoryManagement />;
    case "cattags":         return <CatTagManagement />;
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

export default function Admin({ initialModule }: { initialModule?: Module } = {}) {
  const [active, setActive] = useState<Module>(initialModule ?? "dashboard");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const role = getStoredUser()?.role;
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

  const adminNickname = getStoredUser()?.nickname ?? "管理员";

  const { data: profile } = useAdminProfile();
  const isSuperAdmin = profile?.isSuperAdmin ?? false;
  const permissions = profile?.permissions ?? [];
  const hasAllPerms = isSuperAdmin || permissions.includes("*");

  function canSee(item: typeof NAV[0]): boolean {
    if (item.superAdminOnly) return isSuperAdmin;
    if (hasAllPerms) return true;
    if (!item.permKey) return true;
    return permissions.includes(item.permKey);
  }

  const visibleNav = NAV.filter(canSee);

  // If the current active module is no longer accessible, jump to the first visible one.
  // Must also check child module keys (e.g. "catcategories", "cattags") so clicking sub-items doesn't reset.
  useEffect(() => {
    const allowed = visibleNav.some(n =>
      n.key === active ||
      n.children?.some(c => c.moduleKey === active)
    );
    if (!allowed && visibleNav.length > 0) {
      setActive(visibleNav[0].key);
    }
  }, [visibleNav.map(n => n.key).join(","), active]);

  function handleLogout() {
    clearSession();
    toast({ title: "已退出登录" });
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-[#f3f3f6] text-[#1a1c1e]">

      {/* Sidebar */}
      <aside className="w-64 fixed left-0 top-0 h-screen z-50 bg-slate-900 flex flex-col p-4">
        <AdminSidebarLogo />

        <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto">
          {visibleNav.map(item => {
            if (item.children?.length) {
              const isExpanded = expandedGroups.has(item.key);
              return (
                <div key={item.key}>
                  {/* Group header — toggles expand/collapse */}
                  <button
                    onClick={() => setExpandedGroups(prev => {
                      const next = new Set(prev);
                      if (next.has(item.key)) next.delete(item.key);
                      else next.add(item.key);
                      return next;
                    })}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left text-slate-400 hover:text-white hover:bg-white/5"
                  >
                    <item.icon size={17} />
                    <span className="flex-1">{item.label}</span>
                    {isExpanded
                      ? <ChevronDown size={14} className="text-slate-500" />
                      : <ChevronRight size={14} className="text-slate-500" />
                    }
                  </button>
                  {/* Sub-items */}
                  {isExpanded && (
                    <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-white/10 pl-3">
                      {item.children.filter(child => !child.superAdminOnly || isSuperAdmin).map(child => {
                        const isChildActive = child.moduleKey && active === child.moduleKey;
                        if (child.moduleKey) {
                          return (
                            <button
                              key={child.key}
                              onClick={() => setActive(child.moduleKey!)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold transition-all text-left ${
                                isChildActive
                                  ? "bg-primary/20 text-white"
                                  : "text-slate-400 hover:text-white hover:bg-white/5"
                              }`}
                            >
                              <child.icon size={15} />
                              {child.label}
                            </button>
                          );
                        }
                        return (
                          <a
                            key={child.key}
                            href={`${BASE}${child.href}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                          >
                            <child.icon size={15} />
                            {child.label}
                            <ArrowUpRight size={11} className="ml-auto text-slate-600" />
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            return (
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
            );
          })}
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
              {NAV.find(n => n.key === active)?.label
                ?? NAV.flatMap(n => n.children ?? []).find(c => c.moduleKey === active)?.label}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-bold text-blue-900">{profile?.nickname ?? adminNickname}</p>
                <p className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
                  {isSuperAdmin
                    ? <><ShieldAlert size={10} className="text-amber-500" /> 超级管理员</>
                    : "平台管理员"
                  }
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                {(profile?.nickname ?? adminNickname)[0]}
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
