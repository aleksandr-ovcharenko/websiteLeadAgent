import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { crawlSite } from '../crawl/crawlSite.js';
import { extractFromCrawl } from '../extract/extractFromCrawl.js';
import { importToCms } from '../import/importToCms.js';
import { validateGeneratedSite } from './validateSite.js';
function slugify(input) {
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
export async function generateSite(options) {
    const prisma = options.prisma ?? new PrismaClient();
    const templateId = options.templateId ?? 'construction-modern-v1';
    const onActivity = options.onActivity;
    const emit = async (level, eventType, message, details) => {
        if (onActivity)
            await onActivity({ module: 'FACTORY', eventType, message, details, level }).catch(() => { });
    };
    const l = await prisma.lead.findUnique({
        where: { id: options.leadId },
        include: { site: true }
    });
    if (!l)
        throw new Error(`Lead not found: ${options.leadId}`);
    await emit('INFO', 'FACTORY_STARTED', 'Starting site generation', { leadId: l.id });
    if (l.manualReviewStatus !== 'GOOD') {
        throw new Error(`Lead ${l.id} is not GOOD (status: ${l.manualReviewStatus})`);
    }
    const lastRun = await prisma.redesignRun.findFirst({
        where: { leadId: l.id },
        orderBy: { createdAt: 'desc' }
    });
    if (!options.force && lastRun && !lastRun.errorMessage) {
        throw new Error(`Redesign already in progress or completed. Use force to rerun.`);
    }
    if (options.force && l.site) {
        await prisma.site.delete({ where: { id: l.site.id } });
    }
    const run = await prisma.redesignRun.create({
        data: {
            leadId: l.id,
            stage: 'SELECTED_FOR_REDESIGN'
        }
    });
    await prisma.lead.update({
        where: { id: l.id },
        data: { redesignStage: 'SELECTED_FOR_REDESIGN' }
    });
    const baseUrl = l.website;
    if (!baseUrl)
        throw new Error(`Lead has no website: ${l.id}`);
    const artifactDir = join('data', 'redesign', l.id);
    await mkdir(artifactDir, { recursive: true });
    try {
        await emit('INFO', 'FACTORY_CRAWL_STARTED', 'Crawling source website', { baseUrl });
        const { pages: crawled, navigation } = await crawlSite({ baseUrl, maxPages: 40, maxDepth: 4 });
        await emit('INFO', 'FACTORY_CRAWL_COMPLETED', `Crawled ${crawled.length} pages`, { pages: crawled.length });
        await prisma.redesignRun.update({
            where: { id: run.id },
            data: { currentCrawl: crawled, stage: 'CONTENT_EXTRACTED' }
        });
        await prisma.lead.update({
            where: { id: l.id },
            data: { redesignStage: 'CONTENT_EXTRACTED' }
        });
        const content = extractFromCrawl(crawled, baseUrl, navigation);
        await writeFile(join(artifactDir, 'content.json'), JSON.stringify(content, null, 2));
        await emit('INFO', 'FACTORY_CONTENT_TRANSFORMED', 'Content extracted and transformed', { pages: content?.pages?.length ?? 0 });
        await prisma.redesignRun.update({
            where: { id: run.id },
            data: { contentJsonPath: join(artifactDir, 'content.json'), stage: 'CONTENT_TRANSFORMED' }
        });
        await prisma.lead.update({
            where: { id: l.id },
            data: { redesignStage: 'CONTENT_TRANSFORMED' }
        });
        const siteSlugBase = slugify(l.companyName || l.websiteDomain || 'site');
        const siteSlug = `${siteSlugBase}-${l.id.slice(-6)}`;
        const domain = l.websiteDomain || l.website.replace(/^https?:\/\//, '').replace(/\/$/, '');
        await emit('INFO', 'FACTORY_CMS_IMPORT_STARTED', 'Importing to CMS');
        const { siteId, previewSlug, demoVariantId } = await importToCms({
            leadId: l.id,
            siteName: l.companyName || 'Generated Site',
            siteSlug,
            previewSlug: randomToken(),
            templateId,
            content,
            artifactDir,
            storageBaseUrl: '/redesign-media'
        }, prisma);
        await emit('INFO', 'FACTORY_CMS_IMPORT_COMPLETED', 'CMS import completed', { siteId, demoVariantId, previewSlug });
        await prisma.site.update({
            where: { id: siteId },
            data: {
                domain,
                status: 'ACTIVE',
                settings: { previewUrl: `http://localhost:3000/showcase/${previewSlug}` }
            }
        });
        await prisma.siteSettings.update({
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
            }
        });
        await prisma.redesignRun.update({
            where: { id: run.id },
            data: { siteId, stage: 'SITE_RENDERED' }
        });
        await prisma.lead.update({
            where: { id: l.id },
            data: { redesignStage: 'DEMO_GENERATED' }
        });
        await prisma.siteBuild.create({
            data: {
                siteId,
                demoVariantId,
                templateId,
                status: 'SUCCESS',
                outputPath: `data/generated/sites/${siteId}`
            }
        });
        await prisma.redesignRun.update({
            where: { id: run.id },
            data: { stage: 'AUDIT_DONE' }
        });
        await prisma.lead.update({
            where: { id: l.id },
            data: { redesignStage: 'AUDIT_DONE' }
        });
        const validation = await validateGeneratedSite({ siteId, prisma });
        if (!validation.ok) {
            await emit('ERROR', 'FACTORY_VALIDATION_FAILED', 'Demo generation validation failed', { missing: validation.missing });
            throw new Error(`Demo generation incomplete: ${validation.missing.join(', ')}`);
        }
        await emit('INFO', 'FACTORY_VALIDATION_PASSED', 'Demo validation passed', { siteId });
        await prisma.redesignRun.update({
            where: { id: run.id },
            data: { stage: 'DEMO_GENERATED' }
        });
        await prisma.lead.update({
            where: { id: l.id },
            data: { redesignStage: 'DEMO_GENERATED' }
        });
        await emit('INFO', 'FACTORY_COMPLETED', 'Site generation completed', { siteId, previewSlug });
        return { leadId: l.id, siteId, previewSlug, runId: run.id, validation };
    }
    catch (err) {
        await emit('ERROR', 'FACTORY_FAILED', `Site generation failed: ${err?.message || String(err)}`, { error: err?.message || String(err) });
        await prisma.redesignRun.update({
            where: { id: run.id },
            data: { errorMessage: err?.message || String(err) }
        });
        throw err;
    }
}
