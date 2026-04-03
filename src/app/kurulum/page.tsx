import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Signage kurulumu",
  description: "Mini PC kiosk dosyalarını indirin",
};

const files = [
  {
    file: "hospisync-signage-kurulum.zip",
    label: "Tüm dosyalar (ZIP)",
    hint: "Önerilen: açıp aynı klasöre çıkarın, sonra KUR.bat çalıştırın.",
  },
  { file: "KUR.bat", label: "KUR.bat", hint: "Tek seferlik kurulum (ZIP ile aynı)" },
  { file: "kiosk-fs.bat", label: "kiosk-fs.bat", hint: "Kiosk başlatıcı" },
  { file: "signage-kur.ps1", label: "signage-kur.ps1", hint: "PowerShell kurulum betiği" },
  {
    file: "signage-kaldir.ps1",
    label: "signage-kaldir.ps1",
    hint: "Başlangıç kısayolunu kaldırır",
  },
] as const;

export default function KurulumPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-8 px-6 py-12 text-zinc-100">
      <header className="space-y-2">
        <p className="text-sm text-zinc-500">
          <Link href="/" className="text-zinc-400 underline-offset-4 hover:underline">
            Ana sayfa
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Mini PC signage kurulumu
        </h1>
        <p className="text-zinc-400">
          Dosyaları indirip tek klasörde toplayın; ardından{" "}
          <strong className="text-zinc-200">KUR.bat</strong> dosyasına çift tıklayın.
          Windows oturumu açıldığında{" "}
          <span className="text-zinc-300">https://hospisync.cloud/fs</span> tam ekran
          kiosk olarak açılır.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          İndir
        </h2>
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-950/80">
          {files.map((item) => (
            <li
              key={item.file}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <a
                  href={`/kurulum/${item.file}`}
                  download
                  className={
                    item.file === "hospisync-signage-kurulum.zip"
                      ? "font-medium text-sky-400 hover:text-sky-300"
                      : "text-zinc-200 hover:text-white"
                  }
                >
                  {item.label}
                </a>
                <p className="text-sm text-zinc-500">{item.hint}</p>
              </div>
              <a
                href={`/kurulum/${item.file}`}
                download
                className="shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-center text-sm text-zinc-300 hover:bg-zinc-900"
              >
                İndir
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400">
        <p className="font-medium text-zinc-300">Notlar</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>
            ZIP kullanıyorsanız içindeki dört dosyayı <strong>aynı klasöre</strong>{" "}
            çıkarın; KUR.bat, signage-kur.ps1 ve kiosk-fs.bat birlikte olmalı.
          </li>
          <li>
            Elektrik gelince PC&apos;nin kendiliğinden açılması için BIOS&apos;ta AC
            power recovery ayarını kurum IT yapmalıdır.
          </li>
          <li>Chrome veya Edge kurulu olmalıdır.</li>
        </ul>
      </section>
    </main>
  );
}
