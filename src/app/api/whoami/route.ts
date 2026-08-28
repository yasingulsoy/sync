import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { IP_HEADERS, clientIpFrom } from "@/lib/clientIp";
import { groupForIp } from "@/lib/screenGroups";

export const dynamic = "force-dynamic";

/**
 * Teshis ucu: bir ekranda acildiginda o cihazin sunucuya hangi IP ile
 * gorundugunu ve hangi gruba dustugunu gosterir.
 * Ornek: hospisync.cloud/api/whoami
 */
export async function GET() {
  const h = await headers();
  const { ip, via } = clientIpFrom(h);
  const match = groupForIp(ip);

  const raw: Record<string, string | null> = {};
  for (const name of IP_HEADERS) raw[name] = h.get(name);

  return NextResponse.json({
    ip,
    via,
    group: match.group || "(varsayilan)",
    label: match.label,
    matched: match.matched,
    userAgent: h.get("user-agent") ?? "",
    headers: raw,
  });
}
