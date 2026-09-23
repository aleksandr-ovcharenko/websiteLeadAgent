// V3.7.8 — template registry contract for collection-section limits.
//
// Every registered template declares which homepage section types are
// collection sections and their default limits. Templates that render
// collection previews must route through the shared limit contract — a new
// template cannot silently ignore `homepageSections[].limit`.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { templates } from './index.js';
import { constructionModernV1Manifest } from './construction-modern-v1/manifest.js';
import { editorialArchitectureV1Manifest } from './editorial-architecture-v1/manifest.js';
import { constructionIndustrialV1Manifest } from './construction-industrial-v1/manifest.js';
import { constructionModernManifest } from './construction-modern/manifest.js';
import { constructionFigmaManifest } from './construction-figma/manifest.js';
import { resolveSectionLimit } from './sectionLimits.js';
import type { TemplateManifest } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));

export const TEMPLATE_MANIFESTS: Record<string, TemplateManifest> = {
  'construction-modern': constructionModernManifest,
  'construction-figma': constructionFigmaManifest,
  'construction-modern-v1': constructionModernV1Manifest,
  'construction-industrial-v1': constructionIndustrialV1Manifest,
  'editorial-architecture-v1': editorialArchitectureV1Manifest,
};

const LIMIT_HELPERS = /\b(applySectionLimit|resolveSectionLimit|selectBlockItems)\b/;

/** Reads every source file of a template directory (ts/tsx). */
function templateSources(templateId: string): string {
  const dir = join(here, templateId);
  if (!existsSync(dir)) return '';
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) out.push(readFileSync(p, 'utf8'));
    }
  };
  walk(dir);
  return out.join('\n');
}

describe('template registry — collection-section contract', () => {
  it('every registered template has a manifest', () => {
    for (const id of Object.keys(templates)) {
      expect(TEMPLATE_MANIFESTS[id], `template "${id}" lacks a manifest`).toBeTruthy();
    }
  });

  it('every manifest declares defaults for its collection sections', () => {
    for (const [id, m] of Object.entries(TEMPLATE_MANIFESTS)) {
      const decl = m.collectionSections || {};
      // Section types rendered as collection previews must be declared.
      for (const [type, cfg] of Object.entries(decl)) {
        expect(typeof cfg.defaultLimit, `${id}: ${type} defaultLimit`).toBe('number');
        expect(cfg.defaultLimit).toBeGreaterThanOrEqual(1);
        expect(cfg.supportsLimit, `${id}: ${type} supportsLimit`).toBe(true);
      }
      expect(Object.keys(decl).length, `${id}: no collectionSections declared`).toBeGreaterThan(0);
    }
  });

  it('declared collection types are also supported section types', () => {
    for (const [id, m] of Object.entries(TEMPLATE_MANIFESTS)) {
      for (const type of Object.keys(m.collectionSections || {})) {
        expect(m.supportedSectionTypes, `${id}: '${type}' missing from supportedSectionTypes`).toContain(type);
      }
    }
  });

  it('every template routes homepage collection items through the shared limit contract', () => {
    for (const id of Object.keys(templates)) {
      const src = templateSources(id);
      expect(src.length, `${id}: no sources found`).toBeGreaterThan(0);
      expect(LIMIT_HELPERS.test(src), `${id}: does not use the shared section-limit helper`).toBe(true);
    }
  });

  it('a bogus template manifest fails validation — future templates cannot skip the contract', () => {
    const bogus: TemplateManifest = {
      id: 'bogus', name: 'Bogus', supportedSectionTypes: ['projects'],
      sectionRendererMap: {}, collectionRendererMap: {},
      collectionSections: { projects: { defaultLimit: 0, supportsLimit: false } },
    };
    const decl = bogus.collectionSections!.projects;
    expect(decl.defaultLimit >= 1 && decl.supportsLimit === true).toBe(false);
  });
});

describe('resolveSectionLimit — per-template manifest defaults', () => {
  it('each template yields its own declared defaults', () => {
    expect(resolveSectionLimit({ type: 'projects' }, constructionModernV1Manifest)).toBe(6);
    expect(resolveSectionLimit({ type: 'news' }, constructionModernV1Manifest)).toBe(3);
    expect(resolveSectionLimit({ type: 'projects' }, constructionIndustrialV1Manifest)).toBe(3);
    expect(resolveSectionLimit({ type: 'news' }, constructionIndustrialV1Manifest)).toBe(4);
    expect(resolveSectionLimit({ type: 'services' }, constructionModernManifest)).toBe(4);
    expect(resolveSectionLimit({ type: 'news' }, constructionModernManifest)).toBe(6);
  });

  it('a section-level limit overrides the manifest default for that section only', () => {
    const a = { id: 's1', type: 'projects', limit: 2 };
    const b = { id: 's2', type: 'projects', limit: 5 };
    expect(resolveSectionLimit(a, constructionModernV1Manifest)).toBe(2);
    expect(resolveSectionLimit(b, constructionModernV1Manifest)).toBe(5);
  });
});

describe('legacy string templates honour homepageSections limits', () => {
  const baseCtx = (over: any = {}) => ({
    site: { name: 'Co', leadId: 'x' },
    settings: {},
    theme: {},
    pages: [{ title: 'Home', slug: 'index', isHomepage: true, blocks: [] }],
    services: Array.from({ length: 6 }, (_, i) => ({ title: `Svc ${i}`, slug: `s${i}` })),
    projects: Array.from({ length: 6 }, (_, i) => ({ title: `Prj ${i}`, slug: `p${i}` })),
    news: Array.from({ length: 8 }, (_, i) => ({ title: `News ${i}`, slug: `n${i}` })),
    vacancies: [],
    mediaMap: new Map(),
    menu: [],
    route: '',
    ...over,
  });

  it('construction-modern renders per-section limits independently', () => {
    const ctx = baseCtx({
      homepageSections: [
        { id: 'h1', type: 'services', enabled: true, limit: 2 },
        { id: 'h2', type: 'projects', enabled: true, limit: 3 },
      ],
    });
    const html = templates['construction-modern'](ctx as any);
    expect((html.match(/class="service-card__title"/g) || []).length).toBe(2);
    expect((html.match(/class="project-card__title"/g) || []).length).toBe(3);
  });

  it('construction-figma renders per-section limits independently', () => {
    const ctx = baseCtx({
      homepageSections: [
        { id: 'h1', type: 'services', enabled: true, limit: 1 },
        { id: 'h2', type: 'projects', enabled: true, limit: 4 },
      ],
    });
    const html = templates['construction-figma'](ctx as any);
    expect((html.match(/class="service-card__title"/g) || []).length).toBe(1);
    expect((html.match(/class="project-card__title"/g) || []).length).toBe(4);
  });

  it('old payloads without limit keep manifest defaults', () => {
    const ctx = baseCtx({
      homepageSections: [
        { id: 'h1', type: 'services', enabled: true },
        { id: 'h2', type: 'projects', enabled: true },
      ],
    });
    const html = templates['construction-modern'](ctx as any);
    expect((html.match(/class="service-card__title"/g) || []).length).toBe(4); // manifest default
    expect((html.match(/class="project-card__title"/g) || []).length).toBe(3);
  });
});
