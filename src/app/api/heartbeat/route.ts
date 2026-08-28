import { NextResponse } from "next/server";
import { beatScreen } from "@/lib/screenRegistry";

export const dynamic = "force-dynamic";

function asCount(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
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
  };

  const id = typeof b.id === "string" ? b.id.trim().slice(0, 64) : "";
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  // Kayit yoksa (sunucu yeniden baslamis) ekran listeyi tekrar cekip kaydolsun.
  const known = beatScreen({
    id,
    current: typeof b.current === "string" ? b.current.slice(0, 300) : null,
    index: asCount(b.index),
    total: asCount(b.total),
    now: Date.now(),
  });

  return NextResponse.json({ ok: true, known });
}
