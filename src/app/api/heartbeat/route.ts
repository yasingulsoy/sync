import { NextResponse } from "next/server";
import { beatScreen } from "@/lib/db/queries";

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

  const cihazId = typeof b.id === "string" ? b.id.trim().slice(0, 64) : "";
  if (!cihazId) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    await beatScreen({
      cihazId,
      sonVideo: typeof b.current === "string" ? b.current.slice(0, 300) : null,
      sira: asCount(b.index),
      toplam: asCount(b.total),
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
