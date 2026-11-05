/**
 * Yayın tarihleri — hem sunucu (oynatma listesi) hem panel (durum rozetleri)
 * aynı kuralı kullansın diye burada. Node API'si kullanmaz.
 *
 * Tarihler "YYYY-MM-DD" metni olarak tutulur ve İstanbul saatine göre
 * değerlendirilir; bu biçimde metin karşılaştırması tarih karşılaştırmasıyla
 * aynı sonucu verir. İki uç da dahildir: bitişi 31 Ekim olan afiş
 * 31 Ekim 23:59'a kadar oynar, 1 Kasım 00:00'da düşer.
 */

export type YayinAraligi = {
  baslangic: string | null;
  bitis: string | null;
};

export type YayinDurumu = "yayinda" | "baslamadi" | "bitti";

const ISTANBUL = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** İstanbul'a göre bugünün tarihi, ör. "2026-11-05". Sunucu UTC'de olsa bile doğru gün. */
export function istanbulBugun(simdi: Date = new Date()): string {
  return ISTANBUL.format(simdi);
}

export function yayinDurumu(
  aralik: YayinAraligi | undefined,
  bugun: string
): YayinDurumu {
  if (!aralik) return "yayinda";
  if (aralik.baslangic && bugun < aralik.baslangic) return "baslamadi";
  if (aralik.bitis && bugun > aralik.bitis) return "bitti";
  return "yayinda";
}

/** "2026-02-30" gibi takvimde olmayan günleri de reddeder */
export function gecerliTarih(deger: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deger)) return false;
  const [y, a, g] = deger.split("-").map(Number);
  const d = new Date(Date.UTC(y, a - 1, g));
  return d.getUTCFullYear() === y && d.getUTCMonth() === a - 1 && d.getUTCDate() === g;
}

const KISA = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });

/** "2026-10-31" -> "31 Eki" (panel için) */
export function kisaTarih(deger: string): string {
  const [y, a, g] = deger.split("-").map(Number);
  return KISA.format(new Date(Date.UTC(y, a - 1, g)));
}

/** b - a, gün olarak ("2026-11-05", "2026-11-08" -> 3) */
export function gunFarki(a: string, b: string): number {
  const ms = (x: string) => {
    const [y, ay, g] = x.split("-").map(Number);
    return Date.UTC(y, ay - 1, g);
  };
  return Math.round((ms(b) - ms(a)) / 86_400_000);
}
