import { launchSandboxedBrowser } from '@minsk/security';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export interface SiteLike {
  id: string;
  previewToken: string;
  updatedAt: Date;
  builds?: { id: string; status: string; updatedAt: Date }[];
}

export function getScreenshotStoragePath(siteId: string): string {
  return path.resolve('data/generated/sites', siteId, 'screenshots', 'preview.png');
}

export function getVariantScreenshotStoragePath(siteId: string, variantId: string): string {
  return path.resolve('data/generated/sites', siteId, 'screenshots', `variant-${variantId}.png`);
}

export function getScreenshotUrl(siteId: string, baseUrl?: string): string {
  const gateway = `http://localhost:${process.env.GATEWAY_PORT ?? 3000}`;
  return `${baseUrl ?? gateway}/site-screenshots/${siteId}/preview.png`;
}

export function getVariantScreenshotUrl(siteId: string, variantId: string, baseUrl?: string): string {
  const gateway = `http://localhost:${process.env.GATEWAY_PORT ?? 3000}`;
  return `${baseUrl ?? gateway}/site-screenshots/${siteId}/variant-${variantId}.png`;
}

/** Hub/Forge preview URL: versioned so a new preferred variant/run always
 * produces a different URL — the Hub can never display a stale generation. */
export function previewImageUrl(screenshot: { url?: string | null; siteUpdatedAt?: Date | string | null; updatedAt?: Date | string | null; capturedAt?: Date | string | null }, variantId?: string | null): string {
  const base = screenshot.url || '';
  const stamp = new Date(screenshot.siteUpdatedAt || screenshot.updatedAt || screenshot.capturedAt || 0).getTime() || 0;
  const v = `${variantId || 'site'}-${stamp}`;
  return `${base}${base.includes('?') ? '&' : '?'}v=${v}`;
}

async function captureToFile(previewToken: string, storagePath: string): Promise<void> {
  await mkdir(path.dirname(storagePath), { recursive: true });
  const browser = await launchSandboxedBrowser({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const rendererPort = process.env.RENDERER_PORT ?? 3336;
    const previewUrl = `http://localhost:${rendererPort}/preview/${previewToken}`;
    const resp = await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 30000 });
    if (!resp || !resp.ok()) throw new Error(`preview ${previewToken} returned ${resp?.status()}`);
    await page.screenshot({ path: storagePath, fullPage: false });
  } finally {
    await browser.close();
  }
}

export async function captureSitePreview(site: SiteLike & { previewTokenOverride?: string }, prisma: any): Promise<{ path: string; url: string }> {
  const storagePath = getScreenshotStoragePath(site.id);
  const token = site.previewTokenOverride || site.previewToken;
  await captureToFile(token, storagePath);

  const url = getScreenshotUrl(site.id);
  const build = (site.builds || []).find((b: any) => b.status === 'SUCCESS') ?? null;
  const data = {
    siteId: site.id,
    storagePath,
    url,
    siteUpdatedAt: new Date(site.updatedAt),
    capturedAt: new Date(),
    buildId: build?.id ?? null
  };
  await prisma.sitePreviewScreenshot.upsert({
    where: { siteId: site.id },
    create: data,
    update: data
  });

  return { path: storagePath, url };
}

/** Capture a per-variant preview and persist a DemoVariantScreenshot. */
export async function captureVariantPreview(
  site: SiteLike,
  variant: { id: string; previewToken: string },
  prisma: any
): Promise<{ path: string; url: string }> {
  const storagePath = getVariantScreenshotStoragePath(site.id, variant.id);
  await captureToFile(variant.previewToken, storagePath);

  const url = getVariantScreenshotUrl(site.id, variant.id);
  const build = (site.builds || []).find((b: any) => b.status === 'SUCCESS' && (b as any).demoVariantId === variant.id)
    ?? (site.builds || []).find((b: any) => b.status === 'SUCCESS')
    ?? null;
  const data = {
    demoVariantId: variant.id,
    storagePath,
    url,
    siteUpdatedAt: new Date(site.updatedAt),
    capturedAt: new Date(),
    buildId: build?.id ?? null
  };
  await prisma.demoVariantScreenshot.upsert({
    where: { demoVariantId: variant.id },
    create: data,
    update: data
  });

  return { path: storagePath, url };
}
