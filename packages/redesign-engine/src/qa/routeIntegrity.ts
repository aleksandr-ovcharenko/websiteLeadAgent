// V3.7.2 Phase 6 — pipeline-owned route contract.
//
// Validates the shared entity-route contract BEFORE CMS import: every routable
// entity must resolve a unique internal route through the SAME builders the
// renderer uses (entityRoute / collectionRoute / resolveRoute from
// @minsk/templates). No route is repaired after import — if this gate fails,
// the owning stage is generation, not CMS.

// @ts-expect-error no declaration file for built templates
import { entityRoute, collectionRoute, resolveRoute } from '../../../templates/dist/index.js';

export interface EntityRouteRecord {
  entityId: string;
  entityType: string;
  route?: string;
  routeStatus: 'ok' | 'missing' | 'conflict' | 'misresolved';
  sourceUrl?: string;
}

export interface RouteIntegrityReport {
  generatedAt: string;
  records: EntityRouteRecord[];
  collections: { kind: string; route?: string; status: 'ok' | 'missing' }[];
  errors: string[];
  warnings: string[];
  metrics: {
    entities: number;
    routed: number;
    missing: number;
    conflicts: number;
    misresolved: number;
  };
}

const ENTITY_KINDS = ['services', 'projects', 'news', 'vacancies', 'products'] as const;
// Kind → singular entity-type label (explicit map — 'news'.replace(/s$/,'')
// would produce the nonsense 'new').
const ENTITY_LABEL: Record<(typeof ENTITY_KINDS)[number], string> = {
  services: 'service', projects: 'project', news: 'news article',
  vacancies: 'vacancy', products: 'product',
};

export function runRouteIntegrity(content: Record<string, any>): RouteIntegrityReport {
  const pages = content.pages || [];
  const ctx: Record<string, any> = { pages, route: '', subRoute: '' };
  for (const k of ENTITY_KINDS) ctx[k] = content[k] || [];

  const records: EntityRouteRecord[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const claimed = new Map<string, { type: string; id: string }>();

  for (const kind of ENTITY_KINDS) {
    const type = ENTITY_LABEL[kind];
    for (const e of content[kind] || []) {
      const id = e.slug || e.title || `${kind}?`;
      const route = entityRoute(e, pages);
      const rec: EntityRouteRecord = {
        entityId: id,
        entityType: type,
        route,
        sourceUrl: e.sourceUrl,
        routeStatus: 'ok',
      };
      if (!route) {
        rec.routeStatus = 'missing';
        errors.push(`${type} "${id}" has no resolvable route (no slug, no source-backed page)`);
      } else {
        const prior = claimed.get(route);
        if (prior) {
          rec.routeStatus = 'conflict';
          errors.push(`route ${route} claimed by both ${prior.type} "${prior.id}" and ${type} "${id}"`);
        } else {
          claimed.set(route, { type, id });
          // Round-trip through resolveRoute: the route must resolve back to
          // THIS entity — a route resolving to another entity or 404 is a
          // broken internal link by construction.
          const r = resolveRoute({ ...ctx, route: route.replace(/^\/+/, ''), subRoute: '' });
          const resolved = r.entity;
          const same = resolved && (resolved === e || (resolved.slug && e.slug && resolved.slug === e.slug));
          if (!same) {
            rec.routeStatus = 'misresolved';
            errors.push(`route ${route} for ${type} "${id}" resolves to ${r.kind}${resolved?.slug ? ` (${resolved.slug})` : ''} instead of the entity`);
          }
        }
      }
      records.push(rec);
    }
  }

  const collections: RouteIntegrityReport['collections'] = [];
  const sectionKinds = new Set<string>(
    (content.homepageSections || [])
      .filter((s: any) => (ENTITY_KINDS as readonly string[]).includes(s.type))
      .map((s: any) => s.type as string),
  );
  for (const kind of sectionKinds) {
    if ((content[kind] || []).length === 0) continue;
    const r = collectionRoute(kind as any, ctx);
    collections.push({ kind, route: r, status: r ? 'ok' : 'missing' });
    if (!r) errors.push(`collection ${kind} has entities but no resolvable collection route`);
  }

  return {
    generatedAt: new Date().toISOString(),
    records,
    collections,
    errors,
    warnings,
    metrics: {
      entities: records.length,
      routed: records.filter((r) => r.routeStatus === 'ok').length,
      missing: records.filter((r) => r.routeStatus === 'missing').length,
      conflicts: records.filter((r) => r.routeStatus === 'conflict').length,
      misresolved: records.filter((r) => r.routeStatus === 'misresolved').length,
    },
  };
}
