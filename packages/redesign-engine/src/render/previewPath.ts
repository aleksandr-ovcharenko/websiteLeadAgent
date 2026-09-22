// V3.7.4 Phase 5 — one shared entity→preview-path resolver.
// The single source of truth is `entityPreviewPath`/`entityRoute` in
// packages/templates/src/routes.ts (used by the renderer, route-integrity QA
// and the CMS API). This module adapts it for pipeline consumers that hold a
// RenderContext-shaped object.

// @ts-expect-error no declaration file for built templates
import { entityPreviewPath, entityRoute } from '../../../templates/dist/index.js';

export type EntityKind = 'service' | 'project' | 'product' | 'news' | 'vacancy';

interface RouteCtx {
  pages?: { slug?: string | null; sourceUrl?: string | null }[];
}

/**
 * Resolve the canonical public route for an entity.
 * Returns `null` when no detail route provably exists — callers must treat
 * that as "preview unavailable", never substitute a collection path.
 */
export function resolveEntityPreviewPath(
  _kind: EntityKind,
  entity: { id?: string; slug?: string | null; status?: string; sourceUrl?: string } | null | undefined,
  ctx: RouteCtx,
): string | null {
  const p = entityPreviewPath(entity, ctx.pages || []);
  return p ?? null;
}

/** Route without the publication gate — for QA/manifest tooling. */
export function entityRouteForManifest(entity: any, pages: any[]): string | null {
  return entityRoute(entity, pages) ?? null;
}
