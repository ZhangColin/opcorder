const ACCESS_TOKEN_KEY = "jdb_user_id";
const REFRESH_TOKEN_KEY = "jdb_refresh_token";
const USER_KEY = "jdb_user";

export interface StoredUser {
  id: number;
  nickname: string;
  email: string;
  avatar: string | null;
  role: string;
  status: string;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as StoredUser; } catch { return null; }
}

export function storeSession(data: {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
}): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  localStorage.setItem("jdb_role", data.user.role);
  localStorage.setItem("jdb_nickname", data.user.nickname ?? "");
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("jdb_role");
  localStorage.removeItem("jdb_nickname");
}

function getTokenExpiry(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch { return null; }
}

function getTokenUserId(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    const sub = payload.sub;
    const id = typeof sub === "string" ? parseInt(sub, 10) : Number(sub);
    return isNaN(id) ? null : id;
  } catch { return null; }
}

export function getUserIdFromToken(): number | null {
  const token = getAccessToken();
  if (!token) return null;
  return getTokenUserId(token);
}

let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(apiBase: string): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearSession();
      return null;
    }

    try {
      const res = await fetch(`${apiBase}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) {
        clearSession();
        return null;
      }

      const data = (await res.json()) as { accessToken?: string };
      if (data.accessToken) {
        localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
        return data.accessToken;
      }

      clearSession();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function getValidAccessToken(apiBase: string): Promise<string | null> {
  const token = getAccessToken();
  if (!token) return null;

  const exp = getTokenExpiry(token);

  // Token is not a valid JWT (e.g. leftover legacy integer ID) — try refresh or clear
  if (exp === null) {
    return refreshAccessToken(apiBase);
  }

  // Token is within 5 minutes of expiry — proactive refresh
  if (exp - Date.now() < 5 * 60 * 1000) {
    return refreshAccessToken(apiBase);
  }

  return token;
}

export async function callLogout(apiBase: string): Promise<void> {
  const token = getAccessToken();
  try {
    await fetch(`${apiBase}/api/auth/logout`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch { }
  clearSession();
}
