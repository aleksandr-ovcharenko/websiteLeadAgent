import assert from 'node:assert';
import { selectTarget } from './selectTarget.js';

const platformApi = `http://localhost:${process.env.PLATFORM_API_PORT ?? 3333}`;
const cms = `http://localhost:${process.env.CMS_PORT ?? 3335}`;
const renderer = `http://localhost:${process.env.RENDERER_PORT ?? 3336}`;
const platformWeb = `http://localhost:${process.env.PLATFORM_WEB_PORT ?? 3004}`;

function t(url: string, expectedTarget: string, expectedUrl: string) {
  const { target, url: rewritten } = selectTarget(url);
  assert.equal(target, expectedTarget, `target for ${url}`);
  assert.equal(rewritten, expectedUrl, `rewritten url for ${url}`);
}

// Hub / product areas (and legacy aliases)
t('/radar', platformWeb, '/radar');
t('/forge', platformWeb, '/forge');
t('/leads', platformWeb, '/leads');
t('/sites', platformWeb, '/sites');

// Studio (canonical) and CMS (legacy)
t('/studio/site-123', cms, '/admin?site=site-123');
t('/studio/site-123?section=pages', cms, '/admin?site=site-123&section=pages');
t('/cms?site=site-123', cms, '/admin?site=site-123');
t('/api/cms/sites', cms, '/api/cms/sites');

// Showcase (canonical) and preview (legacy)
t('/showcase/abc123', renderer, '/showcase/abc123');
t('/preview/abc123', renderer, '/preview/abc123');

// Core API + audit/screenshots
t('/api/leads', platformApi, '/api/leads');
t('/audit/site-123/report.json', platformApi, '/audit/site-123/report.json');
t('/site-screenshots/site-123.png', platformApi, '/site-screenshots/site-123.png');

// Renderer assets
t('/template-assets/construction-modern-v1/style.css', renderer, '/template-assets/construction-modern-v1/style.css');
t('/site-media/site-123/logo.png', renderer, '/site-media/site-123/logo.png');

console.log('✓ selectTarget routing tests passed');
