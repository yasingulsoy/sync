import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * /ekranlar paneli icin basit sifre korumasi.
 *
 * Sifre .env dosyasindaki SIGNAGE_ADMIN_KEY degiskeninden okunur; canlida
 * ayni degiskeni Dokploy > Environment altina eklemeniz gerekir. Degisken
 * tanimli degilse panel tamamen kapalidir (acik birakmaktan guvenli).
 *
 * Cerezde sifrenin kendisi degil, ondan turetilen bir imza saklanir.
 */

const COOKIE_NAME = "signage_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 gun
const TOKEN_SALT = "signage-admin-v1";

function adminKey(): string {
  return process.env.SIGNAGE_ADMIN_KEY ?? "";
}

export function adminKeyConfigured(): boolean {
  return adminKey().length > 0;
}

function tokenFor(key: string): string {
  return createHmac("sha256", key).update(TOKEN_SALT).digest("hex");
}

function safeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function passwordMatches(candidate: string): boolean {
  const key = adminKey();
  if (!key) return false;
  return safeEquals(candidate, key);
}

export async function isAdmin(): Promise<boolean> {
  const key = adminKey();
  if (!key) return false;
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  return safeEquals(raw, tokenFor(key));
}

export async function startAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, tokenFor(adminKey()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function endAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/* ---------- Kaba kuvvet denemelerini sinirlama (bellekte) ---------- */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const store = globalThis as unknown as {
  __signageLoginAttempts?: Map<string, { count: number; resetAt: number }>;
};
const attempts = (store.__signageLoginAttempts ??= new Map());

export function loginThrottled(ip: string, now: number): boolean {
  const key = ip || "bilinmeyen";
  const rec = attempts.get(key);
  if (!rec || now > rec.resetAt) return false;
  return rec.count >= MAX_ATTEMPTS;
}

export function noteFailedLogin(ip: string, now: number): void {
  const key = ip || "bilinmeyen";
  const rec = attempts.get(key);
  if (!rec || now > rec.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  rec.count += 1;
}

export function clearLoginAttempts(ip: string): void {
  attempts.delete(ip || "bilinmeyen");
}
