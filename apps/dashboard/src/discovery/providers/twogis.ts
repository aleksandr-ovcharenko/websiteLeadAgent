import type { BusinessDiscoveryProvider, DiscoveryRequest, DiscoverySearchResult, DiscoveryContext, DiscoveryCandidate } from '../types.js';
import { fetch2gisItems } from '../../../../collector/src/providers/2gis/fetch2gisItems.js';
import { map2gisItemToLeadUpsert } from '../../../../collector/src/providers/2gis/map2gisItemToLeadUpsert.js';

export const twogisProvider: BusinessDiscoveryProvider = {
  meta: {
    id: 'dgis',
    name: '2GIS',
    capabilities: {
      supportsTextQuery: true,
      supportsLocation: true,
      supportsPagination: true,
      supportsCategories: true,
      supportsCoordinates: true,
      supportsRadius: false,
      supportsManualInput: false,
      requiresCredentials: true,
    },
    config: {
      credentialEnv: 'DGIS_API_KEY',
      helpText: 'Set DGIS_API_KEY in environment',
    },
  },

  isConfigured(env) {
    return Boolean(env.DGIS_API_KEY && env.DGIS_API_KEY.length > 0);
  },

  async search(request, context): Promise<DiscoverySearchResult> {
    const { env, logger } = context;
    const apiKey = env.DGIS_API_KEY;
    if (!apiKey) {
      throw new Error('2GIS is not configured: DGIS_API_KEY is missing');
    }

    const city = request.location || '';
    const query = request.query;
    const limit = Math.min(200, Math.max(1, request.limit));
    const maxPages = Math.min(20, Math.max(1, request.maxPages ?? 5));
    const pageSize = Math.min(32, limit);

    const candidates: DiscoveryCandidate[] = [];
    let warning: string | undefined;

    for (let page = 1; page <= maxPages && candidates.length < limit; page++) {
      const remaining = limit - candidates.length;
      const size = Math.min(pageSize, remaining);
      try {
        const items = await fetch2gisItems({ apiKey, city, query, page, pageSize: size });
        if (!items.length) break;

        for (const item of items) {
          const mapped = map2gisItemToLeadUpsert({ city, query, item });
          candidates.push({
            source: 'dgis',
            sourceId: mapped.sourceId,
            data: mapped.create,
          });
          if (candidates.length >= limit) break;
        }
      } catch (err: any) {
        warning = err?.message || '2GIS request failed';
        logger.warn({ err, provider: 'dgis', page }, 'discovery.2gis.page.error');
        break;
      }
    }

    if (!candidates.length && !warning) {
      warning = '2GIS returned no results for this query/location';
    }

    return { candidates, warning };
  },
};
