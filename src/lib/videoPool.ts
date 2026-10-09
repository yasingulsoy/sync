import { readdir, stat } from "fs/promises";
import path from "path";
import { isMediaFile } from "@/lib/medya";

/**
 * Medya havuzu: public/videos altındaki tüm video ve görsel dosyaları.
 *
 * Klasör bazlı gruplama kaldırıldı — hangi videonun hangi şubede oynayacağı
 * artık panelden tikle belirleniyor. Böylece aynı video birden fazla şubede
 * gösterilirken dosyanın kopyalanması gerekmiyor (videolar 80 MB'a varıyor).
 *
 * Geriye dönük uyumluluk için bir seviye alt klasör de taranır; oradaki
 * dosyalar "klasor/dosya.mp4" olarak havuzda görünür.
 */

const VIDEO_ROOT = path.join(process.cwd(), "public", "videos");

export type MedyaDosyasi = {
  dosya: string;
  /** Bayt cinsinden. Ekranlardaki önbelleğin güncel olup olmadığını bununla anlıyoruz. */
  boyut: number;
};

export async function listPoolMedia(): Promise<MedyaDosyasi[]> {
  const found: string[] = [];

  let entries;
  try {
    entries = await readdir(VIDEO_ROOT, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const e of entries) {
    if (e.isFile() && isMediaFile(e.name)) {
      found.push(e.name);
      continue;
    }
    if (!e.isDirectory()) continue;
    try {
      const inner = await readdir(path.join(VIDEO_ROOT, e.name), {
        withFileTypes: true,
      });
      for (const f of inner) {
        if (f.isFile() && isMediaFile(f.name)) found.push(`${e.name}/${f.name}`);
      }
    } catch {
      /* okunamayan klasörü atla */
    }
  }

  found.sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));

  const sonuc = await Promise.all(
    found.map(async (dosya) => {
      try {
        const s = await stat(path.join(VIDEO_ROOT, dosya));
        return { dosya, boyut: s.size };
      } catch {
        return null;
      }
    })
  );
  return sonuc.filter((x): x is MedyaDosyasi => x !== null);
}

export async function listPoolVideos(): Promise<string[]> {
  return (await listPoolMedia()).map((m) => m.dosya);
}
