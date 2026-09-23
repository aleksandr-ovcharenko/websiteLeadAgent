import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const C1 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/atelit/c1-generalization';

const extracted = JSON.parse(await readFile(join(C1, 'source/extracted.json'), 'utf8'));
const cms = JSON.parse(await readFile(join(C1, 'source/cms-content.json'), 'utf8'));

const sourceAnalysis = `# Atelit source analysis

**URL:** https://atelit.by/  
**Business:** Interior design studio + renovation contractor, Minsk, Belarus.  
**Tagline observed:** "ремонт премиум качества".

## What the source does well
- Large portfolio of real projects with room-by-room photography.
- Clear service list (11 items).
- Defined price packages (3 tiers).
- Published 8-stage process.
- Team quotes / "our team" section.
- Promotions and before/after material.
- Contact data: two offices, phone, social.

## Source problems
- Dated WordPress theme with heavy sliders, popups, lazy-load placeholders.
- Repeated blocks (team, text) in desktop/mobile variants.
- Cluttered hierarchy; hero is a generic "АКЦИЯ!" slider.
- Duplicate navigation and excessive scripts.
- No clear content model; images and text are mixed.

## Content depth summary
- Pages fetched: homepage, portfolio, 7 projects, services (interior / cottages), pricing, about, contacts, calculator, promotions.
- Images discovered: 24 selected media (hero, 7 project covers, service icons, styles, team, before/after).
- Core entities: services (11), projects (7), prices (3), stages (8), styles (3), team members, promotions.

## Reconciliation notes
- Two experience claims: "12 лет дизайн студия" and "20 лет строительная компания". We keep both as separate stats rather than inventing a single founding year.
- Services extracted from homepage service list; service-page text used for description enrichment.
- Project summaries sourced from project detail pages; images chosen from cover + first gallery image.
`;

const siteBrief = {
  leadId: 'atelit-c1',
  url: 'https://atelit.by/',
  language: 'ru-RU',
  market: 'BY',
  displayName: 'Ателит',
  legalName: 'Ателит',
  industry: 'Interior design and renovation',
  summary: 'Minsk-based interior design studio and premium renovation contractor with 12+ years as a design studio and 20+ years in construction. Offers design, engineering, smart home, author supervision and turnkey renovation.',
  facts: [
    { statement: '12+ лет дизайн-студия', evidence: 'homepage fact block', confidence: 'high' },
    { statement: '20+ лет строительная компания', evidence: 'homepage fact block', confidence: 'high' },
    { statement: '5 лет гарантии', evidence: 'homepage fact block', confidence: 'high' },
    { statement: '11 core services', evidence: 'homepage service list', confidence: 'high' },
    { statement: '3 price packages from 45 to 90 BYN/m2', evidence: 'homepage pricing block', confidence: 'high' },
    { statement: '8-stage process', evidence: 'homepage stages', confidence: 'high' }
  ],
  contacts: {
    phones: cms.company.phones,
    email: cms.company.email,
    address: cms.company.address,
    social: cms.company.social,
    workingHours: 'пн-пт 9.00 — 18.00, сб/вс по записи'
  },
  sections: ['hero', 'services', 'portfolio', 'pricing', 'process', 'about', 'cta'],
  mediaCount: cms.media.length,
  pageCount: 16
};

const transformation = {
  baseUrl: 'https://atelit.by/',
  objective: 'Transform the dated, script-heavy WordPress site into a calm, premium editorial portfolio that a client would accept as a redesign proposal.',
  strategy: [
    'Lead with portfolio impact, not a generic promo slider.',
    'Surface the 8-stage process as credibility, not a hidden block.',
    'Turn the three price packages into scannable comparison cards.',
    'Use the source before/after material as an interactive credibility proof.',
    'Preserve all real contact, legal and social data without invention.',
    'Remove duplicate desktop/mobile blocks and pop-up noise.'
  ],
  informationArchitecture: ['Hero', 'Services', 'Portfolio (filterable)', 'Pricing', 'Process', 'About/Team', 'CTA'],
  visualTarget: 'Warm, premium, gallery-first: charcoal + off-white + terracotta accent. No green/earthy palette borrowed from MAPID.',
  risks: ['Portfolio images are heavy and must be optimized.', 'Before/after requires real paired images.', 'Pricing copy must not promise fixed numbers beyond source.']
};

const designRecipe = {
  version: '1.0',
  target: 'Atelit redesign proposal',
  influences: ['Source imagery (warm kitchen hero)', 'Impeccable: reduce visual noise, strong typography, generous whitespace', 'Taste: warm premium palette', 'Emil: clear hierarchy, accessible contrast'],
  tokens: {
    colors: {
      primary: '#1A1A1A',
      secondary: '#4A4A4A',
      accent: '#C86D4A',
      surface: '#FAF8F5',
      surfaceDark: '#2C2C2C',
      text: '#1A1A1A',
      muted: '#8A8A8A'
    },
    typography: {
      heading: '"Inter", "Helvetica Neue", Arial, sans-serif',
      body: '"Inter", system-ui, sans-serif',
      heroSize: 'clamp(2.2rem, 5vw, 4.2rem)',
      lineHeight: 1.5
    },
    spacing: { section: '80px', gap: '24px' },
    radius: '8px',
    motion: { reduced: 'reduce', reveal: 'fade-up 0.6s ease-out' }
  },
  sections: {
    hero: { variant: 'split', rationale: 'Portfolio studio needs a strong value statement on the left and a hero interior image on the right; avoids a full-bleed real-estate hero.' },
    services: { variant: 'numbered-grid', rationale: '11 services read as a list; numbering and short labels make them scannable.' },
    projects: { variant: 'filterable-masonry', rationale: 'Atelit has multiple style directions (classic, modern, modern classic); filtering lets users explore by taste.' },
    pricing: { variant: 'cards', rationale: 'Three clear packages need side-by-side comparison.' },
    process: { variant: 'timeline', rationale: '8 stages are a key credibility signal; a vertical timeline is the clearest structure.' },
    about: { variant: 'split-with-stats', rationale: 'Combine company text with the 5/12/20 year facts.' },
    cta: { variant: 'dark-centered', rationale: 'Dark band with a single conversion action.' }
  }
};

const interactionRecipe = {
  version: '1.0',
  opportunities: [
    {
      id: 'portfolio-filter',
      name: 'Filter portfolio by interior style',
      trigger: 'click filter chip',
      sourceGrounding: 'Source exposes style categories (Классический, Современная классика, Современный).',
      implemented: true,
      reason: 'Directly maps to Atelit content and helps prospects find a matching style.'
    },
    {
      id: 'before-after-slider',
      name: 'Before / after comparison slider',
      trigger: 'drag slider handle',
      sourceGrounding: 'Promo section contains "было" and "стало" images.',
      implemented: true,
      reason: 'High-impact proof of transformation; emotionally persuasive for renovation prospects.'
    },
    {
      id: 'process-reveal',
      name: 'Scroll-driven process step reveal',
      trigger: 'scroll into view',
      sourceGrounding: 'Eight-stage process block.',
      implemented: true,
      reason: 'Turns a dense list into a paced, credible narrative.'
    },
    {
      id: 'project-card-hover',
      name: 'Portfolio card zoom + overlay',
      trigger: 'hover / focus',
      sourceGrounding: 'Portfolio is the main conversion asset.',
      implemented: true,
      reason: 'Adds polish without hiding information.'
    },
    {
      id: 'mobile-menu',
      name: 'Responsive hamburger menu',
      trigger: 'click hamburger / Esc',
      sourceGrounding: 'Source has a mobile menu.',
      implemented: true,
      reason: 'Mobile client-readiness requirement.'
    },
    {
      id: 'video-lightbox',
      name: 'YouTube video lightbox',
      trigger: 'click play',
      sourceGrounding: 'Source has "Смотрите наше видео" section.',
      implemented: false,
      reason: 'Would require embedded iframe; video thumbnails kept as static links to avoid external scripts and performance cost.'
    }
  ],
  registryDelta: {
    added: ['portfolio-filter', 'before-after-slider', 'process-timeline'],
    existing: ['project-card-hover', 'mobile-menu', 'scroll-reveal'],
    siteSpecific: ['before-after-slider', 'portfolio-filter']
  }
};

const brandTokens = designRecipe.tokens;

const mediaIntel = {
  heroImage: { sourceUrl: 'https://atelit.by/wp-content/uploads/2021/08/slajder-2.jpg', local: cms.hero.imageId, usage: 'hero background / split image', notes: 'Warm kitchen with terracotta chairs; defines palette.' },
  projectCovers: cms.projects.map(p => ({ title: p.title, file: p.coverImage?.filename, source: p.coverImage?.filename })),
  beforeAfter: { before: cms.promo?.before, after: cms.promo?.after },
  styleImages: cms.styles,
  icons: cms.services.map(s => s.icon).filter(Boolean),
  totalSelected: cms.media.length,
  optimization: 'All images copied locally and served from render/images. Hero image is the LCP target; kept as full-quality JPEG.'
};

const contentDepth = {
  pagesFetched: 16,
  wordsExtracted: extracted.about.text.length + extracted.stages.map(s => s.text).join(' ').length,
  entities: { services: cms.services.length, projects: cms.projects.length, prices: cms.products.length, stages: cms.process.length, styles: cms.styles.length, team: cms.team.length },
  coverage: {
    hero: 'source hero slider',
    services: 'homepage service list + service pages',
    projects: 'homepage works + 7 detail project pages',
    pricing: 'homepage price cards + pricing pages',
    process: 'homepage stages',
    about: 'homepage about + atelit-v-smi',
    team: 'homepage our-team block'
  }
};

await mkdir(C1, { recursive: true });
await writeFile(join(C1, 'SOURCE-ANALYSIS.md'), sourceAnalysis, 'utf8');
await writeFile(join(C1, 'SiteBrief.json'), JSON.stringify(siteBrief, null, 2), 'utf8');
await writeFile(join(C1, 'TransformationBrief.json'), JSON.stringify(transformation, null, 2), 'utf8');
await writeFile(join(C1, 'DesignRecipe.json'), JSON.stringify(designRecipe, null, 2), 'utf8');
await writeFile(join(C1, 'InteractionRecipe.json'), JSON.stringify(interactionRecipe, null, 2), 'utf8');
await writeFile(join(C1, 'brand-tokens.json'), JSON.stringify(brandTokens, null, 2), 'utf8');
await writeFile(join(C1, 'media-intelligence.json'), JSON.stringify(mediaIntel, null, 2), 'utf8');
await writeFile(join(C1, 'content-depth-source.json'), JSON.stringify(contentDepth, null, 2), 'utf8');

console.log('Intelligence artifacts written to', C1);
