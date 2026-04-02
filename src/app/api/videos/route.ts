import { readdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const VIDEO_EXT = new Set([".mp4", ".webm", ".ogg", ".mov", ".m4v", ".mkv"]);

export async function GET() {
  const dir = path.join(process.cwd(), "public", "videos");
  try {
    const files = await readdir(dir);
    const videos = files
      .filter((f) => VIDEO_EXT.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return NextResponse.json({ videos });
  } catch {
    return NextResponse.json({ videos: [] as string[] });
  }
}
