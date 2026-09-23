import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  verifyPngBuffer,
  publishForgePreview,
  backfillForgePreviews,
  ForgePreviewError,
  MIN_PREVIEW_BYTES,
} from './forgePreview.js';

function pngBuffer(w = 800, h = 600, payloadBytes = 9000): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(w, 8);
  ihdr.writeUInt32BE(h, 12);
  ihdr.writeUInt8(8, 16); // bit depth
  ihdr.writeUInt8(2, 17); // color type
  const body = Buffer.alloc(Math.max(0, payloadBytes), 7);
  return Buffer.concat([sig, ihdr, body]);
}

let dir: string;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'forge-preview-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('verifyPngBuffer', () => {
  it('accepts a decodable PNG with dimensions', () => {
    const r = verifyPngBuffer(pngBuffer(1440, 900));
    expect(r.width).toBe(1440);
    expect(r.height).toBe(900);
  });
  it('rejects non-PNG and zero-dimension buffers', () => {
    expect(() => verifyPngBuffer(Buffer.from('not a png'))).toThrow(/png/i);
    expect(() => verifyPngBuffer(pngBuffer(0, 0))).toThrow(/dimension/i);
  });
});

function makePrisma(site: any) {
  const updates: any[] = [];
  const upserts: any[] = [];
  return {
    prisma: {
      site: {
        findUnique: vi.fn(async () => site),
        update: vi.fn(async (a: any) => { updates.push(a); return { ...site, ...a.data }; }),
      },
      sitePreviewScreenshot: {
        upsert: vi.fn(async (a: any) => { upserts.push(a); return a.create; }),
        findMany: vi.fn(async () => []),
      },
      revisionScreenshot: {
        findMany: vi.fn(async () => []),
      },
    } as any,
    updates,
    upserts,
  };
}

const SITE = {
  id: 'site-1',
  name: 'Acme',
  previewToken: 'tok-site',
  updatedAt: new Date('2026-09-22T10:00:00Z'),
  settings: {},
  demoVariants: [{ id: 'v1', isPreferred: true, previewToken: 'tok-v1', status: 'ACTIVE', activeRevisionId: 'rev1' }],
  builds: [{ id: 'b1', status: 'SUCCESS' }],
};

function okShowcaseFetch(imagePath: string) {
  return vi.fn(async (url: any) => {
    const u = String(url);
    if (u.includes('/showcase/')) return new Response('<html data-renderer-ready="true">ok</html>', { status: 200 });
    if (u.includes('/site-screenshots/')) {
      return new Response(new Uint8Array(pngBuffer()), { status: 200, headers: { 'content-type': 'image/png' } });
    }
    return new Response('nf', { status: 404 });
  }) as any;
}

describe('publishForgePreview', () => {
  it('10. screenshot failure blocks completion: throws and marks NEEDS_ATTENTION', async () => {
    const { prisma, updates } = makePrisma(SITE);
    const fetchImpl = vi.fn(async () => new Response('down', { status: 502 })) as any;
    await expect(publishForgePreview({
      siteId: 'site-1', prisma, fetchImpl,
      renderBaseUrl: 'http://renderer.test', gatewayBaseUrl: 'http://gw.test',
      retries: 1,
    })).rejects.toThrow(ForgePreviewError);
    const att = updates.find((u) => (u.data.settings as any)?.reviewStatus === 'NEEDS_ATTENTION');
    expect(att).toBeTruthy();
    expect((att.data.settings as any).previewError.reason).toMatch(/showcase/i);
  });

  it('8/11. reuses a valid revision homepage screenshot → verified + persisted', async () => {
    const shotPath = join(dir, 'home-desktop.png');
    await writeFile(shotPath, pngBuffer(1440, 900));
    const { prisma, upserts } = makePrisma(SITE);
    prisma.revisionScreenshot.findMany.mockResolvedValue([{
      id: 'shot1', revisionId: 'rev1', route: '/', viewport: '1440x900', storagePath: shotPath, current: true,
      revision: { variantId: 'v1', status: 'REVIEW_READY' },
    }]);
    const fetchImpl = okShowcaseFetch('x');
    const res = await publishForgePreview({
      siteId: 'site-1', prisma, fetchImpl,
      renderBaseUrl: 'http://renderer.test', gatewayBaseUrl: 'http://gw.test',
      screenshotsDir: dir, revisionId: 'rev1',
    });
    expect(res.source).toBe('revision');
    expect(res.url).toContain('/site-screenshots/site-1/preview.png');
    expect(upserts).toHaveLength(1);
    // showcase checked with the PREFERRED variant token, not a random one
    const showcaseCall = fetchImpl.mock.calls.map((c: any[]) => String(c[0])).find((u: string) => u.includes('/showcase/'));
    expect(showcaseCall).toContain('/showcase/tok-v1');
    // gateway URL verified → the fetch happened and returned image/png (else throws)
    const shotFetch = fetchImpl.mock.calls.map((c: any[]) => String(c[0])).find((u: string) => u.includes('/site-screenshots/'));
    expect(shotFetch).toContain('v=');
  });

  it('falls back to a fresh capture when no revision shot exists', async () => {
    const { prisma } = makePrisma({ ...SITE, demoVariants: [] });
    const capture = vi.fn(async ({ outputPath }: any) => { await writeFile(outputPath, pngBuffer()); });
    const res = await publishForgePreview({
      siteId: 'site-1', prisma, fetchImpl: okShowcaseFetch('x'), captureImpl: capture,
      renderBaseUrl: 'http://renderer.test', gatewayBaseUrl: 'http://gw.test', screenshotsDir: dir,
    });
    expect(res.source).toBe('captured');
    expect(capture).toHaveBeenCalledOnce();
    // no variants → site previewToken used
    const callUrl = capture.mock.calls[0][0].url;
    expect(callUrl).toContain('/showcase/tok-site');
  });

  it('capture producing an invalid PNG → ForgePreviewError', async () => {
    const { prisma } = makePrisma(SITE);
    const capture = vi.fn(async ({ outputPath }: any) => { await writeFile(outputPath, Buffer.from('tiny')); });
    await expect(publishForgePreview({
      siteId: 'site-1', prisma, fetchImpl: okShowcaseFetch('x'), captureImpl: capture,
      renderBaseUrl: 'http://renderer.test', gatewayBaseUrl: 'http://gw.test', screenshotsDir: dir,
    })).rejects.toThrow(ForgePreviewError);
  });
});

describe('backfillForgePreviews', () => {
  it('13. skips sites that already have a valid screenshot — no duplicates', async () => {
    const sites = [
      { id: 's1', name: 'A', previewToken: 't1', updatedAt: new Date(), status: 'ACTIVE', screenshot: { id: 'sh' } },
      { id: 's2', name: 'B', previewToken: 't2', updatedAt: new Date(), status: 'ACTIVE', screenshot: null },
    ];
    const prisma: any = {
      site: { findMany: vi.fn(async () => sites) },
    };
    const publish = vi.fn(async (_opts: any) => ({ url: 'u', storagePath: 'p', source: 'captured' as const }));
    const report = await backfillForgePreviews({ prisma, publish });
    expect(report.skipped).toBe(1);
    expect(report.succeeded).toBe(1);
    expect(publish).toHaveBeenCalledOnce();
    expect(publish.mock.calls[0][0].siteId).toBe('s2');
  });
});
