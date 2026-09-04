import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { importToCms } from '../dist/import/importToCms.js';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const prisma = new PrismaClient();

function makeContent(overrides = {}) {
  return {
    company: { name: 'Run Isolation Test Co' },
    contacts: {},
    branding: {},
    theme: {},
    hero: {},
    about: {},
    cta: {},
    homepageSections: [],
    navigation: [],
    pages: [],
    services: [],
    projects: [],
    news: [],
    vacancies: [],
    media: [],
    ...overrides
  };
}

async function withRollback(fn) {
  const leadId = randomUUID().replace(/-/g, '').slice(0, 25);
  const artifactDir = await mkdtemp(join(tmpdir(), 'gen2-isolation-'));
  try {
    await prisma.$transaction(async (tx) => {
      await tx.lead.create({
        data: {
          id: leadId,
          source: 'manual',
          sourceId: leadId,
          companyName: 'Run Isolation Test Co',
          city: 'Минск',
          categories: [],
          website: 'https://run-isolation.example',
          websiteDomain: 'run-isolation.example'
        }
      });
      await fn(tx, leadId, artifactDir);
      throw new Error('__ROLLBACK__');
    }, { timeout: 120000 });
  } catch (err) {
    if (err.message !== '__ROLLBACK__') throw err;
  }
}

describe('Generation V2 run isolation', () => {
  it('replaces generated entities on regenerate while preserving manual content', async () => {
    await withRollback(async (tx, leadId, artifactDir) => {
      const previewSlug = `run-iso-${leadId.slice(0, 8)}`;

      const run1Content = makeContent({
        navigation: [
          { label: 'Главная', url: 'https://run-isolation.example/', children: [] },
          { label: 'О нас', url: 'https://run-isolation.example/about', children: [] }
        ],
        pages: [
          { title: 'Главная', slug: 'home', sourceUrl: 'https://run-isolation.example/', isHomepage: true, blocks: [] },
          { title: 'О нас', slug: 'about', sourceUrl: 'https://run-isolation.example/about', isHomepage: false, blocks: [] }
        ],
        services: [
          { title: 'Service A', slug: 'service-a', shortDescription: 'A', blocks: [] }
        ]
      });

      const result1 = await importToCms({
        leadId,
        lead: { id: leadId, companyName: 'Run Isolation Test Co', phone: null, address: null },
        siteName: 'Run Isolation Test Co',
        siteSlug: `run-iso-${leadId.slice(0, 8)}`,
        previewSlug,
        templateId: 'construction-modern-v1',
        content: run1Content,
        artifactDir,
        storageBaseUrl: '/redesign-media',
        runId: 'run-1',
        regenerateContent: true
      }, tx);

      const pagesRun1 = await tx.page.findMany({ where: { siteId: result1.siteId } });
      const servicesRun1 = await tx.service.findMany({ where: { siteId: result1.siteId } });
      assert.equal(pagesRun1.length, 2, 'run-1 creates two pages');
      assert.ok(pagesRun1.every((p) => p.generatedByRunId === 'run-1'), 'run-1 pages have ownership');
      assert.equal(servicesRun1.length, 1, 'run-1 creates one service');
      assert.equal(servicesRun1[0].generatedByRunId, 'run-1');

      // Simulate a manual page created in Studio that must not be overwritten/deleted.
      const manualPage = await tx.page.create({
        data: {
          siteId: result1.siteId,
          title: 'Manual Page',
          slug: 'manual-page',
          isHomepage: false,
          status: 'PUBLISHED',
          sourceType: 'MANUAL',
          blocks: []
        }
      });

      const run2Content = makeContent({
        navigation: [
          { label: 'Главная', url: 'https://run-isolation.example/', children: [] },
          { label: 'Контакты', url: 'https://run-isolation.example/contacts', children: [] }
        ],
        pages: [
          { title: 'Главная', slug: 'home', sourceUrl: 'https://run-isolation.example/', isHomepage: true, blocks: [] },
          { title: 'Контакты', slug: 'contacts', sourceUrl: 'https://run-isolation.example/contacts', isHomepage: false, blocks: [] }
        ],
        services: [
          { title: 'Service B', slug: 'service-b', shortDescription: 'B', blocks: [] }
        ]
      });

      const result2 = await importToCms({
        leadId,
        lead: { id: leadId, companyName: 'Run Isolation Test Co', phone: null, address: null },
        siteName: 'Run Isolation Test Co',
        siteSlug: `run-iso-${leadId.slice(0, 8)}`,
        previewSlug,
        templateId: 'construction-modern-v1',
        content: run2Content,
        artifactDir,
        storageBaseUrl: '/redesign-media',
        runId: 'run-2',
        regenerateContent: true
      }, tx);

      assert.equal(result1.siteId, result2.siteId, 'site id stays stable');

      const pagesRun2 = await tx.page.findMany({ where: { siteId: result2.siteId } });
      const servicesRun2 = await tx.service.findMany({ where: { siteId: result2.siteId } });

      assert.equal(pagesRun2.length, 3, 'home + contacts + manual page remain');
      const slugs = pagesRun2.map((p) => p.slug).sort();
      assert.deepEqual(slugs, ['contacts', 'home', 'manual-page']);
      assert.ok(pagesRun2.find((p) => p.slug === 'home')?.generatedByRunId === 'run-2', 'home was reassigned to run-2');
      assert.ok(pagesRun2.find((p) => p.slug === 'contacts')?.generatedByRunId === 'run-2', 'contacts belongs to run-2');
      const manual = pagesRun2.find((p) => p.slug === 'manual-page');
      assert.ok(manual, 'manual page survived');
      assert.equal(manual.generatedByRunId, null, 'manual page does not have generated ownership');

      assert.equal(servicesRun2.length, 1, 'run-2 service replaced run-1 service');
      assert.equal(servicesRun2[0].slug, 'service-b');
      assert.equal(servicesRun2[0].generatedByRunId, 'run-2');
    });
  });

  it('retry mode does not delete unrelated generated content from a different run', async () => {
    await withRollback(async (tx, leadId, artifactDir) => {
      const previewSlug = `run-retry-${leadId.slice(0, 8)}`;

      const run1Content = makeContent({
        navigation: [{ label: 'Главная', url: 'https://run-isolation.example/', children: [] }],
        pages: [{ title: 'Главная', slug: 'home', sourceUrl: 'https://run-isolation.example/', isHomepage: true, blocks: [] }],
        services: [{ title: 'Service A', slug: 'service-a', shortDescription: 'A', blocks: [] }]
      });

      const result1 = await importToCms({
        leadId,
        lead: { id: leadId, companyName: 'Run Isolation Test Co', phone: null, address: null },
        siteName: 'Run Isolation Test Co',
        siteSlug: `run-retry-${leadId.slice(0, 8)}`,
        previewSlug,
        templateId: 'construction-modern-v1',
        content: run1Content,
        artifactDir,
        storageBaseUrl: '/redesign-media',
        runId: 'run-retry-1',
        regenerateContent: true
      }, tx);

      const run2Content = makeContent({
        navigation: [{ label: 'Главная', url: 'https://run-isolation.example/', children: [] }],
        pages: [{ title: 'Главная', slug: 'home', sourceUrl: 'https://run-isolation.example/', isHomepage: true, blocks: [] }]
      });

      // Retry should not remove the unrelated service-a from run-retry-1.
      await importToCms({
        leadId,
        lead: { id: leadId, companyName: 'Run Isolation Test Co', phone: null, address: null },
        siteName: 'Run Isolation Test Co',
        siteSlug: `run-retry-${leadId.slice(0, 8)}`,
        previewSlug,
        templateId: 'construction-modern-v1',
        content: run2Content,
        artifactDir,
        storageBaseUrl: '/redesign-media',
        runId: 'run-retry-2',
        regenerateContent: false
      }, tx);

      const services = await tx.service.findMany({ where: { siteId: result1.siteId } });
      assert.equal(services.length, 1, 'retry mode preserves unrelated generated entities');
      assert.equal(services[0].slug, 'service-a');
      assert.equal(services[0].generatedByRunId, 'run-retry-1');
    });
  });

  it('preserves user-edited generated content on regenerate and imports conflicting new records with disambiguated slugs', async () => {
    await withRollback(async (tx, leadId, artifactDir) => {
      const previewSlug = `run-edit-${leadId.slice(0, 8)}`;

      const run1Content = makeContent({
        navigation: [{ label: 'Home', url: 'https://run-isolation.example/', children: [] }],
        pages: [{ title: 'Home', slug: 'home', sourceUrl: 'https://run-isolation.example/', isHomepage: true, blocks: [] }],
        services: [
          { title: 'Service A', slug: 'service-a', shortDescription: 'A', blocks: [] },
          { title: 'Service B', slug: 'service-b', shortDescription: 'B', blocks: [] }
        ]
      });

      const result1 = await importToCms({
        leadId,
        lead: { id: leadId, companyName: 'Run Isolation Test Co', phone: null, address: null },
        siteName: 'Run Isolation Test Co',
        siteSlug: `run-edit-${leadId.slice(0, 8)}`,
        previewSlug,
        templateId: 'construction-modern-v1',
        content: run1Content,
        artifactDir,
        storageBaseUrl: '/redesign-media',
        runId: 'run-1',
        regenerateContent: true
      }, tx);

      const serviceA = await tx.service.findUnique({ where: { siteId_slug: { siteId: result1.siteId, slug: 'service-a' } } });
      assert.ok(serviceA, 'run-1 generated service-a');
      assert.equal(serviceA.sourceType, 'GENERATED');

      // Simulate a Studio edit of a generated service without flipping sourceType to MANUAL.
      await tx.service.update({
        where: { id: serviceA.id },
        data: { title: 'User Edited Service A', shortDescription: 'Edited by user', manualModifiedAt: new Date() }
      });

      // Run 2 produces an updated service-a and a new service-c.
      const run2Content = makeContent({
        navigation: [{ label: 'Home', url: 'https://run-isolation.example/', children: [] }],
        pages: [{ title: 'Home', slug: 'home', sourceUrl: 'https://run-isolation.example/', isHomepage: true, blocks: [] }],
        services: [
          { title: "Service A'", slug: 'service-a', shortDescription: 'A2', blocks: [] },
          { title: 'Service C', slug: 'service-c', shortDescription: 'C', blocks: [] }
        ]
      });

      const result2 = await importToCms({
        leadId,
        lead: { id: leadId, companyName: 'Run Isolation Test Co', phone: null, address: null },
        siteName: 'Run Isolation Test Co',
        siteSlug: `run-edit-${leadId.slice(0, 8)}`,
        previewSlug,
        templateId: 'construction-modern-v1',
        content: run2Content,
        artifactDir,
        storageBaseUrl: '/redesign-media',
        runId: 'run-2',
        regenerateContent: true
      }, tx);

      assert.equal(result1.siteId, result2.siteId, 'site id stays stable');

      const services = await tx.service.findMany({ where: { siteId: result2.siteId }, orderBy: { slug: 'asc' } });
      const slugs = services.map((s) => s.slug);
      assert.deepEqual(slugs, ['service-a', 'service-a-1', 'service-c'], 'manual service remains and conflicting new record is disambiguated');

      const manual = services.find((s) => s.slug === 'service-a');
      assert.equal(manual.title, 'User Edited Service A', 'user-edited generated service title is preserved');
      assert.equal(manual.shortDescription, 'Edited by user', 'user-edited generated service body is preserved');
      assert.equal(manual.sourceType, 'GENERATED', 'sourceType stays GENERATED to preserve provenance');
      assert.ok(manual.manualModifiedAt, 'manualModifiedAt is set');
      assert.equal(manual.generatedByRunId, 'run-1', 'provenance stays run-1');

      const updated = services.find((s) => s.slug === 'service-a-1');
      assert.equal(updated.title, "Service A'", 'new generated service imported with disambiguated slug');
      assert.equal(updated.generatedByRunId, 'run-2', 'new generated service belongs to run-2');

      const created = services.find((s) => s.slug === 'service-c');
      assert.equal(created.title, 'Service C');
      assert.equal(created.generatedByRunId, 'run-2');
    });
  });
});
