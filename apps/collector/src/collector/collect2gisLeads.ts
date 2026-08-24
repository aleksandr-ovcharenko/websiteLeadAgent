import type pino from 'pino';
import type { PrismaClient, LeadSource } from '@prisma/client';
import { fetch2gisItems } from '../providers/2gis/fetch2gisItems.js';
import { map2gisItemToLeadUpsert } from '../providers/2gis/map2gisItemToLeadUpsert.js';

export interface Collect2gisLeadsInput {
  prisma: PrismaClient;
  logger: pino.Logger;
  runId: string;
  city: string;
  query: string;
  limit: number;
  apiKey: string;
}

export interface Collect2gisLeadsResult {
  collected: number;
  created: number;
  duplicates: number;
}

const SOURCE: LeadSource = 'dgis';

export async function collect2gisLeads(input: Collect2gisLeadsInput): Promise<Collect2gisLeadsResult> {
  const { prisma, logger, runId, city, query, limit, apiKey } = input;

  const pageSize = Math.min(10, limit);
  const maxPages = 5;

  let collected = 0;
  let created = 0;
  let duplicates = 0;

  for (let page = 1; page <= maxPages && collected < limit; page++) {
    const items = await fetch2gisItems({ apiKey, city, query, page, pageSize });

    if (items.length === 0) break;

    for (const item of items) {
      if (collected >= limit) break;

      collected++;
      const upsert = map2gisItemToLeadUpsert({ city, query, item });

      const existing = await prisma.lead.findUnique({
        where: {
          source_sourceId: {
            source: SOURCE,
            sourceId: upsert.sourceId
          }
        },
        select: { id: true }
      });

      const lead = await prisma.lead.upsert({
        where: {
          source_sourceId: {
            source: SOURCE,
            sourceId: upsert.sourceId
          }
        },
        create: {
          ...upsert.create
        },
        update: {
          ...upsert.update
        },
        select: { id: true }
      });

      if (existing) duplicates++;
      else created++;

      await prisma.leadQuery.upsert({
        where: {
          leadId_query: {
            leadId: lead.id,
            query
          }
        },
        create: {
          leadId: lead.id,
          query
        },
        update: {}
      });
    }

    logger.info({ runId, query, page, pageSize, received: items.length, collected }, 'collector.page');
  }

  return { collected, created, duplicates };
}
