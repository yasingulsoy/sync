"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Bu süre boyunca fare/tıklama/klavye yoksa tam ekran açılır ve mümkünse açık kalır. */
const IDLE_MS = 15_000;

/** TV / kiosk tipi geniş ekranlarda tam ekran otomatik denenir (tarayıcı izin verirse). */
const AUTO_FULLSCREEN_MQ = "(min-width: 1024px) and (min-height: 600px)";

const shellClassName =
  "fixed inset-0 flex h-dvh min-h-dvh w-full max-w-[100vw] flex-col items-center justify-center overflow-hidden bg-black";

export function VideoPlaylist() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(0);
  const [list, setList] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((data: { videos?: string[] }) => setList(data.videos ?? []))
      .catch(() => setList([]));
  }, []);

  const current = list[index] ?? null;

  const goNext = useCallback(() => {
    if (list.length === 0) return;
    setIndex((i) => (i + 1) % list.length);
  }, [list.length]);

  const goPrev = useCallback(() => {
    if (list.length === 0) return;
    setIndex((i) => (i - 1 + list.length) % list.length);
  }, [list.length]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !current) return;
    v.load();
    const p = v.play();
    if (p !== undefined) p.catch(() => {});
  }, [current]);

  const enterFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el || document.fullscreenElement) return;
    void el.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(AUTO_FULLSCREEN_MQ);
    const tryAutoFullscreen = () => {
      if (!mq.matches) return;
      enterFullscreen();
    };
    tryAutoFullscreen();
    mq.addEventListener("change", tryAutoFullscreen);
    window.addEventListener("orientationchange", tryAutoFullscreen);
    return () => {
      mq.removeEventListener("change", tryAutoFullscreen);
      window.removeEventListener("orientationchange", tryAutoFullscreen);
    };
  }, [enterFullscreen]);

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

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      enterFullscreen();
    }, IDLE_MS);
  }, [enterFullscreen]);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    resetIdleTimer();
    const events = [
      "mousemove",
      "mousedown",
      "click",
      "touchstart",
      "keydown",
      "wheel",
      "pointerdown",
      "pointermove",
      "scroll",
    ] as const;
    const onActivity = () => {
      lastActivityRef.current = Date.now();
      resetIdleTimer();
    };
    events.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true }),
    );
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, [resetIdleTimer]);

  /** Çıkış (ESC vb.) yalnızca hareketsizlik halindeyse tekrar tam ekran — tam ekranda kal. */
  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement) return;
      const now = Date.now();
      if (now - lastActivityRef.current < IDLE_MS) return;
      requestAnimationFrame(() => {
        enterFullscreen();
      });
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [enterFullscreen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      lastActivityRef.current = Date.now();
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

  if (list.length === 0) {
    return (
      <div
        ref={containerRef}
        className={shellClassName}
        onDoubleClick={enterFullscreen}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={shellClassName}
      onDoubleClick={enterFullscreen}
    >
      <video
        ref={videoRef}
        className="max-h-full max-w-full shrink-0 object-contain"
        src={`/videos/${current}`}
        playsInline
        autoPlay
        muted={muted}
        onEnded={goNext}
        onClick={() => setMuted((m) => !m)}
        aria-label="Video oynatıcı"
      />
    </div>
  );
}
