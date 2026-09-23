import { access, copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

// V3.7.5 Part E — Forge preview contract.
//
// A Forge card screenshot is a verified build artifact, not a best-effort
// side effect: preferred variant → canonical showcase 200 → DOM/fonts/hero
// ready → PNG captured (or a validated revision homepage shot promoted) →
// PNG verified → SitePreviewScreenshot persisted → gateway URL verified.
// Any failure throws ForgePreviewError and marks the site NEEDS_ATTENTION —
// generation must not reach REVIEW_READY.

export const MIN_PREVIEW_BYTES = 8192;
const PREVIEW_VIEWPORT = { w: 1440, h: 900 };

export class ForgePreviewError extends Error {
  reason: string;
  constructor(reason: string) {
    super(`forge preview: ${reason}`);
    this.name = 'ForgePreviewError';
    this.reason = reason;
  }
}

/** Minimal structural PNG validation: signature + IHDR dimensions. */
export function verifyPngBuffer(buf: Buffer): { width: number; height: number } {
  const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 33) throw new Error('png too small to contain an IHDR');
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== SIG[i]) throw new Error('not a png (bad signature)');
  }
  if (buf.readUInt32BE(0 + 8) !== 13 || buf.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error('png missing IHDR chunk');
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width <= 0 || height <= 0) throw new Error('png has zero dimension');
  return { width, height };
}

async function verifyPngFile(p: string): Promise<{ width: number; height: number; bytes: number }> {
  const st = await stat(p).catch(() => null);
  if (!st) throw new Error(`screenshot file missing: ${p}`);
  if (st.size < MIN_PREVIEW_BYTES) throw new Error(`screenshot too small (${st.size} < ${MIN_PREVIEW_BYTES} bytes) — likely blank`);
  const buf = await readFile(p);
  const { width, height } = verifyPngBuffer(buf);
  return { width, height, bytes: st.size };
}

export function getPreviewStoragePath(siteId: string, screenshotsDir?: string): string {
  return path.join(screenshotsDir ?? path.resolve('data/generated/sites', siteId, 'screenshots'), 'preview.png');
}

export interface ForgePreviewDeps {
  prisma: any;
  fetchImpl?: typeof fetch;
  renderBaseUrl?: string;
  gatewayBaseUrl?: string;
  screenshotsDir?: string;
  retries?: number;
  /** Injectable for tests — default does a readiness-gated Playwright capture. */
  captureImpl?: (opts: { url: string; outputPath: string; viewport: { w: number; h: number } }) => Promise<void>;
  revisionId?: string;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Readiness-gated capture: DOM ready → renderer marker → fonts → above-fold
 *  images. networkidle is deliberately NOT the gate. */
async function captureWithReadiness(opts: { url: string; outputPath: string; viewport: { w: number; h: number } }): Promise<void> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true, timeout: 30000 });
  try {
    const page = await browser.newPage({ viewport: { width: opts.viewport.w, height: opts.viewport.h } });
    const resp = await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!resp || !resp.ok()) throw new Error(`showcase returned ${resp?.status()}`);
    await page.waitForSelector('[data-renderer-ready]', { timeout: 15000 });
    await page.evaluate(() => (document as any).fonts?.ready ?? Promise.resolve());
    // Above-the-fold images must be decoded, not merely requested.
    await page.waitForFunction(() => {
      const imgs = Array.from(document.querySelectorAll('img')).filter((img) => {
        const r = img.getBoundingClientRect();
        return r.top < window.innerHeight && r.bottom > 0 && r.width > 0;
      });
      return imgs.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0);
    }, undefined, { timeout: 15000 });
    await page.screenshot({ path: opts.outputPath, fullPage: false });
  } finally {
    await browser.close();
  }
}

async function findReusableRevisionShot(prisma: any, siteId: string, revisionId?: string): Promise<any | null> {
  const where: any = {
    route: '/',
    revision: { siteId, ...(revisionId ? { id: revisionId } : {}) },
  };
  const shots = await prisma.revisionScreenshot.findMany({
    where,
    orderBy: { capturedAt: 'desc' },
    take: 5,
    include: { revision: { select: { variantId: true, status: true } } },
  }).catch(() => []);
  for (const s of shots) {
    const m = /^(\d+)x(\d+)$/.exec(s.viewport || '');
    if (m && Number(m[1]) >= 1200) return s;
  }
  return null;
}

export async function publishForgePreview(input: {
  siteId: string;
} & ForgePreviewDeps): Promise<{ url: string; storagePath: string; variantId?: string; source: 'revision' | 'captured'; capturedAt: Date }> {
  const {
    siteId,
    prisma,
    renderBaseUrl = `http://localhost:${process.env.RENDERER_PORT ?? 3336}`,
    gatewayBaseUrl = `http://localhost:${process.env.GATEWAY_PORT ?? 3000}`,
    retries = 3,
  } = input;
  const fetchImpl = input.fetchImpl ?? fetch;

  const fail = async (reason: string): Promise<never> => {
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { settings: true } }).catch(() => null);
    const settings = { ...(site?.settings as any || {}), reviewStatus: 'NEEDS_ATTENTION', previewError: { reason, at: new Date().toISOString() } };
    await prisma.site.update({ where: { id: siteId }, data: { settings } }).catch(() => undefined);
    throw new ForgePreviewError(reason);
  };

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      demoVariants: { where: { status: 'ACTIVE' } },
      builds: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, demoVariantId: true } },
    },
  });
  if (!site) return fail(`site ${siteId} not found`);

  // The Forge card always renders the PREFERRED active variant — never an
  // arbitrary first variant.
  const preferred = site.demoVariants.find((v: any) => v.isPreferred) ?? site.demoVariants[0];
  const previewToken = preferred?.previewToken ?? site.previewToken;
  const showcaseUrl = `${renderBaseUrl.replace(/\/+$/, '')}/showcase/${previewToken}`;

  // Canonical showcase must answer 200 before any capture. Every fetch is
  // time-bounded — a stalled connection must fail the attempt, not hang the
  // stage past its watchdog budget.
  const fetchTimeoutMs = 15000;
  let showcaseOk = false;
  let lastStatus = 0;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(showcaseUrl, { headers: { accept: 'text/html' }, signal: AbortSignal.timeout(fetchTimeoutMs) } as any);
      lastStatus = res.status;
      if (res.ok) { showcaseOk = true; break; }
    } catch { /* retry */ }
    if (attempt < retries) await sleep(750 * attempt);
  }
  if (!showcaseOk) return fail(`showcase ${previewToken} not ready (HTTP ${lastStatus || 'unreachable'})`);

  const storagePath = getPreviewStoragePath(siteId, input.screenshotsDir);
  await mkdir(path.dirname(storagePath), { recursive: true });

  // Prefer an already-verified homepage desktop screenshot from the active
  // revision — publish it atomically instead of a redundant capture.
  let source: 'revision' | 'captured' = 'captured';
  let published = false;
  const revisionShot = await findReusableRevisionShot(prisma, siteId, input.revisionId ?? preferred?.activeRevisionId);
  if (revisionShot?.storagePath) {
    try {
      await access(revisionShot.storagePath);
      await verifyPngFile(revisionShot.storagePath);
      await copyFile(revisionShot.storagePath, storagePath);
      source = 'revision';
      published = true;
    } catch {
      // fall through to a fresh capture
    }
  }

  if (!published) {
    const capture = input.captureImpl ?? captureWithReadiness;
    let lastErr: any;
    for (let attempt = 1; attempt <= retries && !published; attempt++) {
      try {
        await capture({ url: showcaseUrl, outputPath: storagePath, viewport: PREVIEW_VIEWPORT });
        await verifyPngFile(storagePath);
        published = true;
      } catch (err: any) {
        lastErr = err;
        if (attempt < retries) await sleep(750 * attempt);
      }
    }
    if (!published) return fail(`capture failed after ${retries} attempt(s): ${lastErr?.message || 'unknown'}`);
  }

  // Clear any previous preview failure BEFORE persisting the screenshot row:
  // the settings update bumps site.updatedAt, and the row's siteUpdatedAt must
  // be at least that new or the card reports "Preview outdated" forever.
  const current = await prisma.site.findUnique({ where: { id: siteId }, select: { settings: true } }).catch(() => null);
  const settings = { ...(current?.settings as any || {}) };
  let siteUpdatedAt = new Date(site.updatedAt);
  if (settings.previewError) {
    delete settings.previewError;
    const updated = await prisma.site.update({ where: { id: siteId }, data: { settings } }).catch(() => null);
    if (updated?.updatedAt) siteUpdatedAt = new Date(updated.updatedAt);
  }

  const capturedAt = new Date();
  const build = (site.builds || []).find((b: any) => b.status === 'SUCCESS' && (!preferred || b.demoVariantId === preferred.id))
    ?? (site.builds || []).find((b: any) => b.status === 'SUCCESS')
    ?? null;
  const url = `${gatewayBaseUrl.replace(/\/+$/, '')}/site-screenshots/${siteId}/preview.png`;
  const data = {
    siteId,
    storagePath,
    url,
    siteUpdatedAt,
    capturedAt,
    buildId: build?.id ?? null,
  };
  await prisma.sitePreviewScreenshot.upsert({
    where: { siteId },
    create: data,
    update: data,
  });

  // The gateway URL the card will actually load must answer image/png.
  const verifyUrl = `${url}?v=${preferred?.id ?? 'site'}-${capturedAt.getTime()}`;
  try {
    const res = await fetchImpl(verifyUrl, { signal: AbortSignal.timeout(fetchTimeoutMs) } as any);
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('image/png')) {
      return fail(`preview URL verification failed (HTTP ${res.status}, content-type ${ct || 'none'})`);
    }
    await res.arrayBuffer().catch(() => undefined);
  } catch (err: any) {
    if (err instanceof ForgePreviewError) throw err;
    return fail(`preview URL unreachable: ${err?.message || err}`);
  }

  return { url, storagePath, variantId: preferred?.id, source, capturedAt };
}

/**
 * One managed backfill pass over active sites missing a Forge preview.
 * Never regenerates sites, never creates Site/DemoVariant rows — screenshots only.
 */
export async function backfillForgePreviews(input: {
  prisma: any;
  publish?: (opts: { siteId: string } & ForgePreviewDeps) => Promise<any>;
  limit?: number;
  includeArchived?: boolean;
}): Promise<{ scanned: number; succeeded: number; failed: number; skipped: number; results: { siteId: string; status: 'ok' | 'failed' | 'skipped'; reason?: string }[] }> {
  const publish = input.publish ?? ((o) => publishForgePreview(o));
  const sites = await input.prisma.site.findMany({
    where: {
      ...(input.includeArchived ? {} : { status: { not: 'ARCHIVED' } }),
      mergedIntoSiteId: null,
    },
    include: { screenshot: true },
    orderBy: { updatedAt: 'desc' },
    ...(input.limit ? { take: input.limit } : {}),
  });
  const results: { siteId: string; status: 'ok' | 'failed' | 'skipped'; reason?: string }[] = [];
  for (const site of sites) {
    if (site.screenshot) {
      results.push({ siteId: site.id, status: 'skipped' });
      continue;
    }
    try {
      await publish({ siteId: site.id, prisma: input.prisma });
      results.push({ siteId: site.id, status: 'ok' });
    } catch (err: any) {
      results.push({ siteId: site.id, status: 'failed', reason: err?.message || String(err) });
    }
  }
  return {
    scanned: sites.length,
    succeeded: results.filter((r) => r.status === 'ok').length,
    failed: results.filter((r) => r.status === 'failed').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    results,
  };
}
