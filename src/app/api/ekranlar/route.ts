import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { SCREEN_GROUPS } from "@/lib/screenGroups";
import { listScreens } from "@/lib/screenRegistry";

export const dynamic = "force-dynamic";

/** Panelin canli veri kaynagi — sifreli oturum gerektirir. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "yetkisiz" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    now: Date.now(),
    screens: listScreens(),
    groups: SCREEN_GROUPS,
  });
}
