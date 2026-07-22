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

/** Authenticated GET to /api/... (no /v2 prefix) */
export async function apiGet<T>(path: string): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { headers });
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

const EXT_MIME: Record<string, string> = {
  md:   "text/markdown",
  txt:  "text/plain",
  html: "text/html",
  htm:  "text/html",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  gif:  "image/gif",
  webp: "image/webp",
  pdf:  "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip:  "application/zip",
  rar:  "application/x-rar-compressed",
  "7z": "application/x-7z-compressed",
  mp4:  "video/mp4",
  webm: "video/webm",
};

function resolveContentType(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "application/octet-stream";
}

export async function uploadFile(file: File): Promise<string> {
  const contentType = resolveContentType(file);
  const token = getAccessToken();
  const params = new URLSearchParams({ name: file.name, contentType });
  const res = await fetch(`${BASE}/api/storage/uploads/direct?${params}`, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: file,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? "上传失败，请重试");
  }
  const { objectPath } = await res.json();
  return `${BASE}/api/storage${objectPath}`;
}
