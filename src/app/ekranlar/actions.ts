"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  adminKeyConfigured,
  clearLoginAttempts,
  endAdminSession,
  loginThrottled,
  noteFailedLogin,
  passwordMatches,
  startAdminSession,
} from "@/lib/adminAuth";
import { clientIpFrom } from "@/lib/clientIp";

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
