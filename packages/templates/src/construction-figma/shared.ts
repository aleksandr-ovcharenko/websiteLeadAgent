import type { RenderContext } from '../types.js';
import { escapeHtml } from './layout.js';

export function mediaUrl(ctx: RenderContext, mediaId: string): string {
  const m = ctx.mediaMap.get(mediaId);
  if (!m) return '';
  const leadId = ctx.site?.leadId || 'shared';
  return `/redesign-media/${leadId}/${m.filename}`;
}

export function renderText(content: string): string {
  return escapeHtml(content).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>');
}

export function renderBlocks(ctx: RenderContext, blocks: any[]): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  return blocks.map((b: any) => {
    switch (b.type) {
      case 'hero':
        return `<section class="hero">
          <div class="hero__tag">${escapeHtml(b.tag || '')}</div>
          <h1 class="hero__title">${escapeHtml(b.title || '')}</h1>
          ${b.body ? `<p class="hero__body">${escapeHtml(b.body)}</p>` : ''}
          ${b.buttonLabel && b.buttonUrl ? `<a class="btn" href="${escapeHtml(b.buttonUrl)}">${escapeHtml(b.buttonLabel)}</a>` : ''}
        </section>`;
      case 'text':
        return `<section class="section">
          <div class="container">
            ${b.heading ? `<h2>${escapeHtml(b.heading)}</h2>` : ''}
            <p>${renderText(b.content || '')}</p>
          </div>
        </section>`;
      case 'image':
        return `<section class="section"><div class="container"><img src="${mediaUrl(ctx, b.imageId)}" alt="${escapeHtml(b.caption || '')}" /></div></section>`;
      case 'gallery':
        return `<section class="section">
          <div class="container grid">
            ${(b.imageIds || []).map((id: string) => `<img src="${mediaUrl(ctx, id)}" alt="" />`).join('')}
          </div>
        </section>`;
      case 'cta':
        return `<section class="hero" style="padding:64px 16px;">
          <div class="container" style="text-align:center;">
            <h2>${escapeHtml(b.title || '')}</h2>
            ${b.description ? `<p>${escapeHtml(b.description)}</p>` : ''}
            ${b.buttonLabel && b.buttonUrl ? `<a class="btn" href="${escapeHtml(b.buttonUrl)}">${escapeHtml(b.buttonLabel)}</a>` : ''}
          </div>
        </section>`;
      case 'contacts':
        return `<section class="section"><div class="container"><h2>${escapeHtml(b.heading || 'Контакты')}</h2>
          <p>${escapeHtml(ctx.settings?.phone || '')}</p>
          <p>${escapeHtml(ctx.settings?.email || '')}</p>
          <p>${escapeHtml(ctx.settings?.address || '')}</p>
        </div></section>`;
      case 'services':
        return renderServicesBlock(ctx, b.limit);
      case 'projects':
        return renderProjectsBlock(ctx, b.limit);
      case 'news':
        return renderNewsBlock(ctx, b.limit);
      case 'reviews':
        return `<section class="section"><div class="container"><h2>Отзывы</h2><div class="grid">${(b.reviews || []).map((r: any) => `<div class="card"><p>"${escapeHtml(r.text)}"</p><p class="muted">— ${escapeHtml(r.author || '')}</p></div>`).join('')}</div></div></section>`;
      default:
        return '';
    }
  }).join('');
}

function renderServicesBlock(ctx: RenderContext, limit?: number) {
  const items = ctx.services.slice(0, limit ?? 4);
  if (items.length === 0) return '';
  return `<section class="section section--alt"><div class="container">
    <h2 class="section__title">Услуги</h2>
    <div class="services-grid">
      ${items.map((s: any) => `<div class="service-card">
        <div class="service-card__accent"></div>
        <div class="service-card__title">${escapeHtml(s.title)}</div>
        <div class="service-card__body">${escapeHtml(s.shortDescription || '')}</div>
      </div>`).join('')}
    </div>
  </div></section>`;
}

function renderProjectsBlock(ctx: RenderContext, limit?: number) {
  const items = ctx.projects.slice(0, limit ?? 3);
  if (items.length === 0) return '';
  return `<section class="section"><div class="container">
    <h2 class="section__title">Реализованные объекты</h2>
    <div class="projects-grid">
      ${items.map((p: any) => `<a class="project-card" href="/projects/${escapeHtml(p.slug)}">
        <div class="project-card__thumb">
          ${p.featuredImageId ? `<img src="${mediaUrl(ctx, p.featuredImageId)}" alt="${escapeHtml(p.title)}" />` : ''}
        </div>
        <div class="project-card__title">${escapeHtml(p.title)}</div>
        <div class="project-card__meta">${escapeHtml(p.location || '')}</div>
      </a>`).join('')}
    </div>
  </div></section>`;
}

function renderNewsBlock(ctx: RenderContext, limit?: number) {
  const items = ctx.news.slice(0, limit ?? 6);
  if (items.length === 0) return '';
  return `<section class="section section-alt"><div class="container"><h2>Новости</h2><div class="grid">
    ${items.map((n: any) => `<a class="card" href="/news/${escapeHtml(n.slug)}">
      <h3>${escapeHtml(n.title)}</h3>
      <p class="muted">${escapeHtml(n.excerpt || '')}</p>
    </a>`).join('')}
  </div></div></section>`;
}
