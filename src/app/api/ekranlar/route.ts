import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { getPanelData } from "@/lib/db/panelData";

export const dynamic = "force-dynamic";

/** Panelin canli veri kaynagi — sifreli oturum gerektirir. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "yetkisiz" }, { status: 401 });
  }
  // Veritabani hatasinda da 200 doner; hata payload icinde gelir ki panel
  // genel bir mesaj yerine asil sebebi gosterebilsin.
  return NextResponse.json(await getPanelData());
}
