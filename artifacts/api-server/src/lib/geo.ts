const PRIVATE_IP = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|fc|fd)/;

export async function lookupCity(ip: string): Promise<string | null> {
  if (!ip || PRIVATE_IP.test(ip)) return null;
  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,city,regionName&lang=zh-CN`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { status: string; city?: string; regionName?: string };
    if (data.status !== "success") return null;
    return data.city || data.regionName || null;
  } catch {
    return null;
  }
}
