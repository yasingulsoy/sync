import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { lookupIps } from "@/lib/ipLookup";
import { SCREEN_GROUPS } from "@/lib/screenGroups";
import { listScreens } from "@/lib/screenRegistry";

export const dynamic = "force-dynamic";

/** Panelin canli veri kaynagi — sifreli oturum gerektirir. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "yetkisiz" }, { status: 401 });
  }

  const screens = listScreens();
  // Hangi IP'nin hangi sube oldugunu ayirt edebilmek icin sehir/operator bilgisi
  const geo = await lookupIps(screens.map((s) => s.ip));

  return NextResponse.json({
    ok: true,
    now: Date.now(),
    screens,
    groups: SCREEN_GROUPS,
    geo,
  });
}
