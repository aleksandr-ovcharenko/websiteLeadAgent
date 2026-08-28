import type { RenderContext } from '../types.js';

export function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function menuItems(ctx: RenderContext): string {
  return ctx.menu
    .filter((item: any) => item.visible)
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
    .map((item: any) => {
      const href = item.page?.slug ? `/${item.page.slug}` : (item.url || '#');
      return `<a href="${escapeHtml(href)}" class="nav-link">${escapeHtml(item.label)}</a>`;
    })
    .join('');
}

export function layout(ctx: RenderContext, body: string): string {
  const s = ctx.settings || {};
  const title = ctx.site?.name || 'Site';
  const primary = s.primaryColor || '#2563EB';
  const secondary = s.secondaryColor || '#1E40AF';
  const seoTitle = `${title}`;
  const seoDescription = s.defaultSeoDescription || '';

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(seoTitle)}</title>
  <meta name="description" content="${escapeHtml(seoDescription)}" />
  <meta name="robots" content="noindex,nofollow" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --color-bg: #F7F7F5;
      --color-surface: #FFFFFF;
      --color-text: #0B1220;
      --color-text-muted: #9CA3AF;
      --color-brand: #B89A5A;
      --color-brand-dark: #8C7340;
      --color-border: #ECECE8;
      --color-hero: #0B1220;
      --color-footer: #0B1220;
      --font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; font-family: var(--font-sans); line-height: 1.6; color: var(--color-text); background: var(--color-bg); }
    a { color: inherit; text-decoration: none; }
    img { max-width: 100%; height: auto; display: block; }
    h1, h2, h3, p { margin: 0; }

    .site-header { background: var(--color-hero); position: sticky; top: 0; z-index: 50; }
    .site-header-inner { max-width: 1440px; margin: 0 auto; padding: 0 64px; display: flex; justify-content: space-between; align-items: center; height: 84px; }
    .logo { font-weight: 600; font-size: 20px; color: #fff; letter-spacing: -0.02em; }
    .nav { display: flex; gap: 32px; }
    .nav-link { color: rgba(255,255,255,0.85); font-weight: 500; font-size: 14px; transition: color .2s; }
    .nav-link:hover { color: #fff; }
    .nav-toggle { display: none; color: #fff; font-weight: 500; font-size: 14px; }

    .hero { background: var(--color-hero); color: #fff; padding: 128px 160px; }
    .hero__tag { color: var(--color-brand); font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 24px; }
    .hero__title { font-size: clamp(36px, 4.2vw, 56px); font-weight: 700; line-height: 1.1; max-width: 680px; margin-bottom: 24px; letter-spacing: -0.02em; }
    .hero__body { color: var(--color-text-muted); font-size: 20px; max-width: 560px; line-height: 1.5; margin-bottom: 32px; }
    .btn { display: inline-flex; padding: 16px 32px; background: var(--color-brand); color: #fff; border-radius: 4px; font-weight: 600; font-size: 16px; transition: background .2s; }
    .btn:hover { background: var(--color-brand-dark); }

    .section { padding: 96px 160px; }
    .section--alt { background: var(--color-bg); }
    .section__title { font-size: 40px; font-weight: 700; line-height: 1.2; margin-bottom: 48px; letter-spacing: -0.02em; }
    .section__subtitle { color: var(--color-text-muted); font-size: 16px; max-width: 640px; margin-bottom: 48px; }

    .container { max-width: 1440px; margin: 0 auto; }

    .services-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
    .service-card { background: var(--color-surface); padding: 28px; border-radius: 4px; }
    .service-card__accent { width: 40px; height: 4px; background: var(--color-brand); margin-bottom: 16px; }
    .service-card__title { font-size: 20px; font-weight: 600; margin-bottom: 12px; }
    .service-card__body { font-size: 14px; color: #4B5563; line-height: 1.5; }

    .projects-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .project-card { display: block; }
    .project-card__thumb { aspect-ratio: 3/2; background: var(--color-border); border-radius: 4px; margin-bottom: 16px; overflow: hidden; }
    .project-card__thumb img { width: 100%; height: 100%; object-fit: cover; }
    .project-card__title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .project-card__meta { font-size: 14px; color: #4B5563; }

    .site-footer { background: var(--color-footer); color: #fff; padding: 64px 160px; }
    .site-footer__title { font-size: 32px; font-weight: 700; margin-bottom: 24px; }
    .site-footer__phone { font-size: 20px; font-weight: 500; margin-bottom: 12px; }
    .site-footer__email { font-size: 16px; color: var(--color-text-muted); margin-bottom: 12px; }
    .site-footer__address { font-size: 14px; color: var(--color-text-muted); }

    .page-body { padding: 96px 160px; min-height: 50vh; }
    .page-body h1 { font-size: 40px; font-weight: 700; margin-bottom: 24px; }
    .page-body p { margin-bottom: 16px; color: #4B5563; }
    .page-body img { margin: 24px 0; border-radius: 4px; }

    @media (max-width: 1200px) {
      .site-header-inner, .hero, .section, .site-footer, .page-body { padding-left: 48px; padding-right: 48px; }
    }
    @media (max-width: 1024px) {
      .services-grid { grid-template-columns: repeat(2, 1fr); }
      .projects-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 768px) {
      .site-header-inner { height: 64px; padding: 0 20px; }
      .nav { display: none; }
      .nav-toggle { display: block; }
      .hero { padding: 80px 20px; }
      .hero__title { font-size: 32px; }
      .hero__body { font-size: 16px; }
      .section { padding: 64px 20px; }
      .section__title { font-size: 28px; }
      .services-grid, .projects-grid { grid-template-columns: 1fr; }
      .site-footer { padding: 48px 20px; }
      .page-body { padding: 48px 20px; }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="site-header-inner">
      <div class="logo">${escapeHtml(title)}</div>
      <nav class="nav">${menuItems(ctx)}</nav>
      <div class="nav-toggle">Меню</div>
    </div>
  </header>
  <main>${body}</main>
  <footer class="site-footer">
    <div class="container">
      <div class="site-footer__title">Контакты</div>
      <div class="site-footer__phone">${escapeHtml(s.phone || '')}</div>
      <div class="site-footer__email">${escapeHtml(s.email || '')}</div>
      <div class="site-footer__address">${escapeHtml(s.address || '')}</div>
    </div>
  </footer>
</body>
</html>`;
}
