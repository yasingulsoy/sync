/**
 * Havuzdaki dosya türleri. Hem sunucu (klasör tarama) hem istemci (oynatıcı)
 * aynı listeyi kullansın diye burada duruyor — bu dosya Node API'si kullanmaz.
 */

const VIDEO_EXT = new Set([".mp4", ".webm", ".ogg", ".mov", ".m4v", ".mkv"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

/** Görseller video gibi "bitmediği" için bu süre sonunda sıradakine geçilir */
export const GORSEL_SURESI_MS = 12_000;

function uzanti(ad: string): string {
  const i = ad.lastIndexOf(".");
  return i < 0 ? "" : ad.slice(i).toLowerCase();
}

export function isVideoFile(ad: string): boolean {
  return VIDEO_EXT.has(uzanti(ad));
}

export function isImageFile(ad: string): boolean {
  return IMAGE_EXT.has(uzanti(ad));
}

export function isMediaFile(ad: string): boolean {
  const e = uzanti(ad);
  return VIDEO_EXT.has(e) || IMAGE_EXT.has(e);
}
