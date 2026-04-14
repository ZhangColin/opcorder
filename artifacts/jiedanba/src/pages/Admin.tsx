import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { SiteLogo, useSiteName } from "@/components/SiteLogo";
import { clearSession } from "@/lib/auth";
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
  Plus, Edit2, ChevronDown, ChevronUp, DollarSign, BadgeCent, FileCheck, ClipboardList, X, Trophy, RotateCcw,
  Flame, Filter, ShieldCheck, Lock, EyeOff,
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

export type Module =
  | "dashboard" | "users" | "demands" | "orders"
  | "finance"   | "ecosystem" | "training" | "content"
  | "cockpit"   | "disputes"  | "settings" | "levelcert"
  | "sensitivewords" | "payments";

const NAV: { key: Module; icon: React.ElementType; label: string }[] = [
  { key: "dashboard",      icon: LayoutDashboard,    label: "数据看板" },
  { key: "cockpit",        icon: BarChart3,           label: "平台驾驶舱" },
  { key: "users",          icon: Users,              label: "用户管理" },
  { key: "demands",        icon: FileText,            label: "需求管理" },
  { key: "payments",       icon: Receipt,             label: "保证金审核" },
  { key: "orders",         icon: ShoppingBag,         label: "订单管理" },
  { key: "disputes",       icon: Gavel,               label: "争议管理" },
  { key: "finance",        icon: Wallet,              label: "财务管理" },
  { key: "ecosystem",      icon: Network,             label: "OPC 生态池" },
  { key: "training",       icon: GraduationCap,       label: "认证培训" },
  { key: "levelcert",      icon: Trophy,              label: "等级认证" },
  { key: "content",        icon: Shield,              label: "内容审核" },
  { key: "sensitivewords", icon: Flame,               label: "敏感词管理" },
  { key: "settings",       icon: SlidersHorizontal,   label: "站点设置" },
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
  const applyFilter = (f: F) => { setFilter(f); setPage(1); };
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
            <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
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
      <AdminPagination page={page} pageSize={pageSize} total={resp?.total ?? 0} onPage={setPage} onPageSize={setPageSize} />
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
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "发送失败");
        return data;
      }),
    onSuccess: (data) => {
      if (data.total === 0) {
        toast({ title: "没有符合条件的用户", description: "请调整过滤条件后重试", variant: "destructive" });
      } else {
        toast({ title: `群发完成：成功 ${data.sent} 封${data.failed > 0 ? `，失败 ${data.failed} 封` : ""}` });
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
  isUrgent: boolean;
  createdAt: string;
  publisherName: string;
  deadline: string;
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
}

const DEMAND_TYPE_CN: Record<string, string> = {
  ai_education: "AI教育", gov_training: "政务培训", ai_research: "AI研究",
  party_building: "党建", livestream_media: "直播媒体", ai_tool_dev: "AI工具开发", other: "其他",
};

function AdminDemandDetailPanel({ id, onClose }: { id: number; onClose: () => void }) {
  const { toast } = useToast();
  const { data: d, isLoading } = useQuery<AdminDemandDetail>({
    queryKey: ["admin-demand-detail", id],
    queryFn: () => adminGet(`/api/admin/demands/${id}`),
  });

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
    draft: "草稿", pending_review: "待审核", published: "已发布",
    matched: "已匹配", in_progress: "进行中", pending_acceptance: "待验收",
    completed: "已完成", closed: "已关闭",
  };

  const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 bg-white transition";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden"
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
                <p className="font-bold text-blue-900">¥{d.budget.toLocaleString()}</p>
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
              <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{d.description}</div>
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
          </div>
        )}
      </div>
    </div>
  );
}

function DemandManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
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
              <td className="px-6 py-4 font-bold text-sm text-blue-900">¥{d.budget.toLocaleString()}</td>
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
  const { q, qInput, setQInput, filter, page, pageSize, setPage, setPageSize, commitSearch, clearSearch, applyFilter } = useAdminListState("all");

  const { data: resp, isLoading } = useQuery<PagedResp<AdminOrder>>({
    queryKey: ["admin-orders", filter, q, page, pageSize],
    queryFn: () => adminGet(`/api/admin/orders?status=${filter === "all" ? "" : filter}&q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`),
  });
  const orders = resp?.data ?? [];

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
      <AdminPagination page={page} pageSize={pageSize} total={resp?.total ?? 0} onPage={setPage} onPageSize={setPageSize} />
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
    completed: "bg-green-100 text-green-700",
    in_progress: "bg-amber-100 text-amber-700",
    pending_acceptance: "bg-blue-100 text-blue-700",
    closed: "bg-slate-100 text-slate-500",
  }[s] ?? "bg-slate-100 text-slate-500");
  const statusCN: Record<string, string> = { completed: "已完成", in_progress: "进行中", pending_acceptance: "待验收", closed: "已关闭", disputed: "争议中" };

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
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "发送失败");
        return data;
      }),
    onSuccess: (data) => {
      toast({ title: `群发完成：成功 ${data.sent} 封${data.failed > 0 ? `，失败 ${data.failed} 封` : ""}` });
      onClose();
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
    </>
  );
}

function TrainingManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<AdminCourse | null>(null);
  const [enrollCourse, setEnrollCourse] = useState<AdminCourse | null>(null);
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
      const { uploadURL, objectPath } = await reqRes.json();
      await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
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
                  onClick={() => { if (confirm("确认删除此帖子？删除后不可恢复。")) deletePost.mutate(previewPost.id); }}
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
                    onClick={() => { if (confirm("确认删除此回复？删除后不可恢复。")) deleteComment.mutate(c.id); }}
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

        {/* 注册欢迎邮件 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">注册欢迎邮件</h3>

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
                <p className="text-xs text-slate-400 mt-1">上传后新注册用户的欢迎邮件中将自动显示此二维码</p>
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

        {/* 修改密码 */}
        <ChangePasswordCard />
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
  credit_score: number | null;
  apply_count: number;
  past_reviews: LevelCertPastReview[] | null;
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(10);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const setPageSize = (s: number) => { setPageSizeRaw(s); setPage(1); };

  const { data: resp, isLoading, refetch } = useQuery<PagedResp<LevelCertRow>>({
    queryKey: ["admin-level-certs", filterStatus, page, pageSize],
    queryFn: () => adminGet(`/api/admin/level-certs?status=${filterStatus === "all" ? "" : filterStatus}&page=${page}&pageSize=${pageSize}`),
  });
  const filtered = resp?.data ?? [];

  const reviewMut = useMutation({
    mutationFn: ({ portfolioId, result, downgradeTo }: { portfolioId: number; result: string; downgradeTo?: string }) =>
      adminPost(`/api/admin/level-certs/${portfolioId}/review`, { result, note: reviewNote, downgradeTo }),
    onSuccess: () => {
      toast({ title: "评审已提交", description: "评审结果已发送通知给OPC" });
      setReviewing(null);
      setReviewNote("");
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-level-certs"] });
    },
    onError: (e: any) => toast({ title: "提交失败", description: e?.message ?? "请稍后重试", variant: "destructive" }),
  });

  const pendingCount = filtered.filter(r => r.level_apply_status === "pending").length;

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
        title="作品等级认证审核"
        sub={`共 ${resp?.total ?? 0} 条申请，当前页 ${pendingCount} 条待审`}
        action={
          <div className="flex items-center gap-2">
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white">
              <option value="all">全部</option>
              <option value="pending">待审核</option>
              <option value="reviewed">已审核</option>
              <option value="approved">已通过</option>
              <option value="downgraded">降级通过</option>
              <option value="rejected">未通过</option>
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

            // 计算可用审核选项
            const currentLevelIdx = LEVEL_ORDER.indexOf(row.current_level as any ?? "newbie");
            const applyLevelIdx = LEVEL_ORDER.indexOf(row.apply_level);
            // 可通过：申请等级必须高于当前等级
            const canApprove = applyLevelIdx > currentLevelIdx;
            // 可降级通过的等级列表：apply_level-1 到 current_level+1 之间（且不为 newbie）
            const downgradeLevels: string[] = [];
            for (let i = currentLevelIdx + 1; i < applyLevelIdx; i++) {
              if (LEVEL_ORDER[i] !== "newbie") downgradeLevels.push(LEVEL_ORDER[i]);
            }

            return (
              <div key={row.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
                {/* 主行 */}
                <div
                  className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : row.id)}>
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
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                      <span>{row.nickname}</span>
                      <span>·</span>
                      <span>当前等级: <span className="font-medium text-slate-600">{row.current_level ?? "新手"}</span></span>
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

                    {/* 项目类型 + 简介 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">项目类型</p>
                        <p className="text-sm text-slate-700 font-medium">{TYPE_LABELS[row.type] ?? row.type}</p>
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
                        <p className="text-sm font-bold text-amber-800">
                          评审该作品 · 申请 {row.apply_level} 级
                          <span className="text-xs font-normal text-amber-600 ml-2">
                            （当前等级：{row.current_level ?? "新手"}）
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
                              onClick={() => reviewMut.mutate({ portfolioId: row.id, result: "approved" })}
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
                              onClick={() => reviewMut.mutate({ portfolioId: row.id, result: "downgraded", downgradeTo: lvl })}
                              disabled={reviewMut.isPending}
                              className="py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                              <Award size={14} />
                              降级通过 · {LEVEL_LABELS[lvl] ?? lvl}
                            </button>
                          ))}
                          {/* 还需努力 */}
                          <button
                            onClick={() => reviewMut.mutate({ portfolioId: row.id, result: "rejected" })}
                            disabled={reviewMut.isPending}
                            className="py-2.5 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-300 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                            <XCircle size={14} />
                            还需努力
                          </button>
                        </div>
                        {!canApprove && downgradeLevels.length === 0 && (
                          <p className="text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
                            ⚠️ 该OPC当前已是 <strong>{row.current_level}</strong> 级，申请的 {row.apply_level} 级不高于当前等级，无法通过认证（只能拒绝）。
                          </p>
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
}

function DepositPaymentManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<"pending" | "confirmed" | "rejected" | "all">("pending");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

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

                    {payment.receiptUrl && (
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">缴费凭证</p>
                        {/\.(jpg|jpeg|png|gif|webp)$/i.test(payment.receiptUrl) ? (
                          <div className="mt-1">
                            <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={payment.receiptUrl}
                                alt="缴费凭证截图"
                                className="max-h-48 rounded-xl border border-slate-200 object-contain bg-slate-50 hover:opacity-90 transition-opacity cursor-zoom-in"
                              />
                            </a>
                          </div>
                        ) : (
                          <a
                            href={payment.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary underline break-all"
                          >
                            {payment.receiptUrl}
                          </a>
                        )}
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
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                        <p className="text-xs font-bold text-emerald-600 mb-1">确认时间</p>
                        <p className="text-sm text-emerald-700">{new Date(payment.confirmedAt).toLocaleString("zh-CN")}</p>
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
    case "content":        return <ContentReview />;
    case "sensitivewords": return <SensitiveWordsManagement />;
    case "payments":       return <DepositPaymentManagement />;
    case "settings":       return <SiteSettingsManagement />;
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
    clearSession();
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
