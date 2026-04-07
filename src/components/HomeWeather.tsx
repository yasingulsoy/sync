"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { WEATHER_BAND_HEIGHT_PX } from "@/lib/weatherBandLayout";
import { wmoWeatherToEmoji } from "@/lib/wmoWeatherTr";

type DayForecast = {
  date: string;
  label: string;
  code: number;
  summary: string;
  maxC: number | null;
  minC: number | null;
};

type WeatherPayload = {
  ok: boolean;
  location: {
    city: string;
    region: string;
    country: string;
    usedDefault?: boolean;
  };
  current: {
    summary: string;
    weatherCode: number;
    tempC: number | null;
    apparentC: number | null;
    humidity: number | null;
    windKmh: number | null;
  };
  days: DayForecast[];
};

function formatSegment(d: DayForecast): string {
  const icon = wmoWeatherToEmoji(d.code);
  let range = "";
  if (d.maxC != null && d.minC != null) range = `${d.maxC}° / ${d.minC}°`;
  else if (d.maxC != null) range = `${d.maxC}°`;
  const parts = [d.label, d.summary, range].filter(Boolean);
  return `${icon} ${parts.join(" · ")}`;
}

/** Metin uzunluğuna göre süre: haber bandı gibi akıcı ama okunaklı kalır */
function marqueeDurationSec(text: string): number {
  if (!text.length) return 40;
  const charPerSec = 11;
  const t = text.length / charPerSec;
  return Math.min(120, Math.max(26, t));
}

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );
}

type HomeWeatherProps = {
  /** Bant görünsün mü (periyodik, W tuşu vb.) — süre her zaman 15 sn (HomeShell) */
  bandActive: boolean;
  /** Tam ekranda haber bandı gibi kayan metin; değilse tek satır statik */
  scrollTicker?: boolean;
};

export function HomeWeather({ bandActive, scrollTicker = false }: HomeWeatherProps) {
  const [data, setData] = useState<WeatherPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/weather")
      .then((r) => r.json())
      .then((j: WeatherPayload) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tickerText = useMemo(() => {
    if (!data?.days?.length) return "";
    const body = data.days.map(formatSegment).join("    •    ");
    return `${body}    •    `;
  }, [data]);

  const marqueeSeconds = useMemo(
    () => marqueeDurationSec(tickerText),
    [tickerText]
  );

  if (!bandActive) {
    return null;
  }

  const bandPositionClass =
    "pointer-events-none absolute bottom-0 left-0 right-0 z-[100]";

  if (loading) {
    return (
      <div
        className={`${bandPositionClass} flex items-center justify-center overflow-hidden border-t border-white/10 bg-black/85 text-lg text-zinc-400 backdrop-blur-md`}
        style={{ height: WEATHER_BAND_HEIGHT_PX }}
        aria-live="polite"
        aria-busy="true"
      >
        Hava durumu yükleniyor…
      </div>
    );
  }

  if (!data || !tickerText) {
    return (
      <div
        className={`${bandPositionClass} flex items-center justify-center overflow-hidden border-t border-white/10 bg-black/85 px-4 text-lg text-zinc-500`}
        style={{ height: WEATHER_BAND_HEIGHT_PX }}
      >
        Hava verisi alınamadı
      </div>
    );
  }

  const place = [data.location.city, data.location.region || data.location.country]
    .filter(Boolean)
    .join(" · ");
  const curIcon = wmoWeatherToEmoji(data.current.weatherCode ?? 0);

  const marqueeStyle = {
    ["--marquee-duration" as string]: `${marqueeSeconds}s`,
  } as CSSProperties;

  return (
    <div
      className={`${bandPositionClass} flex flex-col overflow-hidden border-t-2 border-amber-600/80 bg-gradient-to-b from-zinc-950 to-black shadow-[0_-12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md`}
      style={{ height: WEATHER_BAND_HEIGHT_PX } satisfies CSSProperties}
      aria-label="Hava durumu haber bandı"
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/40 px-4 py-2 text-base text-zinc-400">
        <span className="text-4xl leading-none" aria-hidden>
          {curIcon}
        </span>
        <span className="min-w-0 shrink text-lg font-semibold text-zinc-100">{place}</span>
        {data.location.usedDefault && (
          <span className="hidden text-base text-zinc-500 sm:inline">(varsayılan konum)</span>
        )}
        {data.current.tempC != null && (
          <span className="ml-auto shrink-0 text-lg tabular-nums font-medium text-amber-200/95">
            Şu an {data.current.tempC}°C · {data.current.summary}
          </span>
        )}
      </div>

      {reducedMotion || !scrollTicker ? (
        <div className="flex min-h-0 flex-1 items-center overflow-hidden px-4 py-2 text-xl leading-snug text-zinc-50">
          {tickerText}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 min-w-0 items-stretch overflow-hidden">
          <div
            className="flex shrink-0 items-center bg-amber-600 px-4 py-2 text-lg font-bold uppercase tracking-widest text-black shadow-inner"
            aria-hidden
          >
            Hava
          </div>
          <div className="relative min-w-0 flex-1 overflow-hidden border-l border-white/10 bg-black/50">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-black/90 to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-black/90 to-transparent"
              aria-hidden
            />
            <div className="flex h-full items-center overflow-hidden py-1.5 pl-2">
              <div
                className="weather-marquee-track flex w-max items-center"
                style={marqueeStyle}
              >
                <div className="flex shrink-0 items-center pr-20 pl-2 text-xl font-semibold tabular-nums tracking-wide text-zinc-50">
                  <TickerInner text={tickerText} />
                </div>
                <div
                  className="flex shrink-0 items-center pr-20 pl-2 text-xl font-semibold tabular-nums tracking-wide text-zinc-50"
                  aria-hidden
                >
                  <TickerInner text={tickerText} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TickerInner({ text }: { text: string }) {
  return <span className="inline-block whitespace-nowrap">{text}</span>;
}
