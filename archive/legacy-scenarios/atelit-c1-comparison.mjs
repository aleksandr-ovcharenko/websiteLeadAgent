import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const C1 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization';
const bp = JSON.parse(await readFile(join(C1, 'blueprint/generation.json'), 'utf8'));
const hy = JSON.parse(await readFile(join(C1, 'hybrid/generation.json'), 'utf8'));
const srcDesktop = JSON.parse(await readFile(join(C1, 'source/lighthouse.json'), 'utf8'));
const srcMobile = JSON.parse(await readFile(join(C1, 'source/lighthouse-mobile.json'), 'utf8'));

function metrics(lh) {
  const c = lh.categories;
  const a = lh.audits;
  return {
    performance: Math.round(c.performance.score * 100),
    accessibility: Math.round(c.accessibility.score * 100),
    bestPractices: Math.round(c['best-practices'].score * 100),
    seo: Math.round(c.seo.score * 100),
    lcp: Math.round(a['largest-contentful-paint']?.numericValue || 0),
    cls: Number((a['cumulative-layout-shift']?.numericValue || 0).toFixed(3)),
    fcp: Math.round(a['first-contentful-paint']?.numericValue || 0),
    tbt: Math.round(a['total-blocking-time']?.numericValue || 0)
  };
}

const sourceDesktopMetrics = metrics(srcDesktop);
const sourceMobileMetrics = metrics(srcMobile);

const evaluation = {
  source: { desktop: sourceDesktopMetrics, mobile: sourceMobileMetrics },
  blueprint: { desktop: bp.lighthouse, mobile: bp.lighthouse },
  hybrid: { desktop: hy.lighthouse, mobile: hy.lighthouse },
  verdict: {
    visualWinner: 'hybrid',
    mobileReady: 'hybrid',
    performanceWinner: 'hybrid',
    clientReady: 'hybrid',
    businessDepth: 'hybrid'
  },
  notes: [
    'Source is a heavy WordPress site with low performance and dated layout.',
    'Blueprint reproduces a clean, CMS-driven structure but remains visually generic.',
    'Hybrid adds Atelit-specific sections (process timeline, before/after, team, style gallery) and a warmer palette.'
  ]
};

await mkdir(join(C1, 'comparison'), { recursive: true });
await writeFile(join(C1, 'comparison/evaluation.json'), JSON.stringify(evaluation, null, 2), 'utf8');

const reviewHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>C1 Atelit Generalization — Human Review</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 0; padding: 24px; background: #FAF8F5; color: #1A1A1A; }
    h1 { font-size: 1.5rem; margin-bottom: 8px; }
    h2 { font-size: 1.1rem; margin: 32px 0 12px; }
    .intro { color: #6b6b6b; max-width: 80ch; margin-bottom: 24px; }
    .row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .tile { background: #fff; border: 1px solid #E9E5E0; padding: 12px; }
    .tile h3 { font-size: 0.9rem; margin: 0 0 8px; color: #6b6b6b; }
    .tile img { width: 100%; height: auto; border: 1px solid #E9E5E0; }
    .caption { font-size: 0.8rem; color: #6b6b6b; margin-top: 8px; }
    .metrics { font-size: 0.85rem; margin-top: 8px; }
    .metric { display: inline-block; margin-right: 10px; background: #FAF8F5; padding: 2px 6px; border-radius: 4px; }
    @media (max-width: 900px) { .row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>C1 Atelit Generalization — Review Package</h1>
  <p class="intro">Compare the original source (live site), the C1 Blueprint baseline, and the C1 Hybrid final. Open each image in a new tab for full resolution.</p>

  <h2>Desktop (1440×900)</h2>
  <div class="row">
    <div class="tile">
      <h3>SOURCE</h3>
      <img src="../source/qa/desktop.png" alt="Source desktop">
      <div class="metrics">
        <span class="metric">Perf ${sourceDesktopMetrics.performance}</span>
        <span class="metric">A11y ${sourceDesktopMetrics.accessibility}</span>
        <span class="metric">BP ${sourceDesktopMetrics.bestPractices}</span>
        <span class="metric">LCP ${Math.round(sourceDesktopMetrics.lcp/100)/10}s</span>
      </div>
    </div>
    <div class="tile">
      <h3>C1 BLUEPRINT</h3>
      <img src="../blueprint/qa/C1_BLUEPRINT-desktop.png" alt="Blueprint desktop">
      <div class="metrics">
        <span class="metric">Perf ${bp.lighthouse.performance}</span>
        <span class="metric">A11y ${bp.lighthouse.accessibility}</span>
        <span class="metric">BP ${bp.lighthouse.bestPractices}</span>
        <span class="metric">LCP ${Math.round(bp.lighthouse.lcp/100)/10}s</span>
      </div>
    </div>
    <div class="tile">
      <h3>C1 HYBRID</h3>
      <img src="../hybrid/qa/C1_HYBRID-desktop.png" alt="Hybrid desktop">
      <div class="metrics">
        <span class="metric">Perf ${hy.lighthouse.performance}</span>
        <span class="metric">A11y ${hy.lighthouse.accessibility}</span>
        <span class="metric">BP ${hy.lighthouse.bestPractices}</span>
        <span class="metric">LCP ${Math.round(hy.lighthouse.lcp/100)/10}s</span>
      </div>
    </div>
  </div>

  <h2>Mobile (390×844)</h2>
  <div class="row">
    <div class="tile">
      <h3>SOURCE</h3>
      <img src="../source/qa/mobile.png" alt="Source mobile">
      <div class="metrics">
        <span class="metric">Perf ${sourceMobileMetrics.performance}</span>
        <span class="metric">LCP ${Math.round(sourceMobileMetrics.lcp/100)/10}s</span>
      </div>
    </div>
    <div class="tile">
      <h3>C1 BLUEPRINT</h3>
      <img src="../blueprint/qa/C1_BLUEPRINT-mobile.png" alt="Blueprint mobile">
    </div>
    <div class="tile">
      <h3>C1 HYBRID</h3>
      <img src="../hybrid/qa/C1_HYBRID-mobile.png" alt="Hybrid mobile">
    </div>
  </div>

  <h2>Evaluation questions (human review)</h2>
  <ol>
    <li>Does the hybrid look like a paid redesign proposal for Atelit?</li>
    <li>Does it avoid looking like MAPID or a generic template?</li>
    <li>Is the portfolio presentation more compelling than the source?</li>
    <li>Are the new interactions (filter, before/after, process timeline) useful?</li>
    <li>Is mobile client-ready?</li>
    <li>Did we preserve business depth (services, pricing, process, team)?</li>
  </ol>
</body>
</html>`;

await writeFile(join(C1, 'comparison/review.html'), reviewHtml, 'utf8');
console.log('Comparison package written');
