"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GORSEL_SURESI_MS, isImageFile } from "@/lib/medya";
import {
  medyaAdresi,
  onbellegiBaslat,
  onbellegiIsit,
  onbellekDurumu,
} from "@/lib/onbellek";
import { kioskSurumu, surumGeldi, yenile, yenilemeBekliyor } from "@/lib/guncelleme";
import type { VideoTeshis } from "@/lib/db/schema";

const shellClassName =
  "fixed left-0 right-0 top-0 z-0 w-full max-w-[100vw] overflow-hidden bg-black";

/** Liste ne siklikta yenilenir — yeni video eklendiginde ekran yeniden baslatilmasin diye */
const LIST_REFRESH_MS = 300_000;
/** Panele "yasiyorum, sunu oynatiyorum" sinyali */
const HEARTBEAT_MS = 60_000;

const SCREEN_ID_KEY = "hospisync-ekran-id";

/** Cihaza ozel kalici kimlik: ayni hastanede birden fazla TV'yi ayirt etmek icin */
function loadScreenId(): string {
  const fallback = () =>
    `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  try {
    const existing = window.localStorage.getItem(SCREEN_ID_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : fallback();
    window.localStorage.setItem(SCREEN_ID_KEY, id);
    return id;
  } catch {
    // localStorage kapaliysa (gizli mod, eski WebView) oturumluk kimlik
    return fallback();
  }
}

let cachedScreenId: string | null = null;

/** Kimligi bir kez uret, sonra bellekten ver (yalnizca efektlerden cagrilir) */
function screenId(): string {
  if (cachedScreenId === null) cachedScreenId = loadScreenId();
  return cachedScreenId;
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function teshisKaydi(hepsi: Record<string, VideoTeshis>, dosya: string): VideoTeshis {
  return (hepsi[dosya] ??= { oynatma: 0, takilma: 0, kare: 0, kayip: 0 });
}

function sameSizes(a: Record<string, number>, b: Record<string, number>): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

export function VideoPlaylist({
  bottomInsetPx = 0,
  group,
  children,
}: {
  bottomInsetPx?: number;
  /** URL ile verilen grup (/fs/medipol). Verilmezse sunucu IP'ye gore secer. */
  group?: string;
  /** Tam ekran ağacının içinde olmalı (ör. hava bandı); aksi halde tam ekranda görünmez */
  children?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [list, setList] = useState<string[]>([]);
  const [boyutlar, setBoyutlar] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);

  // Isitma su an oynayanin siradakinden baslasin diye efekt disindan okunuyor
  const indexRef = useRef(0);
  // Panele giden son durum (olay isleyicileri de buradan okur)
  const beatRef = useRef({ current: null as string | null, index: 0, total: 0 });
  // Oynatma sirasinda "veri yetismedi, bekliyorum" sayisi — panele gider
  const takilmaRef = useRef(0);
  // Video basina teshis: hangi video takiliyor, cihaz hangisini cozemiyor
  const teshisRef = useRef<Record<string, VideoTeshis>>({});

  useEffect(() => {
    onbellegiBaslat();
  }, []);

  // Liste: acilista bir kez + periyodik yenileme
  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({ id: screenId() });
    if (group) params.set("grup", group);
    const url = `/api/videos?${params}`;

    const fetchList = () => {
      fetch(url, { cache: "no-store" })
        .then((r) => r.json())
        .then(
          (data: {
            videos?: string[];
            boyutlar?: Record<string, number>;
            surum?: string;
          }) => {
          if (cancelled) return;
          // Yeni deploy varsa bir sonraki medya gecisinde sayfa yenilenir
          surumGeldi(data.surum);
          const next = data.videos ?? [];
          const nextBoyutlar = data.boyutlar ?? {};
          // Ayni liste geldiyse state'e dokunma; oynayan video kesilmesin.
          setList((prev) => (sameList(prev, next) ? prev : next));
          setBoyutlar((prev) => (sameSizes(prev, nextBoyutlar) ? prev : nextBoyutlar));
          // Eksik dosyalari arka planda diske indir (zaten calisiyorsa atlar)
          void onbellegiIsit(next, nextBoyutlar, indexRef.current);
          }
        )
        .catch(() => {
          /* ag koptuysa mevcut listeyle devam et */
        });
    };

    fetchList();
    const id = window.setInterval(fetchList, LIST_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [group]);

  // Liste kisalirsa index tasabilir; modulo ile guvenli tut
  const safeIndex = list.length ? ((index % list.length) + list.length) % list.length : 0;
  const current = list[safeIndex] ?? null;
  const currentSrc = current ? medyaAdresi(current, boyutlar[current]) : null;

  useEffect(() => {
    indexRef.current = safeIndex;
  }, [safeIndex]);

  const goNext = useCallback(() => {
    if (list.length === 0) return;
    setIndex((i) => (i + 1) % list.length);
  }, [list.length]);

  // Otomatik gecislerin hepsi buradan: yeni surum bekliyorsa video
  // ortasinda degil, iki medya arasinda yenilenir.
  const gecis = useCallback(() => {
    if (yenilemeBekliyor()) {
      void yenile().then((oldu) => {
        if (!oldu) goNext();
      });
      return;
    }
    goNext();
  }, [goNext]);

  const goPrev = useCallback(() => {
    if (list.length === 0) return;
    setIndex((i) => (i - 1 + list.length) % list.length);
  }, [list.length]);

  const gorsel = current !== null && isImageFile(current);

  // Tek video kaldiginda goNext ayni index'e doner ve efekt tetiklenmez;
  // <video loop> olmadan ekran biten karede donar.
  const singleVideo = list.length === 1 && !gorsel;

  // Bozuk/eksik dosyada siyah ekranda kalmak yerine sonrakine gec
  const handleError = useCallback(() => {
    if (list.length > 1) gecis();
  }, [gecis, list.length]);

  useEffect(() => {
    const v = videoRef.current;
    // Gorsel gosterilirken <video> render edilmiyor
    if (!v || !currentSrc || gorsel) return;
    const keepSilent = () => {
      v.muted = true;
      v.volume = 0;
    };
    keepSilent();
    v.addEventListener("volumechange", keepSilent);
    v.load();
    const p = v.play();
    if (p !== undefined) p.catch(() => {});
    return () => v.removeEventListener("volumechange", keepSilent);
  }, [currentSrc, gorsel]);

  // Video oynarken veri yetismeyip durursa say. Videonun basindaki ilk
  // yukleme beklemesi ve ileri/geri sarma beklemesi takilma degil, sayilmaz.
  const handleWaiting = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.currentTime <= 0.5 || v.seeking) return;
    takilmaRef.current += 1;
    const dosya = beatRef.current.current;
    if (dosya) teshisKaydi(teshisRef.current, dosya).takilma += 1;
  }, []);

  // Video sonuna kadar oynadiginda kare istatistigini kaydet. Atlanan kare
  // orani yuksekse sorun ag degil, cihaz bu videoyu cozmekte zorlaniyor.
  const handleEnded = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const dosya = beatRef.current.current;
      if (dosya) {
        const t = teshisKaydi(teshisRef.current, dosya);
        t.oynatma += 1;
        const q = e.currentTarget.getVideoPlaybackQuality?.();
        if (q) {
          t.kare += q.totalVideoFrames;
          t.kayip += q.droppedVideoFrames;
        }
      }
      gecis();
    },
    [gecis]
  );

  // Gorselin "bitis" olayi yok; sureyi biz sayip siradakine geciyoruz.
  // Havuzda tek gorsel varsa zamanlayici kurulmaz, kalici olarak durur.
  useEffect(() => {
    if (!gorsel || list.length < 2) return;
    const t = window.setTimeout(() => gecis(), GORSEL_SURESI_MS);
    return () => window.clearTimeout(t);
  }, [gorsel, current, gecis, list.length]);

  /* ---------- Panel sinyali ---------- */

  // Sinyalin tasiyacagi son durum; asagidaki efektlerden once calisir
  useEffect(() => {
    beatRef.current = { current, index: safeIndex, total: list.length };
  }, [current, safeIndex, list.length]);

  const sendBeat = useCallback(
    (id: string) => {
      if (!id) return;
      const body = JSON.stringify({
        id,
        ...beatRef.current,
        onbellek: onbellekDurumu(),
        takilma: takilmaRef.current,
        surum: kioskSurumu(),
        // Sayfa acilisindan beri gecen sure: takilma sayisini saate bolmek icin
        calisma: Math.round(performance.now() / 1000),
        teshis: teshisRef.current,
      });
      fetch("/api/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    },
    []
  );

  useEffect(() => {
    const id = screenId();
    sendBeat(id);
    const timer = window.setInterval(() => sendBeat(id), HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [sendBeat]);

  // Video degistiginde beklemeden bildir
  useEffect(() => {
    if (!current) return;
    sendBeat(screenId());
  }, [current, sendBeat]);

  /* ---------- Tam ekran ve klavye ---------- */

  const enterFullscreenFromUser = useCallback(() => {
    const el = containerRef.current;
    if (!el || document.fullscreenElement) return;
    void el.requestFullscreen().catch(() => {});
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  }, []);

  const toggleFullscreenRef = useRef(toggleFullscreen);
  const goNextRef = useRef(goNext);
  const goPrevRef = useRef(goPrev);
  const listLengthRef = useRef(list.length);

  useEffect(() => {
    toggleFullscreenRef.current = toggleFullscreen;
    goNextRef.current = goNext;
    goPrevRef.current = goPrev;
    listLengthRef.current = list.length;
  }, [toggleFullscreen, goNext, goPrev, list.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        toggleFullscreenRef.current();
        return;
      }
      if (listLengthRef.current === 0) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNextRef.current();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrevRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shellStyle = {
    bottom: bottomInsetPx,
    transition: "bottom 0.45s cubic-bezier(0.32, 0.72, 0, 1)",
  } as const;

  if (list.length === 0) {
    return (
      <div
        ref={containerRef}
        className={shellClassName}
        style={shellStyle}
        onDoubleClick={enterFullscreenFromUser}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={shellClassName}
      style={shellStyle}
      onDoubleClick={enterFullscreenFromUser}
    >
      {gorsel && current ? (
        // Kiosk tam ekran gosterimi; next/image optimizasyonu yerel dosyada
        // kazanc saglamiyor, ekstra karmasiklik getiriyor.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="relative z-0 block h-full w-full min-h-0 object-contain"
          src={currentSrc ?? undefined}
          alt=""
          onError={handleError}
        />
      ) : (
        <video
          ref={videoRef}
          className="relative z-0 block h-full w-full min-h-0 object-contain"
          src={currentSrc ?? undefined}
          playsInline
          autoPlay
          muted
          loop={singleVideo}
          onEnded={handleEnded}
          onError={handleError}
          onWaiting={handleWaiting}
          aria-label="Video oynatıcı (sessiz)"
        />
      )}
      {children}
    </div>
  );
}
