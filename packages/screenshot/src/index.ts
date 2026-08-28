import { chromium } from 'playwright';
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

export function getScreenshotUrl(siteId: string, baseUrl = 'http://localhost:3333'): string {
  return `${baseUrl}/site-screenshots/${siteId}/preview.png`;
}

export async function captureSitePreview(site: SiteLike, prisma: any): Promise<{ path: string; url: string }> {
  const storagePath = getScreenshotStoragePath(site.id);
  await mkdir(path.dirname(storagePath), { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const previewUrl = `http://localhost:3336/preview/${site.previewToken}`;
  await page.goto(previewUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: storagePath, fullPage: false });
  await browser.close();

  const url = getScreenshotUrl(site.id);
  const build = (site.builds || []).find((b: any) => b.status === 'SUCCESS') ?? null;
  const existing = await prisma.sitePreviewScreenshot.findUnique({ where: { siteId: site.id } });
  const data = {
    siteId: site.id,
    storagePath,
    url,
    siteUpdatedAt: new Date(site.updatedAt),
    buildId: build?.id ?? null
  };
  if (existing) {
    await prisma.sitePreviewScreenshot.update({ where: { id: existing.id }, data });
  } else {
    await prisma.sitePreviewScreenshot.create({ data });
  }

  return { path: storagePath, url };
}
