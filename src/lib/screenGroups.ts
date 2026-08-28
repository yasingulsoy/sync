/**
 * IP eşleştirme yardımcıları.
 *
 * Şube ↔ IP eşlemesi artık bu dosyada değil, veritabanında (sube_ipleri) —
 * panelden değiştirilebilsin, bir şubenin IP'si değiştiğinde deploy
 * gerekmesin diye. Burada yalnızca eşleştirme mantığı kaldı.
 */

/** Şube kodu / URL segmenti doğrulaması — path traversal ve geçersiz karakterleri engeller */
const GROUP_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export function isValidGroupName(name: string): boolean {
  return GROUP_NAME_RE.test(name);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = Number(p);
    if (v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

/** Tam IP eşitliği veya IPv4 CIDR eşleşmesi ("88.1.2.0/24") */
export function ipMatches(ip: string, rule: string): boolean {
  if (!ip || !rule) return false;
  if (!rule.includes("/")) return ip === rule;

  const [base, bitsRaw] = rule.split("/");
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const a = ipv4ToInt(ip);
  const b = ipv4ToInt(base);
  if (a === null || b === null) return false;
  if (bits === 0) return true;

  const mask = bits === 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}

/** Panelde girilen IP / CIDR değerinin biçim kontrolü */
export function isValidIpRule(rule: string): boolean {
  const value = rule.trim();
  if (!value) return false;
  if (value.includes("/")) {
    const [base, bits] = value.split("/");
    const n = Number(bits);
    return ipv4ToInt(base) !== null && Number.isInteger(n) && n >= 0 && n <= 32;
  }
  if (ipv4ToInt(value) !== null) return true;
  // IPv6 için kaba kontrol: yalnızca tam eşleşmede kullanılır
  return /^[0-9a-f:]{2,45}$/i.test(value);
}
