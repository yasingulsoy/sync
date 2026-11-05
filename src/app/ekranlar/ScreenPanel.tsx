"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
// Yalnızca tip: derlemede silinir, sunucu kodu tarayıcıya girmez
import type { PanelVerisi } from "@/lib/db/panelData";
import type { EkranSatiri, SubeOzet } from "@/lib/db/queries";
import { isImageFile } from "@/lib/medya";
import { gunFarki, kisaTarih, yayinDurumu, type YayinAraligi } from "@/lib/yayin";
import {
  atamaDegistirAction,
  ekranUnutAction,
  eskiKayitlariSilAction,
  ipEkleAction,
  ipSilAction,
  logoutAction,
  medyaTakvimAction,
  subeEkleAction,
  subeSilAction,
  tumSubelerdeAction,
  type IslemSonucu,
} from "./actions";

type Payload = PanelVerisi;
type IpInfo = PanelVerisi["geo"][string];

/** Bu kadar gündür sinyal vermeyen cihaz varsayılan olarak gizlenir (panelData.ts ile aynı) */
const ESKI_KAYIT_GUN = 7;
/** Toplu silme bu kadar günden eskileri kapsar */
const SILME_GUN = 30;

/** Sinyal 60 sn'de bir gelir; 150 sn'dir ses yoksa ekranı "sessiz" sayarız. */
const LIVE_WINDOW_MS = 150_000;
const POLL_MS = 10_000;

function eskiKayit(e: EkranSatiri, now: number): boolean {
  return now - new Date(e.sonSinyal).getTime() > ESKI_KAYIT_GUN * 86_400_000;
}

function canliMi(e: EkranSatiri, now: number): boolean {
  return now - new Date(e.sonSinyal).getTime() < LIVE_WINDOW_MS;
}

const SAYI = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

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
  const guncel = data.ekranlar.filter((e) => !eskiKayit(e, now));
  const eskiSurumde = canli.filter((e) => e.surum !== data.surum).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Ekran Paneli</h1>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="text-emerald-400">{canli.length} ekran yayında</span>
            {" · "}
            {guncel.length} cihaz · {data.subeler.length} şube · {data.havuz.length} medya
            {eskiSurumde > 0 && (
              <span
                className="ml-2 text-amber-400"
                title="Bu kiosklar yeni sürümü henüz almadı. Kendiliğinden yenilenmezlerse Chrome'u yeniden başlatın."
              >
                · {eskiSurumde} kiosk eski sürümde
              </span>
            )}
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
  const [eskileriGoster, setEskileriGoster] = useState(false);
  const [silmeSonucu, setSilmeSonucu] = useState<string | null>(null);

  const guncel = data.ekranlar.filter((e) => !eskiKayit(e, now));
  const eskiSayisi = data.ekranlar.length - guncel.length;
  const silinebilir = data.ekranlar.filter(
    (e) => now - new Date(e.sonSinyal).getTime() > SILME_GUN * 86_400_000
  ).length;
  const gosterilen = eskileriGoster ? data.ekranlar : guncel;

  const eslesmemis = [
    ...new Map(
      guncel.filter((e) => !e.subeId && e.ip).map((e) => [e.ip as string, e])
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
    <div className="space-y-8">
      <SubeDurumlari data={data} now={now} />

      {eslesmemis.length > 0 && (
        <section className="space-y-3 rounded-lg border border-amber-900/50 bg-amber-950/15 p-4">
          <h2 className="font-medium text-amber-300">
            Şubesi belirlenmemiş {eslesmemis.length} IP
          </h2>
          <p className="text-sm text-zinc-400">
            Bu ekranlar havuzdaki tüm medyayı oynatıyor. Konum bilgisine bakıp
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

      <TakilmaAnalizi data={data} now={now} />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-400">Cihazlar</h2>
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
                <th className="px-4 py-2 font-medium">Önbellek</th>
                <th className="px-4 py-2 font-medium">Takılma</th>
                <th className="px-4 py-2 font-medium">Son sinyal</th>
                <th className="px-4 py-2 font-medium">Cihaz</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {gosterilen.map((e) => {
                const alive = canliMi(e, now);
                const eskiSurum = alive && e.surum !== data.surum;
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
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                      <OnbellekRozeti hazir={e.onbellekHazir} toplam={e.onbellekToplam} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">
                      <TakilmaHucresi ekran={e} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                      {since(now - new Date(e.sonSinyal).getTime())}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                      {deviceKind(e.userAgent)}
                      <span className="ml-2 font-mono text-xs text-zinc-700">
                        {e.cihazId.slice(0, 6)}
                      </span>
                      {eskiSurum && (
                        <span
                          className="ml-2 rounded border border-amber-800/60 px-1.5 py-0.5 text-[11px] text-amber-300"
                          title="Bu kiosk yeni sürümü henüz almadı. Birkaç dakika içinde kendiliğinden yenilenmezse Chrome'u yeniden başlatın."
                        >
                          eski sürüm
                        </span>
                      )}
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

        {(eskiSayisi > 0 || silmeSonucu) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-500">
            {eskiSayisi > 0 && (
              <button
                type="button"
                onClick={() => setEskileriGoster((g) => !g)}
                className="underline-offset-4 hover:text-zinc-300 hover:underline"
              >
                {eskileriGoster
                  ? "Eski kayıtları gizle"
                  : `${ESKI_KAYIT_GUN} günden eski ${eskiSayisi} kaydı göster`}
              </button>
            )}
            {silinebilir > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (
                    !confirm(
                      `${SILME_GUN} günden uzun süredir sinyal vermeyen ${silinebilir} cihaz kaydı silinsin mi? Bu cihazlardan biri tekrar açılırsa kendiliğinden yeniden kaydolur.`
                    )
                  )
                    return;
                  start(async () => {
                    const sonuc = await eskiKayitlariSilAction(SILME_GUN);
                    setSilmeSonucu(
                      sonuc.hata ?? `${sonuc.silinen ?? 0} eski kayıt silindi.`
                    );
                    onChange();
                  });
                }}
                className="text-zinc-600 hover:text-red-400 disabled:opacity-50"
              >
                {SILME_GUN} günden eski {silinebilir} kaydı sil
              </button>
            )}
            {silmeSonucu && <span className="text-zinc-400">{silmeSonucu}</span>}
          </div>
        )}
      </section>
    </div>
  );
}

/** Her şubede kaç ekranın yayında olduğu — hiç bağlanmayan şube göze çarpsın */
function SubeDurumlari({ data, now }: { data: Payload; now: number }) {
  if (data.subeler.length === 0) return null;

  const ozet = data.subeler.map((s) => {
    const cihazlar = data.ekranlar.filter((e) => e.subeId === s.id && !eskiKayit(e, now));
    const canli = cihazlar.filter((e) => canliMi(e, now)).length;
    return { sube: s, toplam: cihazlar.length, canli };
  });
  const baglantiYok = ozet.filter((o) => o.toplam === 0).length;
  const sessiz = ozet.filter((o) => o.toplam > 0 && o.canli === 0).length;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-zinc-400">
        Şubeler
        {(baglantiYok > 0 || sessiz > 0) && (
          <span className="ml-2 font-normal text-zinc-600">
            {[
              sessiz > 0 ? `${sessiz} şube sessiz` : "",
              baglantiYok > 0 ? `${baglantiYok} şubeden hiç sinyal yok` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </h2>
      <div className="flex flex-wrap gap-2">
        {ozet.map(({ sube, toplam, canli }) => {
          const renk =
            canli > 0
              ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-300"
              : toplam > 0
                ? "border-amber-800/60 bg-amber-950/20 text-amber-300"
                : "border-zinc-800 bg-zinc-900/40 text-zinc-500";
          const etiket =
            canli > 0 ? `${canli} yayında` : toplam > 0 ? "sessiz" : "sinyal yok";
          const aciklama =
            canli > 0
              ? `${toplam} cihazdan ${canli} tanesi şu an yayında`
              : toplam > 0
                ? `${toplam} cihaz kayıtlı ama şu an hiçbiri sinyal vermiyor`
                : `Son ${ESKI_KAYIT_GUN} günde bu şubeden hiç sinyal gelmedi: kiosk kapalı, kurulmamış ya da listede olmayan bir IP'den çıkıyor olabilir.`;
          return (
            <span
              key={sube.id}
              className={`rounded-md border px-2.5 py-1 text-xs ${renk}`}
              title={aciklama}
            >
              {sube.ad} · {etiket}
            </span>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Hangi video, kaç cihazda takılıyor. Kare kaybı yüksekse cihaz o videoyu
 * zamanında çözemiyor demektir; ağla ilgisi yoktur.
 */
function TakilmaAnalizi({ data, now }: { data: Payload; now: number }) {
  const kaynak = data.ekranlar.filter(
    (e) => e.teshis && now - new Date(e.sonSinyal).getTime() < 86_400_000
  );

  const toplam = new Map<
    string,
    { oynatma: number; takilma: number; kare: number; kayip: number; ekran: number }
  >();
  for (const e of kaynak) {
    for (const [dosya, t] of Object.entries(e.teshis ?? {})) {
      const x = toplam.get(dosya) ?? { oynatma: 0, takilma: 0, kare: 0, kayip: 0, ekran: 0 };
      x.oynatma += t.oynatma;
      x.takilma += t.takilma;
      x.kare += t.kare;
      x.kayip += t.kayip;
      if (t.takilma > 0) x.ekran += 1;
      toplam.set(dosya, x);
    }
  }
  const satirlar = [...toplam.entries()].sort((a, b) => b[1].takilma - a[1].takilma);

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-zinc-400">
        Takılma analizi
        <span className="ml-2 font-normal text-zinc-600">
          son 24 saat · {kaynak.length} cihaz
        </span>
      </h2>
      {satirlar.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-500">
          Henüz veri yok. Kiosklar yeni sürüme geçip birkaç video oynattıkça burası
          dolacak.
        </p>
      ) : (
        <>
          <p className="text-xs text-zinc-500">
            <strong className="text-zinc-400">Kare kaybı</strong> yüksekse cihaz o
            videoyu zamanında çözemiyor: sorun ağda değil, donanımda. Bu durumda
            videoyu daha düşük kare hızıyla (30 kare/sn) yeniden kodlamak genelde
            çözer.
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-600">
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-2 font-medium">Video</th>
                  <th className="px-4 py-2 text-right font-medium">Oynatma</th>
                  <th className="px-4 py-2 text-right font-medium">Takılma</th>
                  <th className="px-4 py-2 text-right font-medium">Kare kaybı</th>
                  <th className="px-4 py-2 text-right font-medium">Takılan cihaz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {satirlar.map(([dosya, x]) => {
                  const kayipYuzde = x.kare > 0 ? (x.kayip / x.kare) * 100 : null;
                  return (
                    <tr key={dosya}>
                      <td className="max-w-[24rem] truncate px-4 py-2 text-zinc-100">{dosya}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-400">
                        {x.oynatma}
                      </td>
                      <td
                        className={`px-4 py-2 text-right tabular-nums ${
                          x.takilma > 0 ? "text-amber-400" : "text-zinc-600"
                        }`}
                      >
                        {x.takilma}
                      </td>
                      <td
                        className={`px-4 py-2 text-right tabular-nums ${
                          kayipYuzde === null
                            ? "text-zinc-700"
                            : kayipYuzde >= 5
                              ? "text-red-400"
                              : kayipYuzde >= 1
                                ? "text-amber-400"
                                : "text-zinc-500"
                        }`}
                      >
                        {kayipYuzde === null ? "—" : `%${SAYI.format(kayipYuzde)}`}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-zinc-400">
                        {x.ekran}/{kaynak.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

/** Ham sayı yerine saat başına takılma: sayfası 3 hafta açık kalan cihaz kıyaslanabilsin */
function TakilmaHucresi({ ekran }: { ekran: EkranSatiri }) {
  const saat = ekran.calismaSn / 3600;
  // Eski sürüm sayfa çalışma süresini göndermiyor; ham sayıyı göster
  if (saat < 0.25) {
    return (
      <span
        className={ekran.takilma > 0 ? "text-amber-400" : "text-zinc-600"}
        title="Sayfa açıldığından beri video verisi yetişmeyip duraklama sayısı"
      >
        {ekran.takilma}
      </span>
    );
  }
  const oran = ekran.takilma / saat;
  const renk = oran >= 2 ? "text-red-400" : oran > 0 ? "text-amber-400" : "text-zinc-600";
  return (
    <span
      className={renk}
      title={`${ekran.takilma} takılma, sayfa ${SAYI.format(saat)} saattir açık`}
    >
      {SAYI.format(oran)}/sa
    </span>
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
            {r.aciklama && (
              <span className="font-sans text-[11px] text-zinc-500">
                {r.aciklama}
              </span>
            )}
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
/* Yayın takvimi                                                       */
/* ------------------------------------------------------------------ */

function YayinTakvimi({ data, onChange }: { data: Payload; onChange: () => void }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-zinc-400">Yayın takvimi</h2>
      <p className="text-xs text-zinc-500">
        Tarih girilen medya yalnızca o aralıkta oynar; bitiş günü gece yarısına
        kadar dahildir. Süresi dolan medya bütün ekranlardan kendiliğinden düşer,
        tik kaldırmanız gerekmez. Boş bırakılan tarih sınırsız demektir.
      </p>
      <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-600">
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-2 font-medium">Medya</th>
              <th className="px-4 py-2 font-medium">Başlangıç</th>
              <th className="px-4 py-2 font-medium">Bitiş</th>
              <th className="px-4 py-2 font-medium">Durum</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {data.havuz.map((dosya) => (
              <TakvimSatiri
                key={dosya}
                dosya={dosya}
                boyut={data.boyutlar[dosya]}
                sunucu={data.takvim[dosya]}
                bugun={data.bugun}
                onChange={onChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TakvimSatiri({
  dosya,
  boyut,
  sunucu,
  bugun,
  onChange,
}: {
  dosya: string;
  boyut: number | undefined;
  sunucu: YayinAraligi | undefined;
  bugun: string;
  onChange: () => void;
}) {
  const [bas, setBas] = useState(sunucu?.baslangic ?? "");
  const [bit, setBit] = useState(sunucu?.bitis ?? "");
  const [kirli, setKirli] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [kaydediyor, start] = useTransition();
  const zamanlayici = useRef<number | undefined>(undefined);

  // Sunucudaki değer değişirse (kaydettik ya da başka biri düzenledi) yereli
  // güncelle — ama kullanıcı o an yazıyorsa yazdığının üstüne yazma.
  const sunucuAnahtar = `${sunucu?.baslangic ?? ""}|${sunucu?.bitis ?? ""}`;
  const [sonAnahtar, setSonAnahtar] = useState(sunucuAnahtar);
  if (!kirli && sunucuAnahtar !== sonAnahtar) {
    setSonAnahtar(sunucuAnahtar);
    setBas(sunucu?.baslangic ?? "");
    setBit(sunucu?.bitis ?? "");
  }

  useEffect(() => () => window.clearTimeout(zamanlayici.current), []);

  // Takvimden seçince de, elle yazınca da: yazmayı bitirince bir kez kaydet
  const kaydet = (yeniBas: string, yeniBit: string, gecikme = 700) => {
    window.clearTimeout(zamanlayici.current);
    zamanlayici.current = window.setTimeout(() => {
      start(async () => {
        const sonuc = await medyaTakvimAction(dosya, yeniBas, yeniBit);
        setHata(sonuc.hata);
        setKirli(false);
        onChange();
      });
    }, gecikme);
  };

  const durum = yayinDurumu(sunucu, bugun);
  const kalanGun = sunucu?.bitis ? gunFarki(bugun, sunucu.bitis) : null;

  let rozet: { metin: string; renk: string };
  if (durum === "bitti") {
    rozet = {
      metin: `Süresi doldu · son gün ${kisaTarih(sunucu!.bitis!)}`,
      renk: "text-red-400",
    };
  } else if (durum === "baslamadi") {
    rozet = {
      metin: `Başlamadı · başlangıç ${kisaTarih(sunucu!.baslangic!)}`,
      renk: "text-sky-400",
    };
  } else if (kalanGun !== null) {
    rozet =
      kalanGun <= 3
        ? {
            metin: kalanGun === 0 ? "Bugün son gün" : `Yayında · ${kalanGun} gün kaldı`,
            renk: "text-amber-400",
          }
        : {
            metin: `Yayında · son gün ${kisaTarih(sunucu!.bitis!)}`,
            renk: "text-emerald-400",
          };
  } else {
    rozet = { metin: sunucu ? "Yayında" : "Süresiz", renk: "text-zinc-500" };
  }

  const girdi =
    "rounded-md border border-zinc-700 bg-black px-2 py-1 text-sm text-zinc-100 outline-none focus:border-sky-500 [color-scheme:dark]";

  return (
    <tr className={durum === "yayinda" ? "" : "bg-zinc-900/40"}>
      <td className="max-w-[22rem] px-4 py-2">
        <div className="truncate text-zinc-100">{dosya}</div>
        <div className="text-xs text-zinc-600">
          {isImageFile(dosya) ? "Görsel" : "Video"}
          {boyut ? ` · ${SAYI.format(boyut / 1_048_576)} MB` : ""}
        </div>
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          value={bas}
          max={bit || undefined}
          onChange={(e) => {
            setBas(e.target.value);
            setKirli(true);
            setHata(null);
            kaydet(e.target.value, bit);
          }}
          className={girdi}
          aria-label={`${dosya} başlangıç tarihi`}
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          value={bit}
          min={bas || undefined}
          onChange={(e) => {
            setBit(e.target.value);
            setKirli(true);
            setHata(null);
            kaydet(bas, e.target.value);
          }}
          className={girdi}
          aria-label={`${dosya} bitiş tarihi`}
        />
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-xs">
        {hata ? (
          <span className="text-red-300">{hata}</span>
        ) : kirli || kaydediyor ? (
          <span className="text-zinc-500">Kaydediliyor…</span>
        ) : (
          <span className={rozet.renk}>{rozet.metin}</span>
        )}
      </td>
      <td className="px-4 py-2 text-right">
        {(bas || bit) && (
          <button
            type="button"
            onClick={() => {
              setBas("");
              setBit("");
              setKirli(true);
              setHata(null);
              kaydet("", "", 0);
            }}
            className="text-xs text-zinc-600 hover:text-zinc-300"
            title="Tarihleri kaldır, süresiz yayına al"
          >
            Temizle
          </button>
        )}
      </td>
    </tr>
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
    <div className="space-y-8">
      <YayinTakvimi data={data} onChange={onChange} />

      <section className="space-y-2">
      <h2 className="text-sm font-medium text-zinc-400">Şubelere atama</h2>
      <p className="text-xs text-zinc-500">
        Bir medyanın hangi şubelerde oynayacağını işaretleyin. Hiç işaret
        almayan şube havuzdaki <strong>tüm</strong> medyayı oynatır. Değişiklik
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
              const durum = yayinDurumu(data.takvim[dosya], data.bugun);
              return (
                <tr key={dosya} className={durum === "yayinda" ? "" : "opacity-40"}>
                  <td className="sticky left-0 max-w-[24rem] truncate bg-zinc-950 px-4 py-2 text-zinc-100">
                    {dosya}
                    {durum !== "yayinda" ? (
                      <span
                        className={`ml-2 text-xs ${
                          durum === "bitti" ? "text-red-400" : "text-sky-400"
                        }`}
                      >
                        ({durum === "bitti" ? "süresi doldu" : "henüz başlamadı"})
                      </span>
                    ) : (
                      secili.length === 0 && (
                        <span className="ml-2 text-xs text-zinc-600">
                          (hiçbir şubede seçili değil)
                        </span>
                      )
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
      </section>
    </div>
  );
}

/** Kiosk diskinde kaç medyanın hazır olduğu. Tam doluysa video internetsiz oynar. */
function OnbellekRozeti({ hazir, toplam }: { hazir: number; toplam: number }) {
  if (!toplam) {
    // Eski sürüm sayfa veya Service Worker desteklemeyen tarayıcı
    return <span className="text-zinc-700">—</span>;
  }
  const tam = hazir >= toplam;
  return (
    <span
      className={tam ? "text-emerald-400" : "text-sky-400"}
      title={tam ? "Tüm medya bu cihazın diskinde" : "İndiriliyor"}
    >
      {tam ? "✓ " : "↓ "}
      {hazir}/{toplam}
    </span>
  );
}
