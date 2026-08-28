/**
 * Canli ekran kaydi — hangi ekran nerede, ne oynatiyor.
 *
 * Bellekte tutulur: uygulama yeniden baslatildiginda (deploy) sifirlanir ve
 * ekranlar bir sonraki sinyalde (en gec ~1 dk) tekrar listeye girer.
 * Birden fazla sunucu ornegi calisiyorsa her ornek kendi listesini gorur.
 */

export type ScreenSource = "ip" | "url" | "default";

export type ScreenState = {
  /** Tarayicida localStorage'da saklanan kalici cihaz kimligi */
  id: string;
  ip: string;
  /** IP'nin okundugu HTTP basligi */
  via: string;
  group: string;
  label: string;
  source: ScreenSource;
  firstSeen: number;
  lastSeen: number;
  hits: number;
  /** Su an oynayan dosya (heartbeat ile gelir) */
  current: string | null;
  index: number;
  total: number;
  userAgent: string;
};

const MAX_SCREENS = 500;

const store = globalThis as unknown as {
  __signageScreens?: Map<string, ScreenState>;
};
const screens: Map<string, ScreenState> = (store.__signageScreens ??= new Map());

function evictIfNeeded() {
  if (screens.size <= MAX_SCREENS) return;
  const oldest = [...screens.values()].sort((a, b) => a.lastSeen - b.lastSeen);
  for (const s of oldest.slice(0, screens.size - MAX_SCREENS)) {
    screens.delete(s.id);
  }
}

export type TouchInput = {
  id: string;
  ip: string;
  via: string;
  group: string;
  label: string;
  source: ScreenSource;
  userAgent: string;
  now: number;
};

/** Ekran listeyi cektiginde cagrilir (grup/IP bilgisini gunceller) */
export function touchScreen(input: TouchInput): ScreenState {
  const existing = screens.get(input.id);
  const next: ScreenState = {
    id: input.id,
    ip: input.ip,
    via: input.via,
    group: input.group,
    label: input.label,
    source: input.source,
    firstSeen: existing?.firstSeen ?? input.now,
    lastSeen: input.now,
    hits: (existing?.hits ?? 0) + 1,
    current: existing?.current ?? null,
    index: existing?.index ?? 0,
    total: existing?.total ?? 0,
    userAgent: input.userAgent,
  };
  screens.set(next.id, next);
  evictIfNeeded();
  return next;
}

export type HeartbeatInput = {
  id: string;
  current: string | null;
  index: number;
  total: number;
  now: number;
};

/** Ekran duzenli sinyal gonderdiginde cagrilir (ne oynattigini bildirir) */
export function beatScreen(input: HeartbeatInput): boolean {
  const existing = screens.get(input.id);
  if (!existing) return false;
  screens.set(input.id, {
    ...existing,
    lastSeen: input.now,
    current: input.current,
    index: input.index,
    total: input.total,
  });
  return true;
}

export function listScreens(): ScreenState[] {
  return [...screens.values()].sort((a, b) => b.lastSeen - a.lastSeen);
}

export function clearScreens(): void {
  screens.clear();
}
