/**
 * EKRAN GRUPLARI — hangi IP hangi hastanenin videolarini oynatir.
 *
 * ------------------------------------------------------------------
 * NASIL DOLDURULUR
 * ------------------------------------------------------------------
 * 1. Bu dosyayi bos birakip deploy edin.
 * 2. Ekranlar acikken /ekranlar sayfasini acin — baglanan tum IP'ler
 *    orada listelenir (hangi sube oldugunu son gorulme saatinden ve
 *    tarayici bilgisinden ayirt edebilirsiniz).
 * 3. Asagidaki listeye IP'leri yazin, public/videos/<grup> klasorunu
 *    olusturup videolari icine koyun, tekrar deploy edin.
 *
 * `group` = public/videos altindaki klasor adi (kucuk harf, bosluksuz).
 * `ips`   = tam IP ("88.123.45.67") veya CIDR blogu ("88.123.45.0/24").
 *
 * DIKKAT: Hastanenin dis IP'si degisirse (dinamik IP, hat degisikligi)
 * ekran sessizce varsayilan videolara doner. Bu durumda ya buraya yeni
 * IP'yi ekleyin, ya da o PC'nin adresini /fs/<grup> yapip IP'den bagimsiz
 * hale getirin (URL her zaman IP kuralini ezer).
 */

export type GroupRule = {
  /** public/videos altindaki klasor adi */
  group: string;
  /** Panelde gorunecek okunabilir ad */
  label: string;
  /** Tam IP veya CIDR listesi */
  ips: string[];
};

export const SCREEN_GROUPS: GroupRule[] = [
  // Ornek — /ekranlar sayfasindan aldiginiz IP'lerle doldurun:
  // { group: "medipol",  label: "Medipol Hastanesi",   ips: ["88.123.45.67"] },
  // { group: "acibadem", label: "Acibadem Atasehir",   ips: ["81.10.20.0/24", "81.10.30.5"] },
];

/** Hicbir kural eslesmezse oynatilacak klasor. "" = public/videos koku */
export const DEFAULT_GROUP = "";

/** Her grupta ek olarak oynatilacak ortak videolar. Klasor yoksa atlanir. */
export const SHARED_GROUP = "_ortak";

/** Klasor adi dogrulamasi — path traversal ("../") ve gecersiz karakterleri engeller */
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

/** Tam IP esitligi veya IPv4 CIDR eslesmesi */
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

export type GroupMatch = {
  group: string;
  label: string;
  matched: boolean;
};

export function groupForIp(ip: string): GroupMatch {
  for (const rule of SCREEN_GROUPS) {
    if (rule.ips.some((r) => ipMatches(ip, r))) {
      return { group: rule.group, label: rule.label, matched: true };
    }
  }
  return { group: DEFAULT_GROUP, label: "Varsayilan", matched: false };
}

/** IP kuralinda tanimli bir grubun okunabilir adi (panel icin) */
export function labelForGroup(group: string): string {
  if (!group) return "Varsayilan";
  return SCREEN_GROUPS.find((r) => r.group === group)?.label ?? group;
}
