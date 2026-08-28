import { lookupIps } from "@/lib/ipLookup";
import { listPoolVideos } from "@/lib/videoPool";
import { dbConfigured, dbHataMesaji } from "./index";
import {
  listAssignments,
  listBranches,
  listScreens,
  type EkranSatiri,
  type SubeOzet,
} from "./queries";

export type PanelVerisi = {
  ok: boolean;
  dbYok: boolean;
  now: number;
  ekranlar: EkranSatiri[];
  subeler: SubeOzet[];
  havuz: string[];
  atamalar: Record<string, number[]>;
  geo: Record<string, { city: string; region: string; country: string; isp: string }>;
  hata?: string;
};

/**
 * Panelin tek veri kaynağı. Hem sayfanın ilk render'ı (sunucuda) hem de
 * /api/ekranlar (istemci yenilemeleri) buradan beslenir; iki yerde ayrı
 * toplama mantığı olmasın diye.
 */
export async function getPanelData(): Promise<PanelVerisi> {
  const havuz = await listPoolVideos();
  const bos: PanelVerisi = {
    ok: true,
    dbYok: true,
    now: Date.now(),
    ekranlar: [],
    subeler: [],
    havuz,
    atamalar: {},
    geo: {},
  };

  if (!dbConfigured()) return bos;

  try {
    const [ekranlar, subeler, atamalar] = await Promise.all([
      listScreens(),
      listBranches(),
      listAssignments(),
    ]);
    const geo = await lookupIps(ekranlar.map((e) => e.ip ?? ""));

    return {
      ok: true,
      dbYok: false,
      now: Date.now(),
      ekranlar,
      subeler,
      havuz,
      atamalar,
      geo,
    };
  } catch (err) {
    return { ...bos, ok: false, dbYok: false, hata: dbHataMesaji(err) };
  }
}
