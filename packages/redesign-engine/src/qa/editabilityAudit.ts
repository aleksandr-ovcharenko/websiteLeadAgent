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
    /** Homepage Page record — hero/about/cta/home-section blocks live here. */
    home?: { blocks?: any[] } | null;
    /** Rendered __CMS__ payload — used to resolve list indices to block ids. */
    payload?: { HOME_SECTIONS?: any[]; DYNAMIC?: any[] } | null;
  } = {},
): string | null {
  const segs = cmsPath.split('.');
  const root = segs[0].replace(/\[\d+\]/g, '');
  const rootIdx = (segs[0].match(/\[(\d+)\]/) || [])[1];
  const leaf = (segs[segs.length - 1] || '').replace(/\[\d+\]/g, '');
  const kind = meta.entityKind || 'service';
  const summaryField = { service: 'shortDescription', project: 'excerpt', news: 'excerpt', newsPost: 'excerpt', product: 'summary', vacancy: 'description' }[kind as string] || 'shortDescription';
  const blocks = ctx.page?.blocks || [];
  // Homepage furniture (hero/about/cta/home sections) is owned by homepage
  // blocks even when it renders on a different route.
  const homeBlocks = ctx.home?.blocks || blocks;
  const blockOfType = (type: string) => homeBlocks.find((b: any) => String(b?.type || '').toLowerCase() === type);
  // Pages.tsx renders a `heading` control for hero/cta titles and a
  // `subheading` control for hero subtitles — normalize the stored field name
  // to the control name the editor actually exposes.
  const blockLeaf = (block: any, fld: string) => {
    const t = String(block?.type || '').toLowerCase();
    if ((t === 'hero' || t === 'cta') && fld === 'title') return 'heading';
    if (t === 'hero' && fld === 'subtitle') return 'subheading';
    if (fld === 'title') return 'heading';
    return fld;
  };

  if (root === 'COPY') return `copy:${leaf}`;
  // ROUTE mirrors the resolved entity/page identity — map to the owning
  // entity title/slug control (or the page's when no entity is bound).
  if (root === 'ROUTE') {
    if (leaf === 'title') return meta.entityId ? `${kind}:title` : 'page:title';
    if (leaf === 'slug') return meta.entityId ? `${kind}:slug` : 'page:slug';
    return null;
  }
  if (root === 'COMPANY' || root === 'LOGO' || root === 'NAV' || root === 'CONTACTS') {
    const f = leaf === 'name' || leaf === 'companyName' ? 'companyName' : leaf;
    return `settings:${f}`;
  }
  // Homepage furniture rendered from the resolved hero/about/cta sections —
  // the owning editor control is the homepage page block of that type.
  if (root === 'HERO' || root === 'ABOUT' || root === 'CTA') {
    const block = blockOfType(root.toLowerCase());
    if (!block?.id) return null;
    const f = leaf === 'image' || leaf === 'imageId' ? 'imageId' : blockLeaf(block, leaf);
    return `page:block:${block.id}:${f}`;
  }
  // Homepage sections emitted in composition order; payload carries the
  // backing block id, so resolve the concrete `page:block:{id}` control.
  if (root === 'HOME_SECTIONS') {
    const i = Number(rootIdx);
    const sec = ctx.payload?.HOME_SECTIONS?.[i];
    const block = sec?.id ? homeBlocks.find((b: any) => String(b?.id) === String(sec.id)) : homeBlocks[i];
    if (!block?.id) return null;
    return `page:block:${block.id}:${blockLeaf(block, leaf)}`;
  }
  // Dynamic sections (faq/process/reviews/pricing…) persist as homepage
  // blocks — match the owning block by id or section kind.
  if (root === 'DYNAMIC' || root === 'PROCESS_STEPS') {
    const i = Number(rootIdx);
    const sec = ctx.payload?.DYNAMIC?.[i];
    const kindKey = String(sec?.kind || sec?.sectionType || '').toLowerCase();
    const block = sec?.id
      ? homeBlocks.find((b: any) => String(b?.id) === String(sec.id))
      : homeBlocks.find((b: any) => String(b?.type || '').toLowerCase() === 'dynamic'
          && (!kindKey || String(b?.sectionType || b?.kind || '').toLowerCase() === kindKey))
        || blockOfType('dynamic');
    if (!block?.id) return null;
    return `page:block:${block.id}:${leaf}`;
  }
  // Entity collection rows → the entity editor's field control.
  const listKinds: Record<string, string> = { SERVICES: 'service', PROJECTS: 'project', PRODUCTS: 'product', NEWS_ITEMS: 'news', VACANCIES: 'vacancy' };
  if (listKinds[root]) {
    const k = listKinds[root];
    const sumF = { service: 'shortDescription', project: 'excerpt', news: 'excerpt', product: 'summary', vacancy: 'description' }[k] || 'shortDescription';
    if (leaf === 'title') return `${k}:title`;
    if (leaf === 'summary' || leaf === 'excerpt' || leaf === 'desc' || leaf === 'shortDescription' || leaf === 'description') return `${k}:${sumF}`;
    if (leaf === 'image' || leaf === 'img' || leaf === 'imageId' || leaf === 'coverImage' || leaf === 'coverImageUrl') return `${k}:imageId`;
    // Body content is edited through the structured-blocks editor — its
    // container control is `{kind}:blocks`.
    if (leaf === 'content' || leaf === 'blocks' || leaf === 'sections' || leaf === 'body') return `${k}:blocks`;
    return `${k}:${leaf}`;
  }
  if (root === 'PAGES') {
    if (leaf === 'title') return 'page:title';
    if (leaf === 'slug') return 'page:slug';
    return `page:${leaf}`;
  }
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
      return `page:block:${block.id}:${idxM ? `${idxM[1]}[${idxM[2]}]` : blockLeaf(block, fld)}`;
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
  rows: (EditabilityRow & { exact?: boolean })[],
  allowedRepeatRoots: string[] = ['NAV', 'COPY', 'COMPANY', 'LOGO'],
): EditabilityRow[] {
  const byPath = new Map<string, number>();
  for (const r of rows) {
    if (!r.cmsPath) continue;
    // Only exact renders count: a long value split into styled word spans
    // produces several substring rows for one legit render — not a repeat.
    if (r.exact === false) continue;
    const root = r.cmsPath.split('.')[0].replace(/\[\d+\]/g, '');
    if (allowedRepeatRoots.includes(root)) continue;
    byPath.set(r.cmsPath, (byPath.get(r.cmsPath) || 0) + 1);
  }
  return rows.filter((r) => r.cmsPath && r.exact !== false && (byPath.get(r.cmsPath) || 0) > 1);
}
