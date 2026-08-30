import { createHash } from 'node:crypto';
import type { BusinessDiscoveryProvider, DiscoveryRequest, DiscoverySearchResult, DiscoveryContext, DiscoveryCandidate } from '../types.js';

function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
    const host = url.hostname.toLowerCase();
    const normalized = host.startsWith('www.') ? host.slice(4) : host;
    if (!normalized || normalized === 'localhost') return null;
    return `${url.protocol}//${normalized}`;
  } catch {
    return null;
  }
}

function domainFromUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
    const host = url.hostname.toLowerCase();
    const normalized = host.startsWith('www.') ? host.slice(4) : host;
    return !normalized || normalized === 'localhost' ? null : normalized;
  } catch {
    return null;
  }
}

export const manualProvider: BusinessDiscoveryProvider = {
  meta: {
    id: 'manual',
    name: 'Manual Import',
    capabilities: {
      supportsTextQuery: false,
      supportsLocation: false,
      supportsPagination: false,
      supportsCategories: false,
      supportsCoordinates: false,
      supportsRadius: false,
      supportsManualInput: true,
      requiresCredentials: false,
    },
    config: {
      helpText: 'Paste one or more websites or company|website pairs, one per line',
    },
  },

  isConfigured() {
    return true;
  },

  async search(request, _context): Promise<DiscoverySearchResult> {
    const raw = request.manualEntries?.trim() ?? '';
    if (!raw) {
      return { candidates: [], warning: 'No manual entries provided' };
    }

    const candidates: DiscoveryCandidate[] = [];
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      let companyName = '';
      let website: string | null = null;

      const [partA, partB] = line.split(/[\t|;]/, 2).map((s) => s.trim());

      if (partB) {
        companyName = partA;
        website = normalizeUrl(partB) || normalizeUrl(partA) || null;
      } else {
        website = normalizeUrl(partA);
        companyName = website ? (domainFromUrl(website) || partA) : partA;
      }

      if (!website) {
        continue;
      }

      const websiteDomain = domainFromUrl(website)!;
      const sourceId = `${companyName}:${websiteDomain}`;
      const hashed = createHash('sha1').update(`manual:${sourceId}`).digest('hex').slice(0, 24);

      candidates.push({
        source: 'manual',
        sourceId: hashed,
        data: {
          source: 'manual',
          sourceId: hashed,
          companyName,
          city: request.location || '',
          website,
          websiteDomain,
          websiteStatus: 'FOUND',
        },
      });
    }

    return { candidates };
  },
};
