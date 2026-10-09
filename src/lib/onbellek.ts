/**
 * Kiosk bilgisayarında medya önbelleği (istemci tarafı).
 *
 * Akış:
 *  1. public/sw.js kaydedilir; /videos/* isteklerini önbellekten karşılar.
 *  2. Oynatıcı listeyi aldıkça burası eksik dosyaları SIRAYLA tam olarak
 *     indirip önbelleğe koyar. Aynı anda tek dosya: zayıf hatta o an oynayan
 *     videoyu boğmamak için.
 *  3. Listeden çıkan dosyalar önbellekten silinir, disk şişmez.
 *
 * Adreslerde "?v=<boyut>" var: deploy her seferinde dosya tarihini değiştirdiği
 * için tarih/etag işe yaramıyor; içerik değişirse boyut da değişir, yeni adres
 * yeni önbellek kaydı demektir.
 *
 * Tarayıcı Service Worker desteklemiyorsa hiçbir şey yapılmaz; oynatıcı eskisi
 * gibi doğrudan ağdan oynatır.
 */

/** public/sw.js içindeki adla aynı olmalı */
const MEDYA_CACHE = "hospisync-medya-v1";

export type OnbellekDurumu = {
  /** Önbellekte hazır dosya sayısı */
  hazir: number;
  /** Listedeki toplam dosya sayısı */
  toplam: number;
};

function destekleniyor(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "caches" in window &&
    window.isSecureContext
  );
}

/** "medipol/tanitim (1).mp4" + 1234 -> "/videos/medipol/tanitim%20(1).mp4?v=1234" */
export function medyaAdresi(dosya: string, boyut?: number): string {
  const yol = `/videos/${dosya.split("/").map(encodeURIComponent).join("/")}`;
  return boyut ? `${yol}?v=${boyut}` : yol;
}

let kayitBasladi = false;

export function onbellegiBaslat(): void {
  if (!destekleniyor() || kayitBasladi) return;
  kayitBasladi = true;

  navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .catch(() => {
      /* kayıt olmazsa ağdan oynatmaya devam */
    });

  // Disk dolduğunda tarayıcı önbelleği silmesin diye kalıcılık iste.
  // Tarayıcı reddedebilir; o durumda da yalnızca ciddi disk sıkışıklığında silinir.
  navigator.storage?.persist?.().catch(() => {});
}

let isitiliyor: Promise<OnbellekDurumu> | null = null;
let sonDurum: OnbellekDurumu = { hazir: 0, toplam: 0 };

export function onbellekDurumu(): OnbellekDurumu {
  return sonDurum;
}

/**
 * Listedeki eksik dosyaları indirir. `baslangic`, şu an oynayanın sırası:
 * indirme sıradakinden başlar ki önbellek oynatma sırasıyla dolsun.
 * Zaten çalışıyorsa yenisini başlatmaz.
 */
export function onbellegiIsit(
  dosyalar: string[],
  boyutlar: Record<string, number>,
  baslangic = 0
): Promise<OnbellekDurumu> {
  if (!destekleniyor() || dosyalar.length === 0) {
    sonDurum = { hazir: 0, toplam: dosyalar.length };
    return Promise.resolve(sonDurum);
  }
  if (isitiliyor) return isitiliyor;

  isitiliyor = isit(dosyalar, boyutlar, baslangic).finally(() => {
    isitiliyor = null;
  });
  return isitiliyor;
}

async function isit(
  dosyalar: string[],
  boyutlar: Record<string, number>,
  baslangic: number
): Promise<OnbellekDurumu> {
  const cache = await caches.open(MEDYA_CACHE);

  // Sıradakinden başlayarak oynatma sırasıyla
  const sira = dosyalar.map((_, i) => dosyalar[(baslangic + 1 + i) % dosyalar.length]);
  const istenen = new Set(dosyalar.map((d) => mutlak(medyaAdresi(d, boyutlar[d]))));

  await kullanilmayanlariSil(cache, istenen);

  let hazir = 0;
  for (const dosya of sira) {
    const boyut = boyutlar[dosya];
    const adres = medyaAdresi(dosya, boyut);

    if (await hazirMi(cache, adres, boyut)) {
      hazir++;
    } else if (await indir(cache, adres, boyut)) {
      hazir++;
    }
    sonDurum = { hazir, toplam: dosyalar.length };
  }

  sonDurum = { hazir, toplam: dosyalar.length };
  return sonDurum;
}

function mutlak(adres: string): string {
  return new URL(adres, location.origin).href;
}

async function hazirMi(cache: Cache, adres: string, boyut?: number): Promise<boolean> {
  const kayit = await cache.match(adres);
  if (!kayit) return false;
  if (!boyut) return true;
  const baslik = Number(kayit.headers.get("content-length"));
  if (baslik) return baslik === boyut;
  // Başlık yoksa gövdeye bak; diskte durduğu için .blob() içeriği belleğe okumaz
  return (await kayit.blob()).size === boyut;
}

async function indir(cache: Cache, adres: string, boyut?: number): Promise<boolean> {
  try {
    // Range başlığı yok: sunucu dosyanın tamamını 200 ile döner
    const yanit = await fetch(adres, { cache: "no-store" });
    if (yanit.status !== 200) return false;
    await cache.put(adres, yanit);

    // İndirme yarıda kesildiyse yarım dosyayı önbellekte bırakma
    if (boyut && !(await hazirMi(cache, adres, boyut))) {
      await cache.delete(adres);
      return false;
    }
    return true;
  } catch {
    // Ağ koptu vb. — sonraki liste yenilemesinde (5 dk) tekrar denenir
    return false;
  }
}

async function kullanilmayanlariSil(cache: Cache, istenen: Set<string>): Promise<void> {
  const kayitlar = await cache.keys();
  await Promise.all(
    kayitlar.filter((r) => !istenen.has(r.url)).map((r) => cache.delete(r))
  );
}
