import { readdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const IMAGE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
]);

export async function GET() {
  const dir = path.join(process.cwd(), "public", "images");
  try {
    const files = await readdir(dir);
    const images = files
      .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] as string[] });
  }
}
