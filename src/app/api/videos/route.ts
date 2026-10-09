import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/clientIp";
import { playlistFor, resolveScreen, touchScreen } from "@/lib/db/queries";
import { isValidGroupName } from "@/lib/screenGroups";
import { listPoolMedia } from "@/lib/videoPool";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const h = await headers();
  const { ip } = clientIpFrom(h);
  const url = new URL(request.url);

  const override = url.searchParams.get("grup")?.trim() ?? "";
  const urlKodu = override && isValidGroupName(override) ? override : "";

  const havuzMedya = await listPoolMedia();
  const havuz = havuzMedya.map((m) => m.dosya);

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
  if (cihazId) {
    try {
      await touchScreen({
        cihazId,
        ip,
        subeId: sube?.id ?? null,
        kaynak,
        userAgent: h.get("user-agent")?.slice(0, 200) ?? "",
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
    sube: sube ? { kod: sube.kod, ad: sube.ad } : null,
    kaynak,
    atamaVar,
    dbHatasi,
    ip,
  });
}
