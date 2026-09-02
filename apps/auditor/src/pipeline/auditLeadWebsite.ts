import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import { chromium } from 'playwright';
import { crawlPage } from '../crawl/crawlPage.js';
import { handleCookieConsent } from '../cookies/handleCookieConsent.js';

export type ActivityCallback = (event: { level?: 'INFO' | 'WARN' | 'ERROR'; module: string; eventType: string; message: string; details?: Record<string, any> }) => Promise<void>;

export async function auditLeadWebsite(input: {
  prisma: PrismaClient;
  logger: pino.Logger;
  runId: string;
  leadId: string;
  website: string;
  onActivity?: ActivityCallback;
}) {
  const { prisma, logger, runId, leadId, website, onActivity } = input;

  const emit = async (level: 'INFO' | 'WARN' | 'ERROR', eventType: string, message: string, details?: Record<string, any>) => {
    if (onActivity) {
      await onActivity({ level, module: 'AUDIT', eventType, message, details: { runId, leadId, website, ...details } }).catch(() => {});
    }
  };

  await prisma.lead.update({
    where: { id: leadId },
    data: { auditStatus: 'PENDING' }
  });
  await emit('INFO', 'AUDIT_STARTED', 'Auditing website', { website });

  const outDir = join('data', 'audit', leadId);
  await mkdir(outDir, { recursive: true });

  await emit('INFO', 'BROWSER_LAUNCH', 'Launching browser');
  const browser = await chromium.launch();

  try {
    await prisma.lead.update({ where: { id: leadId }, data: { auditErrorMessage: null } });
    let context = await browser.newContext();
    let page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    await page.setViewportSize({ width: 1440, height: 1000 });

    let response: import('playwright').Response | null = null;
    let finalUrl = website;
    let tlsWarning: { status: 'INVALID_CERTIFICATE'; error: string; message: string } | null = null;

    try {
      response = await page.goto(website, { waitUntil: 'domcontentloaded' });
      finalUrl = page.url();
    } catch (gotoErr) {
      const errMessage = gotoErr instanceof Error ? gotoErr.message : String(gotoErr);
      const isCertError = /ERR_CERT_DATE_INVALID|ERR_CERT_AUTHORITY_INVALID|ERR_CERT_COMMON_NAME_INVALID/.test(errMessage);

      if (isCertError) {
        const certCode = (errMessage.match(/ERR_CERT_[A-Z_]+/) || ['UNKNOWN_CERT'])[0];
        tlsWarning = { status: 'INVALID_CERTIFICATE', error: certCode, message: 'Certificate is expired or invalid' };
        await emit('WARN', 'AUDIT_TLS_WARNING', `TLS certificate validation failed (${certCode})`, {
          tlsStatus: 'INVALID_CERTIFICATE',
          tlsError: certCode,
          tlsMessage: 'Certificate is expired or invalid',
          currentUrl: website
        });

        // Retry with HTTPS errors ignored, scoped to this audit context only.
        await context.close().catch(() => {});
        context = await browser.newContext({ ignoreHTTPSErrors: true });
        page = await context.newPage();
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(30000);
        await page.setViewportSize({ width: 1440, height: 1000 });

        try {
          response = await page.goto(website, { waitUntil: 'domcontentloaded' });
          finalUrl = page.url();
        } catch (secondErr) {
          const secondMessage = secondErr instanceof Error ? secondErr.message : String(secondErr);
          throw new Error(`Audit failed after ignoring certificate errors: ${secondMessage}`);
        }
      } else {
        throw gotoErr;
      }
    }

    await page.waitForTimeout(1000);

    await handleCookieConsent(page);
    await page.waitForTimeout(300);

    await page.screenshot({ path: join(outDir, 'desktop.png'), fullPage: false });
    await page.screenshot({ path: join(outDir, 'desktop-full.png'), fullPage: true });
    await emit('INFO', 'SCREENSHOTS_DESKTOP', 'Desktop screenshots captured');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    await handleCookieConsent(page);
    await page.waitForTimeout(300);

    await page.screenshot({ path: join(outDir, 'mobile.png'), fullPage: false });
    await page.screenshot({ path: join(outDir, 'mobile-full.png'), fullPage: true });
    await emit('INFO', 'SCREENSHOTS_MOBILE', 'Mobile screenshots captured');

    await page.evaluate(() => {
      // tsx/esbuild helper used in bundled code; define it in browser context to avoid ReferenceError.
      (globalThis as any).__name = (x: any) => x;
    });

    const crawl = await crawlPage(page);
    await emit('INFO', 'CRAWL_COMPLETED', 'Crawled website', { links: crawl.counts?.links ?? 0 });

    const httpStatus = response?.status() ?? null;
    const payload = {
      leadId,
      inputUrl: website,
      finalUrl,
      httpStatus,
      crawl,
      tls: tlsWarning
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
      data: {
        auditStatus: 'SUCCESS',
        auditErrorMessage: tlsWarning ? JSON.stringify(tlsWarning) : null
      }
    });
    await emit('INFO', 'AUDIT_COMPLETED', 'Audit completed successfully', { finalUrl, httpStatus, tls: tlsWarning });

    logger.info({ runId, leadId, finalUrl, httpStatus, tls: tlsWarning }, 'audit.lead.success');
    return { ok: true, httpStatus, tls: tlsWarning };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.lead.update({
      where: { id: leadId },
      data: { auditStatus: 'FAILED', auditErrorMessage: message }
    });
    await emit('ERROR', 'AUDIT_FAILED', 'Audit failed', { error: message });

    logger.warn({ runId, leadId, err }, 'audit.lead.failed');
  } finally {
    await browser.close();
  }
}
