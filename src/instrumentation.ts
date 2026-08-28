/**
 * Sunucu her açıldığında bir kez çalışır: veritabanı şemasını kurar.
 * Böylece deploy sonrası elle migration komutu çalıştırmanız gerekmez.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootstrapDb } = await import("@/lib/db");
  await bootstrapDb();
}
