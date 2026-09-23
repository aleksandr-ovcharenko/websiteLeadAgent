import type { Screen } from './types';
import type { StudioUser } from './api';

// V3.7.8 — Studio navigation contract.
//
// Single typed registry for first-class CMS entities plus the pure helpers
// Studio, Dashboard, and the editors share: deep-link parsing/building,
// recent-changes normalization, and the canEdit permission mirror.
// A new entity type is supported by adding ONE registry entry — lists,
// recent-changes rows, editor routing, and return-to navigation follow.
// Unknown kinds resolve to null — callers render no link, never crash.

export type EntityKind = 'page' | 'project' | 'news' | 'service' | 'product' | 'vacancy';

export interface EntityRegistryEntry {
  kind: EntityKind;
  /** Dashboard "Type" column label. */
  label: string;
  /** List screen (default Back target). */
  listScreen: Screen;
  /** Editor screen for deep links (?screen=<editor>&edit=<id>). */
  editorScreen: Screen;
  /** StudioData collection key holding the entity rows. */
  collection: 'pages' | 'projects' | 'news' | 'services' | 'products' | 'vacancies';
}

export const ENTITY_REGISTRY: Record<EntityKind, EntityRegistryEntry> = {
  page: { kind: 'page', label: 'Page', listScreen: 'pages', editorScreen: 'page-editor', collection: 'pages' },
  project: { kind: 'project', label: 'Project', listScreen: 'projects', editorScreen: 'project-editor', collection: 'projects' },
  news: { kind: 'news', label: 'News', listScreen: 'news', editorScreen: 'news-editor', collection: 'news' },
  service: { kind: 'service', label: 'Service', listScreen: 'services', editorScreen: 'service-editor', collection: 'services' },
  product: { kind: 'product', label: 'Product', listScreen: 'products', editorScreen: 'product-editor', collection: 'products' },
  vacancy: { kind: 'vacancy', label: 'Vacancy', listScreen: 'vacancies', editorScreen: 'vacancy-editor', collection: 'vacancies' },
};

export const REGISTRY_LIST: readonly EntityRegistryEntry[] = Object.values(ENTITY_REGISTRY);

export const EDITOR_SCREENS: readonly Screen[] = REGISTRY_LIST.map((e) => e.editorScreen);
const EDITOR_SET = new Set<string>(EDITOR_SCREENS);
const BY_EDITOR = new Map(REGISTRY_LIST.map((e) => [e.editorScreen, e]));

export const STUDIO_SCREENS: readonly Screen[] = [
  'dashboard', 'pages', 'page-editor', 'projects', 'project-editor',
  'news', 'news-editor', 'services', 'service-editor', 'products',
  'product-editor', 'vacancies', 'vacancy-editor', 'media', 'navigation',
  'contacts', 'versions', 'site-settings', 'users',
];
const VALID = new Set<string>(STUDIO_SCREENS);

/** Editor screen for a kind — null for unknown kinds (no false links). */
export function editorScreenFor(kind: string | undefined | null): Screen | null {
  return (kind && ENTITY_REGISTRY[kind as EntityKind]?.editorScreen) || null;
}

/** Default Back target for an editor screen — its entity list. */
export function listScreenForEditor(editorScreen: string | undefined | null): Screen | null {
  return (editorScreen && BY_EDITOR.get(editorScreen as Screen)?.listScreen) || null;
}

export interface StudioUrlState {
  screen: Screen;
  id: string | null;
  returnTo: Screen | null;
}

// returnTo may point at a dashboard/list screen — never at another editor
// (Back would deep-link into a different entity's edit context).
function validReturnTo(v: string | null): Screen | null {
  return v && VALID.has(v) && !EDITOR_SET.has(v) ? (v as Screen) : null;
}

export function parseStudioSearch(search: string): StudioUrlState {
  try {
    const p = new URLSearchParams(search.replace(/^\?/, ''));
    const s = p.get('screen');
    return {
      screen: s && VALID.has(s) ? (s as Screen) : 'dashboard',
      id: p.get('edit') || null,
      returnTo: validReturnTo(p.get('returnTo')),
    };
  } catch {
    return { screen: 'dashboard', id: null, returnTo: null };
  }
}

export function buildStudioSearch(state: { screen: Screen; id?: string | null; returnTo?: Screen | null }): string {
  const p = new URLSearchParams();
  p.set('screen', state.screen);
  if (state.id) p.set('edit', state.id);
  const rt = validReturnTo(state.returnTo ?? null);
  if (rt) p.set('returnTo', rt);
  return p.toString();
}

/**
 * Honest preview path for a row. Entities carry the server's canonical
 * `previewPath` (null when no detail route resolves — no link, never a
 * collection substitute). Pages are routable by slug: homepage → '/', else
 * `/<slug>`.
 */
export function previewPathFor(kind: string, entity: any): string | null {
  if (!entity) return null;
  if (kind === 'page') {
    if (entity.isHomepage || entity.slug === 'index') return '/';
    return entity.slug ? `/${entity.slug}` : null;
  }
  return entity.previewPath || null;
}

export interface RecentItem {
  id: string;
  entityType: EntityKind;
  typeLabel: string;
  title: string;
  status: string | undefined;
  updatedAt: string;
  editorScreen: Screen;
  listScreen: Screen;
  /** Canonical detail path — null when unroutable (renders no Preview). */
  previewPath: string | null;
}

/** Registry-driven recent-changes rows: sorted by updatedAt desc, deterministic
 *  tie-break on `entityType:id`, skips records without an id or updatedAt. */
export function buildRecentItems(collections: Partial<Record<string, any[] | null | undefined>>, limit = 10): RecentItem[] {
  const items: RecentItem[] = [];
  for (const reg of REGISTRY_LIST) {
    for (const e of collections[reg.collection] || []) {
      if (!e?.id || !e?.updatedAt) continue;
      items.push({
        id: e.id,
        entityType: reg.kind,
        typeLabel: reg.label,
        title: e.title || e.slug || '—',
        status: e.status,
        updatedAt: e.updatedAt,
        editorScreen: reg.editorScreen,
        listScreen: reg.listScreen,
        previewPath: previewPathFor(reg.kind, e),
      });
    }
  }
  items.sort((a, b) => {
    const dt = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    if (dt !== 0) return dt;
    return `${a.entityType}:${a.id}`.localeCompare(`${b.entityType}:${b.id}`);
  });
  return items.slice(0, limit);
}

// Mirrors requireSitePermission('cms.edit') / hasSitePermission on the server:
// SUPER_ADMIN, or cms.edit at GLOBAL scope, or cms.edit SITE-scoped to this
// site. A siteUser ADMIN membership also grants edit — the CMS membership
// model predates the permission table and the server accepts it for reads;
// for writes the server still enforces its own check (UI gating only).
export function canEditSite(
  user: Pick<StudioUser, 'id'> & Partial<Omit<StudioUser, 'id'>> | null,
  siteUsers: any[] | null | undefined,
  siteId: string,
): boolean {
  if (!user) return false;
  if (user.globalRole === 'SUPER_ADMIN') return true;
  const perms = user.permissions || [];
  if (perms.some((p) => p.name === 'cms.edit' && (p.scope === 'GLOBAL' || (p.scope === 'SITE' && p.siteId === siteId)))) return true;
  const su = (siteUsers || []).find((s: any) => s.userId === user.id);
  return su?.role === 'ADMIN';
}
