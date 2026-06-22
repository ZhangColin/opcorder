import { getAccessToken } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function v2Url(path: string) {
  return `${BASE}/api/v2${path}`;
}

export async function v2Fetch(path: string, init?: RequestInit): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> ?? {}),
  };
  return fetch(v2Url(path), { ...init, headers });
}

export async function v2Get<T>(path: string): Promise<T> {
  const res = await v2Fetch(path);
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? `请求失败 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function v2Post<T>(path: string, body?: unknown): Promise<T> {
  const res = await v2Fetch(path, { method: "POST", body: JSON.stringify(body ?? {}) });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? `请求失败 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function v2Patch<T>(path: string, body?: unknown): Promise<T> {
  const res = await v2Fetch(path, { method: "PATCH", body: JSON.stringify(body ?? {}) });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? `请求失败 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function v2Delete(path: string): Promise<void> {
  const res = await v2Fetch(path, { method: "DELETE" });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? `请求失败 (${res.status})`);
  }
}

export const STORAGE_BASE = BASE;

export async function uploadFile(file: File): Promise<string> {
  const reqRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
  });
  if (!reqRes.ok) {
    const e = await reqRes.json().catch(() => ({}));
    throw new Error((e as any).error || "获取上传链接失败");
  }
  const { uploadURL, objectPath, sessionToken } = await reqRes.json();
  const putRes = await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
  if (!putRes.ok) throw new Error("文件上传失败");
  const verifyRes = await fetch(`${BASE}/api/storage/uploads/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken }),
  });
  if (!verifyRes.ok) throw new Error("文件验证失败");
  return `${BASE}/api/storage${objectPath}`;
}
