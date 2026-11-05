import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/clientIp";
import {
  listMediaSchedules,
  playlistFor,
  resolveScreen,
  touchScreen,
} from "@/lib/db/queries";
import { isValidGroupName } from "@/lib/screenGroups";
import { sunucuSurumu } from "@/lib/surum";
import { listPoolMedia } from "@/lib/videoPool";
import { istanbulBugun, yayinDurumu, type YayinAraligi } from "@/lib/yayin";

/** Arama motoru botları /fs'i tarayıp panelde sahte ekran olarak görünüyordu */
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit/i;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const h = await headers();
  const { ip } = clientIpFrom(h);
  const url = new URL(request.url);

  const override = url.searchParams.get("grup")?.trim() ?? "";
  const urlKodu = override && isValidGroupName(override) ? override : "";

  const havuzMedya = await listPoolMedia();

  // Yayın tarihi dışındaki medya her yerden düşer: atamalardan da, şubesi
  // belirlenmemiş ekranların oynattığı havuzdan da. Veritabanına
  // ulaşılamazsa tarihler bilinemez; o durumda ekran siyah kalmasın diye
  // havuzun tamamı yayında sayılır.
  let takvim: Record<string, YayinAraligi> = {};
  try {
    takvim = await listMediaSchedules();
  } catch {
    takvim = {};
  }
  const bugun = istanbulBugun();
  const havuz = havuzMedya
    .map((m) => m.dosya)
    .filter((f) => yayinDurumu(takvim[f], bugun) === "yayinda");

  let videos = havuz;
  let sube: { id: number; kod: string; ad: string } | null = null;
  let kaynak: string = "yok";
  let atamaVar = false;
  let dbHatasi = false;

  try {
    const cozum = await resolveScreen(ip, urlKodu);
    sube = cozum.sube;
    kaynak = cozum.kaynak;

    if (sube) {
      const atanan = await playlistFor(sube.id);
      if (atanan) {
        // Panelde tikli ama diskten silinmis dosyalari ele — ekran 404'e dusmesin
        const secilen = atanan.filter((f) => havuz.includes(f));
        if (secilen.length > 0) {
          videos = secilen;
          atamaVar = true;
        }
      }
    }
  } catch {
    // Veritabanina ulasilamiyorsa ekran siyah kalmasin: havuzun tamami oynar
    dbHatasi = true;
  }

  const cihazId = url.searchParams.get("id")?.trim().slice(0, 64) ?? "";
  const userAgent = h.get("user-agent") ?? "";
  if (cihazId && !BOT_RE.test(userAgent)) {
    try {
      await touchScreen({
        cihazId,
        ip,
        subeId: sube?.id ?? null,
        kaynak,
        userAgent: userAgent.slice(0, 200),
      });
    } catch {
      /* kayit tutulamadi; yayin etkilenmesin */
    }
  }

  const boyutlar: Record<string, number> = {};
  for (const m of havuzMedya) if (videos.includes(m.dosya)) boyutlar[m.dosya] = m.boyut;

  return NextResponse.json({
    videos,
    // Ekran önbelleğinin güncel olup olmadığını anlamak için. "videos" alanı
    // bilerek string dizisi kaldı: deploy anında açık eski sayfalar bozulmasın.
    boyutlar,
    // Değiştiğini gören kiosk iki video arasında kendini yeniler (yeni deploy)
    surum: sunucuSurumu(),
    sube: sube ? { kod: sube.kod, ad: sube.ad } : null,
    kaynak,
    atamaVar,
    dbHatasi,
    ip,
  }, {
    // Bir ara katman (Cloudflare "cache everything" kuralı vb.) bunu önbelleğe
    // alırsa kiosklar eski/yeni sürüm arasında gidip gelir; açıkça yasakla.
    headers: { "Cache-Control": "no-store" },
  });
}
