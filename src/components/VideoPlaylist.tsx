"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const shellClassName =
  "fixed inset-0 h-dvh min-h-dvh w-full max-w-[100vw] overflow-hidden bg-black";

export function VideoPlaylist() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [list, setList] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

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
  }, [current]);

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

  if (list.length === 0) {
    return (
      <div
        ref={containerRef}
        className={shellClassName}
        onDoubleClick={enterFullscreenFromUser}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={shellClassName}
      onDoubleClick={enterFullscreenFromUser}
    >
      <video
        ref={videoRef}
        className="block h-full w-full min-h-0 object-contain"
        src={`/videos/${current}`}
        playsInline
        autoPlay
        muted
        onEnded={goNext}
        aria-label="Video oynatıcı (sessiz)"
      />
    </div>
  );
}
