import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { crawlSite } from '../crawl/crawlSite.js';
import { extractFromCrawl } from '../extract/extractFromCrawl.js';
import { importToCms } from '../import/importToCms.js';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё\-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function randomToken() {
  return Math.random().toString(36).slice(2, 10);
}

export interface GenerateOptions {
  leadId: string;
  templateId?: string;
  force?: boolean;
  prisma?: PrismaClient;
}

export async function generateSite(options: GenerateOptions) {
  const prisma = options.prisma ?? new PrismaClient();
  const templateId = options.templateId ?? 'construction-modern-v1';

  const l = await (prisma as any).lead.findUnique({
    where: { id: options.leadId },
    include: { site: true }
  });
  if (!l) throw new Error(`Lead not found: ${options.leadId}`);

  if (l.manualReviewStatus !== 'GOOD') {
    throw new Error(`Lead ${l.id} is not GOOD (status: ${l.manualReviewStatus})`);
  }

  const lastRun = await (prisma as any).redesignRun.findFirst({
    where: { leadId: l.id },
    orderBy: { createdAt: 'desc' }
  });

  if (!options.force && lastRun && !lastRun.errorMessage) {
    throw new Error(`Redesign already in progress or completed. Use force to rerun.`);
  }

  if (options.force && l.site) {
    await (prisma as any).site.delete({ where: { id: l.site.id } });
  }

  const run = await (prisma as any).redesignRun.create({
    data: {
      leadId: l.id,
      stage: 'SELECTED_FOR_REDESIGN'
    }
  });

  await (prisma as any).lead.update({
    where: { id: l.id },
    data: { redesignStage: 'SELECTED_FOR_REDESIGN' }
  });

  const baseUrl = l.website;
  if (!baseUrl) throw new Error(`Lead has no website: ${l.id}`);

  const artifactDir = join('data', 'redesign', l.id);
  await mkdir(artifactDir, { recursive: true });

  try {
    const crawled = await crawlSite({ baseUrl, maxPages: 15 });

    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: { currentCrawl: crawled as any, stage: 'CONTENT_EXTRACTED' }
    });
    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'CONTENT_EXTRACTED' }
    });

    const content = extractFromCrawl(crawled, baseUrl);
    await writeFile(join(artifactDir, 'content.json'), JSON.stringify(content, null, 2));

    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: { contentJsonPath: join(artifactDir, 'content.json'), stage: 'CONTENT_TRANSFORMED' }
    });
    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'CONTENT_TRANSFORMED' }
    });

    const siteSlugBase = slugify(l.companyName || l.websiteDomain || 'site');
    const siteSlug = `${siteSlugBase}-${l.id.slice(-6)}`;

    const domain = l.websiteDomain || l.website.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const { siteId, previewSlug } = await importToCms({
      leadId: l.id,
      siteName: l.companyName || 'Generated Site',
      siteSlug,
      previewSlug: randomToken(),
      templateId,
      content,
      artifactDir,
      storageBaseUrl: '/redesign-media'
    }, prisma);

    await (prisma as any).site.update({
      where: { id: siteId },
      data: {
        domain,
        status: 'ACTIVE',
        settings: { previewUrl: `http://localhost:3000/showcase/${previewSlug}` }
      } as any
    });

    await (prisma as any).siteSettings.update({
      where: { siteId },
      data: {
        companyName: l.companyName || 'Generated Site',
        phone: l.phone || content.company?.phone,
        email: content.company?.email,
        address: l.address || content.company?.address,
        workingHours: content.company?.workingHours,
        previewUrl: `http://localhost:3000/showcase/${previewSlug}`,
        language: 'ru',
        timezone: 'Europe/Minsk'
      } as any
    });

    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: { siteId, stage: 'SITE_RENDERED' } as any
    });
    await (prisma as any).lead.update({
      where: { id: l.id },
      data: { redesignStage: 'DEMO_GENERATED' } as any
    });

    await (prisma as any).siteBuild.create({
      data: {
        siteId,
        templateId,
        status: 'SUCCESS',
        outputPath: `data/generated/sites/${siteId}`
      } as any
    });

    return { leadId: l.id, siteId, previewSlug, runId: run.id };
  } catch (err: any) {
    await (prisma as any).redesignRun.update({
      where: { id: run.id },
      data: { errorMessage: err?.message || String(err) }
    });
    throw err;
  }
}
