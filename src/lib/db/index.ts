import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { BOOTSTRAP_SQL } from "./schema";
import * as schema from "./schema";

/**
 * PostgreSQL bağlantısı. Ayarlar .env içindeki POSTGRES_* değişkenlerinden
 * okunur; tek satırlık bağlantı adresi beklenmez (şifredeki özel karakterlerin
 * kaçırılması gerekmesin diye).
 *
 * Değişkenler eksikse bağlantı kurulmaz ve `getDb()` null döner — bu durumda
 * ekranlar veritabanısız çalışmaya devam eder (havuzdaki tüm videolar oynar).
 */

function env(name: string): string {
  const raw = (process.env[name] ?? "").trim();
  // Dokploy gibi panellere .env satırı kopyalanırken tırnaklar da yapışabiliyor
  // (POSTGRES_HOST="1.2.3.4" -> değer tırnaklarla birlikte gelir). Soyalım.
  const tirnakli =
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'")));
  return tirnakli ? raw.slice(1, -1) : raw;
}

/** TLS açık mı — "true" dışındaki yaygın yazımları da kabul et */
function sslAcik(): boolean {
  return ["true", "1", "yes", "require", "on"].includes(
    env("POSTGRES_SSL").toLowerCase()
  );
}

export function dbConfigured(): boolean {
  return Boolean(env("POSTGRES_HOST") && env("POSTGRES_USER") && env("POSTGRES_DB"));
}

type DbHandle = ReturnType<typeof drizzle<typeof schema>>;

const store = globalThis as unknown as {
  __signageSql?: ReturnType<typeof postgres>;
  __signageDb?: DbHandle;
  __signageBootstrap?: Promise<void>;
};

function connect(): { sql: ReturnType<typeof postgres>; db: DbHandle } | null {
  if (!dbConfigured()) return null;

  if (!store.__signageSql || !store.__signageDb) {
    const sql = postgres({
      host: env("POSTGRES_HOST"),
      port: Number(env("POSTGRES_PORT") || 5432),
      user: env("POSTGRES_USER"),
      password: env("POSTGRES_PASSWORD"),
      database: env("POSTGRES_DB"),
      ssl: sslAcik() ? { rejectUnauthorized: false } : false,
      max: 8,
      idle_timeout: 30,
      connect_timeout: 15,
    });
    store.__signageSql = sql;
    store.__signageDb = drizzle(sql, { schema });
  }

  return { sql: store.__signageSql, db: store.__signageDb };
}

export function getDb(): DbHandle | null {
  return connect()?.db ?? null;
}

export function getSql(): ReturnType<typeof postgres> | null {
  return connect()?.sql ?? null;
}

/**
 * Şemayı kurar. Tüm ifadeler "IF NOT EXISTS" olduğu için tekrar çalıştırmak
 * zararsızdır; ayrı bir migration komutu çalıştırmanız gerekmez.
 */
export function bootstrapDb(): Promise<void> {
  if (store.__signageBootstrap) return store.__signageBootstrap;

  const conn = connect();
  if (!conn) {
    store.__signageBootstrap = Promise.resolve();
    return store.__signageBootstrap;
  }

  store.__signageBootstrap = conn.sql
    .unsafe(BOOTSTRAP_SQL)
    .then(() => {
      console.log("[signage] veritabanı şeması hazır");
    })
    .catch((err: unknown) => {
      // Kurulum başarısız olsa bile uygulama ayakta kalmalı; ekranlar
      // veritabanısız modda havuzdaki videoları oynatmaya devam eder.
      console.error("[signage] veritabanı şeması kurulamadı:", dbHataMesaji(err));
      store.__signageBootstrap = undefined;
    });

  return store.__signageBootstrap;
}

/** Sık karşılaşılan bağlantı hatalarını anlaşılır hale getirir. */
export function dbHataMesaji(err: unknown): string {
  const e = err as { message?: string; code?: string } | undefined;
  const ham = e?.message ?? String(err);
  const metin = `${e?.code ?? ""} ${ham}`.trim();

  // TLS kapalı bir sunucuya SSL ile bağlanınca hata metni sürüme göre değişiyor
  // ("...secure TLS connection..." veya sadece "read ECONNRESET"); ikisini de yakala.
  if (sslAcik() && /TLS|SSL|ECONNRESET|EPROTO/i.test(metin)) {
    return (
      "Sunucu TLS kabul etmiyor ama POSTGRES_SSL açık. Dokploy > Environment " +
      `içinde POSTGRES_SSL değerini false yapıp servisi yeniden başlatın. (${ham})`
    );
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(metin)) {
    return `POSTGRES_HOST çözümlenemedi: "${env("POSTGRES_HOST")}". Değerde tırnak veya boşluk kalmış olabilir. (${ham})`;
  }
  if (/ECONNREFUSED/i.test(metin)) {
    return `${env("POSTGRES_HOST")}:${env("POSTGRES_PORT")} bağlantıyı reddetti. Port veya güvenlik duvarı kontrol edin. (${ham})`;
  }
  if (/ETIMEDOUT|CONNECT_TIMEOUT/i.test(metin)) {
    return `${env("POSTGRES_HOST")}:${env("POSTGRES_PORT")} zaman aşımına uğradı. Uygulama sunucusundan bu porta erişim var mı? (${ham})`;
  }
  if (/password|authentication|28P01/i.test(metin)) {
    return `Kimlik doğrulama başarısız — POSTGRES_USER / POSTGRES_PASSWORD kontrol edin. (${ham})`;
  }
  return ham;
}
