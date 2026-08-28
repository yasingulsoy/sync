import type { Metadata } from "next";
import { adminKeyConfigured, isAdmin } from "@/lib/adminAuth";
import { getPanelData } from "@/lib/db/panelData";
import { LoginForm } from "./LoginForm";
import { ScreenPanel } from "./ScreenPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ekran Paneli - HospiSync",
  robots: { index: false, follow: false },
};

export default async function EkranlarPage() {
  const configured = adminKeyConfigured();
  const authed = configured && (await isAdmin());
  const veri = authed ? await getPanelData() : null;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-7xl px-6 py-10 text-zinc-100">
      {!configured ? (
        <div className="mx-auto mt-24 max-w-md rounded-lg border border-red-900/50 bg-red-950/20 p-5 text-sm text-red-200">
          <p className="font-medium">Panel kapalı</p>
          <p className="mt-2 text-red-300/80">
            Sunucuda <code className="text-red-200">SIGNAGE_ADMIN_KEY</code>{" "}
            tanımlı değil. Dokploy &gt; Environment bölümüne ekleyip servisi
            yeniden başlatın.
          </p>
        </div>
      ) : veri ? (
        <ScreenPanel baslangic={veri} />
      ) : (
        <LoginForm />
      )}
    </main>
  );
}
