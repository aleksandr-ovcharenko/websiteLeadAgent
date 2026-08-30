import { twogisProvider } from './providers/twogis.js';
import { manualProvider } from './providers/manual.js';
import { osmProvider } from './providers/osm.js';
import { ddgProvider } from './providers/ddg.js';
import { yandexProvider } from './providers/yandex.js';
import type { BusinessDiscoveryProvider } from './types.js';

const providers: BusinessDiscoveryProvider[] = [
  twogisProvider,
  manualProvider,
  osmProvider,
  ddgProvider,
  yandexProvider,
];

const byId: Map<string, BusinessDiscoveryProvider> = new Map(providers.map((p) => [p.meta.id, p]));

export function getDiscoveryProvider(id: string): BusinessDiscoveryProvider | undefined {
  return byId.get(id);
}

export function listDiscoveryProviders(): BusinessDiscoveryProvider[] {
  return [...providers];
}
