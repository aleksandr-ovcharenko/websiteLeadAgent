import type { PrismaClient, Prisma } from '@prisma/client';
import type pino from 'pino';

export interface DiscoveryCapabilities {
  supportsTextQuery: boolean;
  supportsLocation: boolean;
  supportsPagination: boolean;
  supportsCategories: boolean;
  supportsCoordinates: boolean;
  supportsRadius: boolean;
  supportsManualInput: boolean;
  requiresCredentials: boolean;
}

export interface DiscoveryProviderConfig {
  credentialEnv?: string;
  helpText?: string;
}

export interface DiscoveryProviderMeta {
  id: string;
  name: string;
  capabilities: DiscoveryCapabilities;
  config: DiscoveryProviderConfig;
}

export interface DiscoveryRequest {
  provider: string;
  query: string;
  topic?: string;
  location?: string;
  limit: number;
  maxPages?: number;
  providerOptions?: Record<string, any>;
  manualEntries?: string;
}

export interface DiscoveryCandidate {
  source: 'dgis' | 'manual' | 'osm' | 'ddg' | 'yandex';
  sourceId: string;
  data: Prisma.LeadCreateInput;
}

export interface DiscoverySearchResult {
  candidates: DiscoveryCandidate[];
  warning?: string;
}

export interface DiscoveryContext {
  prisma: PrismaClient;
  logger: pino.Logger;
  env: Record<string, string | undefined>;
  onProgress?: (message: string, metadata?: Record<string, any>) => void;
}

export interface BusinessDiscoveryProvider {
  meta: DiscoveryProviderMeta;
  isConfigured(env: Record<string, string | undefined>): boolean;
  search(request: DiscoveryRequest, context: DiscoveryContext): Promise<DiscoverySearchResult>;
}
