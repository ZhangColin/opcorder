import { createRequire } from "module";
import { resolve, dirname } from "path";

let _geoip: { lookup: (ip: string) => { city?: string } | null } | null = null;

async function getGeoip() {
  if (_geoip) return _geoip;
  try {
    const req = createRequire(import.meta.url);
    const pkgPath = req.resolve("geoip-lite/package.json");
    process.env.GEOIP_DATADIR = resolve(dirname(pkgPath), "data");
    const mod = await import("geoip-lite");
    _geoip = mod.default as any;
  } catch {
    _geoip = { lookup: () => null };
  }
  return _geoip!;
}

export async function lookupCity(ip: string): Promise<string | null> {
  if (!ip) return null;
  try {
    const geoip = await getGeoip();
    const geo = geoip.lookup(ip);
    return geo?.city ?? null;
  } catch {
    return null;
  }
}
