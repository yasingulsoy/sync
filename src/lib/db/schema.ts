import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Şube: bir hastane / lokasyon.
 * `kod` hem URL'de (/fs/camlica) hem de panelde kısa ad olarak kullanılır.
 */
export const subeler = pgTable("subeler", {
  id: serial("id").primaryKey(),
  kod: text("kod").notNull().unique(),
  ad: text("ad").notNull(),
  aktif: boolean("aktif").notNull().default(true),
  olusturuldu: timestamp("olusturuldu", { withTimezone: true }).notNull().defaultNow(),
});

/** Şubeye ait dış IP veya CIDR bloğu. Bir IP yalnızca tek şubeye bağlanabilir. */
export const subeIpleri = pgTable("sube_ipleri", {
  id: serial("id").primaryKey(),
  subeId: integer("sube_id")
    .notNull()
    .references(() => subeler.id, { onDelete: "cascade" }),
  ip: text("ip").notNull().unique(),
  aciklama: text("aciklama"),
});

/** Tik: hangi video hangi şubede oynayacak. */
export const videoAtamalari = pgTable(
  "video_atamalari",
  {
    id: serial("id").primaryKey(),
    subeId: integer("sube_id")
      .notNull()
      .references(() => subeler.id, { onDelete: "cascade" }),
    dosya: text("dosya").notNull(),
    sira: integer("sira").notNull().default(0),
  },
  (t) => [unique("video_atamalari_sube_dosya").on(t.subeId, t.dosya)]
);

/**
 * Medyanın yayın tarihleri. Satır yoksa medya süresiz yayındadır.
 * Tarihler İstanbul saatine göre ve iki uç dahil: bitiş günü sonuna kadar oynar.
 * Tarih aralığı dışındaki medya her yerden düşer: atamalardan da, şubesi
 * belirlenmemiş ekranların oynattığı havuzdan da.
 */
export const medyaAyarlari = pgTable("medya_ayarlari", {
  dosya: text("dosya").primaryKey(),
  baslangic: date("baslangic", { mode: "string" }),
  bitis: date("bitis", { mode: "string" }),
  guncellendi: timestamp("guncellendi", { withTimezone: true }).notNull().defaultNow(),
});

/** Ekranın video başına teşhis sayaçları (sayfa açıldığından beri) */
export type VideoTeshis = {
  /** Kaç kez sonuna kadar oynadı */
  oynatma: number;
  /** Oynatma sırasında veri yetişmeyip duraklama sayısı */
  takilma: number;
  /** Çözülen toplam kare / atlanan kare: oran yüksekse cihaz videoyu çözemiyor */
  kare: number;
  kayip: number;
};

/** Ekran kaydı: panel listesi artık deploy'da sıfırlanmasın diye kalıcı. */
export const ekranKaydi = pgTable("ekran_kaydi", {
  cihazId: text("cihaz_id").primaryKey(),
  ip: text("ip"),
  subeId: integer("sube_id").references(() => subeler.id, { onDelete: "set null" }),
  kaynak: text("kaynak"),
  sonVideo: text("son_video"),
  sira: integer("sira").notNull().default(0),
  toplam: integer("toplam").notNull().default(0),
  userAgent: text("user_agent"),
  /** Kiosk diskinde hazır medya sayısı / listedeki toplam */
  onbellekHazir: integer("onbellek_hazir").notNull().default(0),
  onbellekToplam: integer("onbellek_toplam").notNull().default(0),
  /** Sayfa açıldığından beri oynatma sırasında yaşanan takılma sayısı */
  takilma: integer("takilma").notNull().default(0),
  /** Kioskta çalışan sayfanın sürümü; eskiyse panel uyarır */
  surum: text("surum"),
  /** Sayfa kaç saniyedir açık — takılma sayısını saate bölmek için */
  calismaSn: integer("calisma_sn").notNull().default(0),
  teshis: jsonb("teshis").$type<Record<string, VideoTeshis>>(),
  ilkGorulme: timestamp("ilk_gorulme", { withTimezone: true }).notNull().defaultNow(),
  sonSinyal: timestamp("son_sinyal", { withTimezone: true }).notNull().defaultNow(),
});

export type Sube = typeof subeler.$inferSelect;
export type SubeIp = typeof subeIpleri.$inferSelect;
export type VideoAtamasi = typeof videoAtamalari.$inferSelect;
export type EkranKaydi = typeof ekranKaydi.$inferSelect;
export type MedyaAyari = typeof medyaAyarlari.$inferSelect;

/**
 * Şemayı kuran DDL. Uygulama her açılışta çalıştırır (instrumentation.ts).
 *
 * Ayrı bir migration adımı bilerek yok: Dokploy'da deploy ettiğinizde
 * unutulabilecek bir komut kalmasın diye her ifade "IF NOT EXISTS" ile
 * yazıldı; tekrar tekrar çalıştırmak zararsızdır.
 *
 * Yukarıdaki tablo tanımlarını değiştirirseniz bu DDL'i de güncelleyin.
 */
export const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS subeler (
  id           serial PRIMARY KEY,
  kod          text NOT NULL UNIQUE,
  ad           text NOT NULL,
  aktif        boolean NOT NULL DEFAULT true,
  olusturuldu  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sube_ipleri (
  id        serial PRIMARY KEY,
  sube_id   integer NOT NULL REFERENCES subeler(id) ON DELETE CASCADE,
  ip        text NOT NULL UNIQUE,
  aciklama  text
);

CREATE TABLE IF NOT EXISTS video_atamalari (
  id       serial PRIMARY KEY,
  sube_id  integer NOT NULL REFERENCES subeler(id) ON DELETE CASCADE,
  dosya    text NOT NULL,
  sira     integer NOT NULL DEFAULT 0,
  CONSTRAINT video_atamalari_sube_dosya UNIQUE (sube_id, dosya)
);

CREATE TABLE IF NOT EXISTS ekran_kaydi (
  cihaz_id      text PRIMARY KEY,
  ip            text,
  sube_id       integer REFERENCES subeler(id) ON DELETE SET NULL,
  kaynak        text,
  son_video     text,
  sira          integer NOT NULL DEFAULT 0,
  toplam        integer NOT NULL DEFAULT 0,
  user_agent    text,
  ilk_gorulme   timestamptz NOT NULL DEFAULT now(),
  son_sinyal    timestamptz NOT NULL DEFAULT now()
);

-- Sonradan eklenen kolonlar: mevcut kurulumlarda tabloyu bozmadan ekler
ALTER TABLE ekran_kaydi ADD COLUMN IF NOT EXISTS onbellek_hazir  integer NOT NULL DEFAULT 0;
ALTER TABLE ekran_kaydi ADD COLUMN IF NOT EXISTS onbellek_toplam integer NOT NULL DEFAULT 0;
ALTER TABLE ekran_kaydi ADD COLUMN IF NOT EXISTS takilma         integer NOT NULL DEFAULT 0;
ALTER TABLE ekran_kaydi ADD COLUMN IF NOT EXISTS surum           text;
ALTER TABLE ekran_kaydi ADD COLUMN IF NOT EXISTS calisma_sn      integer NOT NULL DEFAULT 0;
ALTER TABLE ekran_kaydi ADD COLUMN IF NOT EXISTS teshis          jsonb;

CREATE TABLE IF NOT EXISTS medya_ayarlari (
  dosya        text PRIMARY KEY,
  baslangic    date,
  bitis        date,
  guncellendi  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT medya_ayarlari_tarih_sirasi CHECK (baslangic IS NULL OR bitis IS NULL OR baslangic <= bitis)
);

CREATE INDEX IF NOT EXISTS sube_ipleri_sube_idx ON sube_ipleri (sube_id);
CREATE INDEX IF NOT EXISTS video_atamalari_sube_idx ON video_atamalari (sube_id);
CREATE INDEX IF NOT EXISTS ekran_kaydi_sinyal_idx ON ekran_kaydi (son_sinyal DESC);
`;
