import { getAccessToken } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function headers(): Record<string, string> {
  const token = getAccessToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? `请求失败 (${res.status})`);
  }
  // DELETE may return empty body
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** GET /api/compute<path> */
export async function cGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}/api/compute${path}`, { headers: headers() });
  return handle<T>(res);
}

/** GET a list endpoint; backend wraps rows in { items: [...] }. Returns the array. */
export async function cList<T>(path: string): Promise<T[]> {
  const res = await fetch(`${BASE}/api/compute${path}`, { headers: headers() });
  const data = await handle<{ items?: T[] } | T[]>(res);
  if (Array.isArray(data)) return data;
  return (data as { items?: T[] }).items ?? [];
}

export async function cPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api/compute${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body ?? {}),
  });
  return handle<T>(res);
}

export async function cPatch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api/compute${path}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify(body ?? {}),
  });
  return handle<T>(res);
}

export async function cDelete(path: string): Promise<void> {
  const res = await fetch(`${BASE}/api/compute${path}`, {
    method: "DELETE",
    headers: headers(),
  });
  await handle<void>(res);
}
