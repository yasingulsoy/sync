"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildMediaPlaylist,
  mediaSrc,
  type PlaylistItem,
} from "@/lib/mediaPlaylist";

const shellClassName =
  "relative fixed left-0 right-0 top-0 z-0 w-full max-w-[100vw] overflow-hidden bg-black";

/** Kampanya görsellerinin ekranda kalma süresi */
const IMAGE_DISPLAY_MS = 8_000;

export function VideoPlaylist({
  bottomInsetPx = 0,
  children,
}: {
  bottomInsetPx?: number;
  /** Tam ekran ağacının içinde olmalı (ör. hava bandı); aksi halde tam ekranda görünmez */
  children?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [list, setList] = useState<PlaylistItem[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/videos").then((r) => r.json()),
      fetch("/api/images").then((r) => r.json()),
    ])
      .then(([videoData, imageData]: [{ videos?: string[] }, { images?: string[] }]) => {
        setList(
          buildMediaPlaylist(videoData.videos ?? [], imageData.images ?? []),
        );
      })
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
    if (!v || !current || current.type !== "video") return;
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

  useEffect(() => {
    if (!current || current.type !== "image") return;
    const timer = window.setTimeout(goNext, IMAGE_DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [current, goNext]);

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
      {current.type === "video" ? (
        <video
          ref={videoRef}
          className="relative z-0 block h-full w-full min-h-0 object-contain"
          src={mediaSrc(current)}
          playsInline
          autoPlay
          muted
          onEnded={goNext}
          aria-label="Video oynatıcı (sessiz)"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaSrc(current)}
          alt=""
          className="relative z-0 block h-full w-full min-h-0 object-contain"
          draggable={false}
        />
      )}
      {children}
    </div>
  );
}
