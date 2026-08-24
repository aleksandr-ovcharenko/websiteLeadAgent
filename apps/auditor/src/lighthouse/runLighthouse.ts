import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

export interface LighthouseSummary {
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
  lcp?: number;
  cls?: number;
  inp?: number;
  fcp?: number;
  tbt?: number;
}

function scoreToInt(score: number | null | undefined): number {
  if (score == null) return 0;
  return Math.round(score * 100);
}

export async function runLighthouseForLead(input: { leadId: string; url: string }) {
  const { leadId, url } = input;

  const outDir = join('data', 'lighthouse');
  await mkdir(outDir, { recursive: true });

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu']
  });

  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices']
    });

    const lhr = result?.lhr;
    const reportJson = result?.report;

    if (!lhr || !reportJson) {
      throw new Error('Lighthouse returned empty result');
    }

    const summary: LighthouseSummary = {
      performance: scoreToInt(lhr.categories?.performance?.score),
      accessibility: scoreToInt(lhr.categories?.accessibility?.score),
      seo: scoreToInt(lhr.categories?.seo?.score),
      bestPractices: scoreToInt(lhr.categories?.['best-practices']?.score)
    };

    const audits = lhr.audits ?? {};
    const num = (id: string) => {
      const v = audits[id]?.numericValue;
      return typeof v === 'number' ? v : undefined;
    };

    summary.lcp = num('largest-contentful-paint');
    summary.cls = num('cumulative-layout-shift');
    summary.inp = num('interaction-to-next-paint');
    summary.fcp = num('first-contentful-paint');
    summary.tbt = num('total-blocking-time');

    const reportPath = join(outDir, `${leadId}.json`);
    await writeFile(reportPath, typeof reportJson === 'string' ? reportJson : JSON.stringify(reportJson), 'utf-8');

    return { reportPath, summary };
  } finally {
    try {
      await chrome.kill();
    } catch {
      // ignore
    }
  }
}
