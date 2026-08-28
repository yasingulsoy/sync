import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { getPanelData } from "@/lib/db/panelData";

export const dynamic = "force-dynamic";

/** Panelin canli veri kaynagi — sifreli oturum gerektirir. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "yetkisiz" }, { status: 401 });
  }
  const veri = await getPanelData();
  return NextResponse.json(veri, { status: veri.ok ? 200 : 503 });
}
