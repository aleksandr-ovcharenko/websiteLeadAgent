import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RenderContext } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function constructionModernV1(ctx: RenderContext): string {
  const html = readFileSync(resolve(__dirname, 'public/index.html'), 'utf-8');
  const companyName = ctx.settings?.companyName || ctx.site?.name || 'Company';
  const phone = ctx.settings?.phone || '+1 000 000-00-00';
  const email = ctx.settings?.email || `info@${ctx.site?.domain || 'example.com'}`;
  const domain = ctx.site?.domain || ctx.site?.slug || 'example.com';
  const address = ctx.settings?.address || '';

  return html
    .replace('<title>', `<meta name="robots" content="noindex, nofollow" />\n    <title>`)
    .replace(/<title>[^<]*<\/title>/, `<title>${companyName}</title>`)
    .replace(/{{COMPANY_NAME}}/g, companyName)
    .replace(/{{COMPANY_NAME_LEGAL}}/g, companyName)
    .replace(/{{DOMAIN}}/g, domain)
    .replace(/{{EMAIL}}/g, email)
    .replace(/{{PHONE}}/g, phone)
    .replace(/{{ADDRESS}}/g, address)
    // Legacy aliases for old/built HTML still containing pilot data
    .replace(/Гарант Качества/g, companyName)
    .replace(/ООО «Гарант Качества»/g, companyName)
    .replace(/garantk\.by/g, domain)
    .replace(/garantk@tut\.by/g, email)
    .replace(/\+375 17 374-15-28/g, phone)
    .replace(/\+375 17 357-15-29/g, phone)
    .replace(/\+375 17 374-15-41/g, phone)
    .replace(/\+375 17 373-15-27/g, phone)
    .replace(/г\. Минск, ул\. Тимирязева, 121\/4/g, address);
}
