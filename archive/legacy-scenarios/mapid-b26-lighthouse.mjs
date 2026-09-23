import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const url = 'http://localhost:3460/b26-cms.html';
const leadId = 'mapid-b26-cms';
const outDir = 'data/experiments/mapid/b26-cms';

const chrome = await launch({ chromeFlags: ['--headless', '--disable-gpu', '--ignore-certificate-errors'] });

try {
  const result = await lighthouse(url, {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
  });

  const lhr = result?.lhr;
  if (!lhr) throw new Error('Lighthouse returned empty result');

  const summary = {
    performance: Math.round((lhr.categories?.performance?.score ?? 0) * 100),
    accessibility: Math.round((lhr.categories?.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((lhr.categories?.['best-practices']?.score ?? 0) * 100),
    seo: Math.round((lhr.categories?.seo?.score ?? 0) * 100),
    lcp: lhr.audits?.['largest-contentful-paint']?.numericValue,
    cls: lhr.audits?.['cumulative-layout-shift']?.numericValue,
    fcp: lhr.audits?.['first-contentful-paint']?.numericValue,
    tbt: lhr.audits?.['total-blocking-time']?.numericValue
  };

  const report = { url, leadId, summary, lhr, generatedAt: new Date().toISOString() };
  await writeFile(join(outDir, 'lighthouse.json'), JSON.stringify(report, null, 2), 'utf8');
  console.log('Lighthouse complete:', JSON.stringify(summary));
} catch (err) {
  await writeFile(join(outDir, 'lighthouse.json'), JSON.stringify({ url, leadId, error: err.message }, null, 2), 'utf8');
  console.error('Lighthouse failed:', err.message);
} finally {
  try { await chrome.kill(); } catch {}
}
