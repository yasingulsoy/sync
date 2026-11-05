"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  adminKeyConfigured,
  clearLoginAttempts,
  endAdminSession,
  isAdmin,
  loginThrottled,
  noteFailedLogin,
  passwordMatches,
  startAdminSession,
} from "@/lib/adminAuth";
import { clientIpFrom } from "@/lib/clientIp";
import {
  addBranchIp,
  createBranch,
  deleteBranch,
  deleteStaleScreens,
  forgetScreen,
  removeBranchIp,
  renameBranch,
  setAssignment,
  setAssignmentForAll,
  setMediaSchedule,
} from "@/lib/db/queries";
import { isValidGroupName, isValidIpRule } from "@/lib/screenGroups";
import { listPoolVideos } from "@/lib/videoPool";
import { gecerliTarih } from "@/lib/yayin";

/* ------------------------------------------------------------------ */
/* Oturum                                                              */
/* ------------------------------------------------------------------ */

export type LoginState = { error: string | null };

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  if (!adminKeyConfigured()) {
    return { error: "Sunucuda SIGNAGE_ADMIN_KEY tanımlı değil; panel kapalı." };
  }

  const h = await headers();
  const { ip } = clientIpFrom(h);
  const now = Date.now();

  if (loginThrottled(ip, now)) {
    return { error: "Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin." };
  }

  const password = String(formData.get("sifre") ?? "");
  if (!passwordMatches(password)) {
    noteFailedLogin(ip, now);
    return { error: "Şifre hatalı." };
  }

  clearLoginAttempts(ip);
  await startAdminSession();
  redirect("/ekranlar");
}

export async function logoutAction(): Promise<void> {
  await endAdminSession();
  redirect("/ekranlar");
}

/* ------------------------------------------------------------------ */
/* Yönetim işlemleri                                                   */
/*                                                                     */
/* Server action'lara doğrudan POST atılabildiği için her birinde       */
/* yetki kontrolü ayrıca yapılır.                                       */
/* ------------------------------------------------------------------ */

export type IslemSonucu = { hata: string | null };

const OK: IslemSonucu = { hata: null };

async function yetkiVar(): Promise<boolean> {
  return isAdmin();
}

export async function subeEkleAction(
  _prev: IslemSonucu,
  formData: FormData
): Promise<IslemSonucu> {
  if (!(await yetkiVar())) return { hata: "Yetkisiz." };

  const kod = String(formData.get("kod") ?? "").trim().toLowerCase();
  const ad = String(formData.get("ad") ?? "").trim();

  if (!isValidGroupName(kod)) {
    return {
      hata: "Kod yalnızca harf, rakam, tire ve alt çizgi içerebilir (örn. camlica).",
    };
  }
  if (!ad) return { hata: "Şube adı boş olamaz." };

  try {
    await createBranch(kod, ad);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { hata: `"${kod}" kodu zaten kullanılıyor.` };
    }
    return { hata: "Şube eklenemedi." };
  }
  return OK;
}

export async function subeSilAction(subeId: number): Promise<IslemSonucu> {
  if (!(await yetkiVar())) return { hata: "Yetkisiz." };
  try {
    await deleteBranch(subeId);
  } catch {
    return { hata: "Şube silinemedi." };
  }
  return OK;
}

export async function subeAdiDegistirAction(
  subeId: number,
  ad: string
): Promise<IslemSonucu> {
  if (!(await yetkiVar())) return { hata: "Yetkisiz." };
  const yeni = ad.trim();
  if (!yeni) return { hata: "Şube adı boş olamaz." };
  try {
    await renameBranch(subeId, yeni);
  } catch {
    return { hata: "Ad değiştirilemedi." };
  }
  return OK;
}

export async function ipEkleAction(
  subeId: number,
  ip: string
): Promise<IslemSonucu> {
  if (!(await yetkiVar())) return { hata: "Yetkisiz." };

  const deger = ip.trim();
  if (!isValidIpRule(deger)) {
    return { hata: "Geçersiz IP. Örnek: 88.123.45.67 veya 88.123.45.0/24" };
  }

  try {
    await addBranchIp(subeId, deger);
  } catch (e) {
    const msg = String(e);
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { hata: `${deger} zaten başka bir şubeye tanımlı.` };
    }
    return { hata: "IP eklenemedi." };
  }
  return OK;
}

export async function ipSilAction(ipId: number): Promise<IslemSonucu> {
  if (!(await yetkiVar())) return { hata: "Yetkisiz." };
  try {
    await removeBranchIp(ipId);
  } catch {
    return { hata: "IP silinemedi." };
  }
  return OK;
}

export async function atamaDegistirAction(
  subeId: number,
  dosya: string,
  isaretli: boolean
): Promise<IslemSonucu> {
  if (!(await yetkiVar())) return { hata: "Yetkisiz." };
  try {
    await setAssignment(subeId, dosya, isaretli);
  } catch {
    return { hata: "Kaydedilemedi." };
  }
  return OK;
}

export async function tumSubelerdeAction(
  dosya: string,
  isaretli: boolean
): Promise<IslemSonucu> {
  if (!(await yetkiVar())) return { hata: "Yetkisiz." };
  try {
    await setAssignmentForAll(dosya, isaretli);
  } catch {
    return { hata: "Kaydedilemedi." };
  }
  return OK;
}

export async function ekranUnutAction(cihazId: string): Promise<IslemSonucu> {
  if (!(await yetkiVar())) return { hata: "Yetkisiz." };
  try {
    await forgetScreen(cihazId);
  } catch {
    return { hata: "Kayıt silinemedi." };
  }
  return OK;
}

/**
 * Medyanın yayın tarihlerini kaydeder. Boş bırakılan uç sınırsızdır;
 * ikisi de boşsa medya süresiz yayına döner.
 */
export async function medyaTakvimAction(
  dosya: string,
  baslangic: string,
  bitis: string
): Promise<IslemSonucu> {
  if (!(await yetkiVar())) return { hata: "Yetkisiz." };

  // Yalnızca havuzda gerçekten olan dosyalar için satır açılsın
  const havuz = await listPoolVideos();
  if (!havuz.includes(dosya)) return { hata: "Dosya havuzda yok." };

  const b = baslangic.trim() || null;
  const s = bitis.trim() || null;
  if ((b && !gecerliTarih(b)) || (s && !gecerliTarih(s))) {
    return { hata: "Geçersiz tarih." };
  }
  if (b && s && b > s) return { hata: "Bitiş, başlangıçtan önce olamaz." };

  try {
    await setMediaSchedule(dosya, { baslangic: b, bitis: s });
  } catch {
    return { hata: "Kaydedilemedi." };
  }
  return OK;
}

/** Uzun süredir sinyal vermeyen cihaz kayıtlarını (bozuk kopyalar, botlar) siler */
export async function eskiKayitlariSilAction(gun: number): Promise<IslemSonucu & { silinen?: number }> {
  if (!(await yetkiVar())) return { hata: "Yetkisiz." };
  const sinir = Number.isInteger(gun) && gun >= 1 ? gun : 30;
  try {
    const silinen = await deleteStaleScreens(sinir);
    return { hata: null, silinen };
  } catch {
    return { hata: "Silinemedi." };
  }
}
