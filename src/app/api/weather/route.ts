import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { wmoWeatherToTr } from "@/lib/wmoWeatherTr";

export const dynamic = "force-dynamic";

const DEFAULT = {
  city: "İstanbul",
  region: "Marmara",
  country: "Türkiye",
  lat: 41.0082,
  lon: 28.9784,
};

function isLocalOrPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === "127.0.0.1" || ip === "::1") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

async function geoFromIp(ip: string) {
  if (isLocalOrPrivateIp(ip)) {
    return { ...DEFAULT, fallback: true as const };
  }

  const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error("geo_http");
  const data = (await res.json()) as {
    success?: boolean;
    city?: string;
    region?: string;
    country?: string;
    latitude?: number | string;
    longitude?: number | string;
  };
  if (!data.success) throw new Error("geo_fail");

  const lat = Number(data.latitude);
  const lon = Number(data.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error("geo_coords");

  return {
    city: data.city || DEFAULT.city,
    region: data.region || "",
    country: data.country || "",
    lat,
    lon,
    fallback: false as const,
  };
}

function dayHeading(index: number, isoDate: string): string {
  if (index === 0) return "Bugün";
  if (index === 1) return "Yarın";
  const d = new Date(isoDate + "T12:00:00");
  const name = d.toLocaleDateString("tr-TR", { weekday: "long" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

async function forecast(lat: number, lon: number) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "weather_code",
      "wind_speed_10m",
    ].join(","),
    daily: ["weather_code", "temperature_2m_max", "temperature_2m_min"].join(","),
    timezone: "auto",
    forecast_days: "7",
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error("meteo_http");
  const data = (await res.json()) as {
    current?: {
      temperature_2m?: number;
      apparent_temperature?: number;
      relative_humidity_2m?: number;
      weather_code?: number;
      wind_speed_10m?: number;
    };
    daily?: {
      time?: string[];
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
    };
  };
  const c = data.current;
  const daily = data.daily;
  if (!c || !daily?.time?.length) throw new Error("meteo_data");

  const days = daily.time.map((iso, i) => {
    const code = daily.weather_code?.[i] ?? 0;
    const max = daily.temperature_2m_max?.[i];
    const min = daily.temperature_2m_min?.[i];
    return {
      date: iso,
      label: dayHeading(i, iso),
      code,
      summary: wmoWeatherToTr(code),
      maxC: max != null ? Math.round(max * 10) / 10 : null,
      minC: min != null ? Math.round(min * 10) / 10 : null,
    };
  });

  return {
    current: {
      tempC: Math.round((c.temperature_2m ?? 0) * 10) / 10,
      apparentC:
        c.apparent_temperature != null
          ? Math.round(c.apparent_temperature * 10) / 10
          : null,
      humidity: c.relative_humidity_2m ?? null,
      weatherCode: c.weather_code ?? 0,
      summary: wmoWeatherToTr(c.weather_code ?? 0),
      windKmh: c.wind_speed_10m ?? null,
    },
    days,
  };
}

export async function GET() {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip =
      forwarded?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      h.get("cf-connecting-ip") ||
      "";

    const geo = await geoFromIp(ip);
    const fc = await forecast(geo.lat, geo.lon);

    return NextResponse.json({
      ok: true as const,
      location: {
        city: geo.city,
        region: geo.region,
        country: geo.country,
        lat: geo.lat,
        lon: geo.lon,
        approximate: true,
        usedDefault: geo.fallback,
      },
      current: fc.current,
      days: fc.days,
    });
  } catch {
    return NextResponse.json(
      {
        ok: false as const,
        error: "weather_unavailable",
        location: DEFAULT,
        current: {
          tempC: null,
          apparentC: null,
          humidity: null,
          weatherCode: 0,
          summary: "—",
          windKmh: null,
        },
        days: [] as {
          date: string;
          label: string;
          code: number;
          summary: string;
          maxC: number | null;
          minC: number | null;
        }[],
      },
      { status: 200 }
    );
  }
}
