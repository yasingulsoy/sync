import { and, asc, desc, eq, sql as raw } from "drizzle-orm";
import { ipMatches } from "@/lib/screenGroups";
import { getDb } from "./index";
import { ekranKaydi, subeIpleri, subeler, videoAtamalari } from "./schema";

export type SubeOzet = {
  id: number;
  kod: string;
  ad: string;
  aktif: boolean;
  ipler: { id: number; ip: string; aciklama: string | null }[];
  videoSayisi: number;
};

/* ------------------------------------------------------------------ */
/* Şubeler                                                             */
/* ------------------------------------------------------------------ */

export async function listBranches(): Promise<SubeOzet[]> {
  const db = getDb();
  if (!db) return [];

  const [rows, ips, counts] = await Promise.all([
    db.select().from(subeler).orderBy(asc(subeler.ad)),
    db.select().from(subeIpleri).orderBy(asc(subeIpleri.ip)),
    db
      .select({ subeId: videoAtamalari.subeId, adet: raw<number>`count(*)::int` })
      .from(videoAtamalari)
      .groupBy(videoAtamalari.subeId),
  ]);

  const ipsBySube = new Map<
    number,
    { id: number; ip: string; aciklama: string | null }[]
  >();
  for (const r of ips) {
    const arr = ipsBySube.get(r.subeId);
    const item = { id: r.id, ip: r.ip, aciklama: r.aciklama };
    if (arr) arr.push(item);
    else ipsBySube.set(r.subeId, [item]);
  }

  const countBySube = new Map(counts.map((c) => [c.subeId, Number(c.adet)]));

  return rows.map((s) => ({
    id: s.id,
    kod: s.kod,
    ad: s.ad,
    aktif: s.aktif,
    ipler: ipsBySube.get(s.id) ?? [],
    videoSayisi: countBySube.get(s.id) ?? 0,
  }));
}

export async function createBranch(kod: string, ad: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("veritabani_yok");
  await db.insert(subeler).values({ kod, ad });
}

export async function renameBranch(id: number, ad: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("veritabani_yok");
  await db.update(subeler).set({ ad }).where(eq(subeler.id, id));
}

export async function deleteBranch(id: number): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("veritabani_yok");
  await db.delete(subeler).where(eq(subeler.id, id));
}

export async function addBranchIp(subeId: number, ip: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("veritabani_yok");
  await db.insert(subeIpleri).values({ subeId, ip });
}

export async function removeBranchIp(id: number): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("veritabani_yok");
  await db.delete(subeIpleri).where(eq(subeIpleri.id, id));
}

/* ------------------------------------------------------------------ */
/* Tik atamaları                                                       */
/* ------------------------------------------------------------------ */

/** dosya -> o dosyanın tikli olduğu şube id'leri */
export async function listAssignments(): Promise<Record<string, number[]>> {
  const db = getDb();
  if (!db) return {};
  const rows = await db.select().from(videoAtamalari);
  const out: Record<string, number[]> = {};
  for (const r of rows) {
    (out[r.dosya] ??= []).push(r.subeId);
  }
  return out;
}

export async function setAssignment(
  subeId: number,
  dosya: string,
  isaretli: boolean
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("veritabani_yok");
  if (isaretli) {
    await db.insert(videoAtamalari).values({ subeId, dosya }).onConflictDoNothing();
  } else {
    await db
      .delete(videoAtamalari)
      .where(and(eq(videoAtamalari.subeId, subeId), eq(videoAtamalari.dosya, dosya)));
  }
}

/** Bir videoyu tüm şubelerde aç / kapat */
export async function setAssignmentForAll(
  dosya: string,
  isaretli: boolean
): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("veritabani_yok");
  if (!isaretli) {
    await db.delete(videoAtamalari).where(eq(videoAtamalari.dosya, dosya));
    return;
  }
  const hepsi = await db.select({ id: subeler.id }).from(subeler);
  if (hepsi.length === 0) return;
  await db
    .insert(videoAtamalari)
    .values(hepsi.map((s) => ({ subeId: s.id, dosya })))
    .onConflictDoNothing();
}

/* ------------------------------------------------------------------ */
/* Ekranın hangi şubeye ait olduğunu çözme                             */
/* ------------------------------------------------------------------ */

export type Cozum = {
  sube: { id: number; kod: string; ad: string } | null;
  kaynak: "ip" | "url" | "yok";
};

export async function resolveScreen(ip: string, urlKodu: string): Promise<Cozum> {
  const db = getDb();
  if (!db) return { sube: null, kaynak: "yok" };

  // URL ile verilen şube kodu IP kuralını ezer
  if (urlKodu) {
    const [s] = await db.select().from(subeler).where(eq(subeler.kod, urlKodu)).limit(1);
    if (s) return { sube: { id: s.id, kod: s.kod, ad: s.ad }, kaynak: "url" };
  }

  if (!ip) return { sube: null, kaynak: "yok" };

  // Kural sayısı az; CIDR mantığı tek yerde kalsın diye eşleştirme JS tarafında
  const kurallar = await db
    .select({ subeId: subeIpleri.subeId, ip: subeIpleri.ip })
    .from(subeIpleri);

  const eslesen = kurallar.find((k) => ipMatches(ip, k.ip));
  if (!eslesen) return { sube: null, kaynak: "yok" };

  const [s] = await db
    .select()
    .from(subeler)
    .where(eq(subeler.id, eslesen.subeId))
    .limit(1);
  if (!s || !s.aktif) return { sube: null, kaynak: "yok" };

  return { sube: { id: s.id, kod: s.kod, ad: s.ad }, kaynak: "ip" };
}

/** Şubeye atanmış videolar. Hiç atama yoksa null döner (çağıran havuzun tamamını oynatır). */
export async function playlistFor(subeId: number): Promise<string[] | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db
    .select({ dosya: videoAtamalari.dosya })
    .from(videoAtamalari)
    .where(eq(videoAtamalari.subeId, subeId))
    .orderBy(asc(videoAtamalari.sira), asc(videoAtamalari.dosya));
  return rows.length ? rows.map((r) => r.dosya) : null;
}

/* ------------------------------------------------------------------ */
/* Ekran kaydı (kalıcı — deploy'da sıfırlanmaz)                        */
/* ------------------------------------------------------------------ */

export type EkranSatiri = {
  cihazId: string;
  ip: string | null;
  subeId: number | null;
  subeAdi: string | null;
  kaynak: string | null;
  sonVideo: string | null;
  sira: number;
  toplam: number;
  userAgent: string | null;
  ilkGorulme: string;
  sonSinyal: string;
};

export async function touchScreen(input: {
  cihazId: string;
  ip: string;
  subeId: number | null;
  kaynak: string;
  userAgent: string;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .insert(ekranKaydi)
    .values({
      cihazId: input.cihazId,
      ip: input.ip,
      subeId: input.subeId,
      kaynak: input.kaynak,
      userAgent: input.userAgent,
    })
    .onConflictDoUpdate({
      target: ekranKaydi.cihazId,
      set: {
        ip: input.ip,
        subeId: input.subeId,
        kaynak: input.kaynak,
        userAgent: input.userAgent,
        sonSinyal: new Date(),
      },
    });
}

export async function beatScreen(input: {
  cihazId: string;
  sonVideo: string | null;
  sira: number;
  toplam: number;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .update(ekranKaydi)
    .set({
      sonVideo: input.sonVideo,
      sira: input.sira,
      toplam: input.toplam,
      sonSinyal: new Date(),
    })
    .where(eq(ekranKaydi.cihazId, input.cihazId));
}

export async function listScreens(): Promise<EkranSatiri[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      cihazId: ekranKaydi.cihazId,
      ip: ekranKaydi.ip,
      subeId: ekranKaydi.subeId,
      subeAdi: subeler.ad,
      kaynak: ekranKaydi.kaynak,
      sonVideo: ekranKaydi.sonVideo,
      sira: ekranKaydi.sira,
      toplam: ekranKaydi.toplam,
      userAgent: ekranKaydi.userAgent,
      ilkGorulme: ekranKaydi.ilkGorulme,
      sonSinyal: ekranKaydi.sonSinyal,
    })
    .from(ekranKaydi)
    .leftJoin(subeler, eq(subeler.id, ekranKaydi.subeId))
    .orderBy(desc(ekranKaydi.sonSinyal));

  return rows.map((r) => ({
    ...r,
    ilkGorulme: r.ilkGorulme.toISOString(),
    sonSinyal: r.sonSinyal.toISOString(),
  }));
}

export async function forgetScreen(cihazId: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("veritabani_yok");
  await db.delete(ekranKaydi).where(eq(ekranKaydi.cihazId, cihazId));
}
