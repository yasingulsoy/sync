/*
 * HospiSync Signage — medya önbelleği (Service Worker)
 *
 * Amaç: videolar ve görseller kiosk bilgisayarının diskine bir kez indirilsin,
 * sonra hep oradan oynatılsın. İnternet yavaşlasa veya kesilse bile ekran
 * takılmadan döner.
 *
 * Bu dosya yalnızca /videos/* isteklerine karışır. Sayfa, API ve diğer her şey
 * olduğu gibi ağdan gelir.
 *
 * Önbelleği DOLDURAN bu dosya değil, sayfadaki oynatıcıdır (src/lib/onbellek.ts):
 * dosyaları sırayla tam olarak indirip buraya koyar. Burası sadece SUNAR.
 * Böylece önbellekte olmayan bir dosya istenirse ağa düşülür — en kötü durum
 * bugünkü davranışın aynısıdır.
 *
 * ACİL DURUM: bu Service Worker sorun çıkarırsa, dosyanın içeriğini
 * aşağıdaki iki satırla değiştirip deploy etmek tüm ekranlarda kaldırır:
 *   self.addEventListener("install", () => self.skipWaiting());
 *   self.addEventListener("activate", () => self.registration.unregister());
 */

// Adı değiştirmeyin: değişirse her kiosk bütün medyayı yeniden indirir
const MEDYA_CACHE = "hospisync-medya-v1";
const META_CACHE = "hospisync-meta";
const YENILEME_SOGUMA_MS = 10 * 60_000;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Medya önbelleği zaten varsa bu cihaz önceki sürümü çalıştırıyordu:
      // bu bir güncelleme. (İlk kurulumda önbellek henüz yoktur.)
      const guncelleme = await caches.has(MEDYA_CACHE);

      // Eski sürüm önbelleklerini temizle (ileride v2'ye geçilirse)
      const adlar = await caches.keys();
      await Promise.all(
        adlar
          .filter((ad) => ad.startsWith("hospisync-medya-") && ad !== MEDYA_CACHE)
          .map((ad) => caches.delete(ad))
      );
      // Açık sayfayı yeniden yüklemeye gerek kalmadan hemen devral
      await self.clients.claim();

      if (guncelleme) {
        // BEKLEMEYİN: yenileme isteği bu Service Worker'dan geçer ve tarayıcı,
        // SW "activating" durumundayken fetch olaylarını bekletir. Burada
        // beklemek, aktivasyonla yenilemenin birbirini beklemesine yol açar
        // (testte 8+ sn gecikme). Aktivasyon bitince başlatıyoruz.
        setTimeout(() => void kiosklariYenile(), 0);
      }
    })()
  );
});

/**
 * Bu Service Worker güncellendiğinde açık kiosk sayfalarını bir kez yeniler.
 * Otomatik güncelleme özelliğinden ÖNCEKİ sayfa kodu kendini yenilemeyi
 * bilmiyor; onları yeni koda geçirmenin tek yolu bu. Medya diskte olduğu
 * için yenileme bir iki saniye sürer.
 *
 * Döngü koruması: son yenilemeden bu yana YENILEME_SOGUMA_MS geçmediyse
 * hiçbir şey yapılmaz.
 */
async function kiosklariYenile() {
  try {
    const meta = await caches.open(META_CACHE);
    const kayit = await meta.match("/__son-sw-yenileme");
    const son = kayit ? Number(await kayit.text()) : 0;
    if (Date.now() - son < YENILEME_SOGUMA_MS) return;
    await meta.put("/__son-sw-yenileme", new Response(String(Date.now())));

    const pencereler = await self.clients.matchAll({ type: "window" });
    for (const pencere of pencereler) {
      const yol = new URL(pencere.url).pathname;
      // Yalnızca kiosk sayfaları; yönetim paneli açıksa ona dokunma
      if (yol === "/" || yol === "/fs" || yol.startsWith("/fs/")) {
        try {
          await pencere.navigate(pencere.url);
        } catch {
          /* bu pencere yenilenemedi; sayfa kendi kontrolüyle yakalar */
        }
      }
    }
  } catch {
    /* yenileme opsiyonel; önbellek işlevi etkilenmesin */
  }
}

self.addEventListener("fetch", (event) => {
  const istek = event.request;
  if (istek.method !== "GET") return;

  const url = new URL(istek.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/videos/")) return;

  event.respondWith(onbellektenYaDaAgdan(istek));
});

async function onbellektenYaDaAgdan(istek) {
  try {
    const cache = await caches.open(MEDYA_CACHE);
    // Range başlığı eşleşmeyi etkilemesin diye yalnızca URL ile ara
    const kayitli = await cache.match(istek.url);
    if (kayitli) return parcaliYanit(istek, kayitli);
  } catch {
    /* önbellek okunamadı — ağa düş */
  }
  return fetch(istek);
}

/**
 * <video> öğesi dosyayı parça parça ister ("Range: bytes=0-"). Önbellekte tam
 * dosya duruyor; istenen aralığı kesip 206 yanıtı olarak döndürüyoruz.
 * Blob disk üzerinde tutulduğu için 80 MB'lık dosya belleğe yüklenmez,
 * slice() yalnızca istenen kısmı okur.
 */
async function parcaliYanit(istek, kayitli) {
  const aralik = istek.headers.get("range");
  if (!aralik) return kayitli;

  const govde = await kayitli.blob();
  const boyut = govde.size;
  const tur = kayitli.headers.get("content-type") || "application/octet-stream";

  const m = /^bytes=(\d*)-(\d*)$/.exec(aralik.trim());
  if (!m || (m[1] === "" && m[2] === "")) return gecersizAralik(boyut);

  let bas;
  let son;
  if (m[1] === "") {
    // "bytes=-500": son 500 bayt
    bas = Math.max(0, boyut - Number(m[2]));
    son = boyut - 1;
  } else {
    bas = Number(m[1]);
    son = m[2] === "" ? boyut - 1 : Math.min(Number(m[2]), boyut - 1);
  }
  if (bas >= boyut || bas > son) return gecersizAralik(boyut);

  const parca = govde.slice(bas, son + 1, tur);
  return new Response(parca, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": tur,
      "Content-Length": String(parca.size),
      "Content-Range": `bytes ${bas}-${son}/${boyut}`,
      "Accept-Ranges": "bytes",
    },
  });
}

function gecersizAralik(boyut) {
  return new Response(null, {
    status: 416,
    statusText: "Range Not Satisfiable",
    headers: { "Content-Range": `bytes */${boyut}` },
  });
}
