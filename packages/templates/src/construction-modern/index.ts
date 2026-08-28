import { escapeHtml, layout } from './layout.js';
import { renderHome } from './home.js';
import { renderPage } from './page.js';
import { renderProjects, renderProject } from './projects.js';
import { renderNews, renderNewsPost } from './news.js';
import { renderServices } from './services.js';
import type { RenderContext } from '../types.js';

export function constructionModern(ctx: RenderContext): string {
  const base = ctx.route || '/';

  if (base === '/' || base === '' || base === 'index') {
    return layout(ctx, renderHome(ctx));
  }
  if (base === 'projects') {
    if (ctx.subRoute) return layout(ctx, renderProject(ctx));
    return layout(ctx, renderProjects(ctx));
  }
  if (base === 'news' || base === 'novosti') {
    if (ctx.subRoute) return layout(ctx, renderNewsPost(ctx));
    return layout(ctx, renderNews(ctx));
  }
  if (base === 'services' || base === 'uslugi') {
    return layout(ctx, renderServices(ctx));
  }
  const page = ctx.pages.find((p: any) => p.slug === base || p.slug === ctx.route);
  if (page) return layout(ctx, renderPage(ctx, page));
  return layout(ctx, `<div class="container"><h1>404</h1></div>`);
}

export { escapeHtml } from './layout.js';
