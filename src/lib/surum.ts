import { readFileSync } from "fs";
import path from "path";

/**
 * Sunucuda çalışan derlemenin kimliği. Kiosklar bunu liste yanıtında alır;
 * değiştiğini görünce (yeni deploy) iki video arasında kendini yeniler.
 *
 * Next'in her derlemede ürettiği .next/BUILD_ID kullanılır: aynı derleme
 * yeniden başlatılırsa değişmez, yani konteyner yeniden başladı diye bütün
 * kiosklar boşuna yenilenmez. Okunamazsa süreç başlangıç zamanına düşülür.
 *
 * globalThis'te tutuluyor: her route kendi modül kopyasını yüklese de
 * hepsi aynı değeri görsün (panel kioskların sürümünü bununla karşılaştırıyor).
 */

const store = globalThis as unknown as { __signageSurum?: string };

export function sunucuSurumu(): string {
  if (store.__signageSurum) return store.__signageSurum;

  let surum = "";
  try {
    surum = readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    /* geliştirme ortamı veya farklı çıktı yapısı */
  }
  store.__signageSurum = surum || `t${Date.now().toString(36)}`;
  return store.__signageSurum;
}
