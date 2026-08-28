import { readdir } from "fs/promises";
import path from "path";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { clientIpFrom } from "@/lib/clientIp";
import {
  DEFAULT_GROUP,
  SHARED_GROUP,
  groupForIp,
  isValidGroupName,
  labelForGroup,
} from "@/lib/screenGroups";
import { touchScreen, type ScreenSource } from "@/lib/screenRegistry";

export const dynamic = "force-dynamic";

const VIDEO_EXT = new Set([".mp4", ".webm", ".ogg", ".mov", ".m4v", ".mkv"]);
const VIDEO_ROOT = path.join(process.cwd(), "public", "videos");

/** Bir klasordeki videolari "<grup>/<dosya>" biciminde dondurur. Klasor yoksa bos dizi. */
async function listFolder(folder: string): Promise<string[]> {
  const dir = folder ? path.join(VIDEO_ROOT, folder) : VIDEO_ROOT;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && VIDEO_EXT.has(path.extname(e.name).toLowerCase()))
      .map((e) => (folder ? `${folder}/${e.name}` : e.name))
      .sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const h = await headers();
  const { ip, via } = clientIpFrom(h);
  const url = new URL(request.url);

  // URL ile verilen grup IP kuralini ezer (bir subenin IP'si degistiginde
  // deploy beklemeden o ekrani duzeltebilmek icin).
  const override = url.searchParams.get("grup")?.trim() ?? "";
  let group: string;
  let source: ScreenSource;

  if (override && isValidGroupName(override)) {
    group = override;
    source = "url";
  } else {
    const match = groupForIp(ip);
    group = match.group;
    source = match.matched ? "ip" : "default";
  }

  const [shared, own] = await Promise.all([
    listFolder(SHARED_GROUP),
    listFolder(group),
  ]);

  let videos = [...shared, ...own];

  // Grup klasoru bos veya yoksa ekran siyah kalmasin — koke dus.
  let usedFallback = false;
  if (videos.length === 0 && group !== DEFAULT_GROUP) {
    videos = await listFolder(DEFAULT_GROUP);
    usedFallback = videos.length > 0;
  }

  const screenId = url.searchParams.get("id")?.trim() ?? "";
  if (screenId) {
    touchScreen({
      id: screenId.slice(0, 64),
      ip,
      via,
      group,
      label: source === "url" ? group : labelForGroup(group),
      source,
      userAgent: h.get("user-agent")?.slice(0, 200) ?? "",
      now: Date.now(),
    });
  }

  return NextResponse.json({
    videos,
    group,
    label: source === "url" ? group : labelForGroup(group),
    source,
    usedFallback,
    ip,
  });
}
