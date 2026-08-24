import type { LeadEnrichmentProvider, LeadEnrichmentResult } from '../../types.js';
import type { Lead } from '@prisma/client';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractFirstResultUrl(html: string): string | null {
  const marker = 'href="//duckduckgo.com/l/?uddg=';
  const idx = html.indexOf(marker);
  if (idx === -1) return null;

  const start = idx + marker.length;
  const end = html.indexOf('"', start);
  if (end === -1) return null;

  const encoded = html.slice(start, end);
  try {
    const decoded = decodeURIComponent(encoded);
    let cleaned = decoded.replaceAll('&amp;', '&');

    cleaned = cleaned.replace(/([?&])rut=[^&#]+/g, '');
    cleaned = cleaned.replace(/&rut=[^&#]+/g, '');

    try {
      const url = new URL(cleaned);
      url.searchParams.delete('rut');
      return url.toString();
    } catch {
      return cleaned;
    }
  } catch {
    return null;
  }
}

function isBadDomain(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();

    const bad = [
      '2gis',
      'yandex',
      'google',
      'facebook.com',
      'instagram.com',
      'vk.com',
      'tiktok.com',
      'youtube.com',
      'maps',
      'wikipedia.org'
    ];

    return bad.some((b) => host.includes(b));
  } catch {
    return true;
  }
}

export class DDGEnrichmentProvider implements LeadEnrichmentProvider {
  async enrich(input: { lead: Lead }): Promise<LeadEnrichmentResult> {
    const { lead } = input;

    const q = `${lead.companyName} ${lead.city} ${lead.address ?? ''} официальный сайт`;

    const url = new URL('https://duckduckgo.com/html/');
    url.searchParams.set('q', q);

    const res = await fetch(url, {
      headers: {
        accept: 'text/html',
        'user-agent': 'minsk-website-lead-agent/0.1 (local)'
      }
    });

    if (!res.ok) return { website: null, phone: null, source: 'ddg' };

    const html = await res.text();

    let candidate = extractFirstResultUrl(html);
    if (candidate && isBadDomain(candidate)) {
      candidate = null;
    }

    await sleep(800);

    return { website: candidate, phone: null, source: 'ddg' };
  }
}
