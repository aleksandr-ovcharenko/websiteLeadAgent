import type { BusinessDiscoveryProvider, DiscoveryRequest, DiscoverySearchResult, DiscoveryContext, DiscoveryCandidate } from '../types.js';
import { fetch2gisItems, probeContactGroupsAccess, redactDgisItem, type Fetch2gisResult } from '../../../../collector/src/providers/2gis/fetch2gisItems.js';
import { map2gisItemToLeadUpsert } from '../../../../collector/src/providers/2gis/map2gisItemToLeadUpsert.js';

export const DGIS_CONTACT_GROUPS_UNAVAILABLE = 'DGIS_CONTACT_GROUPS_UNAVAILABLE';
export const DGIS_CONTACT_PERMISSION_MISSING = 'DGIS_CONTACT_PERMISSION_MISSING';

export interface TwogisDeps {
  fetchItems?: (input: { apiKey: string; city: string; query: string; page: number; pageSize: number }) => Promise<Fetch2gisResult>;
  probeContactAccess?: (input: { apiKey: string; itemId: string }) => Promise<boolean>;
}

export function createTwogisProvider(deps: TwogisDeps = {}): BusinessDiscoveryProvider {
  const fetchItems = deps.fetchItems ?? ((input) => fetch2gisItems(input));
  const probe = deps.probeContactAccess ?? ((input) => probeContactGroupsAccess(input));

  return {
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
      const pageSize = Math.min(10, limit);

      context.onProgress?.(
        `Effective 2GIS request: query="${query}", location="${city}", limit=${limit}, maxPages=${maxPages}, pageSize=${pageSize}`,
        { provider: 'dgis', endpoint: 'https://catalog.api.2gis.com/3.0/items', query, city, limit, maxPages, pageSize }
      );

      const candidates: DiscoveryCandidate[] = [];
      let warning: string | undefined;
      let contactGroupsSeen = false;
      let firstItemId: string | undefined;
      const rawSample: any[] = [];

      for (let page = 1; page <= maxPages && candidates.length < limit; page++) {
        const remaining = limit - candidates.length;
        const size = Math.min(pageSize, remaining);
        try {
          const { items, contactGroupsPresent, rawItems = [] } = await fetchItems({ apiKey, city, query, page, pageSize: size });
          for (const raw of rawItems.slice(0, 3 - rawSample.length)) rawSample.push(redactDgisItem(raw));
          context.onProgress?.(
            `2GIS page ${page} (pageSize=${size}): HTTP 200, raw=${items.length}, normalized=${Math.min(items.length, remaining)}`,
            { provider: 'dgis', page, pageSize: size, rawCount: items.length, normalizedCount: Math.min(items.length, remaining), contactGroupsPresent }
          );
          if (!items.length) break;
          if (contactGroupsPresent) contactGroupsSeen = true;
          if (!firstItemId && items[0]?.id) firstItemId = items[0].id;

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
          context.onProgress?.(
            `2GIS page ${page} failed: ${warning}`,
            { provider: 'dgis', page, pageSize: size, error: warning }
          );
          break;
        }
      }

      // The key may lack the contact_groups permission: the API silently drops
      // the field (HTTP 200). Confirm with a single byid probe so we report a
      // provider diagnostic instead of pretending every org has no website.
      let contactGroupsUnavailable = false;
      if (candidates.length && !contactGroupsSeen && !warning) {
        const permitted = firstItemId ? await probe({ apiKey, itemId: firstItemId }) : false;
        if (!permitted) {
          contactGroupsUnavailable = true;
          warning = DGIS_CONTACT_GROUPS_UNAVAILABLE;
          context.onProgress?.(
            '2GIS contact_groups unavailable: API key lacks contact permission — provider websites will be resolved via enrichment',
            { provider: 'dgis', reason: DGIS_CONTACT_PERMISSION_MISSING }
          );
        }
      }

      if (!candidates.length && !warning) {
        warning = '2GIS returned no results for this query/location';
      }

      context.onProgress?.(
        `2GIS finished: ${candidates.length} candidate(s), warning=${warning || 'none'}`,
        { provider: 'dgis', totalCandidates: candidates.length, warning }
      );

      return { candidates, warning, rawSample, diagnostics: { contactGroupsUnavailable } };
    },
  };
}

export const twogisProvider = createTwogisProvider();
