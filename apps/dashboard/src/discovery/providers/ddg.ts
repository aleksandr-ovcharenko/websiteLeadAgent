import type { BusinessDiscoveryProvider, DiscoveryRequest, DiscoverySearchResult } from '../types.js';

export const ddgProvider: BusinessDiscoveryProvider = {
  meta: {
    id: 'ddg',
    name: 'DuckDuckGo HTML',
    capabilities: {
      supportsTextQuery: true,
      supportsLocation: false,
      supportsPagination: true,
      supportsCategories: false,
      supportsCoordinates: false,
      supportsRadius: false,
      supportsManualInput: false,
      requiresCredentials: false,
    },
    config: {
      helpText: 'DuckDuckGo HTML discovery is not yet implemented; marked as available for future use',
    },
  },

  isConfigured() {
    return true;
  },

  async search(): Promise<DiscoverySearchResult> {
    return {
      candidates: [],
      warning: 'DuckDuckGo HTML discovery is a reserved adapter; multi-result extraction is not implemented yet',
    };
  },
};
