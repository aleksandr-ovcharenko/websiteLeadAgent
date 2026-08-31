import { extractedContentSchema, type ExtractedContent } from '../../../content-schema/dist/index.js';
import type { CrawledPage } from '../types.js';

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9а-яё\-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || `page-${Date.now()}`;
}

function pickImage(pages: CrawledPage[]): { src: string; alt: string } | undefined {
  for (const p of pages) {
    const img = p.images.find((i) => i.src && !i.src.startsWith('data:'));
    if (img) return img;
  }
  return undefined;
}

export function extractFromCrawl(pages: CrawledPage[], baseUrl: string, navigation?: { label: string; url?: string; children?: any[] }[]): ExtractedContent {
  const homepage = pages[0];
  const companyName = homepage?.title?.split(/[\|—–\-]/)[0]?.trim() ?? '';
  const contacts: any = {};
  const services: any[] = [];
  const projects: any[] = [];
  const news: any[] = [];
  const contentPages: any[] = [];
  const media: any[] = [];
  const seenMedia = new Set<string>();
  const navItems = navigation ?? [];

  for (const p of pages) {
    const path = p.path || toSlug(p.title);
    const isHome = p.url === baseUrl || p.path === 'index';
    const lower = (p.title + ' ' + p.text).toLowerCase();
    const lowerUrl = p.url.toLowerCase();

    const pageRecord: any = {
      title: p.title || companyName,
      slug: isHome ? 'index' : path,
      sourceUrl: p.url,
      isHomepage: isHome,
      seoTitle: p.title || '',
      seoDescription: p.metaDescription || '',
      blocks: [
        { type: 'text', heading: p.h1 || p.title, content: p.text.slice(0, 2000) }
      ]
    };

    if (lowerUrl.includes('contact') || lower.includes('контакт')) {
      contacts.phone = Array.from(p.text.matchAll(/[\+\d\s\-\(\)]{7,20}/g)).map((m) => m[0].trim())[0] ?? undefined;
      contacts.address = p.text.split('\n').slice(0, 3).join(' ').slice(0, 300);
    }

    if (lowerUrl.includes('service') || lower.includes('услуг')) {
      const title = p.h1 || p.title;
      if (title) {
        services.push({
          title,
          slug: toSlug(title),
          shortDescription: p.metaDescription || p.text.slice(0, 200),
          blocks: [{ type: 'text', content: p.text.slice(0, 1500) }],
          sourceUrl: p.url
        });
      }
    }

    if (lowerUrl.includes('project') || lowerUrl.includes('object') || lower.includes('объект')) {
      const title = p.h1 || p.title;
      if (title && !title.toLowerCase().includes('главная')) {
        projects.push({
          title,
          slug: toSlug(title),
          excerpt: p.metaDescription || p.text.slice(0, 250),
          blocks: [{ type: 'text', content: p.text.slice(0, 1500) }],
          sourceUrl: p.url,
          gallery: p.images.slice(0, 8).map((img) => ({
            filename: img.src.split('/').pop() || 'image.jpg',
            sourceUrl: img.src,
            alt: img.alt
          }))
        });
      }
    }

    if (lowerUrl.includes('news') || lowerUrl.includes('novost')) {
      const title = p.h1 || p.title;
      if (title) {
        news.push({
          title,
          slug: toSlug(title),
          excerpt: p.metaDescription || p.text.slice(0, 250),
          blocks: [{ type: 'text', content: p.text.slice(0, 1500) }],
          sourceUrl: p.url
        });
      }
    }

    contentPages.push(pageRecord);

    for (const img of p.images) {
      if (!img.src || img.src.startsWith('data:')) continue;
      const src = new URL(img.src, p.url).toString();
      if (seenMedia.has(src)) continue;
      seenMedia.add(src);
      media.push({
        filename: img.src.split('/').pop() || 'image.jpg',
        sourceUrl: src,
        alt: img.alt
      });
    }
  }

  const result = {
    company: {
      name: companyName,
      address: contacts.address || '',
      phone: contacts.phone || ''
    },
    branding: {
      companyName,
      primaryColor: '#2563EB',
      secondaryColor: '#1E40AF'
    },
    navigation: navItems,
    pages: contentPages,
    services,
    projects,
    news,
    reviews: [],
    contacts,
    media
  };

  return extractedContentSchema.parse(result);
}
