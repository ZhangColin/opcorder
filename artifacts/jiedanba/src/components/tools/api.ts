import { getAccessToken } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Build full URL to /api/... (no /v2 prefix) */
export function toolsUrl(path: string) {
  return `${BASE}/api${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(toolsUrl(path), { ...init, headers });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? `请求失败 (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function tGet<T>(path: string) {
  return request<T>(path);
}
export function tPost<T>(path: string, body?: unknown) {
  return request<T>(path, { method: "POST", body: JSON.stringify(body ?? {}) });
}
export function tPatch<T>(path: string, body?: unknown) {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
}
export function tDelete<T = void>(path: string) {
  return request<T>(path, { method: "DELETE" });
}

/* ─── Types ─────────────────────────── */

export type AppType = "agent" | "workflow";
export type ShareStatus = "private" | "published" | "template";

export interface Agent {
  id: number;
  name: string;
  appType: AppType;
  description: string | null;
  iconUrl: string | null;
  tags: string[] | null;
  category: string | null;
  shareStatus: ShareStatus;
  priceFenPerMonth: number | null;
  publishedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketAgent extends Agent {
  authorName: string | null;
  rating?: number | null;
  favoriteCount?: number | null;
  favorited?: boolean;
}

export interface KnowledgeBase {
  id: number;
  name: string;
  description: string | null;
  tags: string[] | null;
  sizeMb: number | null;
  docCount: number | null;
  updatedAt?: string;
  createdAt?: string;
}

export type ToolKind = "custom" | "mcp";
export interface CustomTool {
  id: number;
  name: string;
  kind: ToolKind;
  config: any;
  enabled: boolean;
  refCount: number | null;
  createdAt?: string;
}

export interface Plugin {
  id: number;
  name: string;
  author: string | null;
  description: string | null;
  installCount: number | null;
  installed?: boolean;
}

/** GET /tools/earnings raw response */
export interface EarningItem {
  id: number;
  agentId: number | null;
  subscriberId: number | null;
  amountFen: number;
  agentName: string;
  subscriberName: string | null;
  createdAt: string;
}
export interface EarningsResponse {
  totalFen: number;
  items: EarningItem[];
}

/** GET /tools/subscriptions raw response */
export interface SubscriptionItem {
  id: number;
  agentId: number | null;
  agentName: string;
  agentIcon: string | null;
  authorName: string | null;
  amountFen: number;
  status: string | null;
  createdAt: string;
}
export interface SubscriptionsResponse {
  totalSpentFen: number;
  items: SubscriptionItem[];
}

/** Generic list wrapper */
export interface ListResponse<T> {
  items: T[];
}
export interface MarketResponse {
  items: MarketAgent[];
  categories: string[];
}

export const CATEGORIES = [
  "金融", "教育", "医疗", "法律", "客服助手", "办公助手",
  "生活助手", "角色扮演", "创意绘画", "游戏", "情感", "其他",
] as const;

export function formatPrice(fen: number | null | undefined): string {
  if (fen == null || fen === 0) return "限时免费";
  return `¥${(fen / 100).toFixed(2)}/月`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
