"use client";

import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import {
  atamaDegistirAction,
  ekranUnutAction,
  ipEkleAction,
  ipSilAction,
  logoutAction,
  subeEkleAction,
  subeSilAction,
  tumSubelerdeAction,
  type IslemSonucu,
} from "./actions";

type EkranSatiri = {
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

type SubeOzet = {
  id: number;
  kod: string;
  ad: string;
  aktif: boolean;
  ipler: { id: number; ip: string }[];
  videoSayisi: number;
};

type IpInfo = { city: string; region: string; country: string; isp: string };

type Payload = {
  ok: boolean;
  dbYok: boolean;
  now: number;
  ekranlar: EkranSatiri[];
  subeler: SubeOzet[];
  havuz: string[];
  atamalar: Record<string, number[]>;
  geo: Record<string, IpInfo>;
  hata?: string;
};

/** Sinyal 60 sn'de bir gelir; 150 sn'dir ses yoksa ekranı "sessiz" sayarız. */
const LIVE_WINDOW_MS = 150_000;
const POLL_MS = 10_000;

function since(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} sn önce`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.round(h / 24)} gün önce`;
}

function deviceKind(ua: string | null): string {
  if (!ua) return "—";
  if (/Android/i.test(ua)) return "Android";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua)) return "Chrome";
  return "Diğer";
}

function fileName(p: string | null): string {
  if (!p) return "—";
  const parts = p.split("/");
  return parts[parts.length - 1] ?? p;
}

/** "Kayseri, İç Anadolu · Türk Telekom" */
function placeOf(info: IpInfo | undefined): string {
  if (!info) return "";
  const where = [info.city, info.region].filter(Boolean).join(", ");
  return [where, info.isp].filter(Boolean).join(" · ");
}

const TABS = [
  { id: "ekranlar", label: "Ekranlar" },
  { id: "subeler", label: "Şubeler" },
  { id: "videolar", label: "Videolar" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ScreenPanel({ baslangic }: { baslangic: Payload }) {
  // İlk veri sunucuda hazırlanıp geliyor; burada yalnızca yenilemeler yapılır.
  const [data, setData] = useState<Payload>(baslangic);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("ekranlar");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ekranlar", { cache: "no-store" });
      if (res.status === 401) {
        setError("Oturum düştü. Sayfayı yenileyip tekrar giriş yapın.");
        return;
      }
      if (!res.ok) {
        setError("Veritabanına ulaşılamıyor.");
        return;
      }
      setData((await res.json()) as Payload);
      setError(null);
    } catch {
      setError("Veri alınamadı.");
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Sunucu saati: sonSinyal de sunucuda üretildiği için istemci saati
  // yanlış ayarlıysa bile "yayında / sessiz" doğru hesaplanır.
  const now = data.now;
  const canli = data.ekranlar.filter(
    (e) => now - new Date(e.sonSinyal).getTime() < LIVE_WINDOW_MS
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Ekran Paneli</h1>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="text-emerald-400">{canli.length} ekran yayında</span>
            {" · "}
            {data.ekranlar.length} kayıtlı cihaz · {data.subeler.length} şube ·{" "}
            {data.havuz.length} video
            {error && <span className="ml-2 text-amber-400">({error})</span>}
          </p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800"
          >
            Çıkış
          </button>
        </form>
      </header>

      {data.dbYok && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-200">
          Veritabanı ayarları eksik (POSTGRES_*). Şube ve video atamaları
          çalışmaz; ekranlar havuzdaki tüm videoları oynatır.
        </p>
      )}

      {data.hata && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-200">
          <p className="font-medium">Veritabanına bağlanılamıyor</p>
          <p className="mt-2 text-red-300/90">{data.hata}</p>
          <p className="mt-2 text-red-300/60">
            Ekranlar bu sırada havuzdaki tüm videoları oynatmaya devam eder.
          </p>
        </div>
      )}

      <nav className="flex gap-1 border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
              tab === t.id
                ? "border-sky-500 font-medium text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "ekranlar" && <EkranlarTab data={data} now={now} onChange={load} />}
      {tab === "subeler" && <SubelerTab data={data} onChange={load} />}
      {tab === "videolar" && <VideolarTab data={data} onChange={load} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ekranlar                                                            */
/* ------------------------------------------------------------------ */

function EkranlarTab({
  data,
  now,
  onChange,
}: {
  data: Payload;
  now: number;
  onChange: () => void;
}) {
  const [pending, start] = useTransition();

  const eslesmemis = [
    ...new Map(
      data.ekranlar.filter((e) => !e.subeId && e.ip).map((e) => [e.ip as string, e])
    ).values(),
  ];

  if (data.ekranlar.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
        Henüz sinyal gelmedi. Ekranlar açıldıktan en geç 1 dakika sonra burada
        görünürler.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {eslesmemis.length > 0 && (
        <section className="space-y-3 rounded-lg border border-amber-900/50 bg-amber-950/15 p-4">
          <h2 className="font-medium text-amber-300">
            Şubesi belirlenmemiş {eslesmemis.length} IP
          </h2>
          <p className="text-sm text-zinc-400">
            Bu ekranlar havuzdaki tüm videoları oynatıyor. Konum bilgisine bakıp
            hangi şube olduklarını belirleyin, sonra <strong>Şubeler</strong>{" "}
            sekmesinden ilgili şubeye IP olarak ekleyin.
          </p>
          <ul className="space-y-1 text-sm">
            {eslesmemis.map((e) => (
              <li key={e.ip} className="flex flex-wrap gap-x-3 text-zinc-300">
                <code className="font-medium text-white">{e.ip}</code>
                <span className="text-amber-200/90">
                  {placeOf(data.geo?.[e.ip ?? ""]) || "konum sorgulanıyor…"}
                </span>
                <span className="text-zinc-500">{deviceKind(e.userAgent)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-600">
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-2 font-medium">Durum</th>
              <th className="px-4 py-2 font-medium">Şube</th>
              <th className="px-4 py-2 font-medium">IP</th>
              <th className="px-4 py-2 font-medium">Konum / operatör</th>
              <th className="px-4 py-2 font-medium">Şu an oynatılan</th>
              <th className="px-4 py-2 font-medium">Sıra</th>
              <th className="px-4 py-2 font-medium">Son sinyal</th>
              <th className="px-4 py-2 font-medium">Cihaz</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {data.ekranlar.map((e) => {
              const alive = now - new Date(e.sonSinyal).getTime() < LIVE_WINDOW_MS;
              return (
                <tr key={e.cihazId} className={alive ? "" : "opacity-50"}>
                  <td className="whitespace-nowrap px-4 py-2">
                    <span
                      className={`inline-flex items-center gap-1.5 ${
                        alive ? "text-emerald-400" : "text-zinc-500"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          alive ? "bg-emerald-400" : "bg-zinc-600"
                        }`}
                        aria-hidden
                      />
                      {alive ? "Yayında" : "Sessiz"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-100">
                    {e.subeAdi ?? (
                      <span className="text-amber-400/80">belirlenmedi</span>
                    )}
                    {e.kaynak === "url" && (
                      <span className="ml-2 text-xs text-zinc-600">(URL ile)</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-zinc-300">
                    {e.ip || "—"}
                  </td>
                  <td className="max-w-[16rem] truncate px-4 py-2 text-zinc-400">
                    {placeOf(data.geo?.[e.ip ?? ""]) || "—"}
                  </td>
                  <td className="max-w-[20rem] truncate px-4 py-2 text-zinc-100">
                    {fileName(e.sonVideo)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums text-zinc-500">
                    {e.toplam ? `${e.sira + 1}/${e.toplam}` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                    {since(now - new Date(e.sonSinyal).getTime())}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                    {deviceKind(e.userAgent)}
                    <span className="ml-2 font-mono text-xs text-zinc-700">
                      {e.cihazId.slice(0, 6)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        if (!confirm("Bu cihaz kaydı silinsin mi?")) return;
                        start(async () => {
                          await ekranUnutAction(e.cihazId);
                          onChange();
                        });
                      }}
                      className="text-xs text-zinc-600 hover:text-red-400 disabled:opacity-50"
                    >
                      Kaydı sil
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Şubeler                                                             */
/* ------------------------------------------------------------------ */

const bosSonuc: IslemSonucu = { hata: null };

function SubelerTab({ data, onChange }: { data: Payload; onChange: () => void }) {
  const [state, formAction, pending] = useActionState(
    async (prev: IslemSonucu, fd: FormData) => {
      const sonuc = await subeEkleAction(prev, fd);
      if (!sonuc.hata) onChange();
      return sonuc;
    },
    bosSonuc
  );

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
        Bütün ekranlar aynı adresi açar:{" "}
        <code className="text-zinc-200">hospisync.cloud/fs</code>. Hangi videonun
        oynayacağını aşağıda tanımladığınız <strong>IP</strong> belirler; kiosk
        kurulumunda hiçbir şey değiştirmeniz gerekmez.
        <br />
        <span className="text-zinc-500">
          Şube kodu yalnızca yedek çözümdür: bir şubenin IP&apos;si değişip ekran
          yanlış içerik gösterirse, o bilgisayarın adresini geçici olarak{" "}
          <code className="text-zinc-400">/fs/kod</code> yapabilirsiniz.
        </span>
      </p>

      <form
        action={formAction}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4"
      >
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Şube adı
          <input
            name="ad"
            required
            placeholder="Çamlıca Şubesi"
            className="w-56 rounded-md border border-zinc-700 bg-black px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-sky-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Kod (URL&apos;de kullanılır)
          <input
            name="kod"
            required
            placeholder="camlica"
            className="w-40 rounded-md border border-zinc-700 bg-black px-3 py-2 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-sky-500"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
        >
          Şube ekle
        </button>
        {state.hata && <p className="text-sm text-red-300">{state.hata}</p>}
      </form>

      {data.subeler.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
          Henüz şube yok. Yukarıdan ekleyin, sonra her şubeye o hastanenin dış
          IP&apos;sini tanımlayın.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.subeler.map((s) => (
            <SubeKarti key={s.id} sube={s} onChange={onChange} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SubeKarti({ sube, onChange }: { sube: SubeOzet; onChange: () => void }) {
  const [yeniIp, setYeniIp] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const ipEkle = () => {
    const deger = yeniIp.trim();
    if (!deger) return;
    start(async () => {
      const sonuc = await ipEkleAction(sube.id, deger);
      setHata(sonuc.hata);
      if (!sonuc.hata) {
        setYeniIp("");
        onChange();
      }
    });
  };

  return (
    <li className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-semibold text-white">{sube.ad}</span>
          <span className="text-xs text-zinc-600">
            kod <code className="text-zinc-500">{sube.kod}</code>
          </span>
          <span className="text-xs text-zinc-600">
            {sube.videoSayisi > 0
              ? `${sube.videoSayisi} video atanmış`
              : "atama yok — tüm videolar oynar"}
          </span>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(`"${sube.ad}" silinsin mi? IP'leri ve atamaları da silinir.`))
              return;
            start(async () => {
              await subeSilAction(sube.id);
              onChange();
            });
          }}
          className="text-xs text-zinc-600 hover:text-red-400 disabled:opacity-50"
        >
          Şubeyi sil
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {sube.ipler.length === 0 && (
          <span className="text-sm text-amber-400/80">
            IP tanımlı değil — bu şubeye hiçbir ekran düşmez.
          </span>
        )}
        {sube.ipler.map((r) => (
          <span
            key={r.id}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-black/60 px-2 py-1 font-mono text-xs text-zinc-300"
          >
            {r.ip}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await ipSilAction(r.id);
                  onChange();
                })
              }
              className="text-zinc-600 hover:text-red-400 disabled:opacity-50"
              aria-label={`${r.ip} kaldır`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={yeniIp}
          onChange={(e) => setYeniIp(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ipEkle();
            }
          }}
          placeholder="88.123.45.67 veya 88.123.45.0/24"
          className="w-64 rounded-md border border-zinc-700 bg-black px-3 py-1.5 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-sky-500"
        />
        <button
          type="button"
          onClick={ipEkle}
          disabled={pending}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 disabled:opacity-50"
        >
          IP ekle
        </button>
        {hata && <span className="text-sm text-red-300">{hata}</span>}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Videolar — tik matrisi                                              */
/* ------------------------------------------------------------------ */

function VideolarTab({ data, onChange }: { data: Payload; onChange: () => void }) {
  // Sunucu yanıtı beklenirken tik anında görünsün diye yerel kopya.
  // `kaynak` alanı türetildiği sunucu verisini işaret eder; yeni yanıt gelince
  // kimlik değiştiği için iyimser değer kendiliğinden düşer.
  const [iyimser, setIyimser] = useState<{
    kaynak: Record<string, number[]>;
    degerler: Record<string, number[]>;
  } | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [, start] = useTransition();

  const atamalar =
    iyimser && iyimser.kaynak === data.atamalar ? iyimser.degerler : data.atamalar;

  const tikli = (dosya: string, subeId: number) =>
    (atamalar[dosya] ?? []).includes(subeId);

  const degistir = (dosya: string, subeId: number, yeni: boolean) => {
    const mevcut = atamalar[dosya] ?? [];
    setIyimser({
      kaynak: data.atamalar,
      degerler: {
        ...atamalar,
        [dosya]: yeni ? [...mevcut, subeId] : mevcut.filter((id) => id !== subeId),
      },
    });
    start(async () => {
      const sonuc = await atamaDegistirAction(subeId, dosya, yeni);
      setHata(sonuc.hata);
      onChange();
    });
  };

  const hepsi = (dosya: string, yeni: boolean) => {
    setIyimser({
      kaynak: data.atamalar,
      degerler: {
        ...atamalar,
        [dosya]: yeni ? data.subeler.map((s) => s.id) : [],
      },
    });
    start(async () => {
      const sonuc = await tumSubelerdeAction(dosya, yeni);
      setHata(sonuc.hata);
      onChange();
    });
  };

  if (data.havuz.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
        <code className="text-zinc-300">public/videos</code> klasöründe video yok.
        Dosyaları ekleyip deploy edin, burada listelenirler.
      </p>
    );
  }

  if (data.subeler.length === 0) {
    return (
      <p className="rounded-lg border border-amber-900/50 bg-amber-950/15 p-4 text-sm text-zinc-300">
        Önce <strong>Şubeler</strong> sekmesinden şube ekleyin; tik kutuları
        şubelere göre oluşur.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">
        Bir videonun hangi şubelerde oynayacağını işaretleyin. Hiç işaret
        almayan şube havuzdaki <strong>tüm</strong> videoları oynatır. Değişiklik
        anında kaydedilir; ekranlar en geç 5 dakika içinde yeni listeyi çeker.
        {hata && <span className="ml-2 text-red-300">{hata}</span>}
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr className="border-b border-zinc-800">
              <th className="sticky left-0 bg-zinc-950 px-4 py-3 font-medium">
                Video
              </th>
              <th className="px-3 py-3 text-center font-medium">Tümü</th>
              {data.subeler.map((s) => (
                <th
                  key={s.id}
                  className="whitespace-nowrap px-3 py-3 text-center font-medium text-zinc-300"
                >
                  {s.ad}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {data.havuz.map((dosya) => {
              const secili = atamalar[dosya] ?? [];
              const tumu = secili.length === data.subeler.length;
              return (
                <tr key={dosya}>
                  <td className="sticky left-0 max-w-[24rem] truncate bg-zinc-950 px-4 py-2 text-zinc-100">
                    {dosya}
                    {secili.length === 0 && (
                      <span className="ml-2 text-xs text-zinc-600">
                        (hiçbir şubede seçili değil)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={tumu}
                      onChange={(e) => hepsi(dosya, e.target.checked)}
                      className="h-4 w-4 accent-sky-500"
                      aria-label={`${dosya} tüm şubelerde`}
                    />
                  </td>
                  {data.subeler.map((s) => (
                    <td key={s.id} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={tikli(dosya, s.id)}
                        onChange={(e) => degistir(dosya, s.id, e.target.checked)}
                        className="h-4 w-4 accent-emerald-500"
                        aria-label={`${dosya} — ${s.ad}`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
