import { useState, useEffect, useRef, useMemo, Fragment, useCallback } from "react";
import { AdminInlineNavContext } from "@/context/AdminInlineNavContext";
import AdminV2ClientDemandDetail from "@/pages/admin-v2/AdminV2ClientDemandDetail";
import AdminV2OutsourceDemandDetail from "@/pages/admin-v2/AdminV2OutsourceDemandDetail";
import AdminV2ContractADetail from "@/pages/admin-v2/AdminV2ContractADetail";
import AdminV2PaymentADetail from "@/pages/admin-v2/AdminV2PaymentADetail";
import AdminV2TicketADetail from "@/pages/admin-v2/AdminV2TicketADetail";
import AdminV2TenderDetail from "@/pages/admin-v2/AdminV2TenderDetail";
import AdminV2OutsourceOrderDetail from "@/pages/admin-v2/AdminV2OutsourceOrderDetail";
import AdminV2PaymentBDetail from "@/pages/admin-v2/AdminV2PaymentBDetail";
import AdminV2TicketBDetail from "@/pages/admin-v2/AdminV2TicketBDetail";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import AdminActivities from "./AdminActivities";
import ContestQuestions from "./admin-contests/ContestQuestions";
import ContestActivities from "./admin-contests/ContestActivities";
import ContestRegistrations from "./admin-contests/ContestRegistrations";
import ContestRegistrationAdminDetail from "./admin-contests/ContestRegistrationAdminDetail";
import { AdminEmbeddedContext } from "@/context/AdminEmbeddedContext";
import AdminV2Overview from "@/pages/admin-v2/AdminV2Overview";
import AdminV2ClientDemandList from "@/pages/admin-v2/AdminV2ClientDemandList";
import AdminV2ContractAList from "@/pages/admin-v2/AdminV2ContractAList";
import AdminV2ContractBList from "@/pages/admin-v2/AdminV2ContractBList";
import AdminV2PaymentAList from "@/pages/admin-v2/AdminV2PaymentAList";
import AdminV2TicketAList from "@/pages/admin-v2/AdminV2TicketAList";
import AdminV2OutsourceDemandList from "@/pages/admin-v2/AdminV2OutsourceDemandList";
import AdminV2TenderList from "@/pages/admin-v2/AdminV2TenderList";
import AdminV2OutsourceOrderList from "@/pages/admin-v2/AdminV2OutsourceOrderList";
import AdminV2PaymentBList from "@/pages/admin-v2/AdminV2PaymentBList";
import AdminV2TicketBList from "@/pages/admin-v2/AdminV2TicketBList";
import AdminV2DeliveryAList from "@/pages/admin-v2/AdminV2DeliveryAList";
import AdminV2DeliveryBList from "@/pages/admin-v2/AdminV2DeliveryBList";
import AdminV2DeliveryADetail from "@/pages/admin-v2/AdminV2DeliveryADetail";
import AdminV2DeliveryBDetail from "@/pages/admin-v2/AdminV2DeliveryBDetail";
import AdminV2OutsourceDemandNew from "@/pages/admin-v2/AdminV2OutsourceDemandNew";
import AdminContractTemplates from "@/pages/admin-v2/AdminContractTemplates";
import AdminContractPlaceholders from "@/pages/admin-v2/AdminContractPlaceholders";
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
  Flame, Filter, ShieldCheck, Lock, EyeOff, KeyRound, UserCog, ShieldAlert, ChevronRight, Monitor, Bot, Video,
  Pin, Paperclip, ScrollText, Layers, PackageCheck, ChevronLeft,
  History, ArrowLeft, Building2, GripVertical,
  Globe2, Tag, MessageSquare, Cpu, Wrench,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import { MarkdownContent } from "@/components/MarkdownContent";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { HtmlEditor } from "@/components/HtmlEditor";
import { marked } from "marked";
import { fetchWithTimeout } from "@workspace/api-client-react";

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
  const res = await fetchWithTimeout(`${BASE}${path}`, { headers: getAdminHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `请求失败 (${res.status})`);
  }
  return res.json();
}

async function adminPatch(path: string, body: object) {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
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

async function adminPost(path: string, body: object, opts?: { signal?: AbortSignal }) {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify(body),
    signal: opts?.signal,
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error ?? "操作失败");
  }
  return res.json();
}

async function adminPut(path: string, body: object) {
  const res = await fetchWithTimeout(`${BASE}${path}`, {
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
  const res = await fetchWithTimeout(`${BASE}${path}`, {
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
  | "dashboard" | "users"
  | "finance"   | "ecosystem" | "training" | "content"
  | "cockpit"   | "settings" | "levelcert"
  | "sensitivewords" | "activities"
  | "roles" | "adminusers" | "screen" | "screenvideos" | "agent" | "settlement" | "quotecard" | "syslogs"
  | "platform_config" | "catcategories" | "cattags" | "creditlevels" | "creditrules"
  | "opc_management" | "system_management"
  | "operation_management" | "userData"
  | "contest_questions" | "contest_activities" | "contest_registrations"
  | "v2_overview"
  | "v2_pub_workbench" | "v2_pub_demands" | "v2_pub_contracts" | "v2_pub_payments" | "v2_pub_deliveries" | "v2_pub_tickets"
  | "v2_opc_workbench" | "v2_opc_demands" | "v2_opc_tenders" | "v2_opc_orders" | "v2_opc_contracts" | "v2_opc_payments" | "v2_opc_deliveries" | "v2_opc_tickets"
  | "platform_info" | "contract_config"
  | "skill_registry"
  | "contract_templates" | "contract_placeholders"
  // 社区管理
  | "community_workbench" | "community_overview" | "announcement_category" | "announcement_mgmt" | "consult_mgmt"
  // AI 能力平台（外链）
  | "ai_platforms";

type NavChild = { key: string; label: string; icon: React.ElementType; href?: string; moduleKey?: Module; superAdminOnly?: boolean; permKey?: string };
type NavItem = { key: Module; icon: React.ElementType; label: string; superAdminOnly?: boolean; requireAllPerms?: boolean; permKey?: string; permKeys?: string[]; children?: NavChild[] };

const NAV: NavItem[] = [
  { key: "dashboard", icon: LayoutDashboard, label: "数据看板",   permKey: "dashboard" },

  {
    key: "v2_pub_workbench", icon: Users, label: "发单方工作台", permKey: "demands",
    children: [
      { key: "v2_pub_demands",   label: "需求", moduleKey: "v2_pub_demands"   as Module, icon: FileText },
      { key: "v2_pub_contracts", label: "合同", moduleKey: "v2_pub_contracts" as Module, icon: FileCheck },
      { key: "v2_pub_payments",    label: "收款", moduleKey: "v2_pub_payments"    as Module, icon: Wallet },
      { key: "v2_pub_deliveries",  label: "交付", moduleKey: "v2_pub_deliveries"  as Module, icon: PackageCheck },
      { key: "v2_pub_tickets",     label: "工单", moduleKey: "v2_pub_tickets"     as Module, icon: ClipboardList },
    ],
  },

  {
    key: "v2_opc_workbench", icon: Network, label: "OPC 工作台", permKey: "demands",
    children: [
      { key: "v2_opc_demands",  label: "需求", moduleKey: "v2_opc_demands"  as Module, icon: FileText },
      { key: "v2_opc_tenders",  label: "投标", moduleKey: "v2_opc_tenders"  as Module, icon: Trophy },
      { key: "v2_opc_orders",   label: "订单", moduleKey: "v2_opc_orders"   as Module, icon: ShoppingBag },
      { key: "v2_opc_contracts", label: "合同", moduleKey: "v2_opc_contracts" as Module, icon: FileCheck },
      { key: "v2_opc_payments",   label: "付款", moduleKey: "v2_opc_payments"   as Module, icon: CreditCard },
      { key: "v2_opc_deliveries", label: "交付", moduleKey: "v2_opc_deliveries" as Module, icon: PackageCheck },
      { key: "v2_opc_tickets",    label: "工单", moduleKey: "v2_opc_tickets"    as Module, icon: ClipboardList },
    ],
  },

  {
    key: "contest_activities", icon: Trophy, label: "OPC 大赛", permKey: "contest",
    children: [
      { key: "contest_activities",     label: "大赛活动", moduleKey: "contest_activities"     as Module, icon: Trophy },
      { key: "contest_registrations",  label: "报名与评级", moduleKey: "contest_registrations" as Module, icon: Award },
      { key: "contest_questions",      label: "题库",     moduleKey: "contest_questions"      as Module, icon: BookOpen },
    ],
  },

  {
    key: "community_workbench", icon: Megaphone, label: "社区管理",
    permKeys: ["community", "announcement_category", "announcement", "consult"],
    children: [
      { key: "community_overview",    label: "社区",     moduleKey: "community_overview"    as Module, icon: Globe2,   permKey: "community" },
      { key: "announcement_category", label: "公告类别", moduleKey: "announcement_category" as Module, icon: Tag,      permKey: "announcement_category" },
      { key: "announcement_mgmt",     label: "公告",     moduleKey: "announcement_mgmt"     as Module, icon: Megaphone, permKey: "announcement" },
      { key: "consult_mgmt",          label: "咨询管理", moduleKey: "consult_mgmt"          as Module, icon: MessageSquare, permKey: "consult" },
    ],
  },

  {
    key: "ai_platforms", icon: Cpu, label: "AI 能力平台", requireAllPerms: true,
    children: [
      { key: "ai_compute", label: "算力中心", icon: Cpu,    href: "/compute" },
      { key: "ai_tools",   label: "工具平台", icon: Wrench, href: "/tools" },
    ],
  },

  { key: "cockpit",   icon: BarChart3,       label: "平台驾驶舱", permKey: "cockpit" },
  { key: "users",     icon: Users,           label: "用户管理",   permKey: "users" },
  { key: "finance",   icon: Wallet,          label: "财务管理",   permKey: "finance" },
  { key: "content",   icon: Shield,          label: "内容审核",   permKey: "content" },
  { key: "activities",icon: ClipboardList,   label: "活动报名",   permKey: "activities" },

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
      { key: "agent",          label: "智能体配置",   moduleKey: "agent"          as Module, icon: Bot },
      { key: "skill_registry", label: "Skill 管理",  moduleKey: "skill_registry" as Module, icon: Layers },
      { key: "sensitivewords",label: "敏感词管理",   moduleKey: "sensitivewords"as Module, icon: Flame },
      { key: "contract_templates",    label: "合同模板",   moduleKey: "contract_templates"    as Module, icon: FileText },
      { key: "contract_placeholders", label: "合同占位符", moduleKey: "contract_placeholders" as Module, icon: FileText },
    ],
  },

  {
    key: "operation_management", icon: Activity, label: "运营管理", permKey: "operation",
    children: [
      { key: "userData", label: "用户数据", moduleKey: "userData" as Module, icon: BarChart3 },
    ],
  },

  {
    key: "system_management", icon: SlidersHorizontal, label: "系统管理", permKey: "settings",
    children: [
      { key: "platform_info",           label: "企业信息",     moduleKey: "platform_info"           as Module, icon: Building2 },
      { key: "contract_config",         label: "合同配置",     moduleKey: "contract_config"         as Module, icon: FileCheck },
      { key: "settings",       label: "站点设置",   moduleKey: "settings"       as Module, icon: SlidersHorizontal },
      { key: "roles",          label: "角色管理",   moduleKey: "roles"          as Module, icon: KeyRound,   superAdminOnly: true },
      { key: "adminusers",     label: "管理员管理", moduleKey: "adminusers"     as Module, icon: UserCog,    superAdminOnly: true },
      { key: "syslogs",        label: "系统日志",   moduleKey: "syslogs"        as Module, icon: ScrollText, superAdminOnly: true },
    ],
  },

  {
    key: "screen", icon: Monitor, label: "数据大屏", permKey: "screen",
    children: [
      { key: "screen_h",     label: "横屏大屏", href: "/screen",     icon: Monitor },
      { key: "screenvideos", label: "视频管理", moduleKey: "screenvideos" as Module, icon: Video },
    ],
  },

  { key: "v2_overview", icon: Layers, label: "跨通道总览", permKey: "demands" },
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

interface LoginStatsDay { day: string; loginCount: number; userCount: number; }
interface LoginStatsCity { city: string; loginCount: number; userCount: number; }
interface LoginTrend { days14: LoginStatsDay[]; }
interface LoginCity  { cityBreakdown: LoginStatsCity[]; date: string; }

function Dashboard() {
  const { data, isLoading, refetch } = useQuery<AdminStats>({
    queryKey: ["admin-stats"],
    queryFn: () => adminGet("/api/admin/stats"),
  });

  const todayStr = new Date().toISOString().substring(0, 10);
  const [cityDate, setCityDate] = useState(todayStr);

  // 折线图：固定 query key，不受 cityDate 影响
  const { data: trendStats, isLoading: trendLoading } = useQuery<LoginTrend>({
    queryKey: ["admin-login-stats"],
    queryFn: () => adminGet("/api/admin/login-stats"),
    staleTime: 5 * 60_000,
  });

  // 柱图：随 cityDate 变化
  const { data: cityStats, isLoading: cityLoading } = useQuery<LoginCity>({
    queryKey: ["admin-login-city", cityDate],
    queryFn: () => adminGet(`/api/admin/login-city?date=${cityDate}`),
    staleTime: 60_000,
  });

  const handleLineDotClick = useCallback((payload: any) => {
    const fullDay = payload?.activePayload?.[0]?.payload?._fullDay;
    if (fullDay) setCityDate(fullDay);
  }, []);

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

  const trendData = (trendStats?.days14 ?? []).map(d => ({
    day: d.day.substring(5),
    登录次数: d.loginCount,
    用户登录数: d.userCount,
    _fullDay: d.day,
  }));

  const cityData = cityStats?.cityBreakdown ?? [];

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

      {/* ── 14-day login trend line chart ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-blue-900">近 14 天用户访问趋势</h3>
            <p className="text-xs text-slate-400 mt-0.5">点击折线上的日期点，柱图将切换到该日城市分布</p>
          </div>
          {trendLoading && <Loader2 size={16} className="animate-spin text-slate-400" />}
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendData} onClick={handleLineDotClick} style={{ cursor: "pointer" }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
              formatter={(val: number, name: string) => [val.toLocaleString(), name]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="登录次数" stroke="#0047ab" strokeWidth={2} dot={{ r: 4, fill: "#0047ab" }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="用户登录数" stroke="#10b981" strokeWidth={2} dot={{ r: 4, fill: "#10b981" }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── City breakdown bar chart ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-base font-bold text-blue-900">城市登录分布</h3>
            <p className="text-xs text-slate-400 mt-0.5">选择日期查看当天各城市的登录情况</p>
          </div>
          <input
            type="date"
            value={cityDate}
            max={todayStr}
            onChange={e => setCityDate(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-600 outline-none focus:ring-2 focus:ring-primary/20 bg-white"
          />
        </div>
        {cityLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin text-slate-300" />
          </div>
        ) : cityData.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-slate-400 text-sm">该日期暂无登录数据</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cityData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="city" tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                formatter={(val: number, name: string) => [val.toLocaleString(), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="loginCount" name="登录次数" fill="#0047ab" radius={[4, 4, 0, 0]} />
              <Bar dataKey="userCount" name="用户登录数" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
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

interface OpcTrackCert { cat_id: number; cat_name: string; level: string; }
interface OpcUserTag   { tag_id: number; tag_name: string; cat_id: number; }

interface OpcEcoItem {
  id: number;
  nickname: string;
  email: string;
  status: string;
  created_at: string;
  credit_score: number | null;
  credit_points: number | null;
  credit_level_name: string | null;
  credit_level_color: string | null;
  total_orders: number | null;
  completion_rate: number | null;
  avg_rating: number | null;
  track_certs: OpcTrackCert[];
  user_tags: OpcUserTag[];
}

interface EcoResp extends PagedResp<OpcEcoItem> {
  stats?: { total: number; aLevelCount: number; warnCount: number };
}

const TRACK_LEVEL_LABELS: Record<string, string> = { newbie: "新手", C: "C级", B: "B级", A: "A级" };
const TRACK_LEVEL_COLORS: Record<string, string> = {
  newbie: "bg-slate-100 text-slate-500",
  C: "bg-blue-100 text-blue-700",
  B: "bg-purple-100 text-purple-700",
  A: "bg-amber-100 text-amber-700",
};

// PostgreSQL raw SQL returns JSON_AGG columns as strings; parse defensively
function parseArr<T>(v: T[] | string | null | undefined): T[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { const r = JSON.parse(v as string); return Array.isArray(r) ? r : []; } catch { return []; }
}

function EcosystemManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { q, qInput, setQInput, page, pageSize, setPage, setPageSize, commitSearch, clearSearch } = useAdminListState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [expanded, setExpanded] = useState<number | null>(null);

  // pending edits per (userId, catId) key
  const [pendingTrackLevel, setPendingTrackLevel] = useState<Record<string, string>>({});
  const [pendingTrackTags, setPendingTrackTags] = useState<Record<string, number[]>>({});

  const catParam   = catFilter === "all" ? "" : catFilter;
  const levelParam = catFilter !== "all" && levelFilter !== "all" ? levelFilter : "";

  const { data: resp, isLoading } = useQuery<EcoResp>({
    queryKey: ["admin-ecosystem", q, catFilter, levelFilter, page, pageSize],
    queryFn: () => adminGet(`/api/admin/ecosystem?q=${encodeURIComponent(q)}&catId=${catParam}&level=${levelParam}&page=${page}&pageSize=${pageSize}`),
  });
  const opcs = resp?.data ?? [];
  const stats = resp?.stats;

  const { data: catCategories } = useQuery<Array<{ id: number; name: string; code: string }>>({
    queryKey: ["cat-categories-admin"],
    queryFn: () => adminGet("/api/admin/level-certs/categories"),
    staleTime: 300_000,
  });

  const { data: allCatTagsEco } = useQuery<Array<{ id: number; catCategoryId: number; name: string }>>({
    queryKey: ["admin-all-cat-tags"],
    queryFn: () => adminGet("/api/admin/cat-tags"),
    staleTime: 300_000,
  });

  const mutate = useMutation({
    mutationFn: (body: { id: number; action: string; value?: string | number; catCategoryId?: number; tagIds?: number[] }) =>
      adminPatch(`/api/admin/ecosystem/${body.id}`, { action: body.action, value: body.value, catCategoryId: body.catCategoryId, tagIds: body.tagIds }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-ecosystem"] }); toast({ title: "操作成功" }); },
    onError: (e: Error) => toast({ title: "操作失败", description: e.message, variant: "destructive" }),
  });

  const handleExpand = (opc: OpcEcoItem) => {
    if (expanded === opc.id) { setExpanded(null); return; }
    setExpanded(opc.id);
    // init pending tag state for each track cert
    const trackCerts = parseArr<OpcTrackCert>(opc.track_certs);
    const userTags   = parseArr<OpcUserTag>(opc.user_tags);
    const tagUpdates: Record<string, number[]> = {};
    trackCerts.forEach(tc => {
      const key = `${opc.id}-${tc.cat_id}`;
      if (pendingTrackTags[key] === undefined) {
        tagUpdates[key] = userTags.filter(t => t.cat_id === tc.cat_id).map(t => t.tag_id);
      }
    });
    if (Object.keys(tagUpdates).length > 0) {
      setPendingTrackTags(prev => ({ ...prev, ...tagUpdates }));
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="OPC 生态池管理" sub="各赛道认证等级、信用分与标签管理" />

      {/* Stats — accurate from DB */}
      <div className="grid grid-cols-3 gap-5">
        <StatCard label="生态池总 OPC" value={(stats?.total ?? resp?.total ?? 0).toString()} icon={Users} />
        <StatCard label="A 级认证 OPC" value={(stats?.aLevelCount ?? 0).toString()} icon={ArrowUpRight} />
        <StatCard label="信用预警 (<3.5)" value={(stats?.warnCount ?? 0).toString()} icon={AlertCircle} accent />
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* Row 1: track + search */}
        <div className="flex items-center gap-2">
          {/* Track pills — scrollable so many tracks don't overflow */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 flex-1 min-w-0 no-scrollbar">
            <button onClick={() => { setCatFilter("all"); setLevelFilter("all"); setPage(1); }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${catFilter === "all" ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              全部赛道
            </button>
            {(catCategories ?? []).map(c => (
              <button key={c.id}
                onClick={() => { setCatFilter(String(c.id)); setLevelFilter("all"); setPage(1); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${catFilter === String(c.id) ? "bg-primary text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                {c.name}
              </button>
            ))}
          </div>
          {/* Search */}
          <form onSubmit={e => { e.preventDefault(); commitSearch(); }} className="flex items-center gap-1 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={qInput} onChange={e => setQInput(e.target.value)} placeholder="搜索用户名/邮箱…"
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary/20 w-44" />
            </div>
            <button type="submit" className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">搜索</button>
            {q && <button type="button" onClick={clearSearch} className="px-2 py-1.5 text-slate-400 hover:text-slate-600 text-xs transition-colors">×</button>}
          </form>
        </div>
        {/* Row 2: level filter — only visible when a track is selected */}
        {catFilter !== "all" && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-medium shrink-0">等级筛选：</span>
            {([["all", "全部等级"], ["C", "C 级"], ["B", "B 级"], ["A", "A 级"]] as const).map(([val, label]) => (
              <button key={val}
                onClick={() => { setLevelFilter(val); setPage(1); }}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${levelFilter === val
                  ? val === "all" ? "bg-slate-600 text-white" : val === "A" ? "bg-amber-400 text-white" : val === "B" ? "bg-purple-500 text-white" : "bg-blue-500 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <TableShell headers={["OPC", "信用等级", "信用分", "完成订单", "完成率", "状态", "赛道认证"]}>
        {isLoading ? <LoadingRow cols={7} /> : opcs.length === 0 ? <EmptyRow cols={7} /> :
          opcs.map(o => (
            <>
              <tr key={o.id} className="hover:bg-slate-50/60 transition-colors cursor-pointer" onClick={() => handleExpand(o)}>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary">{o.nickname[0]}</div>
                    <div>
                      <p className="font-bold text-sm text-blue-900">{o.nickname}</p>
                      <p className="text-[10px] text-slate-400">{o.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {o.credit_level_name ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: o.credit_level_color ?? "#94a3b8" }}>
                      {o.credit_level_name}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${(o.credit_score ?? 0) >= 4 ? "bg-secondary" : (o.credit_score ?? 0) >= 3 ? "bg-amber-400" : "bg-destructive"}`}
                        style={{ width: `${((o.credit_score ?? 0) / 5) * 100}%` }} />
                    </div>
                    <span className="text-xs font-bold text-slate-600">{(o.credit_score ?? 0).toFixed(1)}</span>
                    <button onClick={e => { e.stopPropagation(); mutate.mutate({ id: o.id, action: "addCredit", value: 0.1 }); }}
                      title="+0.1" className="p-1 rounded hover:bg-green-50 text-slate-300 hover:text-secondary"><ArrowUpRight size={12} /></button>
                    <button onClick={e => { e.stopPropagation(); mutate.mutate({ id: o.id, action: "subtractCredit", value: 0.1 }); }}
                      title="-0.1" className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-destructive"><ArrowDownRight size={12} /></button>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{o.total_orders ?? 0}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{(o.completion_rate ?? 0).toFixed(1)}%</td>
                <td className="px-6 py-4">
                  <StatusBadge label={o.status === "active" ? "正常" : "封禁"}
                    color={o.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {(() => { const certs = parseArr<OpcTrackCert>(o.track_certs); return certs.length === 0 ? (
                      <span className="text-xs text-slate-400">暂无认证</span>
                    ) : certs.map(tc => (
                      <span key={tc.cat_id} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TRACK_LEVEL_COLORS[tc.level] ?? "bg-slate-100 text-slate-500"}`}>
                        {tc.cat_name}·{TRACK_LEVEL_LABELS[tc.level] ?? tc.level}
                      </span>
                    )); })()}
                    <span className="text-slate-300 text-xs ml-1">{expanded === o.id ? "▲" : "▼"}</span>
                  </div>
                </td>
              </tr>
              {/* Expanded track cert editor */}
              {expanded === o.id && (
                <tr key={`${o.id}-expand`}>
                  <td colSpan={7} className="px-6 pb-4 pt-0 bg-slate-50/80">
                    <div className="border border-slate-200 rounded-2xl p-4 space-y-4 bg-white">
                      <p className="text-xs font-bold text-slate-500">赛道认证管理 · 可新增/修改等级与标签</p>
                      {(() => {
                        const trackCertsExp = parseArr<OpcTrackCert>(o.track_certs);
                        const userTagsExp   = parseArr<OpcUserTag>(o.user_tags);
                        const allCats = catCategories ?? [];
                        return allCats.map(cat => {
                          const existing = trackCertsExp.find(tc => tc.cat_id === cat.id);
                          const key = `${o.id}-${cat.id}`;
                          const trackTags = (allCatTagsEco ?? []).filter(t => t.catCategoryId === cat.id);

                          if (existing) {
                            // — Existing cert: full editor —
                            const origTagIds = userTagsExp.filter(t => t.cat_id === cat.id).map(t => t.tag_id);
                            const currentTagIds = pendingTrackTags[key] ?? origTagIds;
                            const pendingLvl = pendingTrackLevel[key] ?? existing.level;
                            const levelDirty = pendingLvl !== existing.level;
                            const tagsDirty = JSON.stringify([...currentTagIds].sort()) !== JSON.stringify([...origTagIds].sort());
                            return (
                              <div key={cat.id} className="border border-slate-100 rounded-xl p-3 space-y-2.5 bg-slate-50">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-bold text-slate-700">{cat.name}</p>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${TRACK_LEVEL_COLORS[existing.level] ?? "bg-slate-100 text-slate-500"}`}>
                                      {TRACK_LEVEL_LABELS[existing.level] ?? existing.level}
                                    </span>
                                  </div>
                                  {(levelDirty || tagsDirty) && (
                                    <button
                                      onClick={() => {
                                        if (levelDirty) mutate.mutate({ id: o.id, action: "setTrackLevel", catCategoryId: cat.id, value: pendingLvl });
                                        if (tagsDirty) mutate.mutate({ id: o.id, action: "setTrackTags", catCategoryId: cat.id, tagIds: currentTagIds });
                                        setPendingTrackLevel(prev => { const n = { ...prev }; delete n[key]; return n; });
                                      }}
                                      disabled={mutate.isPending}
                                      className="px-3 py-1 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50">
                                      保存修改
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-slate-500 shrink-0">等级：</span>
                                  <select
                                    value={pendingLvl}
                                    onChange={e => setPendingTrackLevel(prev => ({ ...prev, [key]: e.target.value }))}
                                    className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                                    {(["C", "B", "A"] as const).map(l => (
                                      <option key={l} value={l}>{TRACK_LEVEL_LABELS[l]}</option>
                                    ))}
                                  </select>
                                </div>
                                {trackTags.length > 0 && (
                                  <div className="flex items-start gap-2 flex-wrap">
                                    <span className="text-xs text-slate-500 shrink-0 mt-0.5">标签：</span>
                                    {trackTags.map(tag => {
                                      const checked = currentTagIds.includes(tag.id);
                                      return (
                                        <label key={tag.id}
                                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer border transition-colors ${checked ? "bg-primary/10 border-primary/40 text-primary" : "bg-white border-slate-200 text-slate-500 hover:border-primary/30"}`}>
                                          <input type="checkbox" className="hidden" checked={checked}
                                            onChange={() => setPendingTrackTags(prev => ({
                                              ...prev,
                                              [key]: checked ? currentTagIds.filter(id => id !== tag.id) : [...currentTagIds, tag.id],
                                            }))} />
                                          {checked && <span>✓</span>}
                                          {tag.name}
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          } else {
                            // — No cert yet: add entry —
                            const newLvl = pendingTrackLevel[key] ?? "C";
                            return (
                              <div key={cat.id} className="border border-dashed border-slate-200 rounded-xl p-3 flex items-center gap-3 bg-white">
                                <p className="text-sm text-slate-400 flex-1">{cat.name}</p>
                                <span className="text-[10px] text-slate-300">暂无认证</span>
                                <select
                                  value={newLvl}
                                  onChange={e => setPendingTrackLevel(prev => ({ ...prev, [key]: e.target.value }))}
                                  className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                                  {(["C", "B", "A"] as const).map(l => (
                                    <option key={l} value={l}>{TRACK_LEVEL_LABELS[l]}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => mutate.mutate({ id: o.id, action: "setTrackLevel", catCategoryId: cat.id, value: newLvl })}
                                  disabled={mutate.isPending}
                                  className="px-3 py-1 bg-secondary/10 text-secondary rounded-lg text-xs font-bold hover:bg-secondary/20 disabled:opacity-50 shrink-0">
                                  + 添加认证
                                </button>
                              </div>
                            );
                          }
                        });
                      })()}
                    </div>
                  </td>
                </tr>
              )}
            </>
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
  cat_category_id: number | null;
  cat_category_name: string | null;
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
  catCategories: { id: number; name: string }[];
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
  title: string; category: string; catCategoryId: string; requiredLevel: string; durationMinutes: string;
  description: string; badge: string; rating: string; isRequired: boolean;
  status: string; price: string; syllabusUrl: string; instructor: string; maxEnrollments: string;
};

const BLANK_FORM: CourseForm = {
  title: "", category: "tech", catCategoryId: "", requiredLevel: "C", durationMinutes: "60",
  description: "", badge: "", rating: "", isRequired: false,
  status: "draft", price: "0", syllabusUrl: "", instructor: "", maxEnrollments: "",
};

function courseToForm(c: AdminCourse): CourseForm {
  return {
    title: c.title, category: c.category,
    catCategoryId: c.cat_category_id != null ? String(c.cat_category_id) : "",
    requiredLevel: c.required_level,
    durationMinutes: String(c.duration_minutes), description: c.description,
    badge: c.badge ?? "", rating: c.rating != null ? String(c.rating) : "",
    isRequired: c.is_required, status: c.status, price: String(c.price),
    syllabusUrl: c.syllabus_url ?? "", instructor: c.instructor ?? "",
    maxEnrollments: c.max_enrollments != null ? String(c.max_enrollments) : "",
  };
}

function CourseModal({
  open, onClose, onSave, initialForm, isEdit, catCategories,
}: {
  open: boolean; onClose: () => void;
  onSave: (form: CourseForm) => void;
  initialForm: CourseForm; isEdit: boolean;
  catCategories: { id: number; name: string }[];
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
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">需求大类（赛道）</label>
              <select value={form.catCategoryId} onChange={e => set("catCategoryId", e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                <option value="">不限赛道</option>
                {catCategories.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
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

function TrainingManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm, confirmDialog } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<AdminCourse | null>(null);
  const [enrollCourse, setEnrollCourse] = useState<AdminCourse | null>(null);
  const [trainingTab, setTrainingTab] = useState<"courses" | "refunds">("courses");
  const [courseCat, setCourseCat] = useState<string>("all");
  const { q, qInput, setQInput, filter: courseStatus, level: courseLevel, page, pageSize, setPage, setPageSize, commitSearch, clearSearch, applyFilter: applyStatus, applyLevel } = useAdminListState("all", "all");

  const { data, isLoading } = useQuery<TrainingData>({
    queryKey: ["admin-training", q, courseStatus, courseLevel, courseCat, page, pageSize],
    queryFn: () => adminGet(`/api/admin/training?q=${encodeURIComponent(q)}&status=${courseStatus === "all" ? "" : courseStatus}&level=${courseLevel === "all" ? "" : courseLevel}&catCategoryId=${courseCat === "all" ? "" : courseCat}&page=${page}&pageSize=${pageSize}`),
  });

  const catCategories = data?.catCategories ?? [];

  const createMutation = useMutation({
    mutationFn: (form: CourseForm) => adminPost("/api/admin/training/courses", {
      title: form.title, category: form.category,
      catCategoryId: form.catCategoryId ? Number(form.catCategoryId) : null,
      requiredLevel: form.requiredLevel,
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
      title: form.title, category: form.category,
      catCategoryId: form.catCategoryId ? Number(form.catCategoryId) : null,
      requiredLevel: form.requiredLevel,
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
  const COURSE_CAT_FILTERS = [
    { val: "all", label: "全部赛道" },
    ...catCategories.map(c => ({ val: String(c.id), label: c.name })),
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
        {catCategories.length > 0 && <>
          <span className="text-slate-200">|</span>
          {COURSE_CAT_FILTERS.map(f => (
            <button key={f.val} onClick={() => setCourseCat(f.val)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${courseCat === f.val ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {f.label}
            </button>
          ))}
        </>}
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

      <TableShell headers={["课程名称", "赛道", "分类", "等级", "讲师", "时长", "价格", "状态", "报名/发证", "操作"]}>
        {isLoading ? <LoadingRow cols={10} /> : courses.length === 0 ? <EmptyRow cols={10} /> :
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
                {c.cat_category_name
                  ? <StatusBadge label={c.cat_category_name} color="bg-amber-100 text-amber-700" />
                  : <span className="text-xs text-slate-400">—</span>}
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
        catCategories={catCategories}
      />

      {editCourse && (
        <CourseModal
          open={true}
          onClose={() => setEditCourse(null)}
          onSave={(form) => editMutation.mutate({ id: editCourse.id, form })}
          initialForm={courseToForm(editCourse)}
          isEdit={true}
          catCategories={catCategories}
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

/* ─── Platform Info Management ───────────────────── */

function PlatformInfoManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: Record<string, string> | null }>({
    queryKey: ["admin-platform-info"],
    queryFn: () => adminGet("/api/admin/platform-info"),
  });

  const [form, setForm] = useState({
    companyName: "", creditCode: "", taxId: "",
    contactPerson: "", contactPhone: "", contactAddress: "",
    bankName: "", bankAccount: "",
  });

  useEffect(() => {
    if (data?.data) {
      const d = data.data as any;
      setForm({
        companyName:    d.companyName    ?? "",
        creditCode:     d.creditCode     ?? "",
        taxId:          d.taxId          ?? "",
        contactPerson:  d.contactPerson  ?? "",
        contactPhone:   d.contactPhone   ?? "",
        contactAddress: d.contactAddress ?? "",
        bankName:       d.bankName       ?? "",
        bankAccount:    d.bankAccount    ?? "",
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch(`${BASE}/api/admin/platform-info`, {
        method: "PUT",
        headers: getAdminHeaders(),
        body: JSON.stringify(form),
      }).then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "保存失败"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-platform-info"] }); toast({ title: "平台企业信息已保存" }); },
    onError: (e: Error) => toast({ title: "保存失败", description: e.message, variant: "destructive" }),
  });

  function fi(key: keyof typeof form, label: string, placeholder: string) {
    return (
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1.5">{label}</label>
        <input
          value={form[key]}
          onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))}
          placeholder={placeholder}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50 transition"
        />
      </div>
    );
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  return (
    <div className="max-w-2xl">
      <SectionHeader title="平台企业信息" sub="维护平台方企业的基本工商与银行信息，用于合同、结算等场景" />
      <div className="space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">工商信息</h3>
          <div className="grid grid-cols-1 gap-4">
            {fi("companyName",   "公司名称",         "请输入营业执照上的公司名称")}
            {fi("creditCode",    "统一社会信用代码", "18位统一社会信用代码")}
            {fi("taxId",         "纳税识别号",       "纳税人识别号")}
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">联系信息</h3>
          <div className="grid grid-cols-2 gap-4">
            {fi("contactPerson",  "联系人",   "联系人姓名")}
            {fi("contactPhone",   "联系方式", "联系电话")}
          </div>
          {fi("contactAddress", "联系地址", "公司联系地址")}
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">银行信息</h3>
          <div className="grid grid-cols-2 gap-4">
            {fi("bankName",    "开户银行", "如：中国工商银行")}
            {fi("bankAccount", "账号",     "银行账号")}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-md shadow-primary/20"
          >
            {saveMutation.isPending ? <><Loader2 size={15} className="animate-spin" />保存中…</> : <><Save size={15} />保存</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Platform Contract Config Management ────────── */

function PlatformContractConfigManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ data: Array<{ partyType: string; invoiceType: string; taxRate: string }> }>({
    queryKey: ["admin-platform-contract-config"],
    queryFn: () => adminGet("/api/admin/platform-contract-config"),
  });

  const [configs, setConfigs] = useState<Record<string, { invoiceType: string; taxRate: string }>>({
    publisher: { invoiceType: "普通发票", taxRate: "0" },
    opc:       { invoiceType: "普通发票", taxRate: "0" },
  });
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (data?.data) {
      const next: typeof configs = { ...configs };
      for (const row of data.data) {
        next[row.partyType] = { invoiceType: row.invoiceType, taxRate: row.taxRate };
      }
      setConfigs(next);
    }
  }, [data]);

  async function handleSave(partyType: string) {
    const cfg = configs[partyType];
    setSaving(v => ({ ...v, [partyType]: true }));
    try {
      const res = await fetch(`${BASE}/api/admin/platform-contract-config/${partyType}`, {
        method: "PUT",
        headers: getAdminHeaders(),
        body: JSON.stringify({ invoiceType: cfg.invoiceType, taxRate: parseFloat(cfg.taxRate) || 0 }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "保存失败");
      qc.invalidateQueries({ queryKey: ["admin-platform-contract-config"] });
      toast({ title: `${partyType === "publisher" ? "发单方" : "OPC"} 合同配置已保存` });
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" });
    } finally {
      setSaving(v => ({ ...v, [partyType]: false }));
    }
  }

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-primary" size={32} /></div>;

  const parties: { key: string; label: string }[] = [
    { key: "publisher", label: "发单方合同" },
    { key: "opc",       label: "OPC 合同" },
  ];

  return (
    <div className="max-w-2xl">
      <SectionHeader title="合同配置" sub="新合同创建时将自动沿用此处的发票类型和税率作为默认值，运营人员可在每份合同中单独修改" />
      <div className="space-y-6">
        {parties.map(({ key, label }) => (
          <div key={key} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-700">{label}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">发票类型 <span className="text-red-500">*</span></label>
                <select
                  value={configs[key]?.invoiceType ?? "普通发票"}
                  onChange={e => setConfigs(v => ({ ...v, [key]: { ...v[key], invoiceType: e.target.value } }))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50"
                >
                  <option value="普通发票">普通发票</option>
                  <option value="专用发票">专用发票</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">税率（%）<span className="text-red-500">*</span></label>
                <input
                  type="number" min={0} max={100} step={0.01}
                  value={configs[key]?.taxRate ?? "0"}
                  onChange={e => setConfigs(v => ({ ...v, [key]: { ...v[key], taxRate: e.target.value } }))}
                  placeholder="如：6"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 bg-slate-50"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => handleSave(key)}
                disabled={saving[key]}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving[key] ? <><Loader2 size={14} className="animate-spin" />保存中…</> : <><Save size={14} />保存</>}
              </button>
            </div>
          </div>
        ))}
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
        {/* 平台结算配置 */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">平台结算配置</h3>
          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">平台建行商家编号</label>
            <p className="text-xs text-slate-400 mb-2">用于分账时平台手续费收款方，对应建设银行商家号</p>
            {field("platform_ccb_merchant_no", "请输入平台建设银行商家编号")}
          </div>
          <div>
            <label className="block text-sm font-bold text-blue-900 mb-1.5">保证金锁定天数</label>
            <p className="text-xs text-slate-400 mb-2">OPC 30% 保证金（holdback）在订单完成后需锁定多少天才可解锁，默认 90 天</p>
            {field("holdback_release_days", "90")}
          </div>
        </div>

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

interface ReviewLogEntry {
  id: number;
  result: "approved" | "downgraded" | "rejected";
  note: string | null;
  created_at: string;
  admin_username: string | null;
  admin_avatar: string | null;
}

const RESULT_LABELS: Record<string, { text: string; color: string }> = {
  approved:   { text: "认证通过", color: "text-green-700 bg-green-50 border-green-200" },
  downgraded: { text: "降级通过", color: "text-blue-700 bg-blue-50 border-blue-200" },
  rejected:   { text: "未通过",   color: "text-red-700 bg-red-50 border-red-200" },
};

function ReviewLogsPanel({ portfolioId }: { portfolioId: number }) {
  const { data: logs, isLoading } = useQuery<ReviewLogEntry[]>({
    queryKey: ["review-logs", portfolioId],
    queryFn: () => adminGet(`/api/admin/level-certs/${portfolioId}/review-logs`),
    staleTime: 30_000,
  });
  if (isLoading) return <p className="text-xs text-slate-400 py-1">加载中…</p>;
  if (!logs || logs.length === 0) return <p className="text-xs text-slate-400 py-1">暂无历史评审记录</p>;
  return (
    <div className="space-y-2">
      {logs.map(log => {
        const label = RESULT_LABELS[log.result] ?? { text: log.result, color: "text-slate-600 bg-slate-50 border-slate-200" };
        return (
          <div key={log.id} className={`border rounded-xl px-3 py-2.5 ${label.color}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold">{label.text}</span>
              <span className="text-[11px] opacity-70">
                {new Date(log.created_at).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                {log.admin_username ? ` · ${log.admin_username}` : ""}
              </span>
            </div>
            {log.note ? (
              <p className="text-xs leading-relaxed opacity-90">{log.note}</p>
            ) : (
              <p className="text-xs opacity-50 italic">（无评语）</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LevelCertReview() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCatId, setFilterCatId] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(10);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [settingCatFor, setSettingCatFor] = useState<number | null>(null);
  const [setCatId, setSetCatId] = useState<string>("");
  const [setCatLevel, setSetCatLevel] = useState<string>("");
  const [setCatTagIds, setSetCatTagIds] = useState<number[]>([]);
  const [logsOpenFor, setLogsOpenFor] = useState<number | null>(null);
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

  const { data: allCatTags } = useQuery<Array<{ id: number; catCategoryId: number; code: string; name: string }>>({
    queryKey: ["admin-all-cat-tags"],
    queryFn: () => adminGet("/api/admin/cat-tags"),
    staleTime: 300000,
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
    mutationFn: ({ portfolioId, result, downgradeTo, note, tagIds }: { portfolioId: number; result: string; downgradeTo?: string; note: string; tagIds: number[] }) =>
      adminPost(`/api/admin/level-certs/${portfolioId}/review`, { result, note, downgradeTo, tagIds }),
    onSuccess: () => {
      toast({ title: "评审已提交", description: "评审结果已发送通知给OPC" });
      setReviewing(null);
      setReviewNote("");
      setSelectedTagIds([]);
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
    mutationFn: ({ portfolioId, catCategoryId, grantedLevel, tagIds }: { portfolioId: number; userId: number; catCategoryId: number; grantedLevel?: string; tagIds?: number[] }) =>
      adminPatch(`/api/admin/level-certs/${portfolioId}/category`, { catCategoryId, grantedLevel, tagIds }),
    onSuccess: (_, variables) => {
      toast({ title: "赛道已设置", description: "OPC赛道认证记录已更新" });
      setSettingCatFor(null);
      setSetCatId("");
      setSetCatLevel("");
      setSetCatTagIds([]);
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
                        onClick={e => { e.stopPropagation(); setReviewing(isReviewing ? null : row.id); setExpanded(row.id); setReviewNote(""); setSelectedTagIds([]); }}
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

                    {/* 赛道 + 当前赛道等级 + 申请等级 */}
                    <div className="grid grid-cols-3 gap-4">
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
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">该赛道当前等级</p>
                        <p className="text-sm font-medium text-slate-600">
                          {row.track_current_level ? (LEVEL_LABELS[row.track_current_level] ?? `${row.track_current_level} 级`) : "暂无认证"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">申请等级</p>
                        <p className="text-sm font-bold text-amber-700">{LEVEL_LABELS[row.apply_level] ?? `${row.apply_level} 级`}</p>
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

                    {/* 历史评审记录（管理员可见，按需展开） */}
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                      <button
                        className="flex items-center justify-between w-full text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
                        onClick={() => setLogsOpenFor(logsOpenFor === row.id ? null : row.id)}>
                        <span>历史评审记录</span>
                        <span className="text-slate-400">{logsOpenFor === row.id ? "▲ 收起" : "▼ 展开"}</span>
                      </button>
                      {logsOpenFor === row.id && (
                        <div className="mt-2">
                          <ReviewLogsPanel portfolioId={row.id} />
                        </div>
                      )}
                    </div>

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
                        {/* 二级标签多选（仅有赛道时显示） */}
                        {row.effective_cat_category_id && (() => {
                          const trackTags = (allCatTags ?? []).filter(t => t.catCategoryId === row.effective_cat_category_id);
                          if (trackTags.length === 0) return null;
                          return (
                            <div className="bg-white border border-amber-200 rounded-xl px-3 py-2.5 space-y-2">
                              <p className="text-xs font-bold text-amber-700">评定二级标签（可多选，可留空）</p>
                              <div className="flex flex-wrap gap-2">
                                {trackTags.map(tag => {
                                  const checked = selectedTagIds.includes(tag.id);
                                  return (
                                    <label key={tag.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer border transition-colors ${checked ? "bg-amber-100 border-amber-400 text-amber-800" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-amber-300"}`}>
                                      <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={checked}
                                        onChange={() => setSelectedTagIds(prev => checked ? prev.filter(id => id !== tag.id) : [...prev, tag.id])} />
                                      {checked && <span className="text-amber-600">✓</span>}
                                      {tag.name}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
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
                              onClick={() => reviewMut.mutate({ portfolioId: row.id, result: "approved", note: reviewNote, tagIds: selectedTagIds })}
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
                              onClick={() => reviewMut.mutate({ portfolioId: row.id, result: "downgraded", downgradeTo: lvl, note: reviewNote, tagIds: selectedTagIds })}
                              disabled={reviewMut.isPending}
                              className="py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                              <Award size={14} />
                              降级通过 · {LEVEL_LABELS[lvl] ?? lvl}
                            </button>
                          ))}
                          {/* 还需努力 */}
                          <button
                            onClick={() => reviewMut.mutate({ portfolioId: row.id, result: "rejected", note: reviewNote, tagIds: [] })}
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
                              onChange={e => { setSetCatId(e.target.value); setSetCatTagIds([]); }}
                              className="w-full border border-purple-200 rounded-xl px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-purple-300">
                              <option value="">-- 选择赛道 --</option>
                              {(catCategories ?? []).map(c => (
                                <option key={c.id} value={String(c.id)}>{c.name}</option>
                              ))}
                            </select>
                            {/* 二级标签（选赛道后显示） */}
                            {setCatId && (() => {
                              const trackTags = (allCatTags ?? []).filter(t => t.catCategoryId === Number(setCatId));
                              if (trackTags.length === 0) return null;
                              return (
                                <div className="bg-white border border-purple-200 rounded-xl px-3 py-2.5 space-y-2">
                                  <p className="text-xs font-bold text-purple-700">评定二级标签（可多选，可留空）</p>
                                  <div className="flex flex-wrap gap-2">
                                    {trackTags.map(tag => {
                                      const checked = setCatTagIds.includes(tag.id);
                                      return (
                                        <label key={tag.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer border transition-colors ${checked ? "bg-purple-100 border-purple-400 text-purple-800" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-purple-300"}`}>
                                          <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={checked}
                                            onChange={() => setSetCatTagIds(prev => checked ? prev.filter(id => id !== tag.id) : [...prev, tag.id])} />
                                          {checked && <span className="text-purple-600">✓</span>}
                                          {tag.name}
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
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
                                    tagIds: setCatTagIds,
                                  });
                                }}
                                disabled={!setCatId || setCategoryMut.isPending || (row.level_apply_status === "downgraded" && !setCatLevel)}
                                className="flex-1 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-colors disabled:opacity-40">
                                确认设置
                              </button>
                              <button
                                onClick={() => { setSettingCatFor(null); setSetCatId(""); setSetCatLevel(""); setSetCatTagIds([]); }}
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

type AdminAccount = {
  id: number; nickname: string; email: string;
  isSuperAdmin: boolean; roleIds: number[]; createdAt: string;
};

/* ─── RBAC: permission key labels ────────────────── */

const PERM_LABELS: Record<string, string> = {
  dashboard:             "数据看板",
  cockpit:               "平台驾驶舱",
  users:                 "用户管理",
  demands:               "需求管理",
  payments:              "保证金审核",
  orders:                "订单管理",
  disputes:              "争议管理",
  finance:               "财务管理",
  ecosystem:             "OPC 生态池",
  training:              "认证培训",
  levelcert:             "等级认证",
  content:               "内容审核",
  sensitivewords:        "敏感词管理",
  settings:              "站点设置",
  screen:                "数据大屏",
  operation:             "运营管理",
  contest:               "OPC 大赛",
  // 社区管理模块
  community:             "社区管理 · 社区",
  announcement_category: "社区管理 · 公告类别",
  announcement:          "社区管理 · 公告",
  consult:               "社区管理 · 咨询管理",
};

const PERM_SUB: Record<string, string> = {
  finance:               "财务管理 · 结算账户审核",
  settings:              "站点设置 · 智能体配置",
  screen:                "横屏大屏",
  operation:             "运营管理 · 用户登录数据",
  contest:               "大赛活动 · 报名评级 · 题库管理",
  community:             "社区子菜单（功能建设中）",
  announcement_category: "公告类别增删改",
  announcement:          "公告增删改 · 发布/取消发布",
  consult:               "咨询管理（功能建设中）",
};

const ALL_PERM_KEYS = Object.keys(PERM_LABELS);

type AdminRole = {
  id: number; name: string; description: string | null;
  permissions: string[]; memberCount: number;
  createdAt: string; updatedAt: string;
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
  const [newNickname, setNewNickname] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [inviteRoles, setInviteRoles] = useState<number[]>([]);
  const [editAdminId, setEditAdminId] = useState<number | null>(null);
  const [editRoles, setEditRoles] = useState<number[]>([]);

  function resetCreateForm() {
    setNewNickname(""); setNewEmail(""); setNewPhone(""); setNewPassword(""); setInviteRoles([]);
  }

  const createMutation = useMutation({
    mutationFn: () => adminPost("/api/admin/admin-users/create", {
      nickname: newNickname.trim(),
      email: newEmail.trim() || undefined,
      phone: newPhone.trim() || undefined,
      password: newPassword,
      roleIds: inviteRoles,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rbac-admin-accounts"] });
      setShowInvite(false);
      resetCreateForm();
      toast({ title: "管理员已创建" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const canCreate = newNickname.trim() && newPassword.length >= 6 && (newEmail.trim() || newPhone.trim());

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
          <button onClick={() => { setShowInvite(true); resetCreateForm(); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
            <Plus size={15} /> 创建管理员
          </button>
        }
      />

      {showInvite && (
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-primary/20">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-blue-900">创建管理员</h3>
            <button onClick={() => setShowInvite(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">昵称 *</label>
                <input value={newNickname} onChange={e => setNewNickname(e.target.value)}
                  placeholder="管理员显示名称"
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">登录密码 *（至少 6 位）</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="设置初始密码" autoComplete="new-password"
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">邮箱（与手机号至少填一个，用于登录）</label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">手机号（与邮箱至少填一个，用于登录）</label>
                <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
                  placeholder="13800000000" maxLength={11}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>

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

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowInvite(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">取消</button>
              <button onClick={() => createMutation.mutate()} disabled={!canCreate || createMutation.isPending}
                className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-primary/90">
                {createMutation.isPending ? "创建中…" : "确认创建"}
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
  sortOrder: number;
  createdAt: string;
};

type PromptVersion = {
  id: number;
  agentConfigId: number;
  systemPrompt: string;
  remark: string | null;
  createdAt: string;
};

/* ─── Agent Config Edit Page ─── */
function AgentConfigEditPage({
  cfg,
  onBack,
  onSaved,
}: {
  cfg: AgentConfig;
  onBack: () => void;
  onSaved: (updated: AgentConfig) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const [prompt, setPrompt] = useState(cfg.systemPrompt);
  const [enabled, setEnabled] = useState(cfg.isEnabled);
  const [saving, setSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<PromptVersion | null>(null);

  const { data: versions = [], refetch: refetchVersions } = useQuery<PromptVersion[]>({
    queryKey: ["agent-config-versions", cfg.id],
    queryFn: () => adminGet(`/api/admin/agent-configs/${cfg.id}/versions`),
    enabled: showVersions,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`${BASE}/api/admin/agent-configs/${cfg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ systemPrompt: prompt, isEnabled: enabled }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `保存失败 (${res.status})`);
      }
      const updated: AgentConfig = await res.json();
      await qc.invalidateQueries({ queryKey: ["admin-agent-configs"] });
      if (showVersions) refetchVersions();
      toast({ title: "保存成功", description: "智能体配置已更新" });
      onSaved(updated);
    } catch (err: any) {
      toast({ title: "保存失败", description: err?.message ?? "请稍后重试", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const restoreVersion = (v: PromptVersion) => {
    setPrompt(v.systemPrompt);
    toast({ title: "已还原", description: `已载入 ${new Date(v.createdAt).toLocaleString("zh-CN")} 的版本` });
  };

  /* ── Skill 关联 ── */
  const [showSkills, setShowSkills] = useState(false);
  const [taskSkills, setTaskSkills] = useState<TaskSkillLink[]>([]);
  const [skillSaving, setSkillSaving] = useState(false);
  const skillDragIdxRef = useRef<number | null>(null);
  const [skillDragOverIdx, setSkillDragOverIdx] = useState<number | null>(null);

  const { data: allSkills = [] } = useQuery<SkillRow[]>({
    queryKey: ["admin-skills"],
    queryFn: () => adminGet<{ data: SkillRow[] }>("/api/admin/skills").then(r => r.data),
    enabled: showSkills,
  });

  const { data: currentSkillLinks, isLoading: skillLinksLoading } = useQuery<TaskSkillLink[]>({
    queryKey: ["admin-task-skills", cfg.sceneKey],
    queryFn: () => adminGet<{ data: TaskSkillLink[] }>(`/api/admin/agent-task-types/${cfg.sceneKey}/skills`).then(r => r.data),
    enabled: showSkills,
  });

  useEffect(() => {
    if (currentSkillLinks) setTaskSkills(currentSkillLinks);
  }, [currentSkillLinks]);

  const activeSkills = allSkills.filter(s => s.isActive);
  const linkedSkillIds = new Set(taskSkills.map(s => s.skillId));
  const availableSkills = activeSkills.filter(s => !linkedSkillIds.has(s.id));

  async function addSkill(skill: SkillRow) {
    try {
      const detail = await adminGet<{ data: TaskSkillLink }>(`/api/admin/skills/${skill.id}`);
      setTaskSkills(prev => [...prev, {
        id: 0, skillId: skill.id, sortOrder: prev.length,
        name: detail.data.name, description: detail.data.description,
        isActive: detail.data.isActive, skillMd: detail.data.skillMd ?? "", refFiles: detail.data.refFiles ?? {},
      }]);
    } catch {
      setTaskSkills(prev => [...prev, {
        id: 0, skillId: skill.id, sortOrder: prev.length,
        name: skill.name, description: skill.description, isActive: skill.isActive,
        skillMd: "", refFiles: {},
      }]);
    }
  }

  function removeSkill(skillId: number) {
    setTaskSkills(prev => prev.filter(s => s.skillId !== skillId).map((s, i) => ({ ...s, sortOrder: i })));
  }

  function onSkillDragStart(idx: number) { skillDragIdxRef.current = idx; }
  function onSkillDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setSkillDragOverIdx(idx); }
  function onSkillDrop(dropIdx: number) {
    const fromIdx = skillDragIdxRef.current;
    if (fromIdx === null || fromIdx === dropIdx) { setSkillDragOverIdx(null); return; }
    setTaskSkills(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(dropIdx, 0, moved);
      return arr.map((s, i) => ({ ...s, sortOrder: i }));
    });
    skillDragIdxRef.current = null;
    setSkillDragOverIdx(null);
  }
  function onSkillDragEnd() { skillDragIdxRef.current = null; setSkillDragOverIdx(null); }

  async function handleSkillSave() {
    setSkillSaving(true);
    try {
      await adminPut(`/api/admin/agent-task-types/${cfg.sceneKey}/skills`, {
        skills: taskSkills.map(s => ({ skillId: s.skillId, sortOrder: s.sortOrder })),
      });
      qc.invalidateQueries({ queryKey: ["admin-task-skills", cfg.sceneKey] });
      toast({ title: "Skill 关联已保存" });
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" });
    } finally {
      setSkillSaving(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-700 font-semibold transition-colors">
          <ArrowLeft size={16} /> 返回场景列表
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Bot size={15} className="text-primary" />
          </div>
          <div>
            <span className="font-extrabold text-slate-900">{cfg.name}</span>
            <span className="ml-2 text-xs text-slate-400">{cfg.sceneKey}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Main edit card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-700">启用状态</p>
              <p className="text-xs text-slate-400 mt-0.5">停用后该场景的智能体不会被调用</p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(v => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${enabled ? "bg-primary" : "bg-slate-300"}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${enabled ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>

          {/* Prompt editor — split pane */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">系统提示词</label>
            <div className="grid grid-cols-2 gap-0 border border-slate-200 rounded-xl overflow-hidden" style={{ minHeight: 460 }}>
              <div className="flex flex-col border-r border-slate-200">
                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">源码</div>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="在此粘贴或输入 Markdown 源码…"
                  className="flex-1 w-full px-4 py-3 text-sm font-mono text-slate-700 bg-white outline-none resize-none leading-relaxed"
                  style={{ minHeight: 420 }}
                />
              </div>
              <div className="flex flex-col">
                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">预览</div>
                <div className="flex-1 px-5 py-4 overflow-y-auto">
                  {prompt ? (
                    <MarkdownContent content={prompt} />
                  ) : (
                    <p className="text-sm text-slate-300 italic">预览将在此显示…</p>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">{prompt.length} 字符</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              保存配置
            </button>
            <button
              onClick={onBack}
              className="px-5 py-2.5 border border-slate-200 text-slate-500 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
            >
              返回
            </button>
          </div>
        </div>

        {/* Version history — collapsible below */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowVersions(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2"><History size={14} className="text-slate-400" /> 历史版本{versions.length > 0 && <span className="text-xs font-normal text-slate-400">（{versions.length} 个）</span>}</span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${showVersions ? "rotate-180" : ""}`} />
          </button>
          {showVersions && (
            <div className="border-t border-slate-100">
              {versions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">暂无历史版本</p>
              ) : (
                <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                  {versions.map((v, idx) => {
                    const versionNo = versions.length - idx;
                    return (
                      <div
                        key={v.id}
                        className="px-5 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-4 cursor-pointer"
                        onClick={() => setPreviewVersion(v)}
                      >
                        <span className="shrink-0 w-8 text-center text-[11px] font-bold text-white bg-slate-400 rounded-full py-0.5">V{versionNo}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-slate-400">被替换于 {new Date(v.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                          <p className="text-xs text-slate-500 truncate mt-0.5">{v.systemPrompt.slice(0, 80)}{v.systemPrompt.length > 80 ? "…" : ""}</p>
                        </div>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); restoreVersion(v); }}
                          className="shrink-0 text-xs text-primary hover:underline font-semibold"
                        >
                          还原
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Skill configuration */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSkills(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Layers size={14} className="text-slate-400" />
              关联 Skill
              {taskSkills.length > 0 && <span className="text-xs font-normal text-slate-400">（已关联 {taskSkills.length} 个）</span>}
            </span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${showSkills ? "rotate-180" : ""}`} />
          </button>
          {showSkills && (
            <div className="border-t border-slate-100 p-5 space-y-4">
              <p className="text-xs text-slate-400">关联的 Skill 内容会在调用此智能体时自动注入到 system prompt 最前面。</p>
              {skillLinksLoading ? (
                <div className="flex items-center gap-2 text-slate-400 py-4"><Loader2 size={14} className="animate-spin" />加载中…</div>
              ) : (
                <div className="space-y-2">
                  {taskSkills.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">暂未关联任何 Skill</p>
                  ) : (
                    taskSkills.map((s, idx) => (
                      <div key={s.skillId}
                        draggable
                        onDragStart={() => onSkillDragStart(idx)}
                        onDragOver={(e) => onSkillDragOver(e, idx)}
                        onDrop={() => onSkillDrop(idx)}
                        onDragEnd={onSkillDragEnd}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${skillDragOverIdx === idx ? "border-primary/40 bg-primary/5 scale-[0.99]" : "border-slate-100 bg-slate-50"}`}>
                        <GripVertical size={14} className="text-slate-300 shrink-0" />
                        <span className="text-[10px] font-bold text-slate-400 w-5 text-center">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-blue-900 truncate">{s.name}</p>
                          {s.description && <p className="text-xs text-slate-400 truncate">{s.description}</p>}
                        </div>
                        <button onClick={() => removeSkill(s.skillId)}
                          className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
              {availableSkills.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">可添加</p>
                  {availableSkills.map(s => (
                    <div key={s.id} onClick={() => addSkill(s)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-blue-50/40 cursor-pointer transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{s.name}</p>
                        {s.description && <p className="text-xs text-slate-400 truncate">{s.description}</p>}
                      </div>
                      <Plus size={14} className="text-primary shrink-0" />
                    </div>
                  ))}
                </div>
              )}
              {allSkills.length > 0 && availableSkills.length === 0 && taskSkills.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">所有已激活的 Skill 均已关联</p>
              )}
              {allSkills.length === 0 && !skillLinksLoading && (
                <p className="text-xs text-slate-400 text-center py-2">暂无可用 Skill，请先在「Skill 管理」中安装</p>
              )}
              <button onClick={handleSkillSave} disabled={skillSaving}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {skillSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                保存 Skill 关联
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Version preview modal */}
      {previewVersion && (() => {
        const versionNo = versions.length - versions.findIndex(v => v.id === previewVersion.id);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setPreviewVersion(null)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden"
              style={{ maxHeight: "90vh" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white bg-slate-400 rounded-full px-3 py-0.5">V{versionNo}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-700">历史版本 V{versionNo}</p>
                    <p className="text-xs text-slate-400">被替换于 {new Date(previewVersion.createdAt).toLocaleString("zh-CN")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { restoreVersion(previewVersion); setPreviewVersion(null); }}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors"
                  >
                    还原此版本
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewVersion(null)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              {/* Modal body — split pane */}
              <div className="flex-1 grid grid-cols-2 overflow-hidden">
                <div className="flex flex-col border-r border-slate-100 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">源码</div>
                  <textarea
                    readOnly
                    value={previewVersion.systemPrompt}
                    className="flex-1 w-full px-4 py-3 text-sm font-mono text-slate-700 bg-white outline-none resize-none leading-relaxed overflow-y-auto"
                  />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">预览</div>
                  <div className="flex-1 px-6 py-4 overflow-y-auto">
                    <MarkdownContent content={previewVersion.systemPrompt} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function AgentConfigManagement() {
  const qc = useQueryClient();

  const { data: configs, isLoading } = useQuery<AgentConfig[]>({
    queryKey: ["admin-agent-configs"],
    queryFn: () => adminGet("/api/admin/agent-configs"),
  });

  const [editingCfg, setEditingCfg] = useState<AgentConfig | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);

  const moveConfig = async (idx: number, dir: "up" | "down") => {
    if (!configs) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= configs.length) return;
    const a = configs[idx];
    const b = configs[swapIdx];
    setMovingId(a.id);
    try {
      await Promise.all([
        adminPut(`/api/admin/agent-configs/${a.id}`, { sortOrder: b.sortOrder }),
        adminPut(`/api/admin/agent-configs/${b.id}`, { sortOrder: a.sortOrder }),
      ]);
      await qc.invalidateQueries({ queryKey: ["admin-agent-configs"] });
    } catch {
      toast({ title: "排序更新失败", variant: "destructive" });
    } finally {
      setMovingId(null);
    }
  };

  if (editingCfg !== null) {
    return (
      <div className="space-y-8">
        <LlmProviderManagement />
        <div className="border-t border-slate-100 pt-6">
          <AgentConfigEditPage
            cfg={editingCfg}
            onBack={() => setEditingCfg(null)}
            onSaved={(updated) => setEditingCfg(updated)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <LlmProviderManagement />

      <div className="border-t border-slate-100 pt-6">
        <div className="mb-5">
          <h3 className="text-base font-extrabold text-slate-900">智能体场景配置</h3>
          <p className="text-sm text-slate-500 mt-0.5">管理各场景的系统提示词与启用状态，拖动箭头可调整顺序</p>
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

        {configs && configs.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                <tr>
                  <th className="px-3 py-3 w-16 text-center">顺序</th>
                  <th className="px-5 py-3">场景名称</th>
                  <th className="px-5 py-3">Scene Key</th>
                  <th className="px-5 py-3">状态</th>
                  <th className="px-5 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {configs.map((cfg, idx) => (
                  <tr key={cfg.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          disabled={idx === 0 || movingId !== null}
                          onClick={() => moveConfig(idx, "up")}
                          className="p-1 rounded text-slate-300 hover:text-primary hover:bg-primary/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="上移"
                        >
                          {movingId === cfg.id ? <Loader2 size={12} className="animate-spin" /> : <ChevronUp size={12} />}
                        </button>
                        <span className="text-[10px] font-bold text-slate-400">{idx + 1}</span>
                        <button
                          disabled={idx === configs.length - 1 || movingId !== null}
                          onClick={() => moveConfig(idx, "down")}
                          className="p-1 rounded text-slate-300 hover:text-primary hover:bg-primary/5 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="下移"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot size={14} className="text-primary" />
                        </div>
                        <span className="font-bold text-sm text-slate-800">{cfg.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">{cfg.sceneKey}</code>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cfg.isEnabled ? "bg-green-50 text-green-600" : "bg-slate-100 text-slate-400"}`}>
                        {cfg.isEnabled ? "已启用" : "已停用"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setEditingCfg(cfg)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors"
                      >
                        <Edit2 size={12} /> 编辑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
  ccbMerchantNo: string | null;
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
                {/* Company info */}
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">企业信息</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3 text-sm">
                    <div><p className="text-xs text-slate-400 mb-0.5">企业名称</p><p className="font-medium text-slate-700">{r.companyName || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">统一社会信用代码</p><p className="font-mono text-slate-700 text-xs">{r.creditCode || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">联系人</p><p className="font-medium text-slate-700">{r.contactPerson || r.contactName || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">联系方式</p><p className="font-medium text-slate-700">{r.contactPhone || "—"}</p></div>
                    <div className="col-span-2 md:col-span-3"><p className="text-xs text-slate-400 mb-0.5">联系地址</p><p className="font-medium text-slate-700">{r.contactAddress || "—"}</p></div>
                  </div>
                </div>

                {/* Bank account info */}
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">收款账号</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-3 text-sm">
                    <div><p className="text-xs text-slate-400 mb-0.5">银行</p><p className="font-medium text-slate-700">{r.bankName || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">开户行</p><p className="font-medium text-slate-700">{r.bankBranch || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">银行账号</p><p className="font-mono text-slate-700 text-xs tracking-wider">{r.bankAccount || "—"}</p></div>
                    <div><p className="text-xs text-slate-400 mb-0.5">户名</p><p className="font-medium text-slate-700">{r.accountName || "—"}</p></div>
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

/* ─── Module: Skill 管理 ─────────────────────────── */

interface SkillRow {
  id: number; name: string; description: string | null;
  sourceUrl: string; version: string | null;
  lastSyncedAt: string | null; isActive: boolean; createdAt: string;
}
interface SkillDetail extends SkillRow {
  skillMd: string; refFiles: Record<string, string>;
}
interface FetchPreview {
  name: string; description: string; skillMd: string;
  refFiles: Record<string, string>; version: string;
}

function SkillRegistryModule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm, confirmDialog } = useConfirm();
  const [urlInput, setUrlInput] = useState("");
  const [preview, setPreview] = useState<FetchPreview | null>(null);
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [syncing, setSyncing] = useState<number | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);

  const { data: skills = [], isLoading } = useQuery<SkillRow[]>({
    queryKey: ["admin-skills"],
    queryFn: () => adminGet<{ data: SkillRow[] }>("/api/admin/skills").then(r => r.data),
  });

  function handleCancelPreview() {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    setFetchingPreview(false);
  }

  async function handlePreview() {
    if (!urlInput.trim()) return;
    previewAbortRef.current?.abort();
    const ac = new AbortController();
    previewAbortRef.current = ac;
    setFetchingPreview(true);
    setPreview(null);
    try {
      const res = await adminPost("/api/admin/skills/fetch-preview", { url: urlInput.trim() }, { signal: ac.signal });
      setPreview(res.data);
    } catch (e: any) {
      if (e.name === "AbortError" || e.message === "请求已取消") return;
      toast({ title: "获取失败", description: e.message, variant: "destructive" });
    } finally {
      if (previewAbortRef.current === ac) previewAbortRef.current = null;
      setFetchingPreview(false);
    }
  }

  async function handleInstall() {
    if (!preview) return;
    setInstalling(true);
    try {
      await adminPost("/api/admin/skills", { url: urlInput.trim(), name: preview.name });
      qc.invalidateQueries({ queryKey: ["admin-skills"] });
      toast({ title: "Skill 已安装", description: preview.name });
      setPreview(null); setUrlInput("");
    } catch (e: any) {
      toast({ title: "安装失败", description: e.message, variant: "destructive" });
    } finally {
      setInstalling(false);
    }
  }

  async function handleSync(id: number) {
    setSyncing(id);
    try {
      await adminPost(`/api/admin/skills/${id}/sync`, {});
      qc.invalidateQueries({ queryKey: ["admin-skills"] });
      toast({ title: "同步成功" });
    } catch (e: any) {
      toast({ title: "同步失败", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(null);
    }
  }

  async function handleToggle(id: number, isActive: boolean) {
    try {
      await adminPatch(`/api/admin/skills/${id}`, { isActive: !isActive });
      qc.invalidateQueries({ queryKey: ["admin-skills"] });
      toast({ title: isActive ? "Skill 已禁用" : "Skill 已启用" });
    } catch (e: any) {
      toast({ title: "操作失败", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete(skill: SkillRow) {
    const ok = await askConfirm({
      title: "确认删除",
      description: `删除 Skill "${skill.name}"？若已被任务模板引用则无法删除。`,
      confirmLabel: "删除",
    });
    if (!ok) return;
    try {
      await adminDelete(`/api/admin/skills/${skill.id}`);
      qc.invalidateQueries({ queryKey: ["admin-skills"] });
      toast({ title: "已删除" });
    } catch (e: any) {
      toast({ title: "删除失败", description: e.message, variant: "destructive" });
    }
  }

  async function handleViewDetail(id: number) {
    try {
      const res = await adminGet<{ data: SkillDetail }>(`/api/admin/skills/${id}`);
      setDetail(res.data);
    } catch (e: any) {
      toast({ title: "获取详情失败", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      {confirmDialog}
      <SectionHeader title="Skill 管理" sub="安装、管理智能体技能包（Skill），供任务模板按需注入" />

      {/* Install panel */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Plus size={14} /> 安装新 Skill
        </h3>
        <div className="flex gap-3">
          <input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !fetchingPreview) handlePreview(); }}
            placeholder="粘贴 GitHub 仓库地址或 SKILL.md 文件直链…"
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            disabled={fetchingPreview}
          />
          {fetchingPreview ? (
            <button
              onClick={handleCancelPreview}
              className="px-5 py-2.5 bg-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-300 transition-colors flex items-center gap-2"
            >
              <X size={14} /> 取消
            </button>
          ) : (
            <button
              onClick={handlePreview}
              disabled={!urlInput.trim()}
              className="px-5 py-2.5 bg-slate-700 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Eye size={14} /> 预览
            </button>
          )}
        </div>
        {fetchingPreview && (
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Loader2 size={11} className="animate-spin" />
            正在连接 GitHub，网络较慢时最多等待 15 秒…
          </p>
        )}
        <p className="text-xs text-slate-400">支持 GitHub 仓库地址（自动查找 SKILL.md）、文件直链或 skillsovermcp.com 链接</p>

        {preview && (
          <div className="border border-primary/20 rounded-xl p-4 space-y-3 bg-blue-50/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-bold text-blue-900 text-sm">{preview.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{preview.description}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">{preview.version?.slice(0, 16)}</span>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              引用文件：{Object.keys(preview.refFiles).length > 0 ? Object.keys(preview.refFiles).join("、") : "无"}
            </div>
            <div className="bg-white rounded-lg border border-slate-200 p-3 max-h-40 overflow-y-auto">
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">{preview.skillMd.slice(0, 800)}{preview.skillMd.length > 800 ? "\n…（已截断）" : ""}</pre>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleInstall}
                disabled={installing}
                className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {installing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                确认安装
              </button>
              <button onClick={() => setPreview(null)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Installed skills */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">已安装 Skill（{skills.length}）</h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-400"><Loader2 size={20} className="animate-spin mr-2" />加载中…</div>
        ) : skills.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">暂无已安装的 Skill</div>
        ) : (
          <div className="space-y-3">
            {skills.map(skill => (
              <div key={skill.id} className={`rounded-xl border p-4 transition-all ${skill.isActive ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-70"}`}>
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-blue-900 text-sm">{skill.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${skill.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                        {skill.isActive ? "已启用" : "已禁用"}
                      </span>
                    </div>
                    {skill.description && <p className="text-xs text-slate-500 mt-1">{skill.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400 flex-wrap">
                      <span className="font-mono truncate max-w-xs">{skill.sourceUrl}</span>
                      {skill.lastSyncedAt && <span>同步于 {new Date(skill.lastSyncedAt).toLocaleString("zh-CN", { timeZone: "UTC" })}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleViewDetail(skill.id)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="查看详情">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => handleSync(skill.id)} disabled={syncing === skill.id}
                      className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors" title="同步更新">
                      {syncing === skill.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    </button>
                    <button onClick={() => handleToggle(skill.id, skill.isActive)}
                      className={`p-1.5 rounded-lg transition-colors ${skill.isActive ? "hover:bg-orange-50 text-slate-400 hover:text-orange-600" : "hover:bg-green-50 text-slate-400 hover:text-green-600"}`}
                      title={skill.isActive ? "禁用" : "启用"}>
                      {skill.isActive ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button onClick={() => handleDelete(skill)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="删除">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden" style={{ maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <p className="font-bold text-blue-900">{detail.name}</p>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{detail.sourceUrl}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">SKILL.md</h4>
                <pre className="bg-slate-50 rounded-xl p-4 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed overflow-x-auto">{detail.skillMd}</pre>
              </div>
              {Object.keys(detail.refFiles).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">References（{Object.keys(detail.refFiles).length} 个文件）</h4>
                  <div className="space-y-3">
                    {Object.entries(detail.refFiles).map(([filename, content]) => (
                      <div key={filename}>
                        <p className="text-[11px] font-mono font-bold text-slate-500 mb-1">{filename}</p>
                        <pre className="bg-slate-50 rounded-xl p-3 text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-48">{content}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Module: 任务模板配置 ───────────────────────── */

interface TaskType { taskType: string; label: string; }
interface TaskSkillLink {
  id: number; skillId: number; sortOrder: number;
  name: string; description: string | null; isActive: boolean;
  skillMd: string; refFiles: Record<string, string>;
}

function AgentTaskConfigModule() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedTaskType, setSelectedTaskType] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [taskSkills, setTaskSkills] = useState<TaskSkillLink[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const dragIdxRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const { data: taskTypes = [] } = useQuery<TaskType[]>({
    queryKey: ["admin-agent-task-types"],
    queryFn: () => adminGet<{ data: TaskType[] }>("/api/admin/agent-task-types").then(r => r.data),
  });

  const { data: allSkills = [] } = useQuery<SkillRow[]>({
    queryKey: ["admin-skills"],
    queryFn: () => adminGet<{ data: SkillRow[] }>("/api/admin/skills").then(r => r.data),
  });

  const { data: currentLinks, isLoading: linksLoading } = useQuery<TaskSkillLink[]>({
    queryKey: ["admin-task-skills", selectedTaskType],
    queryFn: () => adminGet<{ data: TaskSkillLink[] }>(`/api/admin/agent-task-types/${selectedTaskType}/skills`).then(r => r.data),
    enabled: !!selectedTaskType,
  });

  useEffect(() => {
    if (currentLinks) setTaskSkills(currentLinks);
  }, [currentLinks]);

  const activeSkills = allSkills.filter(s => s.isActive);
  const linkedIds = new Set(taskSkills.map(s => s.skillId));
  const availableToAdd = activeSkills.filter(s => !linkedIds.has(s.id));

  async function addSkill(skill: SkillRow) {
    try {
      const detail = await adminGet<{ data: TaskSkillLink }>(`/api/admin/skills/${skill.id}`);
      setTaskSkills(prev => [...prev, {
        id: 0, skillId: skill.id, sortOrder: prev.length,
        name: detail.data.name, description: detail.data.description,
        isActive: detail.data.isActive,
        skillMd: detail.data.skillMd ?? "",
        refFiles: detail.data.refFiles ?? {},
      }]);
    } catch {
      setTaskSkills(prev => [...prev, {
        id: 0, skillId: skill.id, sortOrder: prev.length,
        name: skill.name, description: skill.description, isActive: skill.isActive,
        skillMd: "", refFiles: {},
      }]);
    }
  }

  function removeSkill(skillId: number) {
    setTaskSkills(prev => prev.filter(s => s.skillId !== skillId).map((s, i) => ({ ...s, sortOrder: i })));
  }

  function onDragStart(idx: number) {
    dragIdxRef.current = idx;
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function onDrop(dropIdx: number) {
    const fromIdx = dragIdxRef.current;
    if (fromIdx === null || fromIdx === dropIdx) { setDragOverIdx(null); return; }
    setTaskSkills(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(dropIdx, 0, moved);
      return arr.map((s, i) => ({ ...s, sortOrder: i }));
    });
    dragIdxRef.current = null;
    setDragOverIdx(null);
  }

  function onDragEnd() {
    dragIdxRef.current = null;
    setDragOverIdx(null);
  }

  async function handleSave() {
    if (!selectedTaskType) return;
    setSaving(true);
    try {
      await adminPut(`/api/admin/agent-task-types/${selectedTaskType}/skills`, {
        skills: taskSkills.map(s => ({ skillId: s.skillId, sortOrder: s.sortOrder })),
      });
      qc.invalidateQueries({ queryKey: ["admin-task-skills", selectedTaskType] });
      toast({ title: "任务模板已保存" });
    } catch (e: any) {
      toast({ title: "保存失败", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const previewText = taskSkills.length === 0
    ? "（未关联任何 Skill）"
    : "# Injected Skills\n\n" + taskSkills.map(s => {
        const refs = Object.entries(s.refFiles ?? {});
        const refSection = refs.length > 0
          ? "\n\n" + refs.map(([fn, content]) => `### Reference: ${fn}\n\n${content}`).join("\n\n")
          : "";
        return `## Skill: ${s.name}\n\n${s.skillMd || "（内容加载中…）"}${refSection}`;
      }).join("\n\n---\n\n");

  const totalChars = previewText === "（未关联任何 Skill）" ? 0 : previewText.length;

  return (
    <div className="space-y-6">
      <SectionHeader title="智能体任务模板配置" sub="为每种任务类型配置关联的 Skill，执行时按顺序注入 system prompt" />

      {/* Task type picker */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <label className="text-sm font-bold text-slate-700 block mb-3">选择任务类型</label>
        <div className="flex flex-wrap gap-2">
          {taskTypes.map(tt => (
            <button key={tt.taskType} onClick={() => setSelectedTaskType(tt.taskType)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedTaskType === tt.taskType ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {tt.label}
              <span className="ml-1.5 text-[10px] font-mono opacity-70">({tt.taskType})</span>
            </button>
          ))}
        </div>
      </div>

      {selectedTaskType && (
        <div className="grid grid-cols-2 gap-6">
          {/* Left: configuration */}
          <div className="space-y-4">
            {/* Current linked skills */}
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">已关联 Skill（拖拽排序）</h3>
              {linksLoading ? (
                <div className="flex items-center justify-center py-6 text-slate-400"><Loader2 size={16} className="animate-spin mr-2" />加载中…</div>
              ) : taskSkills.length === 0 ? (
                <p className="text-center py-6 text-sm text-slate-400">暂未关联任何 Skill</p>
              ) : (
                <div className="space-y-2">
                  {taskSkills.map((s, idx) => (
                    <div key={s.skillId}
                      draggable
                      onDragStart={() => onDragStart(idx)}
                      onDragOver={(e) => onDragOver(e, idx)}
                      onDrop={() => onDrop(idx)}
                      onDragEnd={onDragEnd}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${dragOverIdx === idx ? "border-primary/40 bg-primary/5 scale-[0.99]" : "border-slate-100 bg-slate-50"}`}>
                      <GripVertical size={14} className="text-slate-300 shrink-0" />
                      <span className="text-[10px] font-bold text-slate-400 w-5 text-center">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-blue-900 truncate">{s.name}</p>
                        {s.description && <p className="text-xs text-slate-400 truncate">{s.description}</p>}
                      </div>
                      <button onClick={() => removeSkill(s.skillId)}
                        className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={handleSave} disabled={saving}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                保存配置
              </button>
            </div>

            {/* Available skills to add */}
            {availableToAdd.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">可添加的 Skill</h3>
                <div className="space-y-2">
                  {availableToAdd.map(s => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-blue-50/30 cursor-pointer transition-colors" onClick={() => addSkill(s)}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{s.name}</p>
                        {s.description && <p className="text-xs text-slate-400 truncate">{s.description}</p>}
                      </div>
                      <Plus size={14} className="text-primary shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: actual assembled prompt preview */}
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3 flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">System Prompt 预览</h3>
              <div className="flex items-center gap-3">
                {totalChars > 0 && (
                  <span className="text-[10px] font-mono text-slate-400">已配置 {taskSkills.length} 个 Skill，总计 {totalChars.toLocaleString()} 字符</span>
                )}
                <button onClick={() => setShowPreview(!showPreview)}
                  className="text-xs text-primary hover:underline font-semibold">
                  {showPreview ? "收起" : "展开"}
                </button>
              </div>
            </div>
            <div className={`flex-1 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden transition-all ${showPreview ? "" : "max-h-64"}`}>
              <pre className="p-4 text-xs font-mono text-slate-600 whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[60vh]">{previewText}</pre>
            </div>
            <p className="text-xs text-slate-400">预览内容即实际注入 system prompt 的完整文本，含所有 Skill 正文及引用文件</p>
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
  docTemplate: string | null;
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

  const [tmplCat, setTmplCat] = useState<CatCategory | null>(null);
  const [tmplText, setTmplText] = useState("");
  const [tmplSaving, setTmplSaving] = useState(false);
  const [showTmplVersions, setShowTmplVersions] = useState(false);
  const [previewTmplVersion, setPreviewTmplVersion] = useState<{ id: number; docTemplate: string; createdAt: string } | null>(null);

  const { data: tmplVersions = [], refetch: refetchTmplVersions } = useQuery<Array<{ id: number; catCategoryId: number; docTemplate: string; createdAt: string }>>({
    queryKey: ["cat-template-versions", tmplCat?.id],
    queryFn: () => adminGet(`/api/admin/cat-categories/${tmplCat!.id}/template-versions`),
    enabled: !!tmplCat,
  });

  const openTmpl = (cat: CatCategory) => {
    setTmplCat(cat);
    setTmplText(cat.docTemplate ?? "");
    setShowTmplVersions(false);
    setPreviewTmplVersion(null);
  };
  const closeTmpl = () => { setTmplCat(null); setTmplText(""); setShowTmplVersions(false); setPreviewTmplVersion(null); };
  const saveTmpl = async () => {
    if (!tmplCat || tmplSaving) return;
    setTmplSaving(true);
    try {
      await adminPut(`/api/admin/cat-categories/${tmplCat.id}`, { docTemplate: tmplText });
      await qc.invalidateQueries({ queryKey: ["admin-cat-categories"] });
      await refetchTmplVersions();
      toast({ title: "模板已保存" });
    } catch (err: any) { toast({ title: "保存失败", description: err.message, variant: "destructive" }); }
    finally { setTmplSaving(false); }
  };
  const restoreTmplVersion = (v: { docTemplate: string; createdAt: string }) => {
    setTmplText(v.docTemplate);
    toast({ title: "已还原", description: `已载入 ${new Date(v.createdAt).toLocaleString("zh-CN")} 的版本` });
  };

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
      {tmplCat && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={closeTmpl} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
              <div>
                <p className="text-sm font-bold text-slate-800">编辑需求文档模板</p>
                <p className="text-xs text-slate-400">分类：{tmplCat.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={saveTmpl} disabled={tmplSaving}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-60 transition-colors">
                {tmplSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {tmplSaving ? "保存中…" : "保存模板"}
              </button>
            </div>
          </div>

          {/* Split-pane editor */}
          <div className="flex-1 overflow-hidden p-4 flex flex-col gap-4 min-h-0">
            <div className="flex-1 grid grid-cols-2 gap-0 border border-slate-200 rounded-xl overflow-hidden bg-white min-h-0">
              <div className="flex flex-col border-r border-slate-200 min-h-0">
                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">源码</div>
                <textarea
                  value={tmplText}
                  onChange={e => setTmplText(e.target.value)}
                  placeholder="在这里编写需求文档模板（Markdown 格式）…"
                  className="flex-1 w-full px-4 py-3 text-sm font-mono text-slate-700 bg-white outline-none resize-none leading-relaxed overflow-y-auto"
                />
              </div>
              <div className="flex flex-col min-h-0">
                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">预览</div>
                <div className="flex-1 px-5 py-4 overflow-y-auto">
                  {tmplText ? <MarkdownContent content={tmplText} /> : <p className="text-sm text-slate-300 italic">预览将在此显示…</p>}
                </div>
              </div>
            </div>

            {/* Version history */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => setShowTmplVersions(v => !v)}
                className="w-full flex items-center justify-between px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <History size={14} className="text-slate-400" />
                  历史版本{tmplVersions.length > 0 && <span className="text-xs font-normal text-slate-400">（{tmplVersions.length} 个）</span>}
                </span>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${showTmplVersions ? "rotate-180" : ""}`} />
              </button>
              {showTmplVersions && (
                <div className="border-t border-slate-100">
                  {tmplVersions.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-5">暂无历史版本</p>
                  ) : (
                    <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                      {tmplVersions.map((v, idx) => {
                        const vNo = tmplVersions.length - idx;
                        return (
                          <div key={v.id} className="px-5 py-2.5 hover:bg-slate-50 transition-colors flex items-center gap-4 cursor-pointer" onClick={() => setPreviewTmplVersion(v)}>
                            <span className="shrink-0 w-8 text-center text-[11px] font-bold text-white bg-slate-400 rounded-full py-0.5">V{vNo}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-slate-400">被替换于 {new Date(v.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                              <p className="text-xs text-slate-500 truncate mt-0.5">{v.docTemplate.slice(0, 80)}{v.docTemplate.length > 80 ? "…" : ""}</p>
                            </div>
                            <button type="button" onClick={e => { e.stopPropagation(); restoreTmplVersion(v); }} className="shrink-0 text-xs text-primary hover:underline font-semibold">还原</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 px-6 py-2.5 border-t border-slate-100 bg-white flex items-center justify-between">
            <p className="text-xs text-slate-400">{tmplText.length} 字符</p>
            <p className="text-xs text-slate-400">发单方在提交需求时将看到此模板作为参考</p>
          </div>
        </div>
      )}

      {/* Version preview modal */}
      {previewTmplVersion && (() => {
        const vNo = tmplVersions.length - tmplVersions.findIndex(v => v.id === previewTmplVersion.id);
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setPreviewTmplVersion(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col overflow-hidden" style={{ maxHeight: "90vh" }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-white bg-slate-400 rounded-full px-3 py-0.5">V{vNo}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-700">历史版本 V{vNo}</p>
                    <p className="text-xs text-slate-400">被替换于 {new Date(previewTmplVersion.createdAt).toLocaleString("zh-CN")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => { restoreTmplVersion(previewTmplVersion); setPreviewTmplVersion(null); }}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors">
                    还原此版本
                  </button>
                  <button type="button" onClick={() => setPreviewTmplVersion(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={18} /></button>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 overflow-hidden">
                <div className="flex flex-col border-r border-slate-100 overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">源码</div>
                  <textarea readOnly value={previewTmplVersion.docTemplate} className="flex-1 w-full px-4 py-3 text-sm font-mono text-slate-700 bg-white outline-none resize-none leading-relaxed overflow-y-auto" />
                </div>
                <div className="flex flex-col overflow-hidden">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest">预览</div>
                  <div className="flex-1 px-6 py-4 overflow-y-auto"><MarkdownContent content={previewTmplVersion.docTemplate} /></div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
            <div className="col-span-2 flex items-center gap-6">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-slate-500">启用状态</label>
                <button type="button" onClick={() => setForm(p => ({...p, isActive: !p.isActive}))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? "bg-primary" : "bg-slate-300"}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <span className="text-xs text-slate-500">{form.isActive ? "启用" : "禁用"}</span>
              </div>
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
                <th className="px-6 py-4">Demo 生成</th>
                <th className="px-6 py-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {categories.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">暂无分类</td></tr>
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
                      <button onClick={() => openTmpl(cat)} className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="编辑需求文档模板">
                        <FileText size={14} />
                      </button>
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

/* ─── Module: 用户数据（运营管理）────────────────────── */

interface LoginLogRow {
  id: number; userId: number; role: string; ip: string | null; city: string | null;
  createdAt: string; nickname: string | null; email: string | null;
}

const ROLE_LABEL_MAP: Record<string, string> = { publisher: "发单方", opc: "OPC", admin: "管理员" };
const ROLE_COLORS: Record<string, string> = {
  publisher: "bg-blue-100 text-blue-700",
  opc:       "bg-green-100 text-green-700",
  admin:     "bg-violet-100 text-violet-700",
};

function UserData() {
  const today = new Date().toISOString().substring(0, 10);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(today);
  const [roleFilter, setRoleFilter] = useState("all");
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const qs = new URLSearchParams();
  if (startDate) qs.set("startDate", startDate);
  if (endDate)   qs.set("endDate",   endDate);
  if (roleFilter !== "all") qs.set("role", roleFilter);
  if (city)      qs.set("city", city);
  qs.set("page",     String(page));
  qs.set("pageSize", String(pageSize));

  const { data: resp, isLoading } = useQuery<PagedResp<LoginLogRow>>({
    queryKey: ["admin-login-logs", startDate, endDate, roleFilter, city, page, pageSize],
    queryFn: () => adminGet(`/api/admin/login-logs?${qs.toString()}`),
    staleTime: 30_000,
  });

  const logs = resp?.data ?? [];
  const total = resp?.total ?? 0;

  const applyFilters = () => { setCity(cityInput); setPage(1); };

  return (
    <div className="space-y-6">
      <SectionHeader title="用户数据" sub="用户登录记录查询" />

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">开始日期</label>
          <input type="date" value={startDate} max={endDate || today}
            onChange={e => { setStartDate(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">结束日期</label>
          <input type="date" value={endDate} min={startDate} max={today}
            onChange={e => { setEndDate(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">用户身份</label>
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white">
            <option value="all">全部</option>
            <option value="publisher">发单方</option>
            <option value="opc">OPC</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">城市</label>
          <div className="flex gap-1.5">
            <input type="text" value={cityInput} placeholder="输入城市名"
              onChange={e => setCityInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && applyFilters()}
              className="border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white w-28" />
            <button onClick={applyFilters}
              className="px-3 py-1.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
              搜索
            </button>
            {(city || startDate || roleFilter !== "all") && (
              <button onClick={() => { setStartDate(""); setEndDate(today); setRoleFilter("all"); setCityInput(""); setCity(""); setPage(1); }}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">
                重置
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <TableShell headers={["时间", "用户", "身份", "IP 地址", "城市"]}>
        {isLoading ? (
          <LoadingRow cols={5} />
        ) : logs.length === 0 ? (
          <EmptyRow cols={5} text="暂无登录记录" />
        ) : logs.map(log => (
          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
            <td className="px-6 py-3.5 text-sm text-slate-600 whitespace-nowrap">
              {new Date(log.createdAt).toLocaleString("zh-CN", { hour12: false })}
            </td>
            <td className="px-6 py-3.5">
              <div className="text-sm font-bold text-slate-800">{log.nickname ?? "—"}</div>
              <div className="text-xs text-slate-400">{log.email ?? `ID: ${log.userId}`}</div>
            </td>
            <td className="px-6 py-3.5">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${ROLE_COLORS[log.role] ?? "bg-slate-100 text-slate-600"}`}>
                {ROLE_LABEL_MAP[log.role] ?? log.role}
              </span>
            </td>
            <td className="px-6 py-3.5 text-sm text-slate-500 font-mono">{log.ip ?? "—"}</td>
            <td className="px-6 py-3.5 text-sm text-slate-600">{log.city ?? "未知"}</td>
          </tr>
        ))}
      </TableShell>

      {total > 0 && (
        <AdminPagination page={page} pageSize={pageSize} total={total}
          onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
      )}
    </div>
  );
}

function ModuleContent({ module, inlineRoute, setInlineRoute }: { module: Module; inlineRoute: string | null; setInlineRoute: (r: string | null) => void }) {
  const inlineNav = useMemo(() => ({
    push: (path: string) => setInlineRoute(path),
    back: () => setInlineRoute(null),
  }), []);

  if (inlineRoute) {
    const clientMatch = inlineRoute.match(/\/admin\/v2\/client-demands\/(\d+)/);
    if (clientMatch) {
      const inlineId = parseInt(clientMatch[1], 10);
      const inlineSearch = new URLSearchParams(inlineRoute.includes("?") ? inlineRoute.split("?")[1] : "");
      const inlineTab = inlineSearch.get("tab") ?? undefined;
      const inlineItemId = inlineSearch.get("id") ? parseInt(inlineSearch.get("id")!, 10) : undefined;
      return (
        <AdminInlineNavContext.Provider value={inlineNav}>
          <AdminEmbeddedContext.Provider value={true}>
            <AdminV2ClientDemandDetail key={`${inlineId}-${inlineTab ?? ""}-${inlineItemId ?? ""}`} inlineId={inlineId} initialTab={inlineTab} initialItemId={inlineItemId} />
          </AdminEmbeddedContext.Provider>
        </AdminInlineNavContext.Provider>
      );
    }
    if (inlineRoute === "/admin/v2/outsource-demands/new") {
      return (
        <AdminInlineNavContext.Provider value={inlineNav}>
          <AdminEmbeddedContext.Provider value={true}>
            <AdminV2OutsourceDemandNew />
          </AdminEmbeddedContext.Provider>
        </AdminInlineNavContext.Provider>
      );
    }
    const outsourceMatch = inlineRoute.match(/\/admin\/v2\/outsource-demands\/(\d+)/);
    if (outsourceMatch) {
      const inlineId = parseInt(outsourceMatch[1], 10);
      const qIdx = inlineRoute.indexOf("?");
      const qp = qIdx >= 0 ? new URLSearchParams(inlineRoute.slice(qIdx + 1)) : new URLSearchParams();
      const initialTab = qp.get("tab") === "tenders" ? "tenders" as const : "detail" as const;
      const tIdStr = qp.get("tenderId");
      const initialTenderId = tIdStr ? parseInt(tIdStr, 10) : undefined;
      return (
        <AdminInlineNavContext.Provider value={inlineNav}>
          <AdminEmbeddedContext.Provider value={true}>
            <AdminV2OutsourceDemandDetail inlineId={inlineId} initialTab={initialTab} initialTenderId={initialTenderId} />
          </AdminEmbeddedContext.Provider>
        </AdminInlineNavContext.Provider>
      );
    }
    const contractAMatch = inlineRoute.match(/\/admin\/v2\/contracts-a\/(\d+)/);
    if (contractAMatch) {
      const inlineId = parseInt(contractAMatch[1], 10);
      return (
        <AdminInlineNavContext.Provider value={inlineNav}>
          <AdminEmbeddedContext.Provider value={true}>
            <AdminV2ContractADetail inlineId={inlineId} />
          </AdminEmbeddedContext.Provider>
        </AdminInlineNavContext.Provider>
      );
    }
    const paymentAMatch = inlineRoute.match(/\/admin\/v2\/payments-a\/(\d+)/);
    if (paymentAMatch) {
      const inlineId = parseInt(paymentAMatch[1], 10);
      return (
        <AdminInlineNavContext.Provider value={inlineNav}>
          <AdminEmbeddedContext.Provider value={true}>
            <AdminV2PaymentADetail inlineId={inlineId} />
          </AdminEmbeddedContext.Provider>
        </AdminInlineNavContext.Provider>
      );
    }
    const ticketAMatch = inlineRoute.match(/\/admin\/v2\/tickets-a\/(\d+)/);
    if (ticketAMatch) {
      const inlineId = parseInt(ticketAMatch[1], 10);
      return (
        <AdminInlineNavContext.Provider value={inlineNav}>
          <AdminEmbeddedContext.Provider value={true}>
            <AdminV2TicketADetail inlineId={inlineId} />
          </AdminEmbeddedContext.Provider>
        </AdminInlineNavContext.Provider>
      );
    }
    const tenderMatch = inlineRoute.match(/\/admin\/v2\/tenders\/(\d+)/);
    if (tenderMatch) {
      const inlineId = parseInt(tenderMatch[1], 10);
      return (
        <AdminInlineNavContext.Provider value={inlineNav}>
          <AdminEmbeddedContext.Provider value={true}>
            <AdminV2TenderDetail inlineId={inlineId} />
          </AdminEmbeddedContext.Provider>
        </AdminInlineNavContext.Provider>
      );
    }
    const outsourceOrderMatch = inlineRoute.match(/\/admin\/v2\/outsource-orders\/(\d+)/);
    if (outsourceOrderMatch) {
      const inlineId = parseInt(outsourceOrderMatch[1], 10);
      const oqp = new URLSearchParams(inlineRoute.includes("?") ? inlineRoute.split("?")[1] : "");
      const oTab = oqp.get("tab") as "demand" | "contract" | "delivery" | "ticket" | null;
      const oDelivId = oqp.get("delivId") ? parseInt(oqp.get("delivId")!, 10) : undefined;
      const oTicketId = oqp.get("ticketId") ? parseInt(oqp.get("ticketId")!, 10) : undefined;
      return (
        <AdminInlineNavContext.Provider value={inlineNav}>
          <AdminEmbeddedContext.Provider value={true}>
            <AdminV2OutsourceOrderDetail inlineId={inlineId} initialTab={oTab ?? undefined} initialDelivId={oDelivId} initialTicketId={oTicketId} />
          </AdminEmbeddedContext.Provider>
        </AdminInlineNavContext.Provider>
      );
    }
    const paymentBMatch = inlineRoute.match(/\/admin\/v2\/payments-b\/(\d+)/);
    if (paymentBMatch) {
      const inlineId = parseInt(paymentBMatch[1], 10);
      return (
        <AdminInlineNavContext.Provider value={inlineNav}>
          <AdminEmbeddedContext.Provider value={true}>
            <AdminV2PaymentBDetail inlineId={inlineId} />
          </AdminEmbeddedContext.Provider>
        </AdminInlineNavContext.Provider>
      );
    }
    const ticketBMatch = inlineRoute.match(/\/admin\/v2\/tickets-b\/(\d+)/);
    if (ticketBMatch) {
      const inlineId = parseInt(ticketBMatch[1], 10);
      return (
        <AdminInlineNavContext.Provider value={inlineNav}>
          <AdminEmbeddedContext.Provider value={true}>
            <AdminV2TicketBDetail inlineId={inlineId} />
          </AdminEmbeddedContext.Provider>
        </AdminInlineNavContext.Provider>
      );
    }
    const deliveryAMatch = inlineRoute.match(/\/admin\/v2\/deliveries-a\/(\d+)/);
    if (deliveryAMatch) {
      const inlineId = parseInt(deliveryAMatch[1], 10);
      return (
        <AdminInlineNavContext.Provider value={inlineNav}>
          <AdminEmbeddedContext.Provider value={true}>
            <AdminV2DeliveryADetail inlineId={inlineId} />
          </AdminEmbeddedContext.Provider>
        </AdminInlineNavContext.Provider>
      );
    }
    const deliveryBMatch = inlineRoute.match(/\/admin\/v2\/deliveries-b\/(\d+)/);
    if (deliveryBMatch) {
      const inlineId = parseInt(deliveryBMatch[1], 10);
      return (
        <AdminInlineNavContext.Provider value={inlineNav}>
          <AdminEmbeddedContext.Provider value={true}>
            <AdminV2DeliveryBDetail inlineId={inlineId} />
          </AdminEmbeddedContext.Provider>
        </AdminInlineNavContext.Provider>
      );
    }
    const contestRegMatch = inlineRoute.match(/\/admin\/contests\/registrations\/(\d+)/);
    if (contestRegMatch) {
      const inlineId = parseInt(contestRegMatch[1], 10);
      return (
        <AdminInlineNavContext.Provider value={inlineNav}>
          <AdminEmbeddedContext.Provider value={true}>
            <ContestRegistrationAdminDetail inlineId={inlineId} />
          </AdminEmbeddedContext.Provider>
        </AdminInlineNavContext.Provider>
      );
    }
  }

  const withEmbedded = (node: React.ReactNode) => (
    <AdminInlineNavContext.Provider value={inlineNav}>
      <AdminEmbeddedContext.Provider value={true}>{node}</AdminEmbeddedContext.Provider>
    </AdminInlineNavContext.Provider>
  );

  switch (module) {
    case "dashboard":      return <Dashboard />;
    case "cockpit":        return <PlatformCockpit />;
    case "users":          return <UserManagement />;
    case "finance":        return <FinanceManagement />;
    case "ecosystem":      return <EcosystemManagement />;
    case "training":       return <><TrainingManagement /><ResourceManagement /></>;
    case "levelcert":      return <LevelCertReview />;
    case "creditlevels":   return <CreditLevelConfig />;
    case "creditrules":    return <CreditRulesConfig />;
    case "content":        return <ContentReview />;
    case "sensitivewords": return <SensitiveWordsManagement />;
    case "activities":     return <AdminActivities />;
    case "quotecard":      return <QuoteCardConfigManagement />;
    case "agent":          return <AgentConfigManagement />;
    case "skill_registry": return <SkillRegistryModule />;
    case "settlement":     return <SettlementManagement />;
    case "platform_info":  return <PlatformInfoManagement />;
    case "contract_config":return <PlatformContractConfigManagement />;
    case "settings":       return <SiteSettingsManagement />;
    case "roles":          return <AdminRolesPanel />;
    case "adminusers":     return <AdminUsersPanel />;
    case "syslogs":        return <SystemLogsPanel />;
    case "screen":         return null;
    case "screenvideos":   return <ScreenVideosModule />;
    case "platform_config": return <CatCategoryManagement />;
    case "catcategories":   return <CatCategoryManagement />;
    case "cattags":         return <CatTagManagement />;
    case "userData":        return <UserData />;
    case "v2_overview":      return withEmbedded(<AdminV2Overview />);
    case "v2_pub_demands":   return withEmbedded(<AdminV2ClientDemandList />);
    case "v2_pub_contracts": return withEmbedded(<AdminV2ContractAList />);
    case "v2_pub_payments":    return withEmbedded(<AdminV2PaymentAList />);
    case "v2_pub_deliveries":  return withEmbedded(<AdminV2DeliveryAList />);
    case "v2_pub_tickets":     return withEmbedded(<AdminV2TicketAList />);
    case "v2_opc_demands":     return withEmbedded(<AdminV2OutsourceDemandList />);
    case "v2_opc_tenders":   return withEmbedded(<AdminV2TenderList />);
    case "v2_opc_orders":    return withEmbedded(<AdminV2OutsourceOrderList />);
    case "v2_opc_contracts": return withEmbedded(<AdminV2ContractBList />);
    case "v2_opc_payments":    return withEmbedded(<AdminV2PaymentBList />);
    case "v2_opc_deliveries":  return withEmbedded(<AdminV2DeliveryBList />);
    case "v2_opc_tickets":     return withEmbedded(<AdminV2TicketBList />);
    case "v2_pub_workbench": return withEmbedded(<AdminV2Overview />);
    case "v2_opc_workbench": return withEmbedded(<AdminV2Overview />);
    case "contest_questions":      return <ContestQuestions />;
    case "contest_activities":     return <ContestActivities />;
    case "contest_registrations":  return withEmbedded(<ContestRegistrations />);
    case "contract_templates":     return <AdminContractTemplates />;
    case "contract_placeholders":  return <AdminContractPlaceholders />;
    case "community_workbench":
    case "community_overview":     return <CommunityOverview />;
    case "announcement_category":  return <AnnouncementCategoryManagement />;
    case "announcement_mgmt":      return <AnnouncementManagement />;
    case "consult_mgmt":           return <ConsultManagement />;
    default:                       return null;
  }
}

/* ─── Community ─────────────────────────────── */

type CommunityRow = {
  id: number; name: string; address: string | null; description: string | null;
  logoUrl: string | null; qrCodeUrl: string | null; sortOrder: number;
  admins: { id: number; nickname: string | null; email: string | null }[];
};
type AdminUserOption = { id: number; nickname: string | null; email: string | null };

const EMPTY_COMMUNITY_FORM = { name: "", address: "", description: "", logoUrl: "", qrCodeUrl: "", adminUserIds: [] as number[] };

function CommunityOverview() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm, confirmDialog } = useConfirm();
  const { data: adminProfile } = useAdminProfile();
  const isSuperAdmin = !!adminProfile?.isSuperAdmin;

  const [editing, setEditing] = useState<CommunityRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_COMMUNITY_FORM);
  const [uploading, setUploading] = useState<"logo" | "qr" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "communities"],
    queryFn: () => adminGet<{ data: CommunityRow[] }>("/api/admin/communities"),
  });
  const communities = data?.data ?? [];

  const { data: adminUsers } = useQuery({
    queryKey: ["admin", "community-eligible-admins"],
    queryFn: () => adminGet<{ data: AdminUserOption[] }>("/api/admin/communities/eligible-admins"),
    enabled: isSuperAdmin,
  });
  const adminOptions = adminUsers?.data ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "communities"] });

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name, address: form.address, description: form.description,
        logoUrl: form.logoUrl, qrCodeUrl: form.qrCodeUrl, adminUserIds: form.adminUserIds,
      };
      if (editing) return adminPatch(`/api/admin/communities/${editing.id}`, body);
      return adminPost("/api/admin/communities", body);
    },
    onSuccess: () => { invalidate(); closeModal(); toast({ title: editing ? "社区已更新" : "社区已创建" }); },
    onError: (e: Error) => toast({ title: "保存失败", description: e.message, variant: "destructive" }),
  });

  const reorderMut = useMutation({
    mutationFn: (ids: number[]) => adminPost("/api/admin/communities/reorder", { ids }),
    onSuccess: invalidate,
    onError: (e: Error) => toast({ title: "调整顺序失败", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminDelete(`/api/admin/communities/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "社区已删除" }); },
    onError: (e: Error) => toast({ title: "删除失败", description: e.message, variant: "destructive" }),
  });

  const move = (idx: number, dir: -1 | 1) => {
    const ids = communities.map(c => c.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    reorderMut.mutate(ids);
  };

  const openCreate = () => { setCreating(true); setEditing(null); setForm(EMPTY_COMMUNITY_FORM); };
  const openEdit = (c: CommunityRow) => {
    setEditing(c); setCreating(false);
    setForm({
      name: c.name, address: c.address ?? "", description: c.description ?? "",
      logoUrl: c.logoUrl ?? "", qrCodeUrl: c.qrCodeUrl ?? "",
      adminUserIds: c.admins.map(a => a.id),
    });
  };
  const closeModal = () => { setCreating(false); setEditing(null); };

  const handleImageUpload = async (kind: "logo" | "qr", file: File) => {
    setUploading(kind);
    try {
      const reqRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: getAdminHeaders(),
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
      setForm(f => kind === "logo" ? { ...f, logoUrl: url } : { ...f, qrCodeUrl: url });
      toast({ title: "图片上传成功" });
    } catch (e: unknown) {
      toast({ title: "上传失败", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const toggleAdmin = (id: number) => setForm(f => ({
    ...f,
    adminUserIds: f.adminUserIds.includes(id) ? f.adminUserIds.filter(x => x !== id) : [...f.adminUserIds, id],
  }));

  const modalOpen = creating || !!editing;

  const imgField = (label: string, kind: "logo" | "qr", value: string) => (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          <img src={value} alt={label} className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
            <ImageIcon size={22} />
          </div>
        )}
        <label className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 cursor-pointer hover:bg-slate-50 inline-flex items-center gap-1.5">
          {uploading === kind ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {value ? "更换图片" : "上传图片"}
          <input type="file" accept="image/*" className="hidden" disabled={uploading !== null}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(kind, f); e.target.value = ""; }} />
        </label>
        {value && (
          <button className="text-sm text-slate-400 hover:text-red-500"
            onClick={() => setForm(f => kind === "logo" ? { ...f, logoUrl: "" } : { ...f, qrCodeUrl: "" })}>
            移除
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      {confirmDialog}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-blue-900">社区</h2>
        {isSuperAdmin && (
          <button onClick={openCreate}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-1.5">
            <Plus size={16} /> 添加社区
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400"><Loader2 className="animate-spin mx-auto" /></div>
        ) : communities.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Globe2 size={36} className="mx-auto mb-3 text-slate-200" />
            <p className="font-semibold">暂无社区</p>
            {isSuperAdmin && <p className="text-sm mt-1">点击右上角「添加社区」创建第一个社区</p>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100 bg-slate-50/60">
                <th className="px-4 py-3 font-medium w-20">顺序</th>
                <th className="px-4 py-3 font-medium">社区</th>
                <th className="px-4 py-3 font-medium">地址</th>
                <th className="px-4 py-3 font-medium">社区管理员</th>
                <th className="px-4 py-3 font-medium w-40">二维码</th>
                {isSuperAdmin && <th className="px-4 py-3 font-medium w-32 text-right">操作</th>}
              </tr>
            </thead>
            <tbody>
              {communities.map((c, idx) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/40">
                  <td className="px-4 py-3">
                    {isSuperAdmin ? (
                      <div className="flex items-center gap-1">
                        <button disabled={idx === 0 || reorderMut.isPending} onClick={() => move(idx, -1)}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 disabled:opacity-30"><ChevronUp size={16} /></button>
                        <button disabled={idx === communities.length - 1 || reorderMut.isPending} onClick={() => move(idx, 1)}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 disabled:opacity-30"><ChevronDown size={16} /></button>
                      </div>
                    ) : <span className="text-slate-400">{idx + 1}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {c.logoUrl ? (
                        <img src={c.logoUrl} alt={c.name} className="w-10 h-10 rounded-lg object-cover border border-slate-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300"><Globe2 size={18} /></div>
                      )}
                      <div>
                        <div className="font-semibold text-slate-800">{c.name}</div>
                        {c.description && <div className="text-xs text-slate-400 line-clamp-1 max-w-xs">{c.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.address || "—"}</td>
                  <td className="px-4 py-3">
                    {c.admins.length ? (
                      <div className="flex flex-wrap gap-1">
                        {c.admins.map(a => (
                          <span key={a.id} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs">
                            {a.nickname || a.email || `#${a.id}`}
                          </span>
                        ))}
                      </div>
                    ) : <span className="text-slate-300">未设置</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.qrCodeUrl ? (
                      <img src={c.qrCodeUrl} alt="官方二维码" className="w-12 h-12 rounded object-cover border border-slate-100" />
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button className="p-1.5 rounded text-slate-400 hover:text-blue-600" onClick={() => openEdit(c)}><Edit2 size={15} /></button>
                      <button className="p-1.5 rounded text-slate-400 hover:text-red-500"
                        onClick={() => askConfirm({
                          title: "删除社区",
                          description: `确定删除社区「${c.name}」吗?该操作不可恢复。`,
                          onConfirm: () => deleteMut.mutate(c.id),
                        })}>
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-blue-900 mb-4">{editing ? "编辑社区" : "添加社区"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">名称 <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="社区名称" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">地址</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="社区地址" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">描述</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" placeholder="社区简介" />
              </div>
              {imgField("Logo", "logo", form.logoUrl)}
              {imgField("官方二维码", "qr", form.qrCodeUrl)}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">社区管理员</label>
                {adminOptions.length === 0 ? (
                  <p className="text-sm text-slate-400">暂无「社区管理员」角色的账号,请先在「权限管理」中给管理员分配社区管理员角色</p>
                ) : (
                  <div className="space-y-2">
                    <select
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                      value=""
                      onChange={e => {
                        const id = parseInt(e.target.value, 10);
                        if (!Number.isNaN(id) && !form.adminUserIds.includes(id)) {
                          setForm(f => ({ ...f, adminUserIds: [...f.adminUserIds, id] }));
                        }
                      }}>
                      <option value="">选择管理员添加…</option>
                      {adminOptions.filter(u => !form.adminUserIds.includes(u.id)).map(u => (
                        <option key={u.id} value={u.id}>{u.nickname || "—"}{u.email ? `（${u.email}）` : ""}</option>
                      ))}
                    </select>
                    {form.adminUserIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {form.adminUserIds.map(id => {
                          const u = adminOptions.find(o => o.id === id);
                          return (
                            <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs">
                              {u?.nickname || u?.email || `#${id}`}
                              <button className="text-blue-400 hover:text-red-500" onClick={() => toggleAdmin(id)}>
                                <X size={12} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={closeModal} className="px-4 py-2 rounded-xl border border-slate-300 text-sm text-slate-600 hover:bg-slate-50">取消</button>
              <button
                onClick={() => {
                  if (!form.name.trim()) { toast({ title: "请填写社区名称", variant: "destructive" }); return; }
                  saveMut.mutate();
                }}
                disabled={saveMut.isPending || uploading !== null}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                {saveMut.isPending && <Loader2 size={14} className="animate-spin" />} 保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Consult Management ──────── */

type CommunityConsultation = {
  id: number;
  communityId: number;
  communityName: string;
  name: string;
  phone: string;
  email: string;
  content: string;
  status: "pending" | "replied";
  tags: string[];
  replyNote: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CommunityConsultationList = {
  data: CommunityConsultation[];
  communities: Array<{ id: number; name: string }>;
  availableTags: string[];
  total: number;
  page: number;
  pageSize: number;
};

function formatConsultationTime(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "UTC",
    hour12: false,
  });
}

function ConsultManagement() {
  const [nameQ, setNameQ] = useState("");
  const [phoneQ, setPhoneQ] = useState("");
  const [emailQ, setEmailQ] = useState("");
  const [communityId, setCommunityId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tagQ, setTagQ] = useState("");
  const [statusQ, setStatusQ] = useState("all");
  
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryParams = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() });
  if (nameQ) queryParams.set("name", nameQ);
  if (phoneQ) queryParams.set("phone", phoneQ);
  if (emailQ) queryParams.set("email", emailQ);
  if (communityId !== "all") queryParams.set("communityId", communityId);
  if (dateFrom) queryParams.set("dateFrom", dateFrom);
  if (dateTo) queryParams.set("dateTo", dateTo);
  if (tagQ) queryParams.set("tag", tagQ);
  if (statusQ !== "all") queryParams.set("status", statusQ);

  const { data, isLoading, isError, error, refetch } = useQuery<CommunityConsultationList>({
    queryKey: ["admin-consultations", queryParams.toString()],
    queryFn: () => adminGet(`/api/admin/community-consultations?${queryParams.toString()}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number, payload: Partial<CommunityConsultation> }) => 
      adminPatch(`/api/admin/community-consultations/${id}`, payload),
    onSuccess: () => {
      toast({ title: "操作成功" });
      queryClient.invalidateQueries({ queryKey: ["admin-consultations"] });
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "操作失败", description: err.message });
    }
  });

  const handleExport = async () => {
    try {
      const exportParams = new URLSearchParams(queryParams.toString());
      exportParams.set("export", "1");
      const res = await adminGet<{ data: CommunityConsultation[] }>(`/api/admin/community-consultations?${exportParams.toString()}`);
      if (!res.data || res.data.length === 0) {
        toast({ title: "没有数据可导出" });
        return;
      }
      
      const XLSX = await import("xlsx");
      const rows = res.data.map(item => ({
        "ID": item.id,
        "所属社区": item.communityName,
        "姓名": item.name,
        "电话": item.phone,
        "邮箱": item.email,
        "咨询内容": item.content,
        "状态": item.status === "pending" ? "待回复" : "已回复",
        "标签": item.tags?.join(", ") || "",
        "回复备注": item.replyNote || "",
        "回复时间": formatConsultationTime(item.repliedAt),
        "提交时间": formatConsultationTime(item.createdAt),
      }));
      
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "咨询记录");
      XLSX.writeFile(workbook, `社区咨询_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err: any) {
      toast({ variant: "destructive", title: "导出失败", description: err.message });
    }
  };

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [noteInput, setNoteInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  const resetFilters = () => {
    setNameQ(""); setPhoneQ(""); setEmailQ(""); setCommunityId("all");
    setDateFrom(""); setDateTo(""); setTagQ(""); setStatusQ("all");
    setPage(1);
  };

  return (
    <div className="space-y-6 pb-10">
      <SectionHeader title="咨询管理" sub="查看并处理各社区成员提交的咨询反馈" />
      
      <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">姓名</label>
            <input value={nameQ} onChange={e => { setNameQ(e.target.value); setPage(1); }} className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white" placeholder="搜索姓名" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">电话</label>
            <input value={phoneQ} onChange={e => { setPhoneQ(e.target.value); setPage(1); }} className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white" placeholder="搜索电话" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">邮箱</label>
            <input value={emailQ} onChange={e => { setEmailQ(e.target.value); setPage(1); }} className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white" placeholder="搜索邮箱" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">所属社区</label>
            <select value={communityId} onChange={e => { setCommunityId(e.target.value); setPage(1); }} className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white">
              <option value="all">全部社区</option>
              {data?.communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">开始日期</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">结束日期</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">包含标签</label>
            <input list="consultation-tag-options" value={tagQ} onChange={e => { setTagQ(e.target.value); setPage(1); }} className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white" placeholder="选择或输入标签" />
            <datalist id="consultation-tag-options">
              {data?.availableTags.map(tagValue => <option key={tagValue} value={tagValue} />)}
            </datalist>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 block mb-1">回复状态</label>
            <select value={statusQ} onChange={e => { setStatusQ(e.target.value); setPage(1); }} className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-primary/20 bg-white">
              <option value="all">全部</option>
              <option value="pending">待回复</option>
              <option value="replied">已回复</option>
            </select>
          </div>
        </div>
        <div className="flex justify-between items-center pt-2">
          <div className="flex gap-2">
            <button onClick={resetFilters} className="px-4 py-1.5 bg-slate-100 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-200 transition-colors">
              重置条件
            </button>
          </div>
          <button onClick={handleExport} data-testid="button-export-consults" className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors shadow-sm">
            <Download size={14} /> 导出当前结果
          </button>
        </div>
      </div>

      <TableShell headers={["咨询人", "所属社区", "咨询内容", "状态/标签", "备注/时间", "操作"]}>
        {isLoading ? <LoadingRow cols={6} /> : isError ? (
          <tr>
            <td colSpan={6} className="px-6 py-14 text-center" data-testid="status-consult-list-error">
              <p className="text-sm font-semibold text-red-600">咨询列表加载失败</p>
              <p className="mt-1 text-xs text-slate-500">{error instanceof Error ? error.message : "请稍后重试"}</p>
              <button
                type="button"
                onClick={() => refetch()}
                data-testid="button-retry-consult-list"
                className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary/90"
              >
                重新加载
              </button>
            </td>
          </tr>
        ) : !data?.data || data.data.length === 0 ? <EmptyRow cols={6} /> : data.data.map(item => (
          <Fragment key={item.id}>
            <tr className="hover:bg-slate-50 transition-colors group">
              <td className="px-6 py-4">
                <div className="font-bold text-sm text-slate-700">{item.name}</div>
                <div className="text-xs text-slate-500 mt-1">{item.phone}</div>
                <div className="text-xs text-slate-500">{item.email}</div>
              </td>
              <td className="px-6 py-4">
                <span className="text-sm font-medium text-slate-600">{item.communityName}</span>
              </td>
              <td className="px-6 py-4">
                <div className="max-w-xs whitespace-pre-wrap text-sm text-slate-600 leading-relaxed line-clamp-3" title={item.content}>
                  {item.content}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-2 items-start">
                  {item.status === "pending" ? (
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 text-xs font-bold">待回复</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-bold">已回复</span>
                  )}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.tags.map(t => (
                        <span key={t} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-semibold border border-blue-100 flex items-center gap-1">
                          {t}
                          <button onClick={() => updateMutation.mutate({ id: item.id, payload: { tags: item.tags.filter(x => x !== t) }})} className="text-blue-400 hover:text-blue-700" title="移除标签">
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-xs text-slate-500 mb-1">{formatConsultationTime(item.createdAt)}</div>
                {item.replyNote && (
                  <div className="text-sm text-slate-700 bg-slate-100 p-2 rounded-lg max-w-xs mt-2 line-clamp-2" title={item.replyNote}>
                    <span className="font-bold text-xs text-slate-400 block mb-0.5">回复备注:</span>
                    {item.replyNote}
                  </div>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="flex gap-2">
                  <button onClick={() => { setSelectedId(selectedId === item.id ? null : item.id); setNoteInput(item.replyNote || ""); setTagInput(""); }} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-colors" data-testid={`button-process-consult-${item.id}`}>
                    {selectedId === item.id ? "收起面板" : "处理"}
                  </button>
                </div>
              </td>
            </tr>
            {selectedId === item.id && (
              <tr>
                <td colSpan={6} className="bg-slate-50/80 px-6 py-4 border-t border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div>
                      <label className="text-sm font-bold text-slate-700 block mb-2">更新回复备注</label>
                      <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)} rows={3} className="w-full resize-none border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="记录沟通结果或回复内容..." />
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <button onClick={() => updateMutation.mutate({ id: item.id, payload: { replyNote: noteInput }})} disabled={updateMutation.isPending} className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary/90 transition-colors">
                          保存备注
                        </button>
                        {item.status === "pending" && (
                          <button onClick={() => updateMutation.mutate({ id: item.id, payload: { status: "replied", replyNote: noteInput || item.replyNote || undefined }})} disabled={updateMutation.isPending} className="px-4 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-colors">
                            标记为已回复
                          </button>
                        )}
                        {item.status === "replied" && (
                          <button onClick={() => updateMutation.mutate({ id: item.id, payload: { status: "pending" }})} disabled={updateMutation.isPending} className="px-4 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-300 transition-colors">
                            标记为待回复
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-bold text-slate-700 block mb-2">添加标签</label>
                      <div className="flex gap-2">
                        <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if(e.key === "Enter" && tagInput.trim()) { updateMutation.mutate({ id: item.id, payload: { tags: Array.from(new Set([...(item.tags || []), tagInput.trim()])) }}); setTagInput(""); } }} className="flex-1 border border-slate-200 rounded-xl px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" placeholder="输入标签按回车..." />
                        <button onClick={() => { if(tagInput.trim()) { updateMutation.mutate({ id: item.id, payload: { tags: Array.from(new Set([...(item.tags || []), tagInput.trim()])) }}); setTagInput(""); } }} className="px-4 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition-colors">
                          添加
                        </button>
                      </div>
                      <div className="mt-4">
                        <p className="text-xs text-slate-500 mb-2">快速标签：</p>
                        <div className="flex flex-wrap gap-2">
                          {["合作意向", "产品问题", "建议反馈"].map(t => (
                            <button key={t} onClick={() => { if(!item.tags?.includes(t)) updateMutation.mutate({ id: item.id, payload: { tags: [...(item.tags || []), t] }})}} className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600 text-xs rounded transition-colors">
                              +{t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </TableShell>
      {data && data.total > 0 && (
        <AdminPagination page={page} pageSize={pageSize} total={data.total} onPage={setPage} onPageSize={setPageSize} />
      )}
    </div>
  );
}

/* ─── Announcement Category Management ──────── */

type AnnCategory = { id: number; name: string; description: string | null; sortOrder: number; createdAt: string };

function AnnouncementCategoryManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm, confirmDialog } = useConfirm();

  const [editing, setEditing] = useState<AnnCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", sortOrder: 0 });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "announcement-categories"],
    queryFn: () => adminGet<{ data: AnnCategory[] }>("/api/admin/community-announcement-categories"),
  });

  const rows = data?.data ?? [];

  async function save() {
    if (!form.name.trim()) { toast({ title: "名称不能为空", variant: "destructive" }); return; }
    try {
      if (editing) {
        await adminPatch(`/api/admin/community-announcement-categories/${editing.id}`, form);
        toast({ title: "更新成功" });
      } else {
        await adminPost("/api/admin/community-announcement-categories", form);
        toast({ title: "创建成功" });
      }
      qc.invalidateQueries({ queryKey: ["admin", "announcement-categories"] });
      setEditing(null); setCreating(false);
      setForm({ name: "", description: "", sortOrder: 0 });
    } catch (err) { toast({ title: "操作失败", description: (err as Error).message, variant: "destructive" }); }
  }

  function remove(id: number, name: string) {
    askConfirm({
      title: `删除「${name}」?`,
      description: "该类别下的公告将变为无分类，不会被删除。",
      confirmLabel: "确认删除",
      confirmVariant: "destructive",
      onConfirm: async () => {
        try {
          await adminDelete(`/api/admin/community-announcement-categories/${id}`);
          toast({ title: "已删除" });
          qc.invalidateQueries({ queryKey: ["admin", "announcement-categories"] });
        } catch (err) { toast({ title: "删除失败", description: (err as Error).message, variant: "destructive" }); }
      },
    });
  }

  function startEdit(row: AnnCategory) {
    setEditing(row);
    setCreating(false);
    setForm({ name: row.name, description: row.description ?? "", sortOrder: row.sortOrder });
  }

  function cancelEdit() { setEditing(null); setCreating(false); setForm({ name: "", description: "", sortOrder: 0 }); }

  const showForm = creating || !!editing;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-blue-900">公告类别</h2>
        {!showForm && (
          <button onClick={() => { setCreating(true); setEditing(null); setForm({ name: "", description: "", sortOrder: 0 }); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
            <Plus size={15} /> 新建类别
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-primary/20">
          <h3 className="font-bold text-blue-900 mb-4">{editing ? "编辑类别" : "新建类别"}</h3>
          <div className="grid grid-cols-1 gap-4 max-w-lg">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">类别名称 <span className="text-red-500">*</span></label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="如：政策公告、活动通知…" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">描述（选填）</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="简短描述该类别的用途" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">排序权重</label>
              <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="数字越小越靠前，默认 0" />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={save} className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-2">
              <Save size={14} /> 保存
            </button>
            <button onClick={cancelEdit} className="px-5 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">
              取消
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-slate-400">
          <Tag size={36} className="mx-auto mb-3 text-slate-200" />
          <p className="font-semibold">暂无公告类别</p>
          <p className="text-sm mt-1">点击「新建类别」开始添加</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-slate-500 font-semibold">ID</th>
                <th className="text-left px-5 py-3 text-slate-500 font-semibold">类别名称</th>
                <th className="text-left px-5 py-3 text-slate-500 font-semibold">描述</th>
                <th className="text-left px-5 py-3 text-slate-500 font-semibold">排序</th>
                <th className="text-right px-5 py-3 text-slate-500 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{row.id}</td>
                  <td className="px-5 py-3.5 font-semibold text-blue-900">{row.name}</td>
                  <td className="px-5 py-3.5 text-slate-500">{row.description || <span className="text-slate-300">—</span>}</td>
                  <td className="px-5 py-3.5 text-slate-500">{row.sortOrder}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(row)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors" title="编辑">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => remove(row.id, row.name)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors" title="删除">
                        <Trash2 size={14} />
                      </button>
                    </div>
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

/* ─── Announcement Management ────────────────── */

type AnnItem = {
  id: number; title: string; coverUrl: string | null; content: string; categoryId: number | null; categoryName: string | null;
  communityId: number | null; communityName: string | null;
  isPublished: boolean; sortOrder: number; publishedAt: string | null; createdAt: string;
};

type AnnListResponse = { data: AnnItem[]; categories: { id: number; name: string }[]; communities: { id: number; name: string }[]; total: number; page: number; pageSize: number };

function AnnouncementManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { askConfirm, confirmDialog } = useConfirm();
  const { data: adminProfile } = useAdminProfile();
  const isSuperAdmin = !!adminProfile?.isSuperAdmin;

  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [filterCat, setFilterCat] = useState<string>("");
  const [filterCommunity, setFilterCommunity] = useState<string>("");
  const [editing, setEditing] = useState<AnnItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [form, setForm] = useState({ title: "", coverUrl: "", content: "", categoryId: "" as string, communityId: "" as string, isPublished: false, sortOrder: 0 });

  /** 直传对象存储:request-url → PUT → verify,返回可访问 URL */
  async function uploadImageFile(file: File): Promise<string> {
    const reqRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
      method: "POST",
      headers: getAdminHeaders(),
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
    return `${BASE}/api/storage${objectPath}`;
  }

  async function handleCoverUpload(file: File) {
    setUploadingCover(true);
    try {
      const url = await uploadImageFile(file);
      setForm(f => ({ ...f, coverUrl: url }));
      toast({ title: "封面上传成功" });
    } catch (e) {
      toast({ title: "上传失败", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleContentImageUpload(file: File): Promise<string> {
    try {
      return await uploadImageFile(file);
    } catch (e) {
      toast({ title: "图片上传失败", description: (e as Error).message, variant: "destructive" });
      throw e;
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "announcements", page, keyword, filterCat, filterCommunity],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (keyword) params.set("keyword", keyword);
      if (filterCat) params.set("categoryId", filterCat);
      if (filterCommunity) params.set("communityId", filterCommunity);
      return adminGet<AnnListResponse>(`/api/admin/community-announcements?${params}`);
    },
  });

  const rows        = data?.data ?? [];
  const total       = data?.total ?? 0;
  const categories  = data?.categories ?? [];
  const communities = data?.communities ?? [];
  const totalPages = Math.ceil(total / 20);
  const showForm   = creating || !!editing;

  async function save() {
    if (!form.title.trim()) { toast({ title: "标题不能为空", variant: "destructive" }); return; }
    try {
      const payload = {
        title: form.title.trim(),
        coverUrl: form.coverUrl || null,
        content: form.content,
        categoryId: form.categoryId ? parseInt(form.categoryId) : null,
        communityId: form.communityId ? parseInt(form.communityId) : null,
        isPublished: form.isPublished,
        sortOrder: form.sortOrder,
      };
      if (editing) {
        await adminPatch(`/api/admin/community-announcements/${editing.id}`, payload);
        toast({ title: "更新成功" });
      } else {
        await adminPost("/api/admin/community-announcements", payload);
        toast({ title: "创建成功" });
      }
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
      setEditing(null); setCreating(false);
      setForm({ title: "", coverUrl: "", content: "", categoryId: "", communityId: "", isPublished: false, sortOrder: 0 });
    } catch (err) { toast({ title: "操作失败", description: (err as Error).message, variant: "destructive" }); }
  }

  async function togglePublish(row: AnnItem) {
    try {
      await adminPatch(`/api/admin/community-announcements/${row.id}`, { isPublished: !row.isPublished });
      toast({ title: row.isPublished ? "已取消发布" : "已发布" });
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    } catch (err) { toast({ title: "操作失败", description: (err as Error).message, variant: "destructive" }); }
  }

  function remove(id: number, title: string) {
    askConfirm({
      title: `删除公告「${title}」?`,
      description: "此操作不可撤销。",
      confirmLabel: "确认删除",
      confirmVariant: "destructive",
      onConfirm: async () => {
        try {
          await adminDelete(`/api/admin/community-announcements/${id}`);
          toast({ title: "已删除" });
          qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
        } catch (err) { toast({ title: "删除失败", description: (err as Error).message, variant: "destructive" }); }
      },
    });
  }

  function startEdit(row: AnnItem) {
    setEditing(row); setCreating(false);
    // 历史公告可能是 Markdown 存储;编辑时统一转成 HTML 进编辑器(此后保存即为 HTML)
    const looksLikeHtml = /^\s*</.test(row.content);
    const content = row.content && !looksLikeHtml ? (marked.parse(row.content, { async: false }) as string) : row.content;
    setForm({ title: row.title, coverUrl: row.coverUrl ?? "", content, categoryId: row.categoryId ? String(row.categoryId) : "", communityId: row.communityId ? String(row.communityId) : "", isPublished: row.isPublished, sortOrder: row.sortOrder });
  }
  function cancelEdit() { setEditing(null); setCreating(false); setForm({ title: "", coverUrl: "", content: "", categoryId: "", communityId: "", isPublished: false, sortOrder: 0 }); }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-blue-900">公告管理</h2>
        {!showForm && (
          <button onClick={() => { setCreating(true); setEditing(null); setForm({ title: "", coverUrl: "", content: "", categoryId: "", communityId: communities.length === 1 && !isSuperAdmin ? String(communities[0].id) : "", isPublished: false, sortOrder: 0 }); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors">
            <Plus size={15} /> 新建公告
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-primary/20">
          <h3 className="font-bold text-blue-900 mb-4">{editing ? "编辑公告" : "新建公告"}</h3>
          <div className="grid grid-cols-1 gap-4 max-w-2xl">
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">标题 <span className="text-red-500">*</span></label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
                placeholder="公告标题" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">封面图</label>
              <div className="flex items-center gap-3">
                {form.coverUrl ? (
                  <img src={form.coverUrl} alt="封面" className="w-32 h-20 rounded-lg object-cover border border-slate-200" />
                ) : (
                  <div className="w-32 h-20 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
                    <ImageIcon size={22} />
                  </div>
                )}
                <label className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-600 cursor-pointer hover:bg-slate-50 inline-flex items-center gap-1.5">
                  {uploadingCover ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {form.coverUrl ? "更换封面" : "上传封面"}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingCover}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f); e.target.value = ""; }} />
                </label>
                {form.coverUrl && (
                  <button className="text-sm text-slate-400 hover:text-red-500"
                    onClick={() => setForm(f => ({ ...f, coverUrl: "" }))}>
                    移除
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">发布范围</label>
              <select value={form.communityId} onChange={e => setForm(f => ({ ...f, communityId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white">
                {isSuperAdmin
                  ? <option value="">平台公告(不属于任何社区)</option>
                  : <option value="" disabled>— 请选择社区 —</option>}
                {communities.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
              {!isSuperAdmin && <p className="text-xs text-slate-400 mt-1">您只能在自己管理的社区发布公告</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">所属类别</label>
              <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white">
                <option value="">— 无类别 —</option>
                {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-1">内容（图文混排,可切换 HTML 源码精细控制）</label>
              <HtmlEditor value={form.content} onChange={v => setForm(f => ({ ...f, content: v }))} minHeight="240px"
                onUploadImage={handleContentImageUpload} enableSourceMode />
            </div>
            <div className="flex gap-6 items-center">
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">排序权重</label>
                <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
                  className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer mt-5">
                <input type="checkbox" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))}
                  className="w-4 h-4 accent-primary rounded" />
                <span className="text-sm font-semibold text-slate-600">立即发布</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={save} className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-2">
              <Save size={14} /> 保存
            </button>
            <button onClick={cancelEdit} className="px-5 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors">
              取消
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      {!showForm && (
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }}
              placeholder="搜索标题或内容…" className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-primary" />
          </div>
          <select value={filterCommunity} onChange={e => { setFilterCommunity(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white">
            <option value="">所有社区</option>
            {communities.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
          <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary bg-white">
            <option value="">所有类别</option>
            {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </div>
      )}

      {/* List */}
      {!showForm && (isLoading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin text-primary" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-slate-400">
          <Megaphone size={36} className="mx-auto mb-3 text-slate-200" />
          <p className="font-semibold">暂无公告</p>
          <p className="text-sm mt-1">点击「新建公告」开始添加</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-5 py-3 text-slate-500 font-semibold">ID</th>
                <th className="text-left px-5 py-3 text-slate-500 font-semibold">标题</th>
                <th className="text-left px-5 py-3 text-slate-500 font-semibold">社区</th>
                <th className="text-left px-5 py-3 text-slate-500 font-semibold">类别</th>
                <th className="text-left px-5 py-3 text-slate-500 font-semibold">状态</th>
                <th className="text-left px-5 py-3 text-slate-500 font-semibold">排序</th>
                <th className="text-left px-5 py-3 text-slate-500 font-semibold">创建时间</th>
                <th className="text-right px-5 py-3 text-slate-500 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{row.id}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      {row.coverUrl && <img src={row.coverUrl} alt="" className="w-12 h-8 rounded object-cover border border-slate-200 shrink-0" />}
                      <div>
                        <p className="font-semibold text-blue-900 max-w-[220px] truncate">{row.title}</p>
                        {row.content && <p className="text-slate-400 text-xs mt-0.5 max-w-[220px] truncate">{row.content.replace(/<[^>]+>/g, " ").replace(/#+\s*/g, "").replace(/\s+/g, " ").trim().slice(0, 60)}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {row.communityName
                      ? <span className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-xs font-semibold">{row.communityName}</span>
                      : <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-xs font-semibold">平台公告</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {row.categoryName
                      ? <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-semibold">{row.categoryName}</span>
                      : <span className="text-slate-300 text-xs">无</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {row.isPublished
                      ? <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold">已发布</span>
                      : <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-bold">草稿</span>}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{row.sortOrder}</td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">{new Date(row.createdAt).toLocaleDateString("zh-CN")}</td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => togglePublish(row)}
                        className={`p-1.5 rounded-lg transition-colors ${row.isPublished ? "hover:bg-amber-50 text-amber-500 hover:text-amber-700" : "hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700"}`}
                        title={row.isPublished ? "取消发布" : "发布"}>
                        {row.isPublished ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button onClick={() => startEdit(row)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 hover:text-blue-700 transition-colors" title="编辑">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => remove(row.id, row.title)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors" title="删除">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-5 py-4 border-t border-slate-100">
              <span className="text-sm text-slate-500">共 {total} 条</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">上一页</button>
                <span className="px-3 py-1.5 text-sm text-slate-500">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">下一页</button>
              </div>
            </div>
          )}
        </div>
      ))}
      {confirmDialog}
    </div>
  );
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
  const [inlineRoute, setInlineRoute] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => { setInlineRoute(null); }, [active]);

  const role = getStoredUser()?.role;
  const adminNickname = getStoredUser()?.nickname ?? "管理员";

  // Hooks must all be called unconditionally before any early return.
  const { data: profile } = useAdminProfile();
  const isSuperAdmin = profile?.isSuperAdmin ?? false;
  const permissions = profile?.permissions ?? [];
  const hasAllPerms = isSuperAdmin || permissions.includes("*");

  function canSee(item: typeof NAV[0]): boolean {
    if (item.superAdminOnly) return isSuperAdmin;
    if (item.requireAllPerms) return hasAllPerms;
    if (hasAllPerms) return true;
    if (item.permKeys) return item.permKeys.some(k => permissions.includes(k));
    if (!item.permKey) return true;
    return permissions.includes(item.permKey);
  }

  function canSeeChild(child: NavChild): boolean {
    if (child.superAdminOnly && !isSuperAdmin) return false;
    if (hasAllPerms) return true;
    if (!child.permKey) return true;
    return permissions.includes(child.permKey);
  }

  const visibleNav = NAV.filter(canSee);

  // Returns the first permitted leaf module key for a nav item.
  // For groups, picks the first child the user can see.
  function firstPermittedKey(item: NavItem): Module {
    if (item.children?.length) {
      const firstChild = item.children.filter(canSeeChild).find(c => c.moduleKey);
      if (firstChild?.moduleKey) return firstChild.moduleKey;
    }
    return item.key;
  }

  // If the current active module is no longer accessible, jump to the first visible leaf.
  // Also handles the case where active equals a parent group key (has children) — redirect
  // to the first permitted child so the rendered component matches the user's permissions.
  useEffect(() => {
    const allowed = visibleNav.some(n =>
      n.key === active ||
      n.children?.some(c => c.moduleKey === active)
    );
    if (!allowed && visibleNav.length > 0) {
      setActive(firstPermittedKey(visibleNav[0]));
      return;
    }
    // If active is a parent group key (has children), redirect to first permitted child
    const activeGroup = visibleNav.find(n => n.key === active && n.children?.length);
    if (activeGroup) {
      const target = firstPermittedKey(activeGroup);
      if (target !== active) setActive(target);
    }
  }, [visibleNav.map(n => n.key).join(","), active]);

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
                      {item.children.filter(canSeeChild).map(child => {
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
            {inlineRoute && (
              <button
                onClick={() => setInlineRoute(null)}
                className="ml-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-700 text-xs font-semibold transition-all group"
              >
                <ChevronLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
                返回
              </button>
            )}
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
          <ModuleContent key={active} module={active} inlineRoute={inlineRoute} setInlineRoute={setInlineRoute} />
        </div>
      </main>
    </div>
  );
}
