import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

const DASHBOARD = 'http://localhost:3333';
const CMS = 'http://localhost:3335';

function httpCode(url: string, cookieFile?: string) {
  const cookie = cookieFile ? `-b ${cookieFile}` : '';
  const out = execSync(`curl -s -o /dev/null -w "%{http_code}" ${cookie} "${url}"`, { encoding: 'utf8' });
  return Number(out.trim());
}

function login(email: string) {
  const file = `/tmp/cookie-${email.replace(/[^a-z0-9]/g, '_')}.txt`;
  execSync(
    `curl -s -c ${file} -X POST -d '{"email":"${email}","password":"admin123"}' -H 'Content-Type: application/json' ${DASHBOARD}/api/auth/login > /dev/null`,
    { encoding: 'utf8' }
  );
  return file;
}

describe('Platform authorization', () => {
  it('rejects unauthenticated platform access', () => {
    expect(httpCode(`${DASHBOARD}/api/platform/sites`)).toBe(401);
  });

  it('lets SUPER_ADMIN access platform and all sites', () => {
    const c = login('admin@minsk.local');
    expect(httpCode(`${DASHBOARD}/api/platform/sites`, c)).toBe(200);
  });

  it('rejects SITE_ADMIN from /platform', () => {
    const c = login('site-admin@minsk.local');
    expect(httpCode(`${DASHBOARD}/api/platform/sites`, c)).toBe(403);
  });

  it('lets SITE_ADMIN access assigned site CMS', () => {
    const c = login('site-admin@minsk.local');
    expect(httpCode(`${CMS}/api/cms/sites/site_test_001`, c)).toBe(200);
  });

  it('blocks SITE_ADMIN from other sites via CMS', () => {
    const c = login('site-admin@minsk.local');
    expect(httpCode(`${CMS}/api/cms/sites/non-existent-site`, c)).toBe(403);
  });

  it('lets EDITOR access assigned site CMS', () => {
    const c = login('editor@minsk.local');
    expect(httpCode(`${CMS}/api/cms/sites/site_test_001`, c)).toBe(200);
  });

  it('rejects EDITOR from /platform', () => {
    const c = login('editor@minsk.local');
    expect(httpCode(`${DASHBOARD}/api/platform/sites`, c)).toBe(403);
  });
});
