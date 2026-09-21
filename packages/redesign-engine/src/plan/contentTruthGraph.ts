import { createHash } from 'node:crypto';
import type { SiteContentPlanV2, PlannedEntity, PlannedDynamicSection } from './siteContentPlanV2.js';

export type Provenance = {
  source: 'SOURCE_FACT' | 'SOURCE_CONTENT' | 'AI_DECORATIVE' | 'AI_GENERATED' | 'INFERENCE';
  sourceUrl?: string;
  sourceDocId?: string;
  entityId?: string;
  mediaId?: string;
  generatedBy?: string;
  note?: string;
};

export type TruthNode = {
  id: string;
  kind: 'identity' | 'contact' | 'entity' | 'media' | 'conversion' | 'dynamic' | 'navigation' | 'prohibition';
  value: any;
  provenance: Provenance;
  verified: boolean;
};

export interface ContentTruthGraph {
  version: '1.0';
  generatedAt: string;
  siteKey: string;
  baseUrl: string;
  contentHash: string;
  nodes: TruthNode[];
  entities: PlannedEntity[];
  dynamicSections: PlannedDynamicSection[];
  media: { id: string; src: string; role: string; provenance: Provenance }[];
  conversionTargets: { id: string; label: string; url: string; kind: 'phone' | 'email' | 'form' | 'collection' | 'external' }[];
  prohibitions: { id: string; rule: string; reason: string }[];
}

export function buildContentTruthGraph(plan: SiteContentPlanV2): ContentTruthGraph {
  const nodes: TruthNode[] = [];

  nodes.push({
    id: 'truth-identity',
    kind: 'identity',
    value: { displayName: plan.siteIdentity.displayName, legalName: plan.siteIdentity.legalName, description: plan.siteIdentity.description, industry: plan.siteIdentity.industry, founded: plan.siteIdentity.founded, employees: plan.siteIdentity.employees, unp: plan.siteIdentity.unp },
    provenance: { source: 'SOURCE_FACT', sourceDocId: plan.siteIdentity.evidenceDocIds[0], note: 'identity extracted from source' },
    verified: true,
  });

  for (const p of plan.contacts.phones) {
    nodes.push({ id: `truth-phone-${p.value}`, kind: 'contact', value: { type: 'phone', value: p.value }, provenance: { source: 'SOURCE_FACT', sourceUrl: p.sourceUrl }, verified: true });
  }
  for (const e of plan.contacts.emails) {
    nodes.push({ id: `truth-email-${e.value}`, kind: 'contact', value: { type: 'email', value: e.value }, provenance: { source: 'SOURCE_FACT', sourceUrl: e.sourceUrl }, verified: true });
  }

  for (const ent of plan.entities) {
    nodes.push({
      id: `truth-entity-${ent.id}`,
      kind: 'entity',
      value: { type: ent.type, title: ent.title, slug: ent.slug, cardSummary: ent.cardSummary, attributes: ent.attributes, primaryImage: ent.primaryImage, media: ent.media },
      provenance: { source: 'SOURCE_CONTENT', sourceUrl: ent.sourceUrls[0], entityId: ent.id },
      verified: true,
    });
  }

  for (const d of plan.dynamicSections) {
    if (d.kind !== 'IGNORED') {
      nodes.push({
        id: `truth-dynamic-${d.id}`,
        kind: 'dynamic',
        value: { kind: d.kind, heading: d.heading, itemCount: d.items.length, cta: d.cta },
        provenance: { source: 'SOURCE_CONTENT', sourceUrl: d.sourcePages[0] },
        verified: true,
      });
    }
  }

  const conversionTargets = [
    ...plan.contacts.phones.map((p) => ({ id: `conv-phone-${p.value}`, label: p.value, url: `tel:${p.value.replace(/\D/g, '')}`, kind: 'phone' as const })),
    ...plan.contacts.emails.map((e) => ({ id: `conv-email-${e.value}`, label: e.value, url: `mailto:${e.value}`, kind: 'email' as const })),
    ...plan.plannedNavigation.filter((n) => n.route && n.route !== '/').map((n, i) => ({ id: `conv-nav-${i}`, label: n.label, url: n.route, kind: 'collection' as const })),
  ];

  for (const c of conversionTargets) {
    nodes.push({ id: `truth-conv-${c.id}`, kind: 'conversion', value: c, provenance: { source: 'SOURCE_FACT' }, verified: true });
  }

  const media = (plan.media.images || []).map((m, i) => ({
    id: `media-${i}`,
    src: m.src,
    role: m.role,
    provenance: { source: 'SOURCE_CONTENT' as const, sourceUrl: m.src },
  }));

  for (const m of media) {
    nodes.push({ id: m.id, kind: 'media', value: m, provenance: m.provenance, verified: true });
  }

  const prohibitions = [
    { id: 'no-fabricated-projects', rule: 'Never generate or imply projects that are not in source entities', reason: 'factual integrity' },
    { id: 'no-fabricated-employees', rule: 'Never invent team members', reason: 'factual integrity' },
    { id: 'no-fabricated-reviews', rule: 'Never create testimonials without source REVIEWS', reason: 'factual integrity' },
    { id: 'no-fabricated-prices', rule: 'Never display prices without source PRICING evidence', reason: 'factual integrity' },
    { id: 'no-stock-as-real', rule: 'AI decorative assets must not be presented as real customer work', reason: 'provenance' },
  ];

  const payload = JSON.stringify({ plan, conversionTargets, media });
  const contentHash = createHash('sha256').update(payload).digest('hex');

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    siteKey: plan.siteKey,
    baseUrl: plan.baseUrl,
    contentHash,
    nodes,
    entities: plan.entities,
    dynamicSections: plan.dynamicSections,
    media,
    conversionTargets,
    prohibitions,
  };
}
