// V3.7.4 Phase 4 — strict editability audit.
//
// "The string exists in CMS JSON" is not ownership. A rendered value is owned
// only when a concrete CMS editor control exists for its field. This module
// marks each rendered-text→cmsPath row with the editor control that owns it.

export interface EditabilityRow {
  renderedText: string;
  cmsPath: string | null;
  cmsEntityType?: string | null;
  cmsEntityId?: string | null;
  editorControlId?: string | null;
  editable: boolean;
  ownership?: string | null;
  sourceUrl?: string | null;
  hardcoded: boolean;
}

/**
 * `resolveControl` maps a cmsPath to the concrete CMS editor control id
 * (e.g. `service:block:b2:field:items`) or null when no UI control exists.
 * Rows whose cmsPath resolves to no control are `editable: false` and fail
 * the gate — exactly like an unmapped cmsPath.
 */
export function markEditability(
  rows: { renderedText: string; cmsPath: string | null; via?: string }[],
  resolveControl: (cmsPath: string) => string | null,
): EditabilityRow[] {
  return rows.map((r) => {
    const editorControlId = r.cmsPath ? resolveControl(r.cmsPath) : null;
    return {
      renderedText: r.renderedText,
      cmsPath: r.cmsPath,
      editorControlId,
      editable: !!editorControlId,
      hardcoded: !r.cmsPath,
    };
  });
}

/**
 * Maps a cmsPath to the concrete `data-cms-control` id the CMS Studio renders.
 * Control scheme (see StructuredBlocksEditor + entity editors):
 *   `{kind}:{field}`                    — entity-level field (title, summary…)
 *   `{kind}:block:{blockId}:{field}`    — structured block field
 *   `page:{field}` / `page:block:{id}:{field}`
 *   `copy:{key}`                        — template copy dictionary
 *   `settings:{field}`                  — site settings (brand, contacts…)
 * Returns null when the path resolves to no editable control — that is a gate
 * failure, not a warning.
 */
export function resolveEditorControl(
  cmsPath: string,
  meta: { entityKind?: string; entityId?: string; pageId?: string; pageSlug?: string },
  ctx: {
    entity?: { blocks?: any[] } | null;
    page?: { blocks?: any[] } | null;
  } = {},
): string | null {
  const segs = cmsPath.split('.');
  const root = segs[0].replace(/\[\d+\]/g, '');
  const leaf = (segs[segs.length - 1] || '').replace(/\[\d+\]/g, '');
  const kind = meta.entityKind || 'service';
  const summaryField = { service: 'shortDescription', project: 'excerpt', news: 'excerpt', newsPost: 'excerpt', product: 'summary', vacancy: 'description' }[kind as string] || 'shortDescription';

  if (root === 'COPY') return `copy:${leaf}`;
  if (root === 'COMPANY' || root === 'LOGO' || root === 'NAV' || root === 'CONTACTS') return `settings:${leaf === 'companyName' ? 'companyName' : leaf}`;
  if (root === 'ENTITY') {
    if (leaf === 'title') return `${kind}:title`;
    if (leaf === 'summary' || leaf === 'shortDescription' || leaf === 'excerpt') return `${kind}:${summaryField}`;
    if (leaf === 'slug') return `${kind}:slug`;
    if (leaf === 'image' || leaf === 'imageId' || leaf === 'coverImage') return `${kind}:imageId`;
    // sections[i].<field> — section index maps to the entity's block id.
    const secM = cmsPath.match(/sections\[(\d+)\]\.(.+)$/);
    if (secM) {
      const bi = Number(secM[1]);
      const block = ctx.entity?.blocks?.[bi];
      if (!block?.id) return null;
      const fieldSegs = secM[2].split('.');
      const fld = fieldSegs[fieldSegs.length - 1];
      const idxM = fld.match(/^(\w+)\[(\d+)\]$/);
      // StructuredBlocksEditor control ids: `block:{id}:field:{name}`.
      return `block:${block.id}:field:${idxM ? `${idxM[1]}[${idxM[2]}]` : fld}`;
    }
    // Flat content/summary fields map onto their backing blocks when present.
    if (leaf === 'content' || leaf === 'description') {
      const block = ctx.entity?.blocks?.[0];
      return block?.id ? `block:${block.id}:field:content` : `${kind}:description`;
    }
    return `${kind}:${leaf}`;
  }
  if (root === 'PAGE' || root === 'SECTIONS' || root === 'COLLECTION') {
    if (leaf === 'title') return 'page:title';
    if (leaf === 'slug') return 'page:slug';
    const blkM = cmsPath.match(/(?:blocks|SECTIONS|COLLECTION)(?:\.\w+)?\[(\d+)\]\.(.+)$/)
      || cmsPath.match(/blocks\[(\d+)\]\.(.+)$/);
    if (blkM) {
      const bi = Number(blkM[1]);
      const block = ctx.page?.blocks?.[bi] ?? ctx.entity?.blocks?.[bi];
      if (!block?.id) return null;
      const fieldSegs = blkM[2].split('.');
      const fld = fieldSegs[fieldSegs.length - 1];
      const idxM = fld.match(/^(\w+)\[(\d+)\]$/);
      return `page:block:${block.id}:${idxM ? `${idxM[1]}[${idxM[2]}]` : fld}`;
    }
    return `page:${leaf}`;
  }
  return null;
}

/**
 * Structural dedupe guard for rendered output: the same CMS value must not
 * appear multiple times on one route unintentionally. Repeated chrome (menu
 * labels in header+footer) is excluded via `allowedRepeatPaths` — the caller
 * passes the paths that are legitimately rendered more than once.
 */
export function findUnintendedRepeats(
  rows: EditabilityRow[],
  allowedRepeatRoots: string[] = ['NAV', 'COPY', 'COMPANY', 'LOGO'],
): EditabilityRow[] {
  const byPath = new Map<string, number>();
  for (const r of rows) {
    if (!r.cmsPath) continue;
    const root = r.cmsPath.split('.')[0].replace(/\[\d+\]/g, '');
    if (allowedRepeatRoots.includes(root)) continue;
    byPath.set(r.cmsPath, (byPath.get(r.cmsPath) || 0) + 1);
  }
  return rows.filter((r) => r.cmsPath && (byPath.get(r.cmsPath) || 0) > 1);
}
