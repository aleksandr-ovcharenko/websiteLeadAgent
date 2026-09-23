// V3.7.8 — shared per-section collection limit contract.
//
// Every homepage collection section owns its own `limit` (stored on the
// section instance, keyed by section id — never a global or per-type value).
// Templates consume the limit ONLY through these helpers: defaults come from
// the template manifest's `collectionSections`, not from inline .slice().

import { clampPageSize, DEFAULT_PAGE_SIZE } from './routes.js';
import { selectBlockItems } from './resolveHomepage.js';
import type { TemplateManifest } from './types.js';

export interface SectionLike {
  type?: string;
  sectionType?: string;
  limit?: number | null;
  selectedItemIds?: string[];
  block?: { limit?: number | null; selectedItemIds?: string[] } | null;
}

/**
 * Effective display limit for one homepage section instance.
 *   - explicit `section.limit` wins (normalized: positive int, page-size range)
 *   - absent/invalid → the manifest's `defaultLimit` for this section type
 *   - section types the manifest does not declare as collections → undefined
 *     (no cap; a template rendering an undeclared collection type fails the
 *     registry contract test)
 * When no manifest is supplied (legacy callers), the raw normalized limit or
 * `fallback` applies.
 */
export function resolveSectionLimit(
  section: SectionLike | undefined | null,
  manifest?: TemplateManifest,
  fallback: number = DEFAULT_PAGE_SIZE,
): number | undefined {
  if (!section) return undefined;
  const type = String(section.type || section.sectionType || '').toLowerCase();
  const decl = manifest?.collectionSections?.[type];
  if (manifest && !decl) return undefined;
  const def = decl?.defaultLimit ?? fallback;
  const raw = section.limit ?? section.block?.limit;
  if (raw == null || (raw as any) === '') return def;
  return clampPageSize(raw, def);
}

/**
 * Homepage-preview slice for a collection section: published-only,
 * selectedItemIds order, then the section's own limit. Collection/detail
 * pages must NOT call this — they render the full set.
 */
export function applySectionLimit<T extends { id?: string; status?: string }>(
  items: T[],
  section: SectionLike | undefined | null,
  manifest?: TemplateManifest,
  fallback?: number,
): T[] {
  const limit = resolveSectionLimit(section, manifest, fallback);
  return selectBlockItems(items, {
    limit,
    selectedItemIds: section?.selectedItemIds ?? section?.block?.selectedItemIds,
  });
}
