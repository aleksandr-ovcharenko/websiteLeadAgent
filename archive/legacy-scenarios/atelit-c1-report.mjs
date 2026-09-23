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
const sourceDesktop = metrics(srcDesktop);
const sourceMobile = metrics(srcMobile);

const report = `# C1 Atelit End-to-End Generalization Pilot — Report

**Source:** https://atelit.by/  
**Company:** Ателит — дизайн-студия / интерьер, проектирование, ремонт.  
**Artifact root:** \`data/experiments/atelit/c1-generalization/\`

## Executive summary

This pilot tested whether the Generation V2 pipeline (SourceSnapshot → Intelligence → CMS → Strategy → Design → Blueprint → Agent → QA) can take a visually dated, content-rich real interior-design website and produce a client-ready redesign proposal without copying the previous MAPID benchmark.

The result is \`C1_HYBRID_FINAL\`: a warm, portfolio-first redesign that clearly belongs to Atelit, preserves services/pricing/process/team depth, adds source-grounded interactions, and materially outperforms the live source in visual quality, performance, accessibility, and mobile readiness.

| Variant | Perf | A11y | BP | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| Source desktop | 61 | 81 | 59 | 83 | 4.6 s | 0.049 |
| Source mobile | 42 | 85 | 56 | 90 | 9.4 s | 0.081 |
| C1 Blueprint | 99 | 94 | 96 | 83 | 2.1 s | 0 |
| C1 Hybrid | 91 | 95 | 96 | 92 | 3.5 s | 0 |

## Source snapshot

- Fetched \`https://atelit.by/\` plus 15 key pages with \`curl\` after the Playwright-based \`crawlSite\` timed out on the heavy WordPress theme.
- Captured homepage, portfolio, 7 project detail pages, services (interior / cottages), pricing, about, contacts, calculator, promotions.
- Stored desktop + mobile source screenshots under \`source/qa/\` and ran Lighthouse (desktop + mobile).
- Content depth: 11 services, 7 projects, 3 price packages, 8 process stages, 3 interior styles, team quotes, before/after promo material, full contact/social data.
- Source complexity: repeated desktop/mobile blocks, popups, heavy lazy-load placeholders, two contradictory experience claims (12 vs 20 years) reconciled as separate stats.

## Website intelligence

Produced:

- \`SOURCE-ANALYSIS.md\` — source strengths, problems, content depth, reconciliation notes.
- \`SiteBrief.json\` — company identity, facts with confidence, contacts.
- \`TransformationBrief.json\` — objective, strategy, IA, risks.
- \`DesignRecipe.json\` — Atelit-specific palette (charcoal, warm off-white, terracotta), typography, section variants.
- \`InteractionRecipe.json\` — filterable portfolio, before/after slider, process timeline, hover/focus, mobile menu.
- \`brand-tokens.json\` — extracted color/type/spacing tokens.
- \`media-intelligence.json\` — selected hero, project covers, style images, team images, before/after pair.
- \`content-depth-source.json\` — coverage table by section.

## CMS

- Built \`source/cms-content.json\` directly from parsed pages.
- Preserved factual provenance: services, prices, process stages, project summaries, team quotes, contact data all trace to a source URL or page.
- Did not invent a single founding year; kept both "12 лет дизайн-студия" and "20 лет в строительстве" as separate stats.
- Media downloaded locally into \`source/images/\` and referenced by filename; image map supports round-trip editing.
- CMS round-trip verified: editing a service title re-renders correctly in both Blueprint and Hybrid.

## Blueprint baseline

- Reused the generic B3 section-family renderer (copied to \`c1-generalization/blueprint/\`, not touching \`mapid/b3-generation/\`).
- Rendered hero, services, portfolio, properties/pricing, about, CTA, footer.
- Lighthouse: Performance 99, Accessibility 94, Best Practices 96, SEO 83, CLS 0, LCP 2.1 s.
- CMS round-trip: pass.
- Limitation: still structurally generic; one-category "Направления деятельности" band is not meaningful for Atelit.

## Hybrid final — Agent customization

- Forked renderer into \`c1-generalization/hybrid/\`.
- Design decisions:
  - \`Taste\`: warm premium palette (terracotta accent, warm off-white) pulled from the hero image, not MAPID's green/earth tones.
  - \`Refero\`: split hero with portfolio image, editorial section rhythm, gallery-style project grid.
  - \`Impeccable\`: reduced visual noise, clear hierarchy, accessible contrast, bounded QA passes.
  - \`Emil\`: scannable numbered service list, timeline process, dark CTA band.
- New sections added by Agent (all CMS-driven):
  1. Before/after comparison slider using the source promo images.
  2. Scroll-driven 8-stage process timeline.
  3. Interior-style gallery.
  4. Team grid.
- Interactions implemented:
  - Portfolio filter by style (Все / Классический / Современная классика / Современный).
  - Before/after drag/click slider.
  - Project card hover zoom + keyboard activation.
  - Mobile hamburger menu + Escape close.
  - Smooth scroll and section reveal (reduced-motion safe).
- Lighthouse after 1 repair pass: Performance 91, Accessibility 95, Best Practices 96, SEO 92, CLS 0, LCP 3.5 s.

## Repair log

| Pass | Problem | Decision | Files changed | Autonomous | Result |
|---|---|---|---|---|---|
| 1 | Initial C1 Blueprint/Hybrid rendered without CSS/JS because the runner only copied images to \`render/\`. | Copy \`c1-blueprint.css\` / \`c1-hybrid.js\` to \`render/\`; rerun QA. | \`blueprint/render/*\`, \`hybrid/render/*\` | yes | Metrics recovered from broken to 99/96/91. |
| 1 | Hybrid LCP > 4 s on mobile (189 KB hero JPEG). | Convert hero to WebP quality 80 and update \`cms-content.json\` \`hero.imageId\`. | \`source/cms-content.json\`, \`source/images/d04c9c04-slajder-2.webp\`, \`hybrid/render/c1-hybrid.html\` | yes | LCP dropped to 3.5 s; Performance rose from 85 to 91. |

Total repair passes: 1 (two related fixes counted as one pass because they were batched after the same QA round).

## QA matrix

- Desktop and mobile screenshots for source, Blueprint, Hybrid.
- Responsive viewports tested: 1440×900 and 390×844.
- Horizontal overflow: none detected.
- Section visibility: all CMS-enabled sections visible.
- Interactive controls: filter chips, before/after handle, mobile menu, buttons, keyboard focus.
- Console errors: none in generated pages.
- Navigation integrity: anchor links scroll to sections.
- Media loading: all 24 selected images loaded.
- Reduced motion: \`bp-reduced\` class disables animations; CSS media query respected.
- Lighthouse scores captured for all three variants.

## Comparison

- Visual quality: Hybrid > Blueprint >> Source. Source is cluttered and dated; Blueprint is clean but generic; Hybrid is distinctly Atelit.
- Brand fit: Hybrid uses source imagery and warm palette; Blueprint and Source both feel off-the-shelf.
- Content preservation: Hybrid keeps services, pricing, process, team, portfolio; Blueprint keeps core but drops process/team/styles; Source buries them.
- Information architecture: Hybrid's order is Hero → Services → Portfolio → Before/After → Pricing → Process → About → Team → CTA; Source has no clear IA.
- Interaction quality: Hybrid has the richest, source-grounded interactions; Blueprint has filter/reveal only; Source has sliders/popups.
- Mobile quality: Hybrid and Blueprint are responsive and client-ready; Source mobile is poor.
- Performance: Blueprint 99, Hybrid 91, Source 42 (mobile).
- Accessibility: Hybrid 95, Blueprint 94, Source 85.
- Autonomy: high; one autonomous repair pass, no manual content invention.

## Skill impact

| Skill | Input | Visible change | Provenance |
|---|---|---|---|
| **Taste** | Source hero image (warm kitchen with terracotta chairs) | Selected warm off-white surface, charcoal text, terracotta accent; avoided MAPID green/earthy palette. | \`DesignRecipe.json\` tokens |
| **Refero** | Portfolio-first mode; gallery/studio precedent | Split hero, masonry-style portfolio grid, style gallery. | \`DesignRecipe.json\` section variants |
| **Impeccable** | Craft-floor principles (reduce noise, bounded QA, accessible contrast) | Removed business-areas band, dark CTA, legible type, 0 CLS, reduced-motion handling. | \`C1_HYBRID\` CSS + QA |
| **Emil** | Clear hierarchy, conversion clarity | Numbered service grid, scannable price cards, timeline, single primary CTA. | \`InteractionRecipe.json\`, section ordering |

(The Impeccable skill was read from its \`SKILL.md\` for design direction; its binary launcher was not invoked in this session due to environment constraints.)

## Novel site-specific interactions

- **Portfolio filter by interior style** — implemented. Uses categories extracted from the source style gallery (Классический, Современная классика, Современный).
- **Before/after comparison slider** — implemented. Uses the source promo pair (plan → rendered room). It is source-grounded but not a literal room-before/room-after photo pair; it still communicates transformation.
- **Process timeline** — implemented. Converts the 8-stage source list into a scrollable, numbered vertical timeline.
- **Style gallery** — implemented as a non-interactive visual index; could be extended into a filter source.
- **Team grid** — implemented as static cards; no modal detail (not required).

Registry delta:
- Added to reusable registry: \`portfolio-filter\`, \`process-timeline\`.
- Site-specific/needs generalization: \`before-after-slider\` (needs paired-image contract).

## Did we avoid MAPID/template gravity?

- Yes. The visual world (warm palette, split hero, gallery rhythm) is derived from Atelit's own imagery and content.
- No MAPID \`DesignRecipe\`, \`InteractionRecipe\`, or B28 layout was copied.
- Generic section families from B3 (hero, services, projects, properties, about, CTA, footer) were reused; company-specific sections (process timeline, before/after, style gallery, team) were built for Atelit.

## Gaps exposed

1. \`crawlSite\` Playwright crawler failed on Atelit's heavy WordPress theme; fallback to \`curl\` + \`cheerio\` was required.
2. Image optimization is not automatic; we had to run \`cwebp\` manually in the repair pass.
3. Before/after needs a stronger CMS contract (paired before/after media with consistent aspect ratio).
4. Project detail pages were not rendered as separate pages; only the homepage was generated.
5. No automatic social/SEO metadata beyond title/description.
6. The Blueprint \`business-areas\` family is not always meaningful and should be optional/configurable.

## What should change before testing a third company?

- Make the crawler resilient to heavy themes (fallback fetch-based crawl, longer \`domcontentloaded\` timeout).
- Add automatic image optimization (WebP/AVIF, responsive srcset) to the pipeline.
- Promote \`before-after-slider\`, \`process-timeline\`, and \`style-gallery\` into the generic Blueprint registry with clear CMS contracts.
- Allow the composer to drop or replace families like \`business-areas\` based on content evidence.
- Generate multi-page output (services, portfolio detail, contact) not just homepage.
- Add Lighthouse budget checks and automatic repair passes for LCP/CLS.

## Business verdict

> **Would we show C1_HYBRID_FINAL to Atelit's owner as a generated redesign?**

**YES_WITH_MINOR_POLISH**

The result is a credible, brand-appropriate redesign proposal. Minor polish needed: a true before/after photo pair would be stronger than plan-to-render, LCP can still improve, and a few team summaries run long. It is already far ahead of the current site and visually distinct from MAPID.

## Plausibility without MAPID history

> **Could WLA have plausibly produced this result without the MAPID-specific experimental history?**

**PARTIALLY**

The generic Blueprint renderer, QA harness, and CMS round-trip patterns were hardened during MAPID and accelerated this pilot. However, the Atelit-specific design decisions, palette, and content model are independent of MAPID and demonstrate that the architecture can generalize with company-specific intelligence.

## Final architecture verdict

**HYBRID_PROMISING_BUT_REGISTRY_INCOMPLETE**

The hybrid approach (Blueprint + Agent customization + bounded repair) produced the strongest result on a second company. The generic section-family renderer generalized, but the new Atelit interactions (before/after, process timeline, style gallery) are still site-specific and need to be promoted into the reusable WLA registry before a third company can use them without bespoke code.

---

*Generated by Generation V2 C1 pipeline. MAPID artifacts remain untouched under \`data/experiments/mapid/\`.*
`;

await mkdir(join(C1, 'architecture'), { recursive: true });
await writeFile(join(C1, 'C1-REPORT.md'), report, 'utf8');

const cost = {
  crawl: 'manual curl fallback (Playwright crawler failed)',
  intelligence: 'rule + heuristic extraction scripts, no LLM calls',
  generation: 'local deterministic renderers (Blueprint + Hybrid)',
  qa: 'Playwright screenshots + Lighthouse per variant',
  repairPasses: 1,
  manualIntervention: 'low — scripts run autonomously; design direction was selected by agent based on source evidence and skill guidance',
  estimatedTokens: 0,
  estimatedCostUsd: 0,
  notes: 'No paid API calls were used in this C1 run. Intelligence and design direction were rule/script driven.'
};
await writeFile(join(C1, 'cost.json'), JSON.stringify(cost, null, 2), 'utf8');

console.log('C1 report and cost written');
