import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const C2 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/proekt-m/c2-transformation';
const bp = JSON.parse(await readFile(join(C2, 'blueprint/generation.json'), 'utf8'));
const hy = JSON.parse(await readFile(join(C2, 'hybrid/generation.json'), 'utf8'));
const srcDesktop = JSON.parse(await readFile(join(C2, 'source/lighthouse.json'), 'utf8'));
const srcMobile = JSON.parse(await readFile(join(C2, 'source/lighthouse-mobile.json'), 'utf8'));

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
const sourceDesktop = metrics(srcDesktop);
const sourceMobile = metrics(srcMobile);

const review = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>C2 Proekt-M — До и после</title>
  <style>
    body { font-family: Inter, system-ui, sans-serif; margin: 0; padding: 24px; background: #F4F4F2; color: #1A1A1A; }
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.1rem; margin-top: 32px; }
    .row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
    .tile { background: #fff; border: 1px solid #E0E0E0; padding: 12px; }
    .tile h3 { font-size: 0.9rem; color: #6B6B6B; margin: 0 0 8px; }
    .tile img { width: 100%; height: auto; }
    .metric { display: inline-block; margin: 4px 8px 0 0; background: #F4F4F2; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; }
    @media (max-width: 900px) { .row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>C2 Proekt-M — сравнение текущего сайта и C2 Hybrid</h1>

  <h2>Desktop (1440×900)</h2>
  <div class="row">
    <div class="tile">
      <h3>ТЕКУКУЩИЙ ИСТОЧНИК</h3>
      <img src="../source/qa/desktop.png" alt="Current desktop">
      <div>
        <span class="metric">Perf ${sourceDesktop.performance}</span>
        <span class="metric">A11y ${sourceDesktop.accessibility}</span>
        <span class="metric">CLS ${sourceDesktop.cls}</span>
        <span class="metric">LCP ${Math.round(sourceDesktop.lcp/100)/10}s</span>
      </div>
    </div>
    <div class="tile">
      <h3>C2 HYBRID</h3>
      <img src="../hybrid/qa/C2_HYBRID-desktop.png" alt="Hybrid desktop">
      <div>
        <span class="metric">Perf ${hy.lighthouse.performance}</span>
        <span class="metric">A11y ${hy.lighthouse.accessibility}</span>
        <span class="metric">CLS ${hy.lighthouse.cls}</span>
        <span class="metric">LCP ${Math.round(hy.lighthouse.lcp/100)/10}s</span>
      </div>
    </div>
  </div>

  <h2>Mobile (390×844)</h2>
  <div class="row">
    <div class="tile">
      <h3>ТЕ�КУКУЩИЙ ИСТОЧНИК</h3>
      <img src="../source/qa/mobile.png" alt="Current mobile">
      <div>
        <span class="metric">Perf ${sourceMobile.performance}</span>
        <span class="metric">LCP ${Math.round(sourceMobile.lcp/100)/10}s</span>
      </div>
    </div>
    <div class="tile">
      <h3>C2 HYBRID</h3>
      <img src="../hybrid/qa/C2_HYBRID-mobile.png" alt="Hybrid mobile">
    </div>
  </div>

  <h2>Ключевые моменты</h2>
  <ul>
    <li><strong>Hero:</strong> крупное фото объекта, понятное УТП, один CTA.</li>
    <li><strong>Доверие:</strong> 1200+, 150 000 м2, BIM — сразу в цифрах.</li>
    <li><strong>Портфолио:</strong> фильтр по жилым/общественным/промышленным.</li>
    <li><strong>Жизненный цикл:</strong> от сбора данных до сдачи — прозрачно.</li>
    <li><strong>Отзывы:</strong> видео-карточки с YouTube.</li>
    <li><strong>Мобильная версия:</strong> читаемая, без горизонтального скролла.</li>
  </ul>
</body>
</html>`;

await mkdir(join(C2, 'comparison'), { recursive: true });
await writeFile(join(C2, 'comparison/review.html'), review, 'utf8');

const evaluation = { sourceDesktop, sourceMobile, blueprint: bp.lighthouse, hybrid: hy.lighthouse };
await writeFile(join(C2, 'comparison/evaluation.json'), JSON.stringify(evaluation, null, 2), 'utf8');
console.log('Comparison package written');
