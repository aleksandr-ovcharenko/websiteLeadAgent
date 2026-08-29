import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RenderContext } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function cleanPhone(input: string): string {
  return (input || '').replace(/[^\d+]/g, '');
}

function formatDateRu(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function textFrom(page: any): string {
  if (!page) return '';
  if (Array.isArray(page.blocks)) {
    return page.blocks.map((b: any) => b.content || b.text || '').join('\n');
  }
  return page.content || '';
}

function findPhoneNumbers(text: string, limit = 10): string[] {
  const matches = text.match(/[+\d\s\-\(\)]{7,24}/g) || [];
  const cleaned = matches
    .map((m) => m.replace(/\s+/g, ' ').trim())
    .filter((m) => /\d/.test(m) && m.replace(/\D/g, '').length >= 7)
    .filter((m, i, arr) => arr.indexOf(m) === i);
  return cleaned.slice(0, limit);
}

function mediaUrl(ctx: RenderContext, id?: string): string | undefined {
  if (!id) return undefined;
  const media = ctx.mediaMap.get(id);
  if (!media) return undefined;
  if (media.sourceUrl && media.sourceUrl.startsWith('http')) return media.sourceUrl;
  const filename = media.filename || media.storagePath?.split('/').pop();
  if (filename) return `/site-media/${ctx.site.id}/${filename}`;
  return undefined;
}

function buildCompany(ctx: RenderContext) {
  const settings = ctx.settings || {};
  const site = ctx.site || {};
  const companyName = settings.companyName || site.name || 'Company';
  const domain = site.domain || site.slug || 'example.com';
  const rawPhone = settings.phone || '+375 17 374-15-28';
  const phone = rawPhone;
  const phoneHref = cleanPhone(rawPhone) ? `tel:${cleanPhone(rawPhone)}` : '#';
  const email = settings.email || `info@${domain}`;
  const tenderEmail = settings.email || email;
  const address = settings.address || '';

  const contactsPage = ctx.pages?.find((p) => p.slug === 'contacts' || /контакт/i.test(p.title || ''));
  const contactsText = textFrom(contactsPage);
  const allPhones = findPhoneNumbers(contactsText || rawPhone);
  const generalPhones = allPhones.slice(0, 2).map((p) => ({ phone: p, href: `tel:${cleanPhone(p)}`, label: 'приёмная' }));
  const procurementPhones = allPhones.slice(2, 4).map((p) => ({ phone: p, href: `tel:${cleanPhone(p)}` }));

  return {
    name: companyName,
    legalName: settings.legalName || `ООО «${companyName}»`,
    unp: settings.unp || '000000000',
    founded: settings.founded || '2000',
    employees: settings.employees || '50+',
    address: {
      zip: '',
      city: '',
      street: address,
      room: '',
      formatted: address
    },
    hours: settings.workingHours || 'Пн–Пт: 9:00–18:00',
    phone,
    phoneHref,
    domain,
    contacts: {
      general: generalPhones.length ? generalPhones : [{ phone, href: phoneHref, label: 'приёмная' }],
      procurement: procurementPhones.length ? procurementPhones : [{ phone, href: phoneHref }],
      email,
      tenderEmail
    }
  };
}

export function constructionModernV1(ctx: RenderContext): string {
  const html = readFileSync(resolve(__dirname, 'public/index.html'), 'utf-8');
  const company = buildCompany(ctx);

  const navItems = ctx.menu && ctx.menu.length > 0
    ? ctx.menu.filter((i) => i.visible !== false).map((i) => i.label).filter(Boolean)
    : ['Главная', 'Услуги', 'Объекты', 'О компании', 'Новости', 'Контакты'];

  const defaultProjectImages = [
    'https://images.unsplash.com/photo-1546414701-81cc6963c67f?w=1400&h=960&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1557761469-f29c6e201784?w=1400&h=960&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1694885169342-909981fb408a?w=900&h=640&fit=crop&auto=format',
    'https://images.unsplash.com/photo-1669003750682-93cf2c65b9ca?w=900&h=640&fit=crop&auto=format'
  ];
  const defaultNewsImage = 'https://images.unsplash.com/photo-1623489254637-a2dd8375243d?w=600&h=400&fit=crop&auto=format';

  const services = (ctx.services || []).map((s, i) => ({
    id: s.id,
    slug: s.slug,
    num: String(i + 1).padStart(2, '0'),
    title: s.title || 'Услуга',
    desc: s.shortDescription || (Array.isArray(s.blocks) ? s.blocks.map((b: any) => b.content || b.text || '').join(' ').slice(0, 240) : ''),
    content: textFrom(s),
    img: mediaUrl(ctx, s.imageId) || defaultProjectImages[i % defaultProjectImages.length]
  }));

  const projects = (ctx.projects || []).map((p, i) => ({
    id: p.id,
    slug: p.slug,
    title: p.title || 'Объект',
    category: p.category || 'Промышленное строительство',
    location: p.location || '',
    status: p.projectStatus || 'Завершён',
    excerpt: p.excerpt || '',
    content: textFrom(p),
    img: mediaUrl(ctx, p.coverImageId) || defaultProjectImages[i % defaultProjectImages.length],
    gallery: (p.projectMedia || []).map((pm: any) => mediaUrl(ctx, pm.media?.id) || pm.media?.sourceUrl).filter(Boolean)
  }));

  const news = (ctx.news || []).map((n) => ({
    id: n.id,
    slug: n.slug,
    date: formatDateRu(n.publishedAt),
    title: n.title || 'Новость',
    excerpt: n.excerpt || '',
    content: textFrom(n),
    coverImageUrl: mediaUrl(ctx, n.coverImageId) || defaultNewsImage
  }));

  const cmsPayload = {
    route: ctx.route,
    subRoute: ctx.subRoute,
    PREVIEW_TOKEN: ctx.site?.previewToken || '',
    SITE_ID: ctx.site?.id || '',
    COMPANY: company,
    NAV_ITEMS: navItems,
    SERVICES: services,
    PROJECTS: projects,
    PROCESS_STEPS: [],
    NEWS_ITEMS: news
  };

  const scriptBlock = `<script>window.__CMS__=${JSON.stringify(cmsPayload)};window.__CMS_ROUTE__=${JSON.stringify({ route: ctx.route, subRoute: ctx.subRoute })};</script>`;

  return html
    .replace('<title>', `<meta name="robots" content="noindex, nofollow" />\n    <title>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${company.name}</title>`)
    .replace(/{{COMPANY_NAME}}/g, company.name)
    .replace(/{{COMPANY_NAME_LEGAL}}/g, company.legalName)
    .replace(/{{DOMAIN}}/g, company.domain)
    .replace(/{{EMAIL}}/g, company.contacts.email)
    .replace(/{{PHONE}}/g, company.phone)
    .replace(/{{ADDRESS}}/g, company.address.street)
    .replace(/<script type="module"/, `${scriptBlock}\n    <script type="module"`);
}
