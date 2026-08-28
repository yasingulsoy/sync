import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { IP_HEADERS, clientIpFrom } from "@/lib/clientIp";
import { resolveScreen } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * Teshis ucu: bir ekranda acildiginda o cihazin sunucuya hangi IP ile
 * gorundugunu ve hangi subeye dustugunu gosterir.
 * Ornek: hospisync.cloud/api/whoami
 */
export async function GET() {
  const h = await headers();
  const { ip, via } = clientIpFrom(h);

  let sube: { kod: string; ad: string } | null = null;
  let kaynak = "yok";
  try {
    const c = await resolveScreen(ip, "");
    sube = c.sube ? { kod: c.sube.kod, ad: c.sube.ad } : null;
    kaynak = c.kaynak;
  } catch {
    kaynak = "veritabani_hatasi";
  }

  const raw: Record<string, string | null> = {};
  for (const name of IP_HEADERS) raw[name] = h.get(name);

  return NextResponse.json({
    ip,
    via,
    sube,
    kaynak,
    userAgent: h.get("user-agent") ?? "",
    headers: raw,
  });
}
