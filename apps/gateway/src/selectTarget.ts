import 'dotenv/config';

const targets = {
  platformApi: `http://localhost:${process.env.PLATFORM_API_PORT ?? 3333}`,
  cms: `http://localhost:${process.env.CMS_PORT ?? 3335}`,
  renderer: `http://localhost:${process.env.RENDERER_PORT ?? 3336}`,
  platformWeb: `http://localhost:${process.env.PLATFORM_WEB_PORT ?? 3004}`
};

export function selectTarget(url: string) {
  // CMS API
  if (url.startsWith('/api/cms/')) return { target: targets.cms, url };

  // Platform / Core API and audit/screenshot services
  if (url.startsWith('/api/') || url.startsWith('/audit/') || url.startsWith('/site-screenshots/')) {
    return { target: targets.platformApi, url };
  }

  // Studio: canonical /studio/:siteId -> CMS /admin?site=:siteId
  if (url.startsWith('/studio/')) {
    const m = url.match(/^\/studio\/([^/?]+)(.*)$/);
    if (m) {
      const [, siteId, rest] = m;
      const query = rest.replace(/^\?/, '&');
      return { target: targets.cms, url: '/admin?site=' + encodeURIComponent(siteId) + query };
    }
  }

  // Legacy CMS alias
  if (url.startsWith('/cms')) {
    return { target: targets.cms, url: '/admin' + url.replace(/^\/cms/, '') };
  }

  // Showcase: canonical /showcase/:previewToken and legacy /preview/:token -> renderer
  if (url.startsWith('/showcase/') || url.startsWith('/preview/') || url.startsWith('/template-assets/') || url.startsWith('/site-media/')) {
    return { target: targets.renderer, url };
  }

  // Radar / Forge / Hub are the platform web SPA (with legacy /leads and /sites as aliases)
  return { target: targets.platformWeb, url };
}
