import type { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import { OSMEnrichmentProvider } from './providers/osm/osmEnrichmentProvider.js';
import { SerpApiEnrichmentProvider } from './providers/serpapi/serpApiEnrichmentProvider.js';
import { DDGEnrichmentProvider } from './providers/ddg/ddgEnrichmentProvider.js';
import { normalizeWebsiteDomain } from '../utils/normalizeWebsiteDomain.js';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function enrichLeads(input: {
  prisma: PrismaClient;
  logger: pino.Logger;
  runId: string;
  leadIds: string[];
}) {
  const { prisma, logger, runId, leadIds } = input;

  const providers = [new OSMEnrichmentProvider()] as Array<{
    enrich: (arg: { lead: any }) => Promise<{ website?: string | null; phone?: string | null; source?: string }>;
  }>;

  if (process.env.SERPAPI_API_KEY) {
    providers.push(new SerpApiEnrichmentProvider(process.env.SERPAPI_API_KEY));
  }

  providers.push(new DDGEnrichmentProvider());

  let enriched = 0;
  let websitesFound = 0;

  for (const leadId of leadIds) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) continue;

    if (lead.website) continue;

    try {
      let website: string | null = null;
      let phone: string | null = null;
      let source: string | undefined;

      for (const provider of providers) {
        const result = await provider.enrich({ lead });
        source = result.source;

        website = result.website ?? null;
        phone = result.phone ?? null;

        if (website || phone) break;
      }

      enriched++;

      const websiteDomain = website ? normalizeWebsiteDomain(website) : null;

      if (website) websitesFound++;

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          website,
          websiteDomain,
          phone,
          enrichmentStatus: 'SUCCESS',
          websiteStatus: website ? 'FOUND' : 'NOT_FOUND'
        }
      });

      logger.info({ runId, leadId: lead.id, websiteFound: Boolean(website), source }, 'enrichment.lead');
    } catch (err) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          enrichmentStatus: 'FAILED'
        }
      });

      logger.warn({ runId, leadId: lead.id, err }, 'enrichment.failed');
    }

    await sleep(1100);
  }

  logger.info({ runId, enriched, websitesFound }, 'enrichment.done');
}
