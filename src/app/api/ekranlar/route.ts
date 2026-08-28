import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { listAssignments, listBranches, listScreens } from "@/lib/db/queries";
import { dbConfigured } from "@/lib/db";
import { lookupIps } from "@/lib/ipLookup";
import { listPoolVideos } from "@/lib/videoPool";

export const dynamic = "force-dynamic";

/** Panelin canli veri kaynagi — sifreli oturum gerektirir. */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "yetkisiz" }, { status: 401 });
  }

  if (!dbConfigured()) {
    return NextResponse.json({
      ok: true,
      dbYok: true,
      now: Date.now(),
      ekranlar: [],
      subeler: [],
      havuz: await listPoolVideos(),
      atamalar: {},
      geo: {},
    });
  }

  try {
    const [ekranlar, subeler, havuz, atamalar] = await Promise.all([
      listScreens(),
      listBranches(),
      listPoolVideos(),
      listAssignments(),
    ]);

    const geo = await lookupIps(ekranlar.map((e) => e.ip ?? ""));

    return NextResponse.json({
      ok: true,
      dbYok: false,
      now: Date.now(),
      ekranlar,
      subeler,
      havuz,
      atamalar,
      geo,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "veritabani", detay: String(err) },
      { status: 503 }
    );
  }
}
