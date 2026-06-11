export type PlaylistItem =
  | { type: "video"; name: string }
  | { type: "image"; name: string };

/** Her videodan sonra bir kampanya görseli (sık tekrar). */
export function buildMediaPlaylist(
  videos: string[],
  images: string[],
): PlaylistItem[] {
  if (videos.length === 0) {
    return images.map((name) => ({ type: "image" as const, name }));
  }
  if (images.length === 0) {
    return videos.map((name) => ({ type: "video" as const, name }));
  }

  const result: PlaylistItem[] = [];
  let imageIndex = 0;
  for (const name of videos) {
    result.push({ type: "video", name });
    result.push({
      type: "image",
      name: images[imageIndex % images.length]!,
    });
    imageIndex += 1;
  }
  return result;
}

export function mediaSrc(item: PlaylistItem): string {
  const segment = encodeURIComponent(item.name);
  return item.type === "video" ? `/videos/${segment}` : `/images/${segment}`;
}
