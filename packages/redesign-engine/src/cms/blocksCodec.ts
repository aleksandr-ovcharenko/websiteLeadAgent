// V3.7.4 Phase 3 — non-destructive blocks codec.
//
// The CMS editor works on a typed editor-state (one row per block, stable
// editor ids) and serialises back to the SAME structured block JSON. Every
// field survives: type, heading, title, content, description, caption, items,
// buttonLabel, buttonUrl, media, enabled, ordering, provenance — including
// fields the editor does not render. Unknown block types are never flattened;
// they are preserved byte-for-byte and flagged `unsupported`.

export interface EditorBlockState {
  /** Stable editor-side key (equals source id when present). */
  editorId: string;
  /** Canonical block type or the original unknown type. */
  type: string;
  /** Known editable fields, keyed for the block editor UI. */
  fields: Record<string, unknown>;
  /** Deep copy of the untouched original block — the source of truth for
   *  fields the editor does not edit. */
  original: Record<string, unknown>;
  /** True when the type has no dedicated editor — UI must render it as
   *  read-only structured data and saving must not flatten it. */
  unsupported: boolean;
}

export const KNOWN_BLOCK_TYPES = new Set([
  'hero', 'richText', 'richtext', 'text', 'heading', 'list', 'features',
  'cta', 'gallery', 'media', 'facts', 'faq', 'table', 'quote', 'steps',
  'collection', 'products', 'services', 'projects', 'news', 'contacts',
]);

/** Fields the structured editor exposes per type. Everything else round-trips
 *  through `original` untouched. */
const EDITABLE_FIELDS: Record<string, string[]> = {
  hero: ['title', 'description', 'buttonLabel', 'buttonUrl', 'media', 'image'],
  richtext: ['heading', 'content', 'items', 'caption'],
  richtext2: [],
  text: ['content', 'heading'],
  heading: ['heading', 'title', 'content', 'level'],
  list: ['heading', 'items'],
  features: ['heading', 'items'],
  cta: ['title', 'heading', 'description', 'content', 'buttonLabel', 'buttonUrl'],
  gallery: ['heading', 'caption', 'media', 'items'],
  media: ['caption', 'media', 'src'],
  facts: ['heading', 'items'],
  faq: ['heading', 'items'],
  table: ['heading', 'rows', 'items'],
  quote: ['content', 'caption'],
  steps: ['heading', 'items'],
  collection: ['heading', 'title', 'kind', 'limit', 'pageSize', 'showAllLink', 'displayVariant'],
  contacts: ['heading', 'content'],
};

let seq = 0;
const editorId = (b: any, i: number) => b?.id || b?.sourceSectionId || `blk-${i}-${++seq}`;

export function blocksToEditorState(blocks: any[] | null | undefined): EditorBlockState[] {
  return (blocks || []).map((b: any, i: number) => {
    const type = String(b?.type || 'unknown');
    const editable = new Set(EDITABLE_FIELDS[type.toLowerCase()] || EDITABLE_FIELDS[type] || []);
    const fields: Record<string, unknown> = {};
    for (const k of editable) if (b[k] !== undefined) fields[k] = b[k];
    return {
      editorId: editorId(b, i),
      type,
      fields,
      original: structuredClone(b),
      unsupported: !KNOWN_BLOCK_TYPES.has(type) && !KNOWN_BLOCK_TYPES.has(type.toLowerCase()),
    };
  });
}

export function blocksFromEditorState(state: EditorBlockState[]): any[] {
  return (state || []).map((s) => {
    // Start from the untouched original — any field the editor doesn't know
    // (provenance, sourceUrl, enabled, ordering, media refs…) is preserved.
    const out: Record<string, unknown> = structuredClone(s.original || {});
    out.type = s.type;
    for (const [k, v] of Object.entries(s.fields || {})) {
      if (v === undefined) delete out[k]; else out[k] = v;
    }
    return out;
  });
}

/** Ordering is the editor state array order — preserved by construction. */
export function reorderEditorState(state: EditorBlockState[], from: number, to: number): EditorBlockState[] {
  const next = state.slice();
  const [m] = next.splice(from, 1);
  next.splice(to, 0, m);
  return next;
}
