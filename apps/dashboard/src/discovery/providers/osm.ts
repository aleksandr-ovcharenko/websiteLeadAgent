import type { BusinessDiscoveryProvider, DiscoveryRequest, DiscoverySearchResult, DiscoveryContext, DiscoveryCandidate } from '../types.js';

const nominatimResultSchema = {
  async safeParse(response: any) {
    try {
      const json = await response.json();
      if (!Array.isArray(json)) return { data: [] };
      return { data: json.slice(0, 50).map((r: any) => ({
        display_name: String(r.display_name || ''),
        lat: r.lat ? Number(r.lat) : null,
        lon: r.lon ? Number(r.lon) : null,
        osm_type: String(r.osm_type || ''),
        osm_id: Number(r.osm_id) || null,
      })) };
    } catch {
      return { data: [] };
    }
  }
};

export const osmProvider: BusinessDiscoveryProvider = {
  meta: {
    id: 'osm',
    name: 'OSM / Overpass',
    capabilities: {
      supportsTextQuery: true,
      supportsLocation: true,
      supportsPagination: false,
      supportsCategories: true,
      supportsCoordinates: true,
      supportsRadius: true,
      supportsManualInput: false,
      requiresCredentials: false,
    },
    config: {
      helpText: 'Uses Nominatim and Overpass; may be rate-limited',
    },
  },

  isConfigured() {
    return true;
  },

  async search(request, context): Promise<DiscoverySearchResult> {
    const { logger } = context;
    const q = `${request.query} ${request.location || ''}`.trim();
    const limit = Math.min(50, Math.max(1, request.limit));

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('q', q);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('addressdetails', '1');

    try {
      const res = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'user-agent': 'minsk-website-lead-agent/0.1 (local)',
        },
      });

      if (!res.ok) {
        return { candidates: [], warning: `Nominatim HTTP ${res.status}` };
      }

      const parsed = await nominatimResultSchema.safeParse(res);
      const candidates: DiscoveryCandidate[] = parsed.data
        .filter((r: any) => r.display_name && r.osm_id && r.osm_type)
        .map((r: any) => {
          const sourceId = `${r.osm_type}:${r.osm_id}`;
          return {
            source: 'osm',
            sourceId,
            data: {
              source: 'osm',
              sourceId,
              companyName: r.display_name.split(',')[0]?.trim() || sourceId,
              city: request.location || '',
              address: r.display_name,
              latitude: r.lat,
              longitude: r.lon,
              website: null,
              websiteDomain: null,
              websiteStatus: 'UNKNOWN',
            },
          };
        });

      if (!candidates.length) {
        return { candidates: [], warning: 'OSM / Nominatim returned no results' };
      }

      logger.info({ provider: 'osm', count: candidates.length }, 'discovery.osm.ok');
      return { candidates };
    } catch (err: any) {
      logger.warn({ err, provider: 'osm' }, 'discovery.osm.error');
      return { candidates: [], warning: err?.message || 'OSM request failed' };
    }
  },
};
