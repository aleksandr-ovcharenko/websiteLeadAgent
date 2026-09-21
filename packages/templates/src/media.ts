/**
 * Canonical media URL resolution.
 *
 * Order:
 *  1. Valid absolute http(s) sourceUrl (external asset kept by reference).
 *  2. Local storage copy served by the renderer at /site-media/:siteId/:filename.
 *  3. undefined — callers must render a controlled empty state, never a broken <img>.
 */
export interface MediaLike {
  filename?: string | null;
  storagePath?: string | null;
  sourceUrl?: string | null;
}

export function mediaUrlOf(siteId: string | undefined | null, media: MediaLike | undefined | null): string | undefined {
  if (!media) return undefined;
  // 1. Local storage copy — authoritative when a file exists.
  const filename = media.filename || media.storagePath?.split('/').pop();
  if (siteId && filename) return `/site-media/${siteId}/${encodeURIComponent(filename)}`;
  // 2. Valid sourceUrl (external asset kept by reference).
  const sourceUrl = (media.sourceUrl || '').trim();
  if (/^https?:\/\//i.test(sourceUrl)) return sourceUrl;
  if (sourceUrl.startsWith('/')) return sourceUrl;
  return undefined;
}
