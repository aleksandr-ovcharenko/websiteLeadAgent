import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { launch } from 'chrome-launcher';
import { assertAllowedUrl } from '@minsk/security';
import { ArtifactType } from './types.mjs';
import { createArtifactRef } from './manifest.mjs';

/**
 * @typedef {import('./manifest.mjs').ArtifactRef} ArtifactRef
 */

/**
 * @typedef {object} LighthouseSummary
 * @property {number} performance
 * @property {number} accessibility
 * @property {number} bestPractices
 * @property {number} seo
 * @property {number} [lcp]
 * @property {number} [cls]
 * @property {number} [inp]
 * @property {number} [fcp]
 * @property {number} [tbt]
 */

/**
 * @typedef {object} LighthouseResult
 * @property {string} url
 * @property {string} reportPath
 * @property {LighthouseSummary} summary
 * @property {number} durationMs
 * @property {string} version
 */

function scoreToInt(score) {
  return score == null ? 0 : Math.round(score * 100);
}

/**
 * Run Lighthouse against a URL and write the JSON report.
 * @param {Object} opts
 * @param {string} opts.url
 * @param {string} opts.outDir
 * @param {string} [opts.id]
 * @param {number} [opts.maxTimeMs]
 * @returns {Promise<{ artifact: ArtifactRef, result: LighthouseResult }>}
 */
export async function runLighthouse({ url, outDir, id = 'lighthouse', maxTimeMs = 120000 }) {
  await assertAllowedUrl(url);
  await mkdir(outDir, { recursive: true });

  const chromeFlags = ['--headless', '--disable-gpu', '--ignore-certificate-errors'];
  const noSandboxEnv = process.env.PLAYWRIGHT_CHROMIUM_NO_SANDBOX === 'true';
  if (noSandboxEnv) chromeFlags.push('--no-sandbox');

  const chrome = await launch({ chromeFlags });
  const started = Date.now();
  let reportJson;

  try {
    const { default: lighthouse } = await import('lighthouse');
    const runnerResult = await Promise.race([
      lighthouse(url, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices'],
        maxWaitForLoad: 60000,
        maxWaitForFcp: 30000,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Lighthouse watchdog timeout')), maxTimeMs)),
    ]);

    const lhr = runnerResult?.lhr;
    if (!lhr) throw new Error('Lighthouse returned empty result');
    if (lhr.runtimeError) throw new Error(`Lighthouse runtime error: ${lhr.runtimeError.message}`);

    const audits = lhr.audits ?? {};
    const num = (key) => {
      const v = audits[key]?.numericValue;
      return typeof v === 'number' ? v : undefined;
    };

    const summary = {
      performance: scoreToInt(lhr.categories?.performance?.score),
      accessibility: scoreToInt(lhr.categories?.accessibility?.score),
      bestPractices: scoreToInt(lhr.categories?.['best-practices']?.score),
      seo: scoreToInt(lhr.categories?.seo?.score),
      lcp: num('largest-contentful-paint'),
      cls: num('cumulative-layout-shift'),
      inp: num('interaction-to-next-paint'),
      fcp: num('first-contentful-paint'),
      tbt: num('total-blocking-time'),
    };

    reportJson = runnerResult.report ?? JSON.stringify(lhr);
    const reportPath = join(outDir, `${id}.json`);
    await writeFile(reportPath, typeof reportJson === 'string' ? reportJson : JSON.stringify(reportJson), 'utf8');

    const artifact = await createArtifactRef(ArtifactType.LIGHTHOUSE, reportPath, { url });
    return {
      artifact,
      result: {
        url,
        reportPath,
        summary,
        durationMs: Date.now() - started,
        version: lhr.lighthouseVersion ?? 'unknown',
      },
    };
  } finally {
    try { await chrome.kill(); } catch {}
  }
}

/**
 * Ingest an existing Lighthouse JSON report as an artifact.
 * @param {string} filePath
 * @param {string} url
 * @param {string} [label]
 * @returns {Promise<{ artifact: ArtifactRef, result: LighthouseResult }>}
 */
export async function ingestLighthouse(filePath, url, label = 'ingested') {
  const raw = await readFile(filePath, 'utf8');
  const lhr = JSON.parse(raw);
  const cats = lhr.categories ?? {};
  const audits = lhr.audits ?? {};
  const num = (key) => {
    const v = audits[key]?.numericValue;
    return typeof v === 'number' ? v : undefined;
  };
  const summary = {
    performance: scoreToInt(cats.performance?.score),
    accessibility: scoreToInt(cats.accessibility?.score),
    bestPractices: scoreToInt(cats['best-practices']?.score),
    seo: scoreToInt(cats.seo?.score),
    lcp: num('largest-contentful-paint'),
    cls: num('cumulative-layout-shift'),
    inp: num('interaction-to-next-paint'),
    fcp: num('first-contentful-paint'),
    tbt: num('total-blocking-time'),
  };
  const artifact = await createArtifactRef(ArtifactType.LIGHTHOUSE, filePath, { url, label });
  return {
    artifact,
    result: {
      url,
      reportPath: filePath,
      summary,
      durationMs: 0,
      version: lhr.lighthouseVersion ?? 'unknown',
    },
  };
}
