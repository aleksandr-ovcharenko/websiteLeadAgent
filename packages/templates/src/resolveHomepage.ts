// Canonical homepage composition resolver.
//
// Resolution order (V3.4 contract, refined V3.7.1):
//   1. Published homepage Page.blocks — preferred/final site or site preview
//   2. Variant themeConfig.homepageSections — non-preferred concept previews,
//      but ONLY when the variant composition is genuinely distinct from the
//      site's canonical composition. A variant snapshot identical to the site
//      snapshot is a copy, not a concept — it must not shadow live Page.blocks
//      edits.
//   3. Published homepage Page.blocks — canonical composition (non-preferred
//      variants whose own sections are absent or identical to canonical)
//   4. Legacy site themeConfig.homepageSections
//   5. Safe empty composition
//
// Output is a normalized HomepageSection[]; array order IS render order.

export interface ResolvedSection {
  id: string;
  type: string;
  enabled: boolean;
  supported: boolean;
  heading?: string;
  title?: string;
  limit?: number | null;
  displayVariant?: string;
  selectedItemIds?: string[];
  /** Original block payload (hero/cta/about carry their content here). */
  block?: Record<string, any>;
}

export interface ResolveHomepageInput {
  /** Page.blocks of the PUBLISHED isHomepage page (callers must pre-filter status). */
  homepageBlocks?: unknown;
  /** True for the site preview and for the preferred DemoVariant preview. */
  isPreferred: boolean;
  /** variant.themeConfig.homepageSections */
  variantSections?: unknown;
  /** site.themeConfig.homepageSections */
  siteSections?: unknown;
  /** Section types the active template can render; unknown types pass through as supported:false. */
  supportedTypes?: readonly string[];
}

export interface ResolveHomepageResult {
  /** All sections in composition order, including disabled ones (data preserved). */
  sections: ResolvedSection[];
  /** Only enabled + renderable sections, in order. */
  visible: ResolvedSection[];
  source: 'page-blocks' | 'variant' | 'site' | 'empty';
  /** Composition warnings (e.g. normalized ordering). */
  warnings: string[];
}

const KNOWN_SECTION_TYPES = new Set([
  'hero', 'about', 'services', 'projects', 'products', 'news', 'articles',
  'vacancies', 'contacts', 'cta', 'dynamic', 'text', 'image', 'gallery', 'reviews',
  'certificates',
]);

function nonEmptyArray(v: unknown): any[] | null {
  return Array.isArray(v) && v.length > 0 ? (v as any[]) : null;
}

function fromBlocks(blocks: any[], supportedTypes?: readonly string[]): ResolvedSection[] {
  const seenHero = { done: false };
  return blocks
    .filter((b) => b && typeof b === 'object' && typeof b.type === 'string' && b.type)
    .map((b, i) => {
      const type = String(b.type).toLowerCase();
      // Hero must never duplicate: later hero blocks degrade to 'text' sections.
      let effectiveType = type;
      if (type === 'hero') {
        if (seenHero.done) effectiveType = 'text';
        seenHero.done = true;
      }
      const known = KNOWN_SECTION_TYPES.has(type);
      const supported = supportedTypes ? supportedTypes.includes(effectiveType) : known;
      return {
        id: String(b.id || `block-${i}`),
        type: effectiveType,
        enabled: b.enabled !== false,
        supported,
        heading: b.heading ?? b.title,
        title: b.heading ?? b.title,
        limit: typeof b.limit === 'number' ? b.limit : (b.limit ?? undefined),
        displayVariant: b.displayVariant,
        selectedItemIds: Array.isArray(b.selectedItemIds) ? b.selectedItemIds : undefined,
        block: b,
      };
    });
}

function fromSections(sections: any[], supportedTypes?: readonly string[]): ResolvedSection[] {
  const seenHero = { done: false };
  return sections
    .filter((s) => s && typeof s === 'object')
    .map((s, i) => {
      const type = String(s.type || s.sectionType || '').toLowerCase();
      let effectiveType = type;
      if (type === 'hero') {
        if (seenHero.done) effectiveType = 'text';
        seenHero.done = true;
      }
      const known = KNOWN_SECTION_TYPES.has(type);
      const supported = supportedTypes ? supportedTypes.includes(effectiveType) : known;
      return {
        id: String(s.id || `section-${i}`),
        type: effectiveType,
        enabled: s.enabled !== false,
        supported,
        heading: s.title ?? s.heading,
        title: s.title ?? s.heading,
        limit: typeof s.limit === 'number' ? s.limit : (s.limit ?? undefined),
        displayVariant: s.displayVariant,
        selectedItemIds: Array.isArray(s.selectedItemIds) ? s.selectedItemIds : undefined,
        block: s,
      };
    });
}

export function resolveHomepageSections(input: ResolveHomepageInput): ResolveHomepageResult {
  const supported = input.supportedTypes;
  let sections: ResolvedSection[] = [];
  let source: ResolveHomepageResult['source'] = 'empty';

  const blocks = nonEmptyArray(input.homepageBlocks);
  const variant = nonEmptyArray(input.variantSections);
  const site = nonEmptyArray(input.siteSections);

  const sectionType = (s: any) => String(s?.type || s?.sectionType || '').toLowerCase();
  const sameComposition = (a: any[], b: any[]) =>
    a.length === b.length && a.every((s, i) => sectionType(s) === sectionType(b[i]));
  // A variant snapshot that merely copies the canonical composition carries no
  // concept-specific structure — demote it so canonical Page.blocks stay live.
  const distinctVariant = variant && (!site || !sameComposition(variant, site));

  if (input.isPreferred && blocks) {
    sections = fromBlocks(blocks, supported);
    source = 'page-blocks';
  } else if (distinctVariant) {
    sections = fromSections(variant, supported);
    source = 'variant';
  } else if (blocks) {
    // Non-preferred variant preview without its own distinct sections:
    // Page.blocks is the site's canonical composition and still applies — it
    // outranks the legacy site-level themeConfig snapshot.
    sections = fromBlocks(blocks, supported);
    source = 'page-blocks';
  } else if (variant) {
    sections = fromSections(variant, supported);
    source = 'variant';
  } else if (site) {
    sections = fromSections(site, supported);
    source = 'site';
  }

  // Finale ordering invariant: enabled 'cta' sections carry the page footer —
  // no content may render after the real footer. Impossible orders (e.g.
  // contacts placed after the finale) are normalized, not silently kept.
  const warnings: string[] = [];
  const lastEnabledIdx = sections.reduce((acc, s, i) => (s.enabled ? i : acc), -1);
  const lastCtaIdx = sections.reduce((acc, s, i) => (s.enabled && s.type === 'cta' ? i : acc), -1);
  if (lastCtaIdx >= 0 && lastCtaIdx < lastEnabledIdx) {
    warnings.push('composition normalized: enabled cta/finale sections moved to the end (footer must be last)');
    const enabledCta = sections.filter((s) => s.enabled && s.type === 'cta');
    sections = [...sections.filter((s) => !(s.enabled && s.type === 'cta')), ...enabledCta];
  }

  return {
    sections,
    visible: sections.filter((s) => s.enabled && s.supported),
    source,
    warnings,
  };
}

// Collection selection contract for blocks:
// - only PUBLISHED entities
// - selectedItemIds picks exact entities in the caller-specified order
// - limit caps the result afterwards
export function selectBlockItems<T extends { id?: string; status?: string }>(
  items: T[],
  section: { limit?: number | null; selectedItemIds?: string[] },
): T[] {
  const published = (items || []).filter((x) => x && (x.status === undefined || x.status === 'PUBLISHED'));
  let out = published;
  if (Array.isArray(section.selectedItemIds) && section.selectedItemIds.length > 0) {
    const byId = new Map(published.map((x) => [x.id, x]));
    out = section.selectedItemIds.map((id) => byId.get(id)).filter((x): x is T => !!x);
  }
  if (typeof section.limit === 'number' && section.limit >= 0) {
    out = out.slice(0, section.limit);
  }
  return out;
}
