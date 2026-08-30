import type { BusinessDiscoveryProvider, DiscoveryRequest, DiscoverySearchResult } from '../types.js';

export const yandexProvider: BusinessDiscoveryProvider = {
  meta: {
    id: 'yandex',
    name: 'Yandex',
    capabilities: {
      supportsTextQuery: true,
      supportsLocation: true,
      supportsPagination: true,
      supportsCategories: true,
      supportsCoordinates: false,
      supportsRadius: false,
      supportsManualInput: false,
      requiresCredentials: true,
    },
    config: {
      credentialEnv: 'YANDEX_SEARCH_API_KEY',
      helpText: 'Set YANDEX_SEARCH_API_KEY in environment to enable Yandex search',
    },
  },

  isConfigured(env) {
    return Boolean(env.YANDEX_SEARCH_API_KEY && env.YANDEX_SEARCH_API_KEY.length > 0);
  },

  async search(_request, _context): Promise<DiscoverySearchResult> {
    throw new Error('Yandex provider is not configured. Add credentials to enable it.');
  },
};
