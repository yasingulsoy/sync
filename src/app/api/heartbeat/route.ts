import { NextResponse } from "next/server";
import { beatScreen } from "@/lib/db/queries";
import type { VideoTeshis } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function asCount(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0
    ? Math.min(Math.floor(v), 2_000_000_000)
    : 0;
}

/**
 * Bu uç kimlik doğrulamasız (kiosklar çağırıyor), o yüzden teşhis nesnesi
 * olduğu gibi veritabanına yazılmaz: yalnızca bilinen sayısal alanlar,
 * sınırlı sayıda video ve sınırlı uzunlukta dosya adı alınır.
 */
function temizTeshis(v: unknown): Record<string, VideoTeshis> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, VideoTeshis> = {};
  for (const [dosya, deger] of Object.entries(v).slice(0, 50)) {
    if (!dosya || dosya.length > 300 || !deger || typeof deger !== "object") continue;
    const d = deger as Record<string, unknown>;
    out[dosya] = {
      oynatma: asCount(d.oynatma),
      takilma: asCount(d.takilma),
      kare: asCount(d.kare),
      kayip: asCount(d.kayip),
    };
  }
  return Object.keys(out).length ? out : null;
}

/** Ekranlar duzenli olarak "su an sunu oynatiyorum" bilgisini buraya gonderir. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const b = body as {
    id?: unknown;
    current?: unknown;
    index?: unknown;
    total?: unknown;
    onbellek?: { hazir?: unknown; toplam?: unknown };
    takilma?: unknown;
    surum?: unknown;
    calisma?: unknown;
    teshis?: unknown;
  };

  const cihazId = typeof b.id === "string" ? b.id.trim().slice(0, 64) : "";
  if (!cihazId) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    await beatScreen({
      cihazId,
      sonVideo: typeof b.current === "string" ? b.current.slice(0, 300) : null,
      sira: asCount(b.index),
      toplam: asCount(b.total),
      // Eski sayfalar bu alanlari gondermez; 0 / null kaydedilir
      onbellekHazir: asCount(b.onbellek?.hazir),
      onbellekToplam: asCount(b.onbellek?.toplam),
      takilma: asCount(b.takilma),
      surum: typeof b.surum === "string" ? b.surum.slice(0, 64) : null,
      calismaSn: asCount(b.calisma),
      teshis: temizTeshis(b.teshis),
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
