/**
 * Ters proxy (Dokploy/Traefik, Nginx, Cloudflare) arkasindaki gercek istemci IP'si.
 *
 * Not: bu basliklar istemci tarafindan taklit edilebilir; proxy'nin bunlari
 * ustune yazdigi varsayilir. Icerik secimi icin yeterli, kimlik dogrulama icin degil.
 */

/** Panelde ham olarak gosterilen basliklar (hangisinin dolu geldigini gormek icin) */
export const IP_HEADERS = [
  "cf-connecting-ip",
  "x-real-ip",
  "x-forwarded-for",
  "x-forwarded-host",
  "forwarded",
] as const;

export function normalizeIp(raw: string): string {
  let ip = raw.trim();
  if (!ip) return "";
  if (ip.startsWith("[")) ip = ip.slice(1, ip.indexOf("]") > 0 ? ip.indexOf("]") : undefined);
  if (ip.toLowerCase().startsWith("::ffff:")) ip = ip.slice(7);
  // "1.2.3.4:5678" -> "1.2.3.4" (IPv6 birden fazla ':' icerdigi icin tek ':' kontrolu)
  if (ip.split(":").length - 1 === 1) ip = ip.split(":")[0];
  return ip;
}

export type ClientIp = {
  ip: string;
  /** IP'nin hangi HTTP basligindan okundugu (proxy ayarini dogrulamak icin) */
  via: string;
};

export function clientIpFrom(h: Headers): ClientIp {
  const cf = h.get("cf-connecting-ip");
  if (cf) {
    const ip = normalizeIp(cf);
    if (ip) return { ip, via: "cf-connecting-ip" };
  }
  const real = h.get("x-real-ip");
  if (real) {
    const ip = normalizeIp(real);
    if (ip) return { ip, via: "x-real-ip" };
  }
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const ip = normalizeIp(xff.split(",")[0] ?? "");
    if (ip) return { ip, via: "x-forwarded-for" };
  }
  return { ip: "", via: "yok" };
}
