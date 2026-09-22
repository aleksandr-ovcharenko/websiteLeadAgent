// V3.7.3 — bounded deterministic repairs driven by VISUAL_VALIDATED findings.
//
// Allowed repairs only (mirrors the V3.7.2 repair policy):
//   clear-broken-image — detach a media reference that renders nothing
//     (0-byte / 404 / zero natural dims), preferring another verified media
//     of the SAME entity before falling back to text-only composition.
//   scrub-leaked-text — remove a leaked technical/chrome fragment from CMS
//     text fields it was never supposed to enter.
//
// Every applied repair is recorded with evidence in the returned log.

import type { PrismaClient } from '@prisma/client';
import type { VisualRepairHint } from './visualQa.js';

export interface AppliedRepair {
  kind: string;
  detail: string;
  entity?: string;
  field?: string;
  before?: string;
  after?: string;
}

function stripMediaTail(url: string): string {
  // "/site-media/x.png" or full URL — match on the path tail.
  try { return new URL(url, 'http://x').pathname.split('/').pop() || url; } catch { return url; }
}

export async function applyVisualRepairs(
  prisma: PrismaClient,
  siteId: string,
  hints: VisualRepairHint[],
): Promise<AppliedRepair[]> {
  const applied: AppliedRepair[] = [];

  for (const hint of hints) {
    if (hint.kind === 'clear-broken-image') {
      const tail = hint.mediaUrl ? stripMediaTail(hint.mediaUrl) : null;
      const media = tail
        ? await (prisma as any).media.findFirst({
            where: { siteId, OR: [{ storagePath: { endsWith: tail } }, { sourceUrl: { endsWith: tail } }, { filename: tail }, { originalFilename: tail }] },
          }).catch(() => null)
        : null;
      if (!media) {
        applied.push({ kind: hint.kind, detail: `no media row matched ${tail || 'unknown'} — left for review` });
        continue;
      }
      // Detach from every cover/image slot that references it.
      for (const [model, field] of [
        ['project', 'coverImageId'], ['product', 'coverImageId'], ['newsPost', 'coverImageId'], ['service', 'imageId'],
      ] as const) {
        const rows: any[] = await (prisma as any)[model].findMany({ where: { siteId, [field]: media.id }, select: { id: true, slug: true } }).catch(() => []);
        for (const row of rows) {
          // Prefer a sibling media of the same entity (gallery member).
          let replacement: string | null = null;
          if (model === 'project') {
            const pm = await (prisma as any).projectMedia.findFirst({
              where: { projectId: row.id, mediaId: { not: media.id } }, orderBy: { sortOrder: 'asc' }, select: { mediaId: true },
            }).catch(() => null);
            replacement = pm?.mediaId ?? null;
          }
          if (model === 'product') {
            const pm = await (prisma as any).productMedia.findFirst({
              where: { productId: row.id, mediaId: { not: media.id } }, orderBy: { sortOrder: 'asc' }, select: { mediaId: true },
            }).catch(() => null);
            replacement = pm?.mediaId ?? null;
          }
          await (prisma as any)[model].update({ where: { id: row.id }, data: { [field]: replacement } });
          applied.push({
            kind: hint.kind, detail: hint.detail, entity: `${model}:${row.slug}`,
            field, before: media.id, after: replacement ?? 'null (text-only composition)',
          });
        }
      }
      // Also remove orphan join rows so galleries don't hold dead frames.
      await (prisma as any).projectMedia.deleteMany({ where: { mediaId: media.id } }).catch(() => undefined);
      await (prisma as any).productMedia.deleteMany({ where: { mediaId: media.id } }).catch(() => undefined);
    }

    if (hint.kind === 'scrub-leaked-text' && hint.text) {
      const needle = hint.text;
      let scrubbed = 0;
      for (const model of ['page', 'service', 'project', 'product', 'newsPost', 'vacancy'] as const) {
        const rows: any[] = await (prisma as any)[model].findMany({ where: { siteId }, select: { id: true, slug: true, blocks: true } }).catch(() => []);
        for (const row of rows) {
          const raw = JSON.stringify(row.blocks || []);
          if (!raw.includes(needle)) continue;
          const cleaned = raw.split(needle).join('');
          await (prisma as any)[model].update({ where: { id: row.id }, data: { blocks: JSON.parse(cleaned) } });
          scrubbed++;
        }
      }
      applied.push({ kind: hint.kind, detail: hint.detail, before: needle.slice(0, 80), after: `${scrubbed} entities scrubbed` });
    }
  }
  return applied;
}
