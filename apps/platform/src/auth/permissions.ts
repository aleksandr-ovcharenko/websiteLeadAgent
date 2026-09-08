export interface EffectivePermission {
  name: string;
  scope: 'GLOBAL' | 'PRODUCT' | 'SITE';
  product?: string | null;
  siteId?: string | null;
}

export type ProductArea = 'hub' | 'radar' | 'factory' | 'forge' | 'studio' | 'security';

export function hasPermission(permissions: EffectivePermission[] | undefined, name: string, siteId?: string): boolean {
  if (!permissions) return false;
  return permissions.some((p) => {
    if (p.name !== name) return false;
    if (p.scope === 'GLOBAL') return true;
    if (p.scope === 'SITE' && siteId && p.siteId === siteId) return true;
    return false;
  });
}

export function hasAnyPermission(permissions: EffectivePermission[] | undefined, names: string[], siteId?: string): boolean {
  if (!permissions) return false;
  return permissions.some((p) => {
    if (!names.includes(p.name)) return false;
    if (p.scope === 'GLOBAL') return true;
    if (p.scope === 'SITE' && siteId && p.siteId === siteId) return true;
    return false;
  });
}

export function visibleAreas(permissions: EffectivePermission[] | undefined): ProductArea[] {
  const areas: ProductArea[] = [];
  if (hasAnyPermission(permissions, ['radar.read', 'radar.manage'])) areas.push('radar');
  if (hasAnyPermission(permissions, ['factory.read', 'factory.run'])) areas.push('factory');
  if (hasAnyPermission(permissions, ['forge.read', 'forge.run'])) areas.push('forge');
  if (hasAnyPermission(permissions, ['security.read', 'security.manage'])) areas.push('security');
  if (hasAnyPermission(permissions, ['studio.read', 'studio.edit', 'cms.read', 'cms.edit'])) areas.push('studio');
  return areas;
}

export function siteIdsFor(permissions: EffectivePermission[] | undefined, permission: string): string[] {
  if (!permissions) return [];
  return permissions.filter((p) => p.name === permission && p.scope === 'SITE' && p.siteId).map((p) => p.siteId!);
}
