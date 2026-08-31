import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import { chromium } from 'playwright';
import { crawlPage } from '../crawl/crawlPage.js';
import { handleCookieConsent } from '../cookies/handleCookieConsent.js';

export async function auditLeadWebsite(input: {
  prisma: PrismaClient;
  logger: pino.Logger;
  runId: string;
  leadId: string;
  website: string;
}) {
  const { prisma, logger, runId, leadId, website } = input;

  await prisma.lead.update({
    where: { id: leadId },
    data: { auditStatus: 'PENDING' }
  });

  const outDir = join('data', 'audit', leadId);
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();

  try {
    await prisma.lead.update({ where: { id: leadId }, data: { auditErrorMessage: null } });
    const context = await browser.newContext();

    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    await page.setViewportSize({ width: 1440, height: 1000 });

    const response = await page.goto(website, { waitUntil: 'domcontentloaded' });
    const finalUrl = page.url();

    await page.waitForTimeout(1000);

    await handleCookieConsent(page);
    await page.waitForTimeout(300);

    await page.screenshot({ path: join(outDir, 'desktop.png'), fullPage: false });
    await page.screenshot({ path: join(outDir, 'desktop-full.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    await handleCookieConsent(page);
    await page.waitForTimeout(300);

    await page.screenshot({ path: join(outDir, 'mobile.png'), fullPage: false });
    await page.screenshot({ path: join(outDir, 'mobile-full.png'), fullPage: true });

    await page.evaluate(() => {
      // tsx/esbuild helper used in bundled code; define it in browser context to avoid ReferenceError.
      (globalThis as any).__name = (x: any) => x;
    });

    const crawl = await crawlPage(page);

    const httpStatus = response?.status() ?? null;
    const payload = {
      leadId,
      inputUrl: website,
      finalUrl,
      httpStatus,
      crawl
    };

    await writeFile(join(outDir, 'crawl.json'), JSON.stringify(payload, null, 2), 'utf-8');

    if (httpStatus != null && httpStatus >= 400) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { auditStatus: 'FAILED' }
      });
      throw new Error(`Website returned HTTP ${httpStatus} for ${website}`);
    }

    await prisma.lead.update({
      where: { id: leadId },
      data: { auditStatus: 'SUCCESS' }
    });

    logger.info({ runId, leadId, finalUrl, httpStatus }, 'audit.lead.success');
    return { ok: true, httpStatus };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.lead.update({
      where: { id: leadId },
      data: { auditStatus: 'FAILED', auditErrorMessage: message }
    });

    logger.warn({ runId, leadId, err }, 'audit.lead.failed');
  } finally {
    await browser.close();
  }
}
