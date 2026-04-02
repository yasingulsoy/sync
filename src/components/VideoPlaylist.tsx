"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const IDLE_MS = 20_000;

export function VideoPlaylist() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    resetIdleTimer();
    const events = [
      "mousemove",
      "mousedown",
      "touchstart",
      "keydown",
      "wheel",
      "pointerdown",
      "scroll",
    ] as const;
    const onActivity = () => resetIdleTimer();
    events.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true }),
    );
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, [resetIdleTimer]);

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

  if (list.length === 0) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 bg-black"
        onDoubleClick={toggleFullscreen}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black"
      onDoubleClick={toggleFullscreen}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
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
