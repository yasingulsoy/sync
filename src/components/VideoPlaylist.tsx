"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GORSEL_SURESI_MS, isImageFile } from "@/lib/medya";

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

/** "medipol/tanitim (1).mp4" -> "/videos/medipol/tanitim%20(1).mp4" */
function mediaSrc(name: string): string {
  return `/videos/${name.split("/").map(encodeURIComponent).join("/")}`;
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
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
  const [index, setIndex] = useState(0);

  // Liste: acilista bir kez + periyodik yenileme
  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({ id: screenId() });
    if (group) params.set("grup", group);
    const url = `/api/videos?${params}`;

    const fetchList = () => {
      fetch(url, { cache: "no-store" })
        .then((r) => r.json())
        .then((data: { videos?: string[] }) => {
          if (cancelled) return;
          const next = data.videos ?? [];
          // Ayni liste geldiyse state'e dokunma; oynayan video kesilmesin.
          setList((prev) => (sameList(prev, next) ? prev : next));
        })
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

  const goNext = useCallback(() => {
    if (list.length === 0) return;
    setIndex((i) => (i + 1) % list.length);
  }, [list.length]);

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
    if (list.length > 1) goNext();
  }, [goNext, list.length]);

  useEffect(() => {
    const v = videoRef.current;
    // Gorsel gosterilirken <video> render edilmiyor
    if (!v || !current || gorsel) return;
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
  }, [current, gorsel]);

  // Gorselin "bitis" olayi yok; sureyi biz sayip siradakine geciyoruz.
  // Havuzda tek gorsel varsa zamanlayici kurulmaz, kalici olarak durur.
  useEffect(() => {
    if (!gorsel || list.length < 2) return;
    const t = window.setTimeout(() => goNext(), GORSEL_SURESI_MS);
    return () => window.clearTimeout(t);
  }, [gorsel, current, goNext, list.length]);

  /* ---------- Panel sinyali ---------- */

  const beatRef = useRef({ current: null as string | null, index: 0, total: 0 });

  // Sinyalin tasiyacagi son durum; asagidaki efektlerden once calisir
  useEffect(() => {
    beatRef.current = { current, index: safeIndex, total: list.length };
  }, [current, safeIndex, list.length]);

  const sendBeat = useCallback(
    (id: string) => {
      if (!id) return;
      const body = JSON.stringify({ id, ...beatRef.current });
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
          src={mediaSrc(current)}
          alt=""
          onError={handleError}
        />
      ) : (
        <video
          ref={videoRef}
          className="relative z-0 block h-full w-full min-h-0 object-contain"
          src={current ? mediaSrc(current) : undefined}
          playsInline
          autoPlay
          muted
          loop={singleVideo}
          onEnded={goNext}
          onError={handleError}
          aria-label="Video oynatıcı (sessiz)"
        />
      )}
      {children}
    </div>
  );
}
