/**
 * IP -> sehir / operator cozumlemesi (ipwho.is, anahtar gerektirmez).
 *
 * Amac: panelde "88.240.10.20 — Kayseri, Turk Telekom" seklinde gorup hangi
 * subenin hangi IP oldugunu gezmeden ayirt edebilmek.
 *
 * Sonuclar bellekte 24 saat tutulur; her istekte en fazla LOOKUP_BUDGET yeni
 * sorgu yapilir, kalanlar sonraki panel yenilemesinde tamamlanir (ipwho.is
 * ucretsiz katmaninda saatlik sinir var).
 */

export type IpInfo = {
  city: string;
  region: string;
  country: string;
  isp: string;
};

type CacheEntry = { info: IpInfo | null; at: number };

const TTL_MS = 24 * 60 * 60 * 1000;
const LOOKUP_BUDGET = 8;

const store = globalThis as unknown as {
  __signageIpCache?: Map<string, CacheEntry>;
};
const cache: Map<string, CacheEntry> = (store.__signageIpCache ??= new Map());

function isPrivate(ip: string): boolean {
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

async function lookupOne(ip: string): Promise<IpInfo | null> {
  try {
    const res = await fetch(
      `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country,connection`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const d = (await res.json()) as {
      success?: boolean;
      city?: string;
      region?: string;
      country?: string;
      connection?: { isp?: string; org?: string };
    };
    if (!d.success) return null;
    return {
      city: d.city ?? "",
      region: d.region ?? "",
      country: d.country ?? "",
      isp: d.connection?.isp ?? d.connection?.org ?? "",
    };
  } catch {
    return null;
  }
}

/** Verilen IP'ler icin bilinen bilgileri dondurur, eksikleri butce kadar tamamlar. */
export async function lookupIps(ips: string[]): Promise<Record<string, IpInfo>> {
  const now = Date.now();
  const unique = [...new Set(ips.filter((ip) => ip && !isPrivate(ip)))];

  const missing = unique.filter((ip) => {
    const hit = cache.get(ip);
    return !hit || now - hit.at > TTL_MS;
  });

  const batch = missing.slice(0, LOOKUP_BUDGET);
  const results = await Promise.all(batch.map((ip) => lookupOne(ip)));
  batch.forEach((ip, i) => cache.set(ip, { info: results[i], at: now }));

  const out: Record<string, IpInfo> = {};
  for (const ip of unique) {
    const hit = cache.get(ip);
    if (hit?.info) out[ip] = hit.info;
  }
  return out;
}
