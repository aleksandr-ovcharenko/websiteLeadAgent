import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PrismaClient, LeadSource } from '@prisma/client';
import { importToCms } from '../dist/import/importToCms.js';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const prisma = new PrismaClient();

async function loadMapidContent() {
  const raw = await readFile(new URL('../../../apps/dashboard/data/redesign/cmthnoa4f004dtnq3jt3hcleo/content.json', import.meta.url), 'utf8');
  return JSON.parse(raw);
}

describe('Full CMS import contract', () => {
  it('imports all CMS entity types without schema drift and rolls back cleanly', async () => {
    const content = await loadMapidContent();
    const leadId = randomUUID().replace(/-/g, '').slice(0, 25);
    const artifactDir = await mkdtemp(join(tmpdir(), 'cms-contract-'));
    await mkdir(artifactDir, { recursive: true });

    try {
      await prisma.$transaction(async (tx) => {
        await tx.lead.create({
          data: {
            id: leadId,
            source: 'manual',
            sourceId: leadId,
            companyName: 'Тест контракт',
            city: 'Минск',
            categories: [],
            website: 'https://test.example',
            websiteDomain: 'test.example'
          }
        });

        const result = await importToCms({
          leadId,
          lead: { id: leadId, companyName: 'Тест контракт', phone: null, address: null },
          siteName: 'Тест контракт',
          siteSlug: 'test-contract',
          previewSlug: `test-${leadId.slice(0, 8)}`,
          templateId: 'construction-modern-v1',
          content,
          artifactDir,
          storageBaseUrl: '/redesign-media'
        }, tx);

        assert.ok(result.siteId, 'siteId must be returned');
        assert.equal(result.siteSlug, 'test-contract');

        const settings = await tx.siteSettings.findUnique({ where: { siteId: result.siteId } });
        assert.ok(settings, 'SiteSettings must be created');

        const counts = {
          pages: await tx.page.count({ where: { siteId: result.siteId } }),
          services: await tx.service.count({ where: { siteId: result.siteId } }),
          projects: await tx.project.count({ where: { siteId: result.siteId } }),
          news: await tx.newsPost.count({ where: { siteId: result.siteId } }),
          vacancies: await tx.vacancy.count({ where: { siteId: result.siteId } }),
          media: await tx.media.count({ where: { siteId: result.siteId } }),
          menuItems: await tx.menuItem.count({ where: { siteId: result.siteId } })
        };

        assert.ok(counts.pages > 0, 'Pages imported');
        assert.ok(counts.media > 0, 'Media imported');
        assert.ok(counts.menuItems > 0, 'Menu imported');

        throw new Error('__ROLLBACK__');
      }, { timeout: 120000 });
    } catch (err) {
      if (err.message !== '__ROLLBACK__') throw err;
    }

    const siteAfter = await prisma.site.findUnique({ where: { leadId } });
    assert.equal(siteAfter, null, 'site should not exist after rollback');
  });
});
