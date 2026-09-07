import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import { chromium } from 'playwright';
import { crawlPage } from '../crawl/crawlPage.js';
import { handleCookieConsent } from '../cookies/handleCookieConsent.js';

export type ActivityCallback = (event: { level?: 'INFO' | 'WARN' | 'ERROR'; module: string; eventType: string; message: string; details?: Record<string, any> }) => Promise<void>;

/**
 * Navigation-error classification for the website viability gate.
 * HARD failures mean the site is not loadable by a real browser; they flip
 * lead.websiteStatus to FAILED so the lead can never enter review/generation
 * until an explicit re-audit recovers it. Retryable/ambiguous conditions
 * (bot challenges, 429/5xx at HTTP level, odd timeouts) keep the lead
 * inspectable without claiming the website is dead.
 */
const HARD_NAV_FAILURE = /ERR_NAME_NOT_RESOLVED|ERR_ADDRESS_UNREACHABLE|ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_CLOSED|ERR_CONNECTION_FAILED|ERR_HTTP2_PROTOCOL_ERROR|ERR_SSL_|ERR_CERT_|ERR_TOO_MANY_REDIRECTS|ERR_INVALID_URL|ERR_ABORTED/i;
const RETRYABLE_NAV_FAILURE = /ERR_TIMED_OUT|429|503|ERR_BLOCKED_BY_CLIENT|ERR_BLOCKED_BY_RESPONSE/i;

export function classifyNavigationError(message: string): 'HARD' | 'RETRYABLE' {
  if (RETRYABLE_NAV_FAILURE.test(message)) return 'RETRYABLE';
  return HARD_NAV_FAILURE.test(message) ? 'HARD' : 'RETRYABLE';
}

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

    // Viability candidates: the discovered URL first, then the canonical
    // origin root — a dead deep link does not prove the site is dead.
    const navTargets: string[] = [website];
    try {
      const origin = new URL(website).origin;
      if (origin && origin !== website) navTargets.push(origin);
    } catch { /* unparseable URL → single target */ }

    const tryNavigate = async (target: string) => {
      response = await page.goto(target, { waitUntil: 'domcontentloaded' });
      finalUrl = page.url();
    };

    let lastNavError: string | null = null;
    try {
      for (const target of navTargets) {
        try {
          await tryNavigate(target);
          lastNavError = null;
          if (target !== website) {
            await emit('WARN', 'AUDIT_ROOT_FALLBACK', 'Deep URL unreachable — canonical root loaded instead', { failedUrl: website, rootUrl: target });
          }
          break;
        } catch (navErr) {
          lastNavError = navErr instanceof Error ? navErr.message : String(navErr);
          const certRetry = /ERR_CERT_DATE_INVALID|ERR_CERT_AUTHORITY_INVALID|ERR_CERT_COMMON_NAME_INVALID/.test(lastNavError);
          if (certRetry) { throw navErr; } // handled by TLS path below
          await emit('WARN', 'NAV_TARGET_FAILED', `Navigation failed: ${lastNavError}`, { target });
        }
      }
      if (lastNavError) throw new Error(lastNavError);
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
    // Viability gate: a hard navigation failure (DNS/protocol/TLS/refused)
    // marks the website itself as failed — the lead can no longer be
    // READY_FOR_REVIEW / READY_FOR_GENERATION until an explicit re-audit
    // recovers it. Retryable failures keep websiteStatus FOUND so the lead
    // stays inspectable under Failed checks.
    const viability = classifyNavigationError(message);
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        auditStatus: 'FAILED',
        auditErrorMessage: message,
        ...(viability === 'HARD' ? { websiteStatus: 'FAILED' } : {}),
      }
    });
    await emit('ERROR', viability === 'HARD' ? 'WEBSITE_UNREACHABLE' : 'AUDIT_FAILED', viability === 'HARD' ? 'Website unreachable — marked failed' : 'Audit failed', { error: message, viability });

    logger.warn({ runId, leadId, err }, 'audit.lead.failed');
  } finally {
    await browser.close();
  }
}
