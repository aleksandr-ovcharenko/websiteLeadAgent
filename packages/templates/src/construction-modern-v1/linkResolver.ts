// Central semantic link resolver — one place that maps a semantic target to a
// canonical Showcase route. Label text never decides routing.
//
// Semantic targets: "HOME", "HOME_SECTION:PRODUCTS", "COLLECTION:PROJECTS",
// "CONTENT_DETAIL:products/slug", "PAGE:about", "EXTERNAL_URL:https://…",
// or legacy plain paths. There is NO silent fallback: an empty or
// unresolvable target returns '' and the caller must omit the CTA.
export function resolveShowcaseTarget(base: string, raw?: string): string {
  if (!raw) return '';
  const t = raw.trim();
  if (!t) return '';
  if (/^https?:\/\//.test(t)) return t;
  const m = t.match(/^(HOME|HOME_SECTION|COLLECTION|PAGE|CONTENT_DETAIL|EXTERNAL_URL|CUSTOM_URL)[:/]\s*(.*)$/i);
  const kind = m ? m[1].toUpperCase() : '';
  if (kind === 'EXTERNAL_URL' || kind === 'CUSTOM_URL') {
    const ext = (m ? m[2] : t).trim();
    return /^https?:\/\//.test(ext) ? ext : (ext ? `${base}/${ext.toLowerCase()}` : '');
  }
  const target = (m ? m[2] : t).replace(/^\/+/, '').replace(/\/+$/, '');
  const key = target.toLowerCase();
  if (kind === 'HOME') return `${base}/`;
  // explicit semantic kind with an empty target is unresolvable — return ''
  if (kind && !target) return '';
  if (kind === 'HOME_SECTION') return `${base}/#${key}`;
  if (kind === 'COLLECTION') return `${base}/${key}`;
  if (kind === 'PAGE') return `${base}/${key}`;
  if (kind === 'CONTENT_DETAIL') return `${base}/${key}`;
  // Legacy plain-path form — classify explicitly, never guess "contacts".
  const COLLECTIONS = ['services', 'projects', 'products', 'news', 'vacancies'];
  const SECTIONS = ['contacts', 'about', 'faq', 'process', 'reviews', 'stats'];
  if (!target || key === 'index') return key === 'index' ? `${base}/` : '';
  if (COLLECTIONS.includes(key)) return `${base}/#${key}`;
  if (SECTIONS.includes(key)) return `${base}/#${key}`;
  return `${base}/${key}`;
}
