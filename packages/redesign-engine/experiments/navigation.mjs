import { launchSandboxedBrowser } from '@minsk/security';
import { ArtifactType } from './types.mjs';
import { createArtifactRef } from './manifest.mjs';

const NOT_FOUND_PHRASES = [
  'not found',
  'not_found',
  '404',
  'ошибка',
  'не найдена',
  'не найдено',
  'not exist',
  'page unavailable',
  'page not found',
  'ошибка 404',
];

const GENERIC_FALLBACK_TITLES = [
  'home',
  'homepage',
  'главная',
  'index',
];

const MIN_BODY_TEXT_LENGTH = 60;

/**
 * @typedef {import('./manifest.mjs').ArtifactRef} ArtifactRef
 */

/**
 * @typedef {'VALID' | 'BROKEN' | 'FALLBACK' | 'EMPTY' | 'EXTERNAL' | 'ANCHOR' | 'UNTESTED'} LinkKind
 */

/**
 * @typedef {object} NavigationLink
 * @property {string} url
 * @property {string} text
 * @property {string} kind
 * @property {number} [status]
 * @property {string} [error]
 * @property {string} [source]
 */

/**
 * @typedef {object} NavigationReport
 * @property {string} url
 * @property {number} total
 * @property {number} valid
 * @property {number} broken
 * @property {number} external
 * @property {number} anchor
 * @property {number} untested
 * @property {number} validPercent
 * @property {NavigationLink[]} links
 */

/**
 * Determine whether a URL is internal to a base origin.
 * @param {string} base
 * @param {string} href
 * @returns {boolean}
 */
function isInternal(base, href) {
  try {
    const baseUrl = new URL(base);
    const url = new URL(href, base);
    return url.origin === baseUrl.origin;
  } catch {
    return false;
  }
}

/**
 * Inspect a loaded page to distinguish real content from 200 fallbacks.
 * @param {import('playwright').Page} page
 * @param {string} rootTitle
 * @param {string} linkText
 * @returns {Promise<{ kind: string, h1?: string, title?: string, bodyLength: number, reason?: string }>}
 */
async function classifyPage(page, rootTitle, linkText) {
  const title = await page.title().catch(() => '');
  const h1 = await page.locator('h1').first().textContent().catch(() => '');
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const bodyLower = bodyText.toLowerCase();

  if (NOT_FOUND_PHRASES.some((p) => bodyLower.includes(p) || title.toLowerCase().includes(p))) {
    return { kind: 'BROKEN', title, h1, bodyLength: bodyText.length, reason: 'not-found wording in body or title' };
  }

  if (bodyText.length < MIN_BODY_TEXT_LENGTH) {
    return { kind: 'EMPTY', title, h1, bodyLength: bodyText.length, reason: 'body too short' };
  }

  const titleLower = title.toLowerCase().trim();
  const rootTitleLower = rootTitle.toLowerCase().trim();
  const titleIsGeneric = GENERIC_FALLBACK_TITLES.some((t) => titleLower === t || titleLower.includes(t));
  const titleMatchesRoot = titleLower === rootTitleLower || (titleLower && rootTitleLower && titleLower.includes(rootTitleLower));
  const h1Missing = !h1 || h1.trim().length < 3;
  const linkTextRelevant = linkText && (h1.toLowerCase().includes(linkText.toLowerCase().slice(0, 20)) || bodyLower.includes(linkText.toLowerCase().slice(0, 20)));

  if (titleMatchesRoot && h1Missing && !linkTextRelevant) {
    return { kind: 'FALLBACK', title, h1, bodyLength: bodyText.length, reason: 'page title matches root and h1 missing or content not related to link label' };
  }

  if (titleIsGeneric && h1Missing) {
    return { kind: 'FALLBACK', title, h1, bodyLength: bodyText.length, reason: 'generic title and missing h1' };
  }

  return { kind: 'VALID', title, h1, bodyLength: bodyText.length };
}

/**
 * Validate the navigation integrity of a generated or source site.
 * @param {Object} opts
 * @param {string} opts.url
 * @param {string} opts.outDir
 * @param {number} [opts.maxLinks]
 * @param {string} [opts.provider]
 * @returns {Promise<{ artifact: ArtifactRef, report: NavigationReport }>}
 */
export async function validateNavigation({ url, outDir, maxLinks = 30 }) {
  const browser = await launchSandboxedBrowser({ headless: true });
  const report = {
    url,
    total: 0,
    valid: 0,
    broken: 0,
    fallback: 0,
    empty: 0,
    external: 0,
    anchor: 0,
    untested: 0,
    validPercent: 0,
    links: [],
  };

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    const rootStatus = response?.status() ?? 0;
    const rootTitle = await page.title().catch(() => '');

    // Extract links from header, footer, body.
    const rawLinks = await page.evaluate(() => {
      const result = [];
      for (const a of document.querySelectorAll('a[href]')) {
        result.push({
          href: a.getAttribute('href'),
          text: (a.textContent || '').trim().slice(0, 120),
          source: a.closest('header') ? 'header' : a.closest('footer') ? 'footer' : 'body',
        });
      }
      return result;
    });

    const seen = new Set();
    const toTest = [];
    for (const link of rawLinks) {
      if (!link.href) continue;
      const resolved = new URL(link.href, url).href.split('#')[0];
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      toTest.push({ ...link, resolved });
    }

    report.total = toTest.length;

    for (const [i, link] of toTest.entries()) {
      const entry = {
        url: link.resolved,
        text: link.text,
        source: link.source,
        kind: 'UNTESTED',
      };

      if (!link.href.startsWith('http') && link.href.startsWith('#')) {
        entry.kind = 'ANCHOR';
        report.anchor++;
      } else if (!isInternal(url, link.resolved)) {
        entry.kind = 'EXTERNAL';
        report.external++;
      } else if (i >= maxLinks) {
        entry.kind = 'UNTESTED';
        report.untested++;
      } else {
        const testPage = await context.newPage();
        try {
          const res = await testPage.goto(link.resolved, { waitUntil: 'domcontentloaded', timeout: 30000 });
          entry.status = res?.status() ?? 0;
          if (entry.status >= 400) {
            entry.kind = 'BROKEN';
            report.broken++;
            entry.reason = `HTTP ${entry.status}`;
          } else {
            const classification = await classifyPage(testPage, rootTitle, link.text);
            entry.kind = classification.kind;
            entry.h1 = classification.h1;
            entry.title = classification.title;
            entry.bodyLength = classification.bodyLength;
            entry.reason = classification.reason;
            if (entry.kind === 'VALID') {
              report.valid++;
            } else if (entry.kind === 'BROKEN') {
              report.broken++;
            } else if (entry.kind === 'FALLBACK') {
              report.fallback = (report.fallback || 0) + 1;
            } else if (entry.kind === 'EMPTY') {
              report.empty = (report.empty || 0) + 1;
            }
          }
        } catch (err) {
          entry.error = err.message.slice(0, 200);
          entry.kind = 'BROKEN';
          report.broken++;
        } finally {
          await testPage.close();
        }
      }

      report.links.push(entry);
    }

    const tested = report.valid + report.broken + (report.fallback || 0) + (report.empty || 0);
    report.validPercent = tested > 0 ? Math.round((report.valid / tested) * 100) : 0;
    await context.close();
  } finally {
    await browser.close();
  }

  const { writeFile, mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { randomUUID } = await import('node:crypto');
  await mkdir(outDir, { recursive: true });
  const id = `navigation-${randomUUID().slice(0, 8)}`;
  const reportPath = join(outDir, `${id}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  const artifact = await createArtifactRef(ArtifactType.NAVIGATION_REPORT, reportPath, { url });
  return { artifact, report };
}
