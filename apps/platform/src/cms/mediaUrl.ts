// Canonical media URL resolution — mirror of packages/templates/src/media.ts.
// Keep the rules identical: absolute sourceUrl → local /site-media → undefined.
export interface MediaLike {
  filename?: string | null
  storagePath?: string | null
  sourceUrl?: string | null
  url?: string | null
}

export function mediaUrlOf(siteId: string | undefined | null, media: MediaLike | undefined | null): string | undefined {
  if (!media) return undefined
  // 1. Local storage copy — authoritative when a file exists.
  const filename = media.filename || media.storagePath?.split('/').pop()
  if (siteId && filename) return `/site-media/${siteId}/${encodeURIComponent(filename)}`
  // 2. Valid sourceUrl (external asset kept by reference).
  const sourceUrl = (media.sourceUrl || '').trim()
  if (/^https?:\/\//i.test(sourceUrl)) return sourceUrl
  if (sourceUrl.startsWith('/')) return sourceUrl
  return undefined
}
