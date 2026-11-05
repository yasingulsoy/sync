import { lookupIps } from "@/lib/ipLookup";
import { sunucuSurumu } from "@/lib/surum";
import { listPoolMedia } from "@/lib/videoPool";
import { istanbulBugun, type YayinAraligi } from "@/lib/yayin";
import { dbConfigured, dbHataMesaji } from "./index";
import {
  listAssignments,
  listBranches,
  listMediaSchedules,
  listScreens,
  type EkranSatiri,
  type SubeOzet,
} from "./queries";

/** Bu kadar gündür sinyal vermeyen cihaz panelde varsayılan olarak gizlenir */
export const ESKI_KAYIT_GUN = 7;

export type PanelVerisi = {
  ok: boolean;
  dbYok: boolean;
  now: number;
  /** İstanbul'a göre bugün; yayın tarihleri buna göre değerlendirilir */
  bugun: string;
  /** Sunucudaki derleme; kiosklarınkiyle karşılaştırılıp eskiler işaretlenir */
  surum: string;
  ekranlar: EkranSatiri[];
  subeler: SubeOzet[];
  havuz: string[];
  boyutlar: Record<string, number>;
  atamalar: Record<string, number[]>;
  takvim: Record<string, YayinAraligi>;
  geo: Record<string, { city: string; region: string; country: string; isp: string }>;
  hata?: string;
};

/**
 * Panelin tek veri kaynağı. Hem sayfanın ilk render'ı (sunucuda) hem de
 * /api/ekranlar (istemci yenilemeleri) buradan beslenir; iki yerde ayrı
 * toplama mantığı olmasın diye.
 */
export async function getPanelData(): Promise<PanelVerisi> {
  const medya = await listPoolMedia();
  const havuz = medya.map((m) => m.dosya);
  const boyutlar = Object.fromEntries(medya.map((m) => [m.dosya, m.boyut]));

  const bos: PanelVerisi = {
    ok: true,
    dbYok: true,
    now: Date.now(),
    bugun: istanbulBugun(),
    surum: sunucuSurumu(),
    ekranlar: [],
    subeler: [],
    havuz,
    boyutlar,
    atamalar: {},
    takvim: {},
    geo: {},
  };

  if (!dbConfigured()) return bos;

  try {
    const [ekranlar, subeler, atamalar, takvim] = await Promise.all([
      listScreens(),
      listBranches(),
      listAssignments(),
      listMediaSchedules(),
    ]);

    // Konum sorgusu kotalı (ipwho.is); yalnızca güncel cihazlar için harca
    const sinir = Date.now() - ESKI_KAYIT_GUN * 86_400_000;
    const guncelIpler = ekranlar
      .filter((e) => new Date(e.sonSinyal).getTime() > sinir)
      .map((e) => e.ip ?? "");
    const geo = await lookupIps(guncelIpler);

    return {
      ...bos,
      dbYok: false,
      now: Date.now(),
      ekranlar,
      subeler,
      atamalar,
      takvim,
      geo,
    };
  } catch (err) {
    return { ...bos, ok: false, dbYok: false, hata: dbHataMesaji(err) };
  }
}
