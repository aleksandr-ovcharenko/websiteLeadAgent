export function normalizeWebsiteDomain(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  try {
    const url = raw.includes('://') ? new URL(raw) : new URL(`https://${raw}`);
    const host = url.hostname.toLowerCase();

    const normalized = host.startsWith('www.') ? host.slice(4) : host;
    if (!normalized || normalized === 'localhost') return null;

    return normalized;
  } catch {
    return null;
  }
}
