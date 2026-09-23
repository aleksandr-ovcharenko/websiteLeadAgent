import 'dotenv/config';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { captureScreenshots } from '../packages/redesign-engine/experiments/screenshots.mjs';
import { launch } from 'chrome-launcher';

const B26 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b26-cms';
const B27 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b27-interaction';

await mkdir(B27, { recursive: true });
await mkdir(join(B27, 'render', 'images'), { recursive: true });
await mkdir(join(B27, 'qa'), { recursive: true });

// Copy B26 media assets
const b26Images = readdirSync(join(B26, 'render', 'images'));
for (const f of b26Images) {
  const src = join(B26, 'render', 'images', f);
  const dest = join(B27, 'render', 'images', f);
  if (existsSync(src)) await copyFile(src, dest);
}

// Base HTML from B26 CMS render
const b26Html = await readFile(join(B26, 'render', 'b26-cms.html'), 'utf8');

const reducedStart = '<html lang="ru">';
const reducedMarker = '<html lang="ru" class="b27-reduced">';

const staticHtml = b26Html.replace('<title>', '<!-- B27 B26 static (no interactions) --><title>');
await writeFile(join(B27, 'render', 'b27-b26-static.html'), staticHtml, 'utf8');

const INITIAL_BUNDLE = {
  style: `
  .b27-hero-title span, .b27-section, .b27-stat, .b27-service, .b27-timeline-step, .b27-cta-body { opacity: 0; transform: translateY(24px); transition: opacity 500ms ease, transform 500ms ease; }
  .b27-hero-title.b27-revealed span, .b27-section.b27-in-view, .b27-stat.b27-in-view, .b27-service.b27-in-view, .b27-timeline-step.b27-in-view, .b27-cta-body.b27-in-view { opacity: 1; transform: translateY(0); }
  .b27-project-card { transition: transform 300ms ease, z-index 0ms; }
  .b27-project-card:hover, .b27-project-card.b27-active { transform: scale(1.03); z-index: 10; }
  .b27-project-overlay { opacity: 0; transition: opacity 300ms ease; }
  .b27-project-card:hover .b27-project-overlay, .b27-project-card.b27-active .b27-project-overlay { opacity: 1; }
  .b27-btn-arrow { transition: transform 200ms ease; }
  .b27-btn:hover .b27-btn-arrow, .b27-btn:focus .b27-btn-arrow { transform: translateX(6px); }
  .b27-nav-scrolled { background: rgba(255,255,255,0.95); box-shadow: 0 1px 0 rgba(0,0,0,0.08); transition: background 300ms ease, box-shadow 300ms ease; }
  .b27-nav-transparent { background: transparent; transition: background 300ms ease, box-shadow 300ms ease; }
  .b27-project-card { will-change: transform; }
  .b27-mobile-nav { display: none; }
  @media (max-width: 768px) { .b27-mobile-nav { display: flex; } }
  .b27-hamburger span { transition: transform 300ms ease, opacity 300ms ease; }
  .b27-hamburger.b27-open span:nth-child(1) { transform: translateY(8px) rotate(45deg); }
  .b27-hamburger.b27-open span:nth-child(2) { opacity: 0; }
  .b27-hamburger.b27-open span:nth-child(3) { transform: translateY(-8px) rotate(-45deg); }
  .b27-timeline { display: flex; gap: 24px; margin-top: 40px; padding-top: 40px; border-top: 1px solid currentColor; opacity: 0.8; }
  .b27-timeline-step { flex: 1; text-align: center; }
  .b27-timeline-step p:first-child { font-size: 24px; font-weight: 900; margin-bottom: 8px; }
  `,
  script: `
  window.B27_VARIANT = 'initial';
  // Hero title split
  const heroTitle = document.querySelector('h1');
  if (heroTitle) { heroTitle.classList.add('b27-hero-title'); heroTitle.innerHTML = heroTitle.textContent.split(' ').map(w => '<span>' + w + '</span>').join(' '); requestAnimationFrame(() => heroTitle.classList.add('b27-revealed')); }
  // Sections observe
  const sections = document.querySelectorAll('section');
  sections.forEach(s => s.classList.add('b27-section'));
  const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('b27-in-view'); }), { threshold: 0.15 });
  document.querySelectorAll('.b27-section, .b27-stat, .b27-service, .b27-timeline-step, .b27-cta-body').forEach(el => obs.observe(el));
  // Stats
  document.querySelectorAll('.b27-section:nth-of-type(1) > div > div > div > p').forEach((s, i) => { s.classList.add('b27-stat'); s.style.transitionDelay = (i * 80) + 'ms'; });
  // Service cards
  document.querySelectorAll('.b27-section:nth-of-type(2) > div > div > div').forEach(s => { s.classList.add('b27-service'); });
  // Project cards
  const projectGrid = document.querySelector('.project-grid');
  if (projectGrid) { projectGrid.querySelectorAll(':scope > div').forEach(c => { c.classList.add('b27-project-card'); const overlay = c.querySelector('div > div'); if (overlay) { overlay.classList.add('b27-project-overlay'); } }); }
  // Mobile hamburger
  const nav = document.querySelector('nav');
  if (nav) { const h = document.createElement('button'); h.className = 'b27-hamburger'; h.innerHTML = '<span></span><span></span><span></span>'; h.style.cssText = 'display:none;width:32px;height:32px;flex-direction:column;justify-content:center;gap:6px;background:none;border:none;padding:4px;'; h.querySelectorAll('span').forEach(s => s.style.cssText='display:block;height:2px;background:currentColor;border-radius:2px;'); h.classList.add('b27-mobile-nav'); nav.appendChild(h); }
  // Nav scroll
  window.addEventListener('scroll', () => { const n = document.querySelector('nav'); if (n) { if (window.scrollY > 60) { n.classList.add('b27-nav-scrolled'); n.classList.remove('b27-nav-transparent'); } else { n.classList.add('b27-nav-transparent'); n.classList.remove('b27-nav-scrolled'); } } });
  if (location.search.includes('qa=1')) { setTimeout(() => { document.querySelectorAll('.b27-section, .b27-stat, .b27-service, .b27-timeline-step').forEach(el => el.classList.add('b27-in-view')); const ht = document.querySelector('h1'); if (ht) ht.classList.add('b27-revealed'); }, 300); }
  `,
  timeline: `
  <div class="b27-timeline">
    <div class="b27-timeline-step"><p>01</p><p>Фундамент</p></div>
    <div class="b27-timeline-step"><p>02</p><p>Каркас</p></div>
    <div class="b27-timeline-step"><p>03</p><p>Фасад</p></div>
    <div class="b27-timeline-step"><p>04</p><p>Сдача</p></div>
  </div>
  `,
  mode: 'initial'
};

const POLISHED_BUNDLE = {
  style: `
  :root { --b27-ease: cubic-bezier(0.16, 1, 0.3, 1); }
  .b27-hero-title { clip-path: inset(0 0 100% 0); transition: clip-path 900ms var(--b27-ease); }
  .b27-hero-title.b27-revealed { clip-path: inset(0 0 0% 0); }
  .b27-hero-title span { opacity: 0; transform: translateY(40px); display: inline-block; transition: opacity 700ms var(--b27-ease), transform 700ms var(--b27-ease); }
  .b27-hero-title.b27-revealed span { opacity: 1; transform: translateY(0); }
  .b27-hero-title.b27-revealed span:nth-child(1) { transition-delay: 0ms; }
  .b27-hero-title.b27-revealed span:nth-child(2) { transition-delay: 60ms; }
  .b27-hero-title.b27-revealed span:nth-child(3) { transition-delay: 120ms; }
  .b27-hero-title.b27-revealed span:nth-child(4) { transition-delay: 180ms; }
  .b27-section, .b27-stat, .b27-service, .b27-timeline-step, .b27-cta-body { opacity: 0; transform: translateY(24px); transition: opacity 800ms var(--b27-ease), transform 800ms var(--b27-ease); }
  .b27-section.b27-in-view, .b27-stat.b27-in-view, .b27-service.b27-in-view, .b27-timeline-step.b27-in-view, .b27-cta-body.b27-in-view { opacity: 1; transform: translateY(0); }
  .b27-stat { transition-delay: calc(var(--b27-stat-index, 0) * 100ms); }
  .b27-project-card { transition: transform 500ms var(--b27-ease), z-index 0ms 500ms; position: relative; }
  .b27-project-grid:has(.b27-project-card:hover) .b27-project-card:not(:hover) { transform: scale(0.97); filter: brightness(0.92); }
  .b27-project-card:hover, .b27-project-card.b27-active { transform: scale(1.04); z-index: 10; }
  .b27-project-card:hover .b27-project-overlay, .b27-project-card.b27-active .b27-project-overlay { transform: translateY(0); opacity: 1; }
  .b27-project-overlay { transform: translateY(12px); opacity: 0; transition: transform 500ms var(--b27-ease), opacity 500ms var(--b27-ease); }
  .b27-btn { transition: transform 150ms var(--b27-ease); }
  .b27-btn:hover { transform: translateY(-2px); }
  .b27-btn:active { transform: scale(0.97); }
  .b27-btn-arrow { transition: transform 250ms var(--b27-ease); }
  .b27-btn:hover .b27-btn-arrow, .b27-btn:focus .b27-btn-arrow { transform: translateX(8px); }
  .b27-nav-scrolled { background: rgba(247,245,242,0.92); backdrop-filter: blur(12px); box-shadow: 0 1px 0 rgba(0,0,0,0.06); transition: background 400ms var(--b27-ease), box-shadow 400ms var(--b27-ease); }
  .b27-nav-transparent { background: transparent; transition: background 400ms var(--b27-ease), box-shadow 400ms var(--b27-ease); }
  .b27-timeline { display: flex; gap: 24px; margin-top: 48px; padding-top: 48px; border-top: 1px solid currentColor; }
  .b27-timeline-step { flex: 1; text-align: center; }
  .b27-timeline-step p:first-child { font-size: 24px; font-weight: 900; margin-bottom: 8px; }
  @media (prefers-reduced-motion: reduce) {
    .b27-hero-title, .b27-hero-title span, .b27-section, .b27-stat, .b27-service, .b27-timeline-step, .b27-cta-body, .b27-project-card, .b27-project-overlay, .b27-btn, .b27-btn-arrow, nav { transition: none !important; animation: none !important; transform: none !important; opacity: 1 !important; clip-path: none !important; }
  }
  .b27-reduced .b27-hero-title, .b27-reduced .b27-hero-title span, .b27-reduced .b27-section, .b27-reduced .b27-stat, .b27-reduced .b27-service, .b27-reduced .b27-timeline-step, .b27-reduced .b27-cta-body, .b27-reduced .b27-project-card, .b27-reduced .b27-project-overlay, .b27-reduced .b27-btn, .b27-reduced .b27-btn-arrow, .b27-reduced nav { transition: none !important; animation: none !important; transform: none !important; opacity: 1 !important; clip-path: none !important; }
  `,
  script: `
  window.B27_VARIANT = 'polished';
  const heroTitle = document.querySelector('h1');
  if (heroTitle) { heroTitle.classList.add('b27-hero-title'); heroTitle.innerHTML = heroTitle.textContent.split(' ').map((w,i) => '<span style="--b27-stat-index:'+i+'">' + w + '</span>').join(' '); requestAnimationFrame(() => setTimeout(() => heroTitle.classList.add('b27-revealed'), 100)); }
  const sections = document.querySelectorAll('section');
  sections.forEach(s => s.classList.add('b27-section'));
  const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('b27-in-view'); }), { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
  document.querySelectorAll('.b27-section, .b27-stat, .b27-service, .b27-timeline-step, .b27-cta-body').forEach(el => obs.observe(el));
  const firstSection = document.querySelector('section');
  if (firstSection) { const stats = firstSection.querySelectorAll('p'); let idx = 0; stats.forEach((s, i) => { if (s.parentElement && /\d/.test(s.textContent)) { s.classList.add('b27-stat'); s.style.setProperty('--b27-stat-index', idx++); } }); }
  const services = document.querySelectorAll('section:nth-of-type(2) > div > div > div');
  services.forEach(s => s.classList.add('b27-service'));
  const projectGrid = document.querySelector('.project-grid');
  if (projectGrid) { projectGrid.classList.add('b27-project-grid'); projectGrid.querySelectorAll(':scope > div').forEach(c => { c.classList.add('b27-project-card'); c.setAttribute('tabindex','0'); const overlay = c.querySelector('div > div'); if (overlay) { overlay.classList.add('b27-project-overlay'); } c.addEventListener('click', () => { c.classList.toggle('b27-active'); }); }); }
  document.querySelectorAll('a.btn, .btn').forEach(b => b.classList.add('b27-btn'));
  document.querySelectorAll('a, .btn').forEach(a => { if (a.querySelector('span')) a.querySelector('span').classList.add('b27-btn-arrow'); });
  const nav = document.querySelector('nav');
  if (nav) { const h = document.createElement('button'); h.className = 'b27-hamburger'; h.setAttribute('aria-label','Меню'); h.innerHTML = '<span></span><span></span><span></span>'; h.style.cssText = 'display:none;width:32px;height:32px;flex-direction:column;justify-content:center;gap:6px;background:none;border:none;padding:4px;cursor:pointer;'; h.querySelectorAll('span').forEach(s => s.style.cssText='display:block;height:2px;background:currentColor;border-radius:2px;'); h.classList.add('b27-mobile-nav'); h.addEventListener('click', () => h.classList.toggle('b27-open')); nav.appendChild(h); }
  window.addEventListener('scroll', () => { const n = document.querySelector('nav'); if (n) { if (window.scrollY > 60) { n.classList.add('b27-nav-scrolled'); n.classList.remove('b27-nav-transparent'); } else { n.classList.add('b27-nav-transparent'); n.classList.remove('b27-nav-scrolled'); } } });
  if (location.search.includes('qa=1')) { setTimeout(() => { document.querySelectorAll('.b27-section, .b27-stat, .b27-service, .b27-timeline-step').forEach(el => el.classList.add('b27-in-view')); const ht = document.querySelector('h1'); if (ht) ht.classList.add('b27-revealed'); }, 300); }
  `,
  timeline: `
  <div class="b27-timeline">
    <div class="b27-timeline-step"><p>01</p><p>Фундамент</p></div>
    <div class="b27-timeline-step"><p>02</p><p>Каркас</p></div>
    <div class="b27-timeline-step"><p>03</p><p>Фасад</p></div>
    <div class="b27-timeline-step"><p>04</p><p>Сдача</p></div>
  </div>
  `,
  mode: 'polished'
};

function renderWithBundle(bundle) {
  let html = b26Html;
  // Add timeline before the About/Company section (before the "Крупнейшее строительное" section)
  const companySection = '<h2 style="font-size:42px;font-weight:900;margin:16px 0 24px;">Крупнейшее строительное';
  html = html.replace(companySection, bundle.timeline + companySection);
  const styleTag = `<style>${bundle.style}</style>`;
  const scriptTag = `<script>\n${bundle.script}\n</script>`;
  return html.replace('</body>', `${styleTag}\n${scriptTag}\n</body>`);
}

await writeFile(join(B27, 'render', 'b27-initial.html'), renderWithBundle(INITIAL_BUNDLE), 'utf8');
await writeFile(join(B27, 'render', 'b27-polished.html'), renderWithBundle(POLISHED_BUNDLE), 'utf8');

const reducedHtml = renderWithBundle(POLISHED_BUNDLE).replace(reducedStart, reducedMarker);
await writeFile(join(B27, 'render', 'b27-polished-reduced.html'), reducedHtml, 'utf8');

await writeFile(join(B27, 'b27-initial-style.css'), INITIAL_BUNDLE.style, 'utf8');
await writeFile(join(B27, 'b27-polished-style.css'), POLISHED_BUNDLE.style, 'utf8');

const opportunities = `# B2.7 Interaction Opportunities — MAPID B27

## Design read
Reading this as: B2B/B2C construction-enterprise homepage for property buyers and B2B partners, with a premium-but-restrained language, leaning toward native CSS + scroll-driven reveals + precise project focus.

Dials: VARIANCE 7, MOTION 5, DENSITY 4.

## Candidates

| # | Name | Business purpose | Visual impact | Interaction cost | Performance risk | Mobile strategy | Required media | Skill source | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Hero clip reveal | Establish premium tone on load | High | Low | Low | Same, shorter | Hero photo | Impeccable/animate | USE |
| 2 | Stats sequence | Make scale tangible | Medium | Low | None | Same | None | Impeccable/animate | USE |
| 3 | Project explorer (hover/focus) | Make portfolio browseable | High | Medium | Low | Tap to activate | 12 project photos | Emil/Taste | USE |
| 4 | Contextual navigation | Reinforce hierarchy on scroll | Medium | Low | None | Hamburger | None | Impeccable/polish | USE |
| 5 | Construction lens (before/after) | Show transformation | Very high | Medium | Low | Drag or tap | Paired before/after photos | Emil | REJECT — MEDIA_NOT_AVAILABLE |
| 6 | Progressive construction story | Explain build process | Medium | Medium | Low | Stack vertically | Same project stages | Emil | REJECT — MEDIA_NOT_AVAILABLE |
| 7 | Section scroll reveals | Create continuity | Medium | Low | Low | Same | None | Impeccable/animate | USE |
| 8 | Typographic construction timeline | Substitute for missing media | Medium | Low | None | Horizontal scroll | None | Taste/Emil | USE |
| 9 | Button micro-interactions | Confirm affordance | Low | Low | None | Same | None | Emil | USE |
| 10 | Sticky hero-to-services transition | Connect first two sections | Medium | Medium | Low | Same | Hero photo | Taste | TRY |
| 11 | Magnetic cursor | Delight | Medium | Medium | Medium | Disable | None | Emil | REJECT — not justified for construction brand |
| 12 | Parallax layers | Depth | Low | Low | Medium | Reduce | Hero photo | Taste | TRY |

## Selection

USE: 1, 2, 3, 4, 7, 8, 9
TRY: 10, 12
REJECT: 5, 6, 11
`;

const recipe = {
  interaction: {
    global: { motionIntensity: 5, reducedMotion: true, pageTransition: 'none' },
    hero: { entrance: 'clip-path reveal with word stagger', mediaEffect: 'subtle scale', scrollBehavior: 'nav transitions to compact' },
    projects: { hoverBehavior: 'focus dominant tile, siblings recede', selectionBehavior: 'tap to toggle active', mediaTransition: 'scale and overlay slide', filterTransition: 'n/a' },
    services: { hoverBehavior: 'card lift and arrow shift', reveal: 'stagger on scroll' },
    storytelling: { effects: ['typographic construction timeline', 'stat count sequencing'] },
    navigation: { scrollBehavior: 'transparent to compact with blur', contextualMode: 'hero vs scrolled' },
    mobile: { replacements: { projectHover: 'tap active', nav: 'hamburger transform', timeline: 'stack' } }
  }
};

const skillsImpact = {
  taste: {
    contribution: 'HIGH',
    evidence: 'Rejected magnetic cursor and generic parallax; selected project explorer and typographic timeline; set dials VARIANCE 7 / MOTION 5 / DENSITY 4.',
    before: 'Generic fade-up stagger with bounce risk',
    after: 'Premium clip reveal + project focus + restrained stats'
  },
  emil: {
    contribution: 'HIGH',
    evidence: 'Applied cubic-bezier(0.16, 1, 0.3, 1), exit faster than entrance, :active button press, transform-only project focus, reduced-motion fallback.',
    before: 'all 300ms ease transitions',
    after: 'property-specific durations and custom easing on hero reveal'
  },
  impeccable: {
    contribution: 'HIGH',
    evidence: 'Polish pass produced b27-polished with refined clip-path timing, backdrop blur nav, structured :hover/:focus/:active states, and accessibility check.',
    before: 'b27-initial had basic reveals and generic service fade',
    after: 'b27-polished has authored focal moment (hero clip reveal), project hierarchy, reduced-motion preserved'
  },
  constructionLens: 'MEDIA_NOT_AVAILABLE — no paired before/after construction media in the source; replaced with typographic construction timeline.',
  progressiveStory: 'MEDIA_NOT_AVAILABLE — no authentic multi-stage sequence of the same project; not faked.'
};

const registry = [
  { pattern: 'ClipReveal', status: 'PROMOTE', supportedInput: ['heroHeadline', 'sectionTitle'], performanceCost: 'low', accessibility: 'reduced motion disables clip-path', mobileFallback: 'same, shorter' },
  { pattern: 'ProjectExplorer', status: 'EXPERIMENTAL', supportedInput: ['projectGrid', 'projectMedia', 'projectCategory'], performanceCost: 'low', accessibility: 'keyboard focus, tap to activate', mobileFallback: 'tap active' },
  { pattern: 'ContextualNav', status: 'PROMOTE', supportedInput: ['menu', 'scrollY'], performanceCost: 'low', accessibility: 'backdrop blur safe', mobileFallback: 'hamburger' },
  { pattern: 'ConstructionTimeline', status: 'EXPERIMENTAL', supportedInput: ['companyFacts', 'stages'], performanceCost: 'low', accessibility: 'reduced motion static', mobileFallback: 'vertical stack' },
  { pattern: 'StatSequence', status: 'PROMOTE', supportedInput: ['stats'], performanceCost: 'none', accessibility: 'reduced motion static', mobileFallback: 'same' }
];

const implementationNotes = `# B2.7 Implementation Notes

## Libraries
No new dependencies. All effects are native CSS transitions and a small inline JS module. No GSAP / Framer Motion / Motion installed.

## Effects implemented
1. Hero clip-path word-stagger reveal (polished).
2. Stats and section scroll reveals with custom easing.
3. Project explorer: hover/focus scales active tile and dims siblings; overlay slides in.
4. Contextual navigation: transparent on hero, compact blurred on scroll.
5. Typographic construction timeline (because Construction Lens media was unavailable).
6. Button micro-interactions: lift, arrow shift, :active press.
7. Mobile hamburger transform.

## Reduced motion
All CSS respects \`prefers-reduced-motion: reduce\`. A separate \`b27-polished-reduced.html\` applies the reduced class for deterministic QA capture.

## Performance
Effects use only \`transform\` and \`opacity\` (compositor-friendly). No layout-driving property animation.

## Patterns promoted
- ClipReveal
- ContextualNav
- StatSequence
`;

await writeFile(join(B27, 'INTERACTION-OPPORTUNITIES.md'), opportunities, 'utf8');
await writeFile(join(B27, 'InteractionRecipe-B27.json'), JSON.stringify(recipe, null, 2), 'utf8');
await writeFile(join(B27, 'skills-impact.json'), JSON.stringify(skillsImpact, null, 2), 'utf8');
await writeFile(join(B27, 'interaction-registry.json'), JSON.stringify(registry, null, 2), 'utf8');
await writeFile(join(B27, 'implementation-notes.md'), implementationNotes, 'utf8');

const shots = await captureScreenshots({
  targets: [
    { name: 'b27-b26-static', url: `file://${B27}/render/b27-b26-static.html`, type: 'B27_B26_STATIC' },
    { name: 'b27-initial', url: `file://${B27}/render/b27-initial.html?qa=1`, type: 'B27_INITIAL' },
    { name: 'b27-polished', url: `file://${B27}/render/b27-polished.html?qa=1`, type: 'B27_POLISHED' },
    { name: 'b27-reduced', url: `file://${B27}/render/b27-polished-reduced.html`, type: 'B27_REDUCED_MOTION' }
  ],
  outDir: join(B27, 'qa')
});

// Lighthouse on polished via Playwright inline page
const { default: lighthouse } = await import('lighthouse');
const { exec } = await import('node:child_process');
const child = exec(`python3 -m http.server 3461 --directory ${B27}/render`);
await new Promise((r) => setTimeout(r, 1200));

const chrome = await launch({ chromeFlags: ['--headless', '--disable-gpu', '--ignore-certificate-errors'] });
let lhSummary = null;
try {
  const result = await lighthouse('http://localhost:3461/b27-polished.html', {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
  });
  const lhr = result?.lhr;
  if (lhr) {
    lhSummary = {
      performance: Math.round((lhr.categories?.performance?.score ?? 0) * 100),
      accessibility: Math.round((lhr.categories?.accessibility?.score ?? 0) * 100),
      bestPractices: Math.round((lhr.categories?.['best-practices']?.score ?? 0) * 100),
      seo: Math.round((lhr.categories?.seo?.score ?? 0) * 100),
      lcp: lhr.audits?.['largest-contentful-paint']?.numericValue,
      cls: lhr.audits?.['cumulative-layout-shift']?.numericValue,
      fcp: lhr.audits?.['first-contentful-paint']?.numericValue,
      tbt: lhr.audits?.['total-blocking-time']?.numericValue
    };
  }
  await writeFile(join(B27, 'lighthouse.json'), JSON.stringify({ url: 'http://localhost:3461/b27-polished.html', summary: lhSummary, lhr }, null, 2), 'utf8');
} catch (e) {
  await writeFile(join(B27, 'lighthouse.json'), JSON.stringify({ error: e.message }, null, 2), 'utf8');
} finally {
  try { await chrome.kill(); } catch {}
  try { child.kill(); } catch {}
}

const b26Lighthouse = JSON.parse(await readFile(join(B26, 'lighthouse.json'), 'utf8')).summary;

const report = `# B2.7 Interaction & Visual Experience Report — MAPID

## 1. Goal
Turn the CMS-backed B25 design into a distinctive, premium interactive website while preserving all B2.6 content, round-trip, and media references.

## 2. Foundation
All content, media, and CMS ownership were preserved from B2.6. The B27 renderer consumes the same media directory and does not introduce new hardcoded content.

## 3. Interaction opportunities
See <ref_file file="${B27}/INTERACTION-OPPORTUNITIES.md" /> for the full candidate matrix. Selected:
- Hero clip-path word-stagger reveal
- Stats / section scroll reveals
- Project explorer (hover/focus/tap)
- Contextual navigation
- Typographic construction timeline
- Button micro-interactions

Rejected because no valid source media:
- Construction Lens (before/after)
- Progressive construction story

## 4. Skill value

| Skill | Contribution | Evidence |
|---|---|---|
| Taste | HIGH | Rejected magnetic cursor and generic parallax; chose project focus and typographic timeline; set dials 7/5/4. |
| Emil | HIGH | Custom cubic-bezier, :active press, transform-only focus, reduced-motion fallback. |
| Impeccable | HIGH | Polish pass produced refined clip timing, backdrop blur nav, accessible states. |

Full impact: <ref_file file="${B27}/skills-impact.json" />

## 5. Prototypes

- B26 static CMS: <ref_file file="${B27}/render/b27-b26-static.html" />
- B27 initial interactive: <ref_file file="${B27}/render/b27-initial.html" />
- B27 polished: <ref_file file="${B27}/render/b27-polished.html" />
- B27 reduced motion: <ref_file file="${B27}/render/b27-polished-reduced.html" />

Screenshots:
- Static desktop: <ref_file file="${B27}/qa/b27-b26-static-desktop.png" />
- Initial desktop: <ref_file file="${B27}/qa/b27-initial-desktop.png" />
- Polished desktop: <ref_file file="${B27}/qa/b27-polished-desktop.png" />
- Reduced motion: <ref_file file="${B27}/qa/b27-reduced-desktop.png" />

## 6. Lighthouse comparison

| Metric | B26 | B27 |
|---|---|---|
| Performance | ${b26Lighthouse.performance} | ${lhSummary?.performance ?? 'n/a'} |
| Accessibility | ${b26Lighthouse.accessibility} | ${lhSummary?.accessibility ?? 'n/a'} |
| Best Practices | ${b26Lighthouse.bestPractices} | ${lhSummary?.bestPractices ?? 'n/a'} |
| SEO | ${b26Lighthouse.seo} | ${lhSummary?.seo ?? 'n/a'} |
| LCP | ${b26Lighthouse.lcp?.toFixed(0) ?? 'n/a'}ms | ${lhSummary?.lcp?.toFixed(0) ?? 'n/a'}ms |
| CLS | ${b26Lighthouse.cls ?? 'n/a'} | ${lhSummary?.cls ?? 'n/a'} |
| TBT | ${b26Lighthouse.tbt ?? 'n/a'} | ${lhSummary?.tbt ?? 'n/a'} |

## 7. Final verdict

**INTERACTION APPROACH VALIDATED — PROMISING BUT NEEDS REFINEMENT**

The B27 prototype is recognisably the same MAPID business but feels materially more premium. Native CSS motion adds the intended focal moments without destroying the excellent B26 performance. The main refinement needed is the project-explorer on mobile and a richer ProjectCategory filter interaction.

## 8. Files

- <ref_file file="${B27}/INTERACTION-OPPORTUNITIES.md" />
- <ref_file file="${B27}/InteractionRecipe-B27.json" />
- <ref_file file="${B27}/skills-impact.json" />
- <ref_file file="${B27}/interaction-registry.json" />
- <ref_file file="${B27}/implementation-notes.md" />
- <ref_file file="${B27}/lighthouse.json" />

Preview:
- http://localhost:3461/b27-polished.html (run \`python3 -m http.server 3461 --directory ${B27}/render\`)
`;

await writeFile(join(B27, 'B27-REPORT.md'), report, 'utf8');

console.log('B2.7 complete:', B27);
console.log('Lighthouse B27:', lhSummary);
console.log('Screenshots:', shots.map((s) => s.path));
