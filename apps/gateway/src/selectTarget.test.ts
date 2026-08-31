import { describe, it, expect } from 'vitest';
import { selectTarget } from './selectTarget.js';

const platformApi = `http://localhost:${process.env.PLATFORM_API_PORT ?? 3333}`;
const cms = `http://localhost:${process.env.CMS_PORT ?? 3335}`;
const renderer = `http://localhost:${process.env.RENDERER_PORT ?? 3336}`;
const platformWeb = `http://localhost:${process.env.PLATFORM_WEB_PORT ?? 3004}`;

describe('selectTarget routing', () => {
  const cases: [string, string, string][] = [
    ['/radar', platformWeb, '/radar'],
    ['/forge', platformWeb, '/forge'],
    ['/leads', platformWeb, '/leads'],
    ['/sites', platformWeb, '/sites'],
    ['/studio/site-123', platformWeb, '/studio/site-123'],
    ['/studio/site-123?section=pages', platformWeb, '/studio/site-123?section=pages'],
    ['/cms?site=site-123', platformWeb, '/forge'],
    ['/api/cms/sites', cms, '/api/cms/sites'],
    ['/showcase/abc123', renderer, '/showcase/abc123'],
    ['/preview/abc123', renderer, '/preview/abc123'],
    ['/api/leads', platformApi, '/api/leads'],
    ['/audit/site-123/report.json', platformApi, '/audit/site-123/report.json'],
    ['/site-screenshots/site-123.png', platformApi, '/site-screenshots/site-123.png'],
    ['/template-assets/construction-modern-v1/style.css', renderer, '/template-assets/construction-modern-v1/style.css'],
    ['/site-media/site-123/logo.png', renderer, '/site-media/site-123/logo.png'],
  ];

  it.each(cases)('routes %s to %s as %s', (url, expectedTarget, expectedUrl) => {
    const { target, url: rewritten } = selectTarget(url);
    expect(target).toBe(expectedTarget);
    expect(rewritten).toBe(expectedUrl);
  });
});
