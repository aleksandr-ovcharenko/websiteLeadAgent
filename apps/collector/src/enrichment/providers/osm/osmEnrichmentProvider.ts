import type { LeadEnrichmentProvider, LeadEnrichmentResult } from '../../types.js';
import type { Lead } from '@prisma/client';
import { z } from 'zod';

const nominatimResultSchema = z.array(
  z.object({
    osm_type: z.string().optional(),
    osm_id: z.coerce.number().optional(),
    lat: z.string().optional(),
    lon: z.string().optional(),
    display_name: z.string().optional(),
    type: z.string().optional()
  })
);

const overpassResponseSchema = z.object({
  elements: z
    .array(
      z.object({
        tags: z.record(z.string(), z.string()).optional()
      })
    )
    .optional()
});

function pickFirstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const s = v?.trim();
    if (s) return s;
  }
  return null;
}

export class OSMEnrichmentProvider implements LeadEnrichmentProvider {
  async enrich(input: { lead: Lead }): Promise<LeadEnrichmentResult> {
    const { lead } = input;

    if (lead.latitude != null && lead.longitude != null) {
      const tags = await this.fetchTagsAround({
        lat: lead.latitude,
        lon: lead.longitude,
        name: lead.companyName
      });

      const website = pickFirstNonEmpty(tags['contact:website'], tags.website);
      const phone = pickFirstNonEmpty(tags['contact:phone'], tags.phone);

      if (website || phone) {
        return { website, phone, source: 'osm_overpass_around' };
      }
    }

    const query = `${lead.companyName}, ${lead.city}${lead.address ? `, ${lead.address}` : ''}`;

    const osm = await this.resolveOsmObject(query);
    if (!osm) return { website: null, phone: null, source: 'osm' };

    const tags = await this.fetchTags(osm.osmType, osm.osmId);

    const website = pickFirstNonEmpty(tags['contact:website'], tags.website);
    const phone = pickFirstNonEmpty(tags['contact:phone'], tags.phone);

    return { website, phone, source: 'osm' };
  }

  private async resolveOsmObject(query: string): Promise<{ osmType: string; osmId: number } | null> {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '1');

    const res = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'user-agent': 'minsk-website-lead-agent/0.1 (local)'
      }
    });

    if (!res.ok) return null;

    const json = await res.json();
    const parsed = nominatimResultSchema.safeParse(json);
    if (!parsed.success) return null;

    const first = parsed.data[0];
    if (!first?.osm_type || !first.osm_id) return null;

    const osmType = first.osm_type;
    if (osmType !== 'node' && osmType !== 'way' && osmType !== 'relation') return null;

    return { osmType, osmId: first.osm_id };
  }

  private async fetchTags(osmType: string, osmId: number): Promise<Record<string, string>> {
    const typeLetter = osmType === 'node' ? 'n' : osmType === 'way' ? 'w' : 'r';
    const q = `[out:json][timeout:25];(${typeLetter}(${osmId}););out tags;`;

    const url = new URL('https://overpass-api.de/api/interpreter');
    url.searchParams.set('data', q);

    const res = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'user-agent': 'minsk-website-lead-agent/0.1 (local)'
      }
    });

    if (!res.ok) return {};

    const json = await res.json();
    const parsed = overpassResponseSchema.safeParse(json);
    if (!parsed.success) return {};

    const tags = parsed.data.elements?.[0]?.tags;
    return tags ?? {};
  }

  private async fetchTagsAround(input: { lat: number; lon: number; name: string }): Promise<Record<string, string>> {
    const { lat, lon, name } = input;

    const escaped = name.replaceAll('\\', '\\\\').replaceAll('"', '\\"');

    const q =
      `[out:json][timeout:25];` +
      `(` +
      `nwr(around:200,${lat},${lon})[name~"^${escaped}$",i];` +
      `nwr(around:200,${lat},${lon})[name~"${escaped}",i];` +
      `);` +
      `out tags 1;`;

    const url = new URL('https://overpass-api.de/api/interpreter');
    url.searchParams.set('data', q);

    const res = await fetch(url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'minsk-website-lead-agent/0.1 (local)'
      }
    });

    if (!res.ok) return {};

    const json = await res.json();
    const parsed = overpassResponseSchema.safeParse(json);
    if (!parsed.success) return {};

    const tags = parsed.data.elements?.[0]?.tags;
    return tags ?? {};
  }
}
