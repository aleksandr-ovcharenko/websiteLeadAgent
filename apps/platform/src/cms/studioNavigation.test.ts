// V3.7.8 — Studio navigation contract tests.
//
// Covers: typed entity→editor registry, returnTo URL state, Recent Changes
// item normalization/sorting, and the canEdit permission mirror.
import { describe, it, expect } from 'vitest';
import {
  ENTITY_REGISTRY,
  editorScreenFor,
  listScreenForEditor,
  parseStudioSearch,
  buildStudioSearch,
  buildRecentItems,
  canEditSite,
} from './studioNavigation';

describe('entity registry', () => {
  it('maps every supported entity type to its editor and list screen', () => {
    expect(ENTITY_REGISTRY.page.editorScreen).toBe('page-editor');
    expect(ENTITY_REGISTRY.project.editorScreen).toBe('project-editor');
    expect(ENTITY_REGISTRY.news.editorScreen).toBe('news-editor');
    expect(ENTITY_REGISTRY.service.editorScreen).toBe('service-editor');
    expect(ENTITY_REGISTRY.product.editorScreen).toBe('product-editor');
    expect(ENTITY_REGISTRY.vacancy.editorScreen).toBe('vacancy-editor');
    expect(ENTITY_REGISTRY.page.listScreen).toBe('pages');
    expect(ENTITY_REGISTRY.project.listScreen).toBe('projects');
    expect(ENTITY_REGISTRY.news.listScreen).toBe('news');
    expect(ENTITY_REGISTRY.service.listScreen).toBe('services');
    expect(ENTITY_REGISTRY.product.listScreen).toBe('products');
    expect(ENTITY_REGISTRY.vacancy.listScreen).toBe('vacancies');
  });

  it('editorScreenFor returns null for unknown types — never a false link', () => {
    expect(editorScreenFor('project')).toBe('project-editor');
    expect(editorScreenFor('unknown-thing')).toBeNull();
    expect(editorScreenFor('')).toBeNull();
  });

  it('listScreenForEditor resolves the fallback back target', () => {
    expect(listScreenForEditor('page-editor')).toBe('pages');
    expect(listScreenForEditor('project-editor')).toBe('projects');
    expect(listScreenForEditor('news-editor')).toBe('news');
    expect(listScreenForEditor('service-editor')).toBe('services');
    expect(listScreenForEditor('product-editor')).toBe('products');
    expect(listScreenForEditor('vacancy-editor')).toBe('vacancies');
  });
});

describe('studio URL state', () => {
  it('parses screen, edit id and returnTo', () => {
    expect(parseStudioSearch('?screen=project-editor&edit=abc123&returnTo=dashboard'))
      .toEqual({ screen: 'project-editor', id: 'abc123', returnTo: 'dashboard' });
  });

  it('missing/unknown screen falls back to dashboard; missing returnTo is null', () => {
    expect(parseStudioSearch('?screen=bogus&edit=x')).toEqual({ screen: 'dashboard', id: 'x', returnTo: null });
    expect(parseStudioSearch('')).toEqual({ screen: 'dashboard', id: null, returnTo: null });
  });

  it('unknown or editor returnTo is rejected — callers fall back to the entity list', () => {
    expect(parseStudioSearch('?screen=page-editor&edit=p1&returnTo=nonexistent').returnTo).toBeNull();
    expect(parseStudioSearch('?screen=page-editor&edit=p1&returnTo=project-editor').returnTo).toBeNull();
    expect(parseStudioSearch('?screen=page-editor&edit=p1&returnTo=pages').returnTo).toBe('pages');
  });

  it('buildStudioSearch round-trips and drops null params', () => {
    const qs = buildStudioSearch({ screen: 'project-editor', id: 'p9', returnTo: 'dashboard' });
    expect(qs).toContain('screen=project-editor');
    expect(qs).toContain('edit=p9');
    expect(qs).toContain('returnTo=dashboard');
    expect(parseStudioSearch(`?${qs}`)).toEqual({ screen: 'project-editor', id: 'p9', returnTo: 'dashboard' });
    const noId = buildStudioSearch({ screen: 'pages', id: null, returnTo: null });
    expect(noId).not.toContain('edit=');
    expect(noId).not.toContain('returnTo=');
  });
});

describe('recent changes items', () => {
  const rec = (id: string, updatedAt: string, extra: any = {}) => ({ id, title: `T-${id}`, status: 'PUBLISHED', updatedAt, ...extra });

  it('merges all six entity types and sorts by updatedAt desc with deterministic tie-break', () => {
    const items = buildRecentItems({
      pages: [rec('pg1', '2025-01-02T00:00:00Z'), rec('pg2', '2025-01-05T00:00:00Z')],
      projects: [rec('pr1', '2025-01-06T00:00:00Z'), rec('pr2', '2025-01-05T00:00:00Z')],
      news: [rec('n1', '2025-01-05T00:00:00Z')],
      services: [rec('s1', '2025-01-04T00:00:00Z')],
      products: [rec('pd1', '2025-01-03T00:00:00Z')],
      vacancies: [rec('v1', '2025-01-01T00:00:00Z')],
    });
    expect(items[0]).toMatchObject({ id: 'pr1', entityType: 'project', editorScreen: 'project-editor' });
    // three rows share 2025-01-05 — deterministic order, not array-order accident
    const tie = items.slice(1, 4).map((i) => `${i.entityType}:${i.id}`);
    expect(tie).toEqual([...tie].sort());
    expect(items.map((i) => i.editorScreen)).toContain('page-editor');
    expect(items.map((i) => i.editorScreen)).toContain('vacancy-editor');
  });

  it('carries id, title, status, previewPath and editorScreen per row', () => {
    const items = buildRecentItems({
      projects: [rec('pr9', '2025-02-01T00:00:00Z', { previewPath: '/projects/pr9' })],
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'pr9', entityType: 'project', title: 'T-pr9', status: 'PUBLISHED',
      editorScreen: 'project-editor', listScreen: 'projects', previewPath: '/projects/pr9',
    });
  });

  it('previewPath is null when no detail route exists — never a collection substitute', () => {
    const items = buildRecentItems({ projects: [rec('pr1', '2025-02-01T00:00:00Z', { previewPath: null })] });
    expect(items[0].previewPath).toBeNull();
  });

  it('respects the dashboard row limit and skips records without updatedAt', () => {
    const items = buildRecentItems(
      { pages: [rec('a', '2025-01-01T00:00:00Z'), rec('b', '2025-01-02T00:00:00Z'), rec('c', '2025-01-03T00:00:00Z'), rec('noDate', '')] },
      2,
    );
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('c');
  });

  it('empty/undefined collections produce an empty list — no throw', () => {
    expect(buildRecentItems({})).toEqual([]);
    expect(buildRecentItems({ pages: undefined, projects: null as any })).toEqual([]);
  });
});

describe('canEditSite — mirrors server cms.edit semantics', () => {
  const siteId = 'site-1';
  it('SUPER_ADMIN edits anywhere', () => {
    expect(canEditSite({ id: 'u1', globalRole: 'SUPER_ADMIN' }, [], siteId)).toBe(true);
  });
  it('global cms.edit grants edit', () => {
    const user = { id: 'u1', permissions: [{ name: 'cms.edit', scope: 'GLOBAL' as const }] };
    expect(canEditSite(user, [], siteId)).toBe(true);
  });
  it('site-scoped cms.edit grants edit only for that site', () => {
    const user = { id: 'u1', permissions: [{ name: 'cms.edit', scope: 'SITE' as const, siteId }] };
    expect(canEditSite(user, [], siteId)).toBe(true);
    expect(canEditSite(user, [], 'other-site')).toBe(false);
  });
  it('site ADMIN membership grants edit', () => {
    expect(canEditSite({ id: 'u1' }, [{ userId: 'u1', role: 'ADMIN' }], siteId)).toBe(true);
  });
  it('read-only user (cms.read only / EDITOR membership) cannot edit', () => {
    const reader = { id: 'u2', permissions: [{ name: 'cms.read', scope: 'SITE' as const, siteId }] };
    expect(canEditSite(reader, [], siteId)).toBe(false);
    expect(canEditSite({ id: 'u3' }, [{ userId: 'u3', role: 'EDITOR' }], siteId)).toBe(false);
    expect(canEditSite(null, [], siteId)).toBe(false);
  });
});
