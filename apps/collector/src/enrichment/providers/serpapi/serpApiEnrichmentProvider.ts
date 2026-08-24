import type { LeadEnrichmentProvider, LeadEnrichmentResult } from '../../types.js';
import type { Lead } from '@prisma/client';
import { z } from 'zod';

const serpSchema = z.object({
  organic_results: z
    .array(
      z.object({
        link: z.string().optional()
      })
    )
    .optional()
});

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class SerpApiEnrichmentProvider implements LeadEnrichmentProvider {
  constructor(private readonly apiKey: string) {}

  async enrich(input: { lead: Lead }): Promise<LeadEnrichmentResult> {
    const { lead } = input;

    const q = `${lead.companyName} ${lead.city} ${lead.address ?? ''} официальный сайт`;

    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', q);
    url.searchParams.set('hl', 'ru');
    url.searchParams.set('gl', 'by');
    url.searchParams.set('api_key', this.apiKey);

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) return { website: null, phone: null, source: 'serpapi' };

    const json = await res.json();
    const parsed = serpSchema.safeParse(json);
    if (!parsed.success) return { website: null, phone: null, source: 'serpapi' };

    const link = parsed.data.organic_results?.map((r) => r.link).find((x): x is string => Boolean(x)) ?? null;

    await sleep(200);

    return { website: link, phone: null, source: 'serpapi' };
  }
}
