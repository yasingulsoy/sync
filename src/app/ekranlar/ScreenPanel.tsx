"use client";

import { useCallback, useEffect, useState } from "react";
import { logoutAction } from "./actions";

type ScreenState = {
  id: string;
  ip: string;
  via: string;
  group: string;
  label: string;
  source: "ip" | "url" | "default";
  firstSeen: number;
  lastSeen: number;
  hits: number;
  current: string | null;
  index: number;
  total: number;
  userAgent: string;
};

type GroupRule = { group: string; label: string; ips: string[] };

type IpInfo = { city: string; region: string; country: string; isp: string };

type Payload = {
  ok: boolean;
  now: number;
  screens: ScreenState[];
  groups: GroupRule[];
  geo: Record<string, IpInfo>;
};

/** "Kayseri · Turk Telekom" — hangi IP'nin hangi sube oldugunu ayirt etmek icin */
function placeOf(info: IpInfo | undefined): string {
  if (!info) return "";
  const where = [info.city, info.region].filter(Boolean).join(", ");
  return [where, info.isp].filter(Boolean).join(" · ");
}

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

function deviceKind(ua: string): string {
  if (/Android/i.test(ua)) return "Android";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (!ua) return "—";
  return "Diğer";
}

function fileName(p: string | null): string {
  if (!p) return "—";
  const parts = p.split("/");
  return parts[parts.length - 1] ?? p;
}

export function ScreenPanel() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ekranlar", { cache: "no-store" });
      if (res.status === 401) {
        setError("Oturum düştü. Sayfayı yenileyip tekrar giriş yapın.");
        return;
      }
      if (!res.ok) throw new Error("http");
      setData((await res.json()) as Payload);
      setError(null);
    } catch {
      setError("Veri alınamadı.");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  if (error && !data) {
    return <p className="text-sm text-red-300">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-zinc-500">Yükleniyor…</p>;
  }

  const now = Date.now();
  const isLive = (s: ScreenState) => now - s.lastSeen < LIVE_WINDOW_MS;
  const live = data.screens.filter(isLive);

  // Henüz bir hastaneye bağlanmamış IP'ler — screenGroups.ts'e eklenmesi gerekenler
  const unmapped = [
    ...new Map(
      data.screens.filter((s) => s.source === "default" && s.ip).map((s) => [s.ip, s])
    ).values(),
  ];

  const byGroup = new Map<string, ScreenState[]>();
  for (const s of data.screens) {
    const key = s.group || "";
    const arr = byGroup.get(key);
    if (arr) arr.push(s);
    else byGroup.set(key, [s]);
  }

  const snippet = unmapped
    .map((s, i) => {
      const yer = placeOf(data.geo?.[s.ip]);
      const satir = `  { group: "sube${i + 1}", label: "Şube ${i + 1}", ips: ["${s.ip}"] },`;
      return yer ? `${satir} // ${yer}` : satir;
    })
    .join("\n");

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Ekran Paneli</h1>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="text-emerald-400">{live.length} ekran yayında</span>
            {" · "}
            {data.screens.length} kayıtlı cihaz · {byGroup.size} grup
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

      {data.screens.length === 0 && (
        <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm text-zinc-400">
          Henüz sinyal gelmedi. Ekranlar açık olsa bile bu liste uygulama her
          yeniden başlatıldığında (deploy) sıfırlanır; ekranlar en geç 1 dakika
          içinde tekrar buraya düşer.
        </p>
      )}

      {unmapped.length > 0 && (
        <section className="space-y-3 rounded-lg border border-amber-900/50 bg-amber-950/15 p-4">
          <div>
            <h2 className="font-medium text-amber-300">
              Eşleşmemiş IP ({unmapped.length})
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Bu IP&apos;ler hiçbir gruba bağlı değil, varsayılan videoları
              oynatıyorlar. Hangi şube olduklarını belirleyip aşağıdaki satırları{" "}
              <code className="rounded bg-black/50 px-1 text-zinc-300">
                src/lib/screenGroups.ts
              </code>{" "}
              içindeki listeye ekleyin.
            </p>
          </div>
          <ul className="space-y-1 text-sm">
            {unmapped.map((s) => (
              <li key={s.ip} className="flex flex-wrap gap-x-3 text-zinc-300">
                <code className="font-medium text-white">{s.ip}</code>
                <span className="text-amber-200/90">
                  {placeOf(data.geo?.[s.ip]) || "konum sorgulanıyor…"}
                </span>
                <span className="text-zinc-500">{deviceKind(s.userAgent)}</span>
                <span className="text-zinc-500">{since(now - s.lastSeen)}</span>
              </li>
            ))}
          </ul>
          <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-black/60 p-3 text-xs text-zinc-300">
            {snippet}
          </pre>
        </section>
      )}

      {[...byGroup.entries()].map(([group, list]) => (
        <section key={group || "_default"} className="space-y-2">
          <h2 className="flex flex-wrap items-baseline gap-2 text-sm font-semibold tracking-wide text-zinc-300">
            {list[0]?.label ?? "Varsayılan"}
            <code className="text-xs normal-case tracking-normal text-zinc-600">
              {group ? `public/videos/${group}` : "public/videos"}
            </code>
          </h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/80">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-600">
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-2 font-medium">Durum</th>
                  <th className="px-4 py-2 font-medium">IP</th>
                  <th className="px-4 py-2 font-medium">Konum / operatör</th>
                  <th className="px-4 py-2 font-medium">Şu an oynatılan</th>
                  <th className="px-4 py-2 font-medium">Sıra</th>
                  <th className="px-4 py-2 font-medium">Eşleşme</th>
                  <th className="px-4 py-2 font-medium">Son sinyal</th>
                  <th className="px-4 py-2 font-medium">Cihaz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {list.map((s) => {
                  const alive = isLive(s);
                  return (
                    <tr key={s.id} className={alive ? "" : "opacity-50"}>
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
                      <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-zinc-300">
                        {s.ip || "—"}
                      </td>
                      <td className="max-w-[16rem] truncate px-4 py-2 text-zinc-400">
                        {placeOf(data.geo?.[s.ip]) || "—"}
                      </td>
                      <td className="max-w-[22rem] truncate px-4 py-2 text-zinc-100">
                        {fileName(s.current)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 tabular-nums text-zinc-500">
                        {s.total ? `${s.index + 1}/${s.total}` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                        {s.source === "ip"
                          ? "IP kuralı"
                          : s.source === "url"
                            ? "URL ile"
                            : "varsayılan"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                        {since(now - s.lastSeen)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-zinc-500">
                        {deviceKind(s.userAgent)}
                        <span className="ml-2 font-mono text-xs text-zinc-700">
                          {s.id.slice(0, 6)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
