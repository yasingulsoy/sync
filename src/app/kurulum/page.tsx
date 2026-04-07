import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Signage Kurulumu - HospiSync",
  description:
    "Mini PC kiosk kurulum dosyaları, Android debug APK ve adım adım talimatlar",
};

const files = [
  {
    file: "hospisync-signage-kurulum.zip",
    label: "Hepsini indir (ZIP)",
    hint: "4 dosyayı tek seferde indirin, çıkarın ve KUR.bat çalıştırın.",
  },
  { file: "KUR.bat", label: "KUR.bat", hint: "Tek tıkla kurulum (önerilen)" },
  { file: "kiosk-fs.bat", label: "kiosk-fs.bat", hint: "Kiosk başlatıcı" },
  { file: "signage-kur.ps1", label: "signage-kur.ps1", hint: "PowerShell kurulum betiği" },
  {
    file: "signage-kaldir.ps1",
    label: "signage-kaldir.ps1",
    hint: "Kaldırma betiği (kiosk devre dışı bırakır)",
  },
] as const;

const androidApk = {
  file: "hospisync-signage-debug.apk",
  label: "Android — HospiSync Signage (debug APK)",
  hint: "Telefon veya Android TV kutusu; hospisync.cloud adresini tam ekran açar. İç test / kurulum içindir (debug imza).",
} as const;

const steps = [
  {
    num: 1,
    title: "Dosyaları indirin",
    desc: "Aşağıdaki dört dosyayı indirip hepsini aynı klasöre kaydedin (örn. Masaüstü\\HospiSync).",
  },
  {
    num: 2,
    title: "KUR.bat dosyasına çift tıklayın",
    desc: "Kurulum otomatik başlar. Windows güvenlik uyarısı çıkarsa \"Yine de çalıştır\" seçin.",
  },
  {
    num: 3,
    title: "Bilgisayarı yeniden başlatın",
    desc: "PC açıldığında hospisync.cloud/fs otomatik olarak tam ekran açılacaktır.",
  },
] as const;

export default function KurulumPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-10 px-6 py-12 text-zinc-100">
      <header className="space-y-3">
        <p className="text-sm text-zinc-500">
          <Link href="/" className="text-zinc-400 underline-offset-4 hover:underline">
            &larr; Ana sayfa
          </Link>
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Signage Kurulumu
        </h1>
        <p className="text-zinc-400 leading-relaxed">
          <span className="text-zinc-200">Windows mini PC</span> için kiosk dosyaları
          ve <span className="text-zinc-200">Android</span> cihazlar için uygulama
          paketi aşağıdadır. Site adresi{" "}
          <span className="text-zinc-200">hospisync.cloud</span> olarak açılır.
        </p>
      </header>

      {/* Adım adım talimatlar */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Adım adım kurulum
        </h2>
        <ol className="space-y-4">
          {steps.map((s) => (
            <li
              key={s.num}
              className="flex gap-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sm font-bold text-sky-400">
                {s.num}
              </span>
              <div>
                <p className="font-medium text-zinc-100">{s.title}</p>
                <p className="mt-1 text-sm text-zinc-400">{s.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* İndirme */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Dosyaları indir
        </h2>
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-950/80">
          {files.map((item, i) => (
            <li
              key={item.file}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <a
                  href={`/kurulum/${item.file}`}
                  download
                  className={
                    i === 0
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
                className="shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-center text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                İndir
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Mobil Android */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Mobil — Android
        </h2>
        <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-950/80">
          <li className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <a
                href={`/kurulum/${androidApk.file}`}
                download
                className="font-medium text-teal-400 hover:text-teal-300"
              >
                {androidApk.label}
              </a>
              <p className="text-sm text-zinc-500">{androidApk.hint}</p>
            </div>
            <a
              href={`/kurulum/${androidApk.file}`}
              download
              className="shrink-0 rounded-md border border-zinc-700 px-3 py-1.5 text-center text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              İndir
            </a>
          </li>
        </ul>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400 leading-relaxed">
          <p className="font-medium text-zinc-300">Yükleme</p>
          <ol className="mt-2 list-inside list-decimal space-y-1.5">
            <li>APK dosyasını indirin ve cihaza aktarın.</li>
            <li>
              Ayarlarda <strong className="text-zinc-300">bilinmeyen kaynaklar</strong>{" "}
              (veya bu uygulama için kaynak izni) açık olmalıdır.
            </li>
            <li>Dosyaya dokunarak kurun ve uygulamayı açın.</li>
          </ol>
          <p className="mt-3 text-zinc-500">
            Yeni bir Android sürümü yayınladığınızda APK&apos;yı yeniden derleyip bu
            sayfadaki dosyayı güncellemeniz gerekir.
          </p>
        </div>
      </section>

      {/* Ne yapar? */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Kurulum ne yapar?
        </h2>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400 leading-relaxed">
          <ul className="list-inside list-disc space-y-2">
            <li>
              Ekran kapanması ve uyku modunu <strong className="text-zinc-300">devre dışı</strong> bırakır.
            </li>
            <li>
              Windows başlangıcına{" "}
              <strong className="text-zinc-300">kiosk-fs.bat</strong> kısayolunu ekler.
            </li>
            <li>
              Bilgisayar her açıldığında Chrome veya Edge ile{" "}
              <strong className="text-zinc-300">hospisync.cloud/fs</strong> adresini tam
              ekran kiosk modunda başlatır.
            </li>
            <li>
              Windows bildirimlerini kapatır.
            </li>
          </ul>
        </div>
      </section>

      {/* Notlar */}
      <section className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4 text-sm text-zinc-400">
        <p className="font-medium text-amber-300">Önemli notlar</p>
        <ul className="mt-2 list-inside list-disc space-y-1.5">
          <li>
            Dört dosyanın hepsi <strong className="text-zinc-300">aynı klasörde</strong>{" "}
            olmalıdır.
          </li>
          <li>
            Mini PC&apos;de <strong className="text-zinc-300">Chrome</strong> veya{" "}
            <strong className="text-zinc-300">Edge</strong> tarayıcısı yüklü olmalıdır.
          </li>
          <li>
            Elektrik kesintisi sonrası PC&apos;nin otomatik açılması için BIOS&apos;ta{" "}
            <em>AC Power Recovery &rarr; Power On</em> ayarını yapın.
          </li>
          <li>
            Kiosk modundan çıkmak için{" "}
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
              Alt + F4
            </kbd>{" "}
            tuşlarına basın.
          </li>
          <li>
            Kiosku tamamen kaldırmak için{" "}
            <strong className="text-zinc-300">signage-kaldir.ps1</strong> dosyasını
            çalıştırın.
          </li>
        </ul>
      </section>

      <footer className="border-t border-zinc-800 pt-6 text-center text-xs text-zinc-600">
        HospiSync Signage &middot; Sorun yaşarsanız IT birimine başvurun
      </footer>
    </main>
  );
}
