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
  return (process.env[name] ?? "").trim();
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
      ssl: env("POSTGRES_SSL") === "true" ? { rejectUnauthorized: false } : false,
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
      console.error("[signage] veritabanı şeması kurulamadı:", err);
      store.__signageBootstrap = undefined;
    });

  return store.__signageBootstrap;
}
