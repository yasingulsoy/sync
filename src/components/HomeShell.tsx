"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { HomeWeather } from "@/components/HomeWeather";
import { VideoPlaylist } from "@/components/VideoPlaylist";
import { WEATHER_BAND_HEIGHT_PX } from "@/lib/weatherBandLayout";

const FULLSCREEN_INTERVAL_MS = 120_000;
const BAND_VISIBLE_MS = 15_000;

function subscribeFullscreen(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
}

function getFullscreenSnapshot() {
  return !!document.fullscreenElement;
}

function getFullscreenServerSnapshot() {
  return false;
}

function useFullscreenElement(): boolean {
  return useSyncExternalStore(
    subscribeFullscreen,
    getFullscreenSnapshot,
    getFullscreenServerSnapshot
  );
}

function usePeriodicBandWhileFullscreen(isFs: boolean): boolean {
  const [tick, setTick] = useState(false);

  useEffect(() => {
    if (!isFs) {
      queueMicrotask(() => setTick(false));
      return;
    }
    let hideTimer: number | undefined;
    const showCycle = () => {
      setTick(true);
      hideTimer = window.setTimeout(() => {
        hideTimer = undefined;
        setTick(false);
      }, BAND_VISIBLE_MS);
    };
    const id = window.setInterval(showCycle, FULLSCREEN_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
      queueMicrotask(() => setTick(false));
    };
  }, [isFs]);

  return isFs && tick;
}

export function HomeShell() {
  const isFullscreen = useFullscreenElement();
  const periodicBand = usePeriodicBandWhileFullscreen(isFullscreen);
  const [manualBand, setManualBand] = useState(false);
  const manualHideRef = useRef<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "w" && e.key !== "W") return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (manualHideRef.current !== null) {
        clearTimeout(manualHideRef.current);
      }
      setManualBand(true);
      manualHideRef.current = window.setTimeout(() => {
        setManualBand(false);
        manualHideRef.current = null;
      }, BAND_VISIBLE_MS);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (manualHideRef.current !== null) {
        clearTimeout(manualHideRef.current);
      }
    };
  }, []);

  const showBand =
    manualBand || (isFullscreen && periodicBand);
  const bottomInset =
    showBand && isFullscreen ? WEATHER_BAND_HEIGHT_PX : 0;

  return (
    <VideoPlaylist bottomInsetPx={bottomInset}>
      <HomeWeather bandActive={showBand} scrollTicker={isFullscreen} />
    </VideoPlaylist>
  );
}
