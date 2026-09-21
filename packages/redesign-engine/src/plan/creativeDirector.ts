import type { CustomerProblemBrief } from './customerProblemBrief.js';
import type { ContentTruthGraph } from './contentTruthGraph.js';

export type Palette = { name: string; background: string; surface: string; ink: string; accent: string; muted: string; note: string };
export type TypeSystem = { family: string; display: string; body: string; scale: 'compact' | 'standard' | 'dramatic'; note: string };
export type LayoutGrammar = { grid: string; density: 'spacious' | 'comfortable' | 'dense'; radius: 'sharp' | 'soft' | 'pill'; note: string };

export interface CreativeDirection {
  id: string;
  version: '1.0';
  conceptName: string;
  businessIdea: string;
  audience: string;
  decisionStage: string;
  emotionalEffect: string;
  visualTerritory: string;
  narrative: string[];
  informationHierarchy: { section: string; rationale: string }[];
  heroComposition: 'full-bleed' | 'split' | 'centered' | 'editorial-stack' | 'cinematic';
  heroMediaTreatment: string;
  typography: TypeSystem;
  palette: Palette;
  surfaces: string;
  layoutGrammar: LayoutGrammar;
  imageryTreatment: string;
  componentLanguage: string;
  motionPrinciples: string;
  desktopBehavior: string;
  mobileBehavior: string;
  differencesFromSource: string[];
  differencesFromSiblings: string[];
  prohibitedCliches: string[];
  evidenceReferences: string[];
  implementationRisks: string[];
}

export interface VisualReference {
  conceptId: string;
  view: 'home-desktop' | 'home-mobile' | 'detail-page';
  status: 'BLOCKED' | 'GENERATED';
  provider?: string;
  prompt?: string;
  url?: string;
  reason?: string;
}

const TERRITORIES: Record<string, Omit<Partial<CreativeDirection>, 'id' | 'businessIdea' | 'audience' | 'narrative' | 'informationHierarchy' | 'differencesFromSource' | 'differencesFromSiblings' | 'evidenceReferences'>> = {
  'editorial-storytelling': {
    visualTerritory: 'Editorial storytelling',
    emotionalEffect: 'Makes the company feel like a serious publication with depth and taste.',
    heroComposition: 'editorial-stack',
    heroMediaTreatment: 'Large hero image with narrow type column and caption; image is treated as editorial photography, not a banner.',
    typography: { family: 'serif-led', display: 'DM Serif Display / Geologica', body: 'Inter', scale: 'dramatic', note: 'Big display type for headings, generous line-height for long-form reading.' },
    palette: { name: 'warm newsprint', background: '#f7f5f0', surface: '#ffffff', ink: '#1a1a1a', accent: '#b45c34', muted: '#7a7670', note: 'Warm paper background with one burnt-orange accent. No blue/purple gradients.' },
    surfaces: 'Lots of off-white, 1px dark rules, no heavy shadows, no glassmorphism.',
    layoutGrammar: { grid: '12-column asymmetric', density: 'spacious', radius: 'sharp', note: 'Asymmetric editorial grid; large left-right empty zones; sharp corners.' },
    imageryTreatment: 'Source photography cropped to editorial aspect ratios; no rounded cards; captions required; decorative textures are paper grain and ink lines only.',
    componentLanguage: 'Narrow article cards, pull quotes, numbered chapter headings, ruled separators, index-style lists.',
    motionPrinciples: 'Scroll-linked text reveals, slow parallax on hero, no bounce or generic fade-up.',
    desktopBehavior: 'Hero is 70vh; navigation is minimal, sticky, monochrome; body uses an asymmetric two-column rhythm.',
    mobileBehavior: 'Single-column; hero stack; section numbers become small captions; keep large type, reduce whitespace.',
    prohibitedCliches: ['three equal feature cards', 'rounded white cards with shadows', 'purple/blue gradients', 'default Inter headings', 'identical centered hero'],
  },
  'cinematic-portfolio': {
    visualTerritory: 'Cinematic portfolio',
    emotionalEffect: 'Evokes a film title sequence: the work feels big and intentional.',
    heroComposition: 'cinematic',
    heroMediaTreatment: 'Full-bleed atmospheric image or video still with large centered type and a single CTA; dark overlay, high contrast.',
    typography: { family: 'grotesk', display: 'Space Grotesk', body: 'Inter', scale: 'dramatic', note: 'Tight grotesk display, high contrast, uppercase micro-labels. Cards use small labels.' },
    palette: { name: 'noir with warm accent', background: '#0e0e0e', surface: '#1a1a1a', ink: '#f2f0ea', accent: '#e0924f', muted: '#8b8680', note: 'Near-black ground with warm cream type and a single amber accent. No AI-gradient backgrounds.' },
    surfaces: 'Deep dark surfaces, thin hairline rules, no rounded cards.',
    layoutGrammar: { grid: 'full-bleed + narrow container', density: 'spacious', radius: 'sharp', note: 'Cinematic full-width sections; narrow centered text blocks; sharp corners.' },
    imageryTreatment: 'Source photography presented as cinematic stills with dark overlays; decorative assets are subtle light leaks, grain, and letterbox masks. AI decorative only as texture.',
    componentLanguage: 'Full-bleed project cards, minimal captions, large counters, oversized category labels, film-style type.',
    motionPrinciples: 'Slow fades, Ken Burns on hero, staggered line reveals, hover reveals on project cards.',
    desktopBehavior: 'Cinematic hero 100vh; project grid is full-bleed 2-up or 3-up; minimal chrome.',
    mobileBehavior: 'Stacked full-bleed cards; text overlays remain readable; reduced motion by default if preferred.',
    prohibitedCliches: ['white cards on white', 'three equal icons', 'generic pills', 'glassmorphism', 'stock lifestyle images'],
  },
  'architectural-minimalism': {
    visualTerritory: 'Architectural minimalism',
    emotionalEffect: 'Calm, precise, expensive; the company feels like a design-led practice.',
    heroComposition: 'split',
    heroMediaTreatment: 'Split hero: one side of bold type and CTA, one side of a carefully cropped source image; 50/50 or 40/60.',
    typography: { family: 'neo-grotesk', display: 'Helvetica Neue', body: 'Inter', scale: 'standard', note: 'Neutral, highly legible, tracking tuned; numbers and addresses use monospaced accents.' },
    palette: { name: 'concrete and steel', background: '#ffffff', surface: '#f4f4f4', ink: '#1a1a1a', accent: '#5a6b7a', muted: '#8d8d8d', note: 'White, warm grey, and steel blue accent. No warm wood or energetic colors.' },
    surfaces: 'Flat panels, 1px light borders, no shadows, no rounded corners.',
    layoutGrammar: { grid: 'rational 12-column', density: 'comfortable', radius: 'sharp', note: 'Rigid grid; lots of air; align everything to a single baseline.' },
    imageryTreatment: 'Source photos cropped to strict 16:10 or square; black-and-white or desaturated treatment allowed; no decorative flourishes.',
    componentLanguage: 'Flat list items, index numbers, technical spec tables, large white space, minimal cards.',
    motionPrinciples: 'Sparse: only gentle opacity and transform on scroll; no decorative motion.',
    desktopBehavior: 'Split hero; index-style service list; technical details presented as flat spec rows.',
    mobileBehavior: 'Stacked split becomes single column; large type; spec tables collapse into lists.',
    prohibitedCliches: ['rounded cards', 'drop shadows', 'gradients', 'excessive pills', 'landing-page illustrations'],
  },
  'interactive-catalog': {
    visualTerritory: 'Interactive catalog',
    emotionalEffect: 'Empowering and pragmatic; the customer can compare and choose.',
    heroComposition: 'split',
    heroMediaTreatment: 'Hero is a search/filter panel on the left and a chosen product visual on the right; image is not the focus, the choice is.',
    typography: { family: 'clean sans', display: 'Inter', body: 'Inter', scale: 'compact', note: 'Compact, high-information density; clear hierarchy with weight, not size alone.' },
    palette: { name: 'soft utility', background: '#ffffff', surface: '#f6f7f9', ink: '#1f2937', accent: '#2563eb', muted: '#6b7280', note: 'Neutral SaaS palette with one blue for action. Avoid purple/pink.' },
    surfaces: 'Subtle light surfaces, 1px borders, small radius on inputs, no shadows on cards.',
    layoutGrammar: { grid: 'two-pane catalog', density: 'comfortable', radius: 'soft', note: 'Left rail for filters/attributes; right for grid; tables and comparison lists.' },
    imageryTreatment: 'Product images on a neutral or slightly warm background; attributes and specs adjacent; no lifestyle collages.',
    componentLanguage: 'Filter chips, comparison rows, attribute tables, mini product cards, sticky summary bar.',
    motionPrinciples: 'Filter transitions, smooth list reorders, hover lifts on product cards; no slow fades.',
    desktopBehavior: 'Sidebar filters, product grid, quick-view modal; CTA is request/quote.',
    mobileBehavior: 'Filters become a drawer; product grid 1-column; sticky CTA at bottom.',
    prohibitedCliches: ['three equal feature cards', 'lifestyle hero with unrelated people', 'fake urgency badges', 'stock interiors as product evidence'],
  },
  'technical-data-driven': {
    visualTerritory: 'Technical / data-driven',
    emotionalEffect: 'Competent, measured, transparent; the customer gets engineering confidence.',
    heroComposition: 'editorial-stack',
    heroMediaTreatment: 'Hero combines a source project photo with a small data band (numbers, process stages, stats) in a strict column.',
    typography: { family: 'monospaced-accent', display: 'Geologica', body: 'Inter', scale: 'standard', note: 'Grotesk for numbers and labels; generous line-height for process text.' },
    palette: { name: 'engineer grey with signal', background: '#f4f5f0', surface: '#ffffff', ink: '#1a1f1c', accent: '#2f6b4f', muted: '#6b7369', note: 'Cool greys with a deep green signal accent. No warm oranges.' },
    surfaces: 'Flat white cards with light borders; process timeline as a horizontal ruled line; no gradients.',
    layoutGrammar: { grid: 'rational 12-column', density: 'comfortable', radius: 'sharp', note: 'Process, stats, and services laid out like a technical report; clear section numbers.' },
    imageryTreatment: 'Source photos treated as documentation: captions, dates, locations; charts and diagrams from real attributes only.',
    componentLanguage: 'Process steps with numbers, stat bands, spec tables, accordion FAQ, clean service cards.',
    motionPrinciples: 'Progress-driven: process bars advance on scroll, numbers count up once, no looping.',
    desktopBehavior: 'Hero with stats band; process section is a horizontal timeline; services as index list.',
    mobileBehavior: 'Stats stack; timeline becomes vertical; numbers remain prominent.',
    prohibitedCliches: ['three equal feature cards', 'fake counters without source', 'purple gradients', 'abstract 3D shapes'],
  },
};

const SIBLING_DIFFERENCE = (siblings: CreativeDirection[]) => (current: CreativeDirection) => {
  return siblings.filter((s) => s.id !== current.id).map((s) => `${s.conceptName} uses ${s.visualTerritory} with a ${s.heroComposition} hero and ${s.layoutGrammar.grid} layout, while this concept uses ${current.visualTerritory} with a ${current.heroComposition} hero and ${current.layoutGrammar.grid} layout.`);
};

function pickTerritories(archetype: string, count = 3): string[] {
  const options: Record<string, string[]> = {
    SERVICE_PORTFOLIO: ['editorial-storytelling', 'cinematic-portfolio', 'technical-data-driven'],
    CATALOG: ['interactive-catalog', 'architectural-minimalism', 'editorial-storytelling'],
    CREATIVE_PORTFOLIO: ['cinematic-portfolio', 'architectural-minimalism', 'editorial-storytelling'],
  };
  return options[archetype] || ['editorial-storytelling', 'cinematic-portfolio', 'architectural-minimalism'];
}

export function generateCreativeDirections(brief: CustomerProblemBrief, graph: ContentTruthGraph): { directions: CreativeDirection[]; references: VisualReference[] } {
  const archetype = (graph.entities.some((e) => e.type === 'product') ? 'CATALOG' : graph.entities.some((e) => e.type === 'project') ? 'CREATIVE_PORTFOLIO' : 'SERVICE_PORTFOLIO') as any;
  const territories = pickTerritories(archetype);

  const directions: any[] = [];
  for (const [i, t] of territories.entries()) {
    const base = TERRITORIES[t];
    const id = `${t}`;
    const productCount = graph.entities.filter((e) => e.type === 'product').length;
    const projectCount = graph.entities.filter((e) => e.type === 'project').length;
    const serviceCount = graph.entities.filter((e) => e.type === 'service').length;

    const businessIdea =
      t === 'interactive-catalog'
        ? `Turn ${brief.brandName.value} into a self-service catalog where the customer chooses, configures, and requests a quote.`
        : t === 'cinematic-portfolio'
          ? `Present ${brief.brandName.value} work as a cinematic case-study experience that prioritizes real projects over words.`
          : t === 'architectural-minimalism'
            ? `Position ${brief.brandName.value} as a precise, design-led practice using restraint and generous space.`
            : t === 'technical-data-driven'
              ? `Lead with process, numbers, and evidence to prove ${brief.brandName.value} competence before the first contact.`
              : `Tell the ${brief.brandName.value} story as a long-form editorial piece that earns trust through depth.`;

    const narrative =
      t === 'interactive-catalog'
        ? [`Start with the catalog.`, `Let the customer filter and compare.`, `Close with a clear quote CTA.`]
        : t === 'cinematic-portfolio'
          ? [`Open with a cinematic project.`, `Show more work full-bleed.`, `Then who we are.`, `Finally, how to start.`]
          : t === 'architectural-minimalism'
            ? [`Introduce the practice in a split hero.`, `List services as an index.`, `Show selected work with discipline.`, `End with a minimal contact call.`]
            : t === 'technical-data-driven'
              ? [`Open with proof: years, projects, process.`, `Explain the process.`, `Show services.`, `Convert with a consultation.`]
              : [`Open with a strong editorial statement.`, `Develop the company story.`, `Present evidence.`, `End with a considered CTA.`];

    const hierarchy =
      t === 'interactive-catalog'
        ? [
            { section: 'Hero with catalog entry', rationale: 'The customer is here to choose; place search/filter first.' },
            { section: 'Product grid', rationale: 'Primary business: the catalog is the content.' },
            { section: 'About / trust', rationale: 'After scanning, the customer needs trust.' },
            { section: 'Contact / quote', rationale: 'Convert after selection.' },
          ]
        : t === 'cinematic-portfolio'
          ? [
              { section: 'Cinematic hero with one project', rationale: 'Emotional impact and proof of quality.' },
              { section: 'Selected work grid', rationale: 'The customer wants to see more.' },
              { section: 'About the practice', rationale: 'Context after the work has impressed.' },
              { section: 'Contact', rationale: 'Convert after portfolio review.' },
            ]
          : t === 'architectural-minimalism'
            ? [
                { section: 'Split hero', rationale: 'Confidence through restraint.' },
                { section: 'Index of services', rationale: 'Clear, scannable offering.' },
                { section: 'Selected projects', rationale: 'Evidence with discipline.' },
                { section: 'Contact', rationale: 'Minimal close.' },
              ]
            : t === 'technical-data-driven'
              ? [
                  { section: 'Hero with stats and promise', rationale: 'Lead with evidence.' },
                  { section: 'Process timeline', rationale: 'Reduce perceived risk.' },
                  { section: 'Services / attributes', rationale: 'What is delivered.' },
                  { section: 'FAQ + Contact', rationale: 'Answer objections before CTA.' },
                ]
              : [
                  { section: 'Editorial hero', rationale: 'Set the tone and premise.' },
                  { section: 'Chapter / about', rationale: 'Develop the company story.' },
                  { section: 'Work / evidence', rationale: 'Support the story with proof.' },
                  { section: 'Closing CTA', rationale: 'Convert after reading.' },
                ];

    const dir = {
      id,
      version: '1.0',
      conceptName: `${brief.brandName.value} — ${base.visualTerritory}`,
      businessIdea,
      audience: brief.primaryAudiences.value[0] || 'главный заказчик',
      decisionStage: brief.decisionCriteria.value[0] || 'оценка',
      emotionalEffect: base.emotionalEffect,
      visualTerritory: base.visualTerritory,
      narrative,
      informationHierarchy: hierarchy,
      heroComposition: base.heroComposition,
      heroMediaTreatment: base.heroMediaTreatment,
      typography: base.typography as TypeSystem,
      palette: base.palette as Palette,
      surfaces: base.surfaces,
      layoutGrammar: base.layoutGrammar as LayoutGrammar,
      imageryTreatment: base.imageryTreatment,
      componentLanguage: base.componentLanguage,
      motionPrinciples: base.motionPrinciples,
      desktopBehavior: base.desktopBehavior,
      mobileBehavior: base.mobileBehavior,
      differencesFromSource: [
        'Palette and typography are entirely new.',
        'Hero composition is not a banner; it is ' + base.heroComposition + '.',
        'Section rhythm and component language are redesigned.',
        'Source content is reused, but hierarchy is restructured.',
      ],
      differencesFromSiblings: [],
      prohibitedCliches: base.prohibitedCliches,
      evidenceReferences: [
        ...brief.whatTheCustomerSells.evidence.slice(0, 4).map((e) => `${e.field}: ${e.value} (${e.sourceUrl || e.id || 'inference'})`),
        `entity counts: ${serviceCount} services, ${projectCount} projects, ${productCount} products`,
      ],
      implementationRisks: [
        'Custom React/CSS components must be built; no shared template reuse.',
        'Decorative assets require an image-generation provider, currently unavailable.',
        'Motion must respect reduced-motion preference.',
      ],
    };
    directions.push(dir);
  }

  for (const d of directions) {
    d.differencesFromSiblings = SIBLING_DIFFERENCE(directions)(d);
  }

  const references: VisualReference[] = [];
  for (const d of directions) {
    for (const view of ['home-desktop', 'home-mobile', 'detail-page'] as const) {
      references.push({
        conceptId: d.id,
        view,
        status: 'BLOCKED',
        reason: 'No image-generation provider configured. Visual references must be generated by a capable image-to-code / web-design model and then validated by vision QA.',
      });
    }
  }

  return { directions: directions as unknown as CreativeDirection[], references };
}
