import type { Lead } from '@prisma/client';

export interface LeadEnrichmentResult {
  website?: string | null;
  phone?: string | null;
  source?: string;
}

/** Minimal identity a website-resolution provider needs — a Lead satisfies
 *  this shape, and so does a pre-lead discovery candidate. */
export interface EnrichmentSubject {
  companyName: string;
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface LeadEnrichmentProvider {
  enrich(input: { lead: EnrichmentSubject }): Promise<LeadEnrichmentResult>;
}
