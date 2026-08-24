import type { Lead } from '@prisma/client';

export interface LeadEnrichmentResult {
  website?: string | null;
  phone?: string | null;
  source?: string;
}

export interface LeadEnrichmentProvider {
  enrich(input: { lead: Lead }): Promise<LeadEnrichmentResult>;
}
