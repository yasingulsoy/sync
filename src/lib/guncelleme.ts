/**
 * Kiosk otomatik güncelleme.
 *
 * Sayfa, açıldıktan sonra sunucudan aldığı ilk sürümü hatırlar. Sonraki
 * liste yanıtlarından birinde sürüm değişmişse (yeni deploy) yenileme
 * planlanır ve bir sonraki medya geçişinde yapılır — oynayan video ortada
 * kesilmez. Medya diskte olduğu için yenileme bir iki saniye sürer.
 *
 * Korumalar (bir hata bütün kioskları döngüye sokmasın diye):
 *  - İki yenileme arasında en az SOGUMA_MS geçer (sessionStorage'da tutulur).
 *  - Yenilemeden önce sayfanın sunucuda açıldığı doğrulanır; sunucu o an
 *    ayakta değilse Chrome hata sayfasında kalırdı, onun yerine beklenir.
 *  - Geçiş hiç olmazsa (tek video döngüde) en geç BEKLEME_MS sonra yenilenir.
 */

const BEKLEME_MS = 10 * 60_000;
const SOGUMA_MS = 10 * 60_000;
const TEKRAR_MS = 60_000;
const ANAHTAR = "hospisync-son-yenileme";

let ilkSurum: string | null = null;
let bekliyor = false;
let calisiyor = false;
let zamanlayici: number | undefined;

/** Bu sayfanın çalıştırdığı sürüm (panele bildirilir). Henüz bilinmiyorsa null. */
export function kioskSurumu(): string | null {
  return ilkSurum;
}

export function yenilemeBekliyor(): boolean {
  return bekliyor;
}

/** Her liste yanıtındaki sürüm buraya verilir. */
export function surumGeldi(surum: unknown): void {
  if (typeof surum !== "string" || !surum) return;
  if (ilkSurum === null) {
    ilkSurum = surum;
    return;
  }
  if (surum === ilkSurum || bekliyor) return;

  bekliyor = true;
  planla(BEKLEME_MS);
}

function planla(ms: number): void {
  window.clearTimeout(zamanlayici);
  zamanlayici = window.setTimeout(() => void yenile(), ms);
}

/**
 * Yenilemeyi dener. Sayfa yenileniyorsa true döner; şu an olmuyorsa false
 * döner ve çağıran oynatmaya devam etmelidir (sonra tekrar denenir).
 */
export async function yenile(): Promise<boolean> {
  if (!bekliyor || calisiyor) return false;
  calisiyor = true;
  try {
    let son = 0;
    try {
      son = Number(sessionStorage.getItem(ANAHTAR) || 0);
    } catch {
      /* sessionStorage kapalı: soğuma süresi uygulanamaz, yine de devam */
    }
    const gecen = Date.now() - son;
    if (gecen < SOGUMA_MS) {
      planla(SOGUMA_MS - gecen);
      return false;
    }

    // HEAD yerine GET: her sunucu/proxy HEAD'i sayfa için desteklemeyebilir
    const yanit = await fetch(location.href, { cache: "no-store" });
    if (!yanit.ok) {
      planla(TEKRAR_MS);
      return false;
    }

    try {
      sessionStorage.setItem(ANAHTAR, String(Date.now()));
    } catch {
      /* yok say */
    }
    window.clearTimeout(zamanlayici);
    location.reload();
    return true;
  } catch {
    // Ağ yok — sonra tekrar dene, bu arada oynatma sürsün
    planla(TEKRAR_MS);
    return false;
  } finally {
    calisiyor = false;
  }
}
