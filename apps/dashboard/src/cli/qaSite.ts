// wla qa — the single generic post-generation QA runner (V3.7.6 Phase 4).
//
//   npm run qa -- --site-id=<id> [--base-url=<renderer>] [--no-browser]
//
// The route manifest is built from actually imported CMS entities — never a
// hand-written list. For every published route: HTTP status, entity identity,
// payload text mass, technical markers, internal links, image resolution,
// console/page errors, desktop + mobile screenshots. Then the Forge preview
// URL is verified (200 + image/png). Same runner, any site, no code changes.
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pino from 'pino';
import { PrismaClient } from '@prisma/client';
import { runPostRenderQa, buildRouteManifest } from '@minsk/redesign-engine';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (const a of argv.slice(2)) {
    const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? 'true';
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const siteId = args['site-id'];
  if (!siteId) throw new Error('usage: --site-id=<id> [--base-url=<renderer>] [--no-browser]');

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { screenshot: true, demoVariants: { where: { status: 'ACTIVE' } } },
  });
  if (!site) throw new Error(`Site not found: ${siteId}`);
  const variant = site.demoVariants.find((v: any) => v.isPreferred) ?? site.demoVariants[0];
  const previewToken = variant?.previewToken ?? (site as any).previewToken;
  if (!previewToken) throw new Error(`Site ${siteId} has no preview token`);

  const artifactDir = join('data', 'redesign', '_site-qa', siteId);
  await mkdir(artifactDir, { recursive: true });

  const manifest = await buildRouteManifest(prisma, siteId);
  logger.info({ routes: manifest.length }, 'route manifest built from CMS entities');

  const report = await runPostRenderQa({
    siteId,
    previewToken,
    prisma,
    baseUrl: args['base-url'],
    browser: args['no-browser'] !== 'true',
    exhaustive: true,
    artifactDir,
  });

  // Forge preview contract — the published card image must be a real PNG.
  const gateway = (process.env.GATEWAY_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  let forge: { url: string; status: number; contentType: string } | null = null;
  if (site.screenshot?.url) {
    try {
      const r = await fetch(site.screenshot.url.startsWith('http') ? site.screenshot.url : `${gateway}${site.screenshot.url}`);
      forge = { url: site.screenshot.url, status: r.status, contentType: r.headers.get('content-type') ?? '' };
      if (r.status !== 200 || !forge.contentType.includes('image/png')) {
        report.errors.push(`forge preview: HTTP ${r.status} ${forge.contentType}`);
      }
    } catch (e: any) {
      report.errors.push(`forge preview unreachable: ${e?.message || e}`);
    }
  } else {
    report.errors.push('forge preview: no SitePreviewScreenshot row');
  }

  const out = {
    siteId,
    domain: site.domain,
    manifest: manifest.map((r) => ({ route: r.route, kind: r.kind, label: r.label, title: r.title })),
    forgePreview: forge,
    ...report,
  };
  const reportPath = join(artifactDir, 'site-qa-report.json');
  await writeFile(reportPath, JSON.stringify(out, null, 2));

  console.log(JSON.stringify({
    siteId, domain: site.domain,
    routesChecked: report.metrics.routes,
    checks: report.metrics.checks,
    failed: report.metrics.failed,
    internalLinks: report.metrics.internalLinks,
    images: report.metrics.images,
    forgePreview: forge,
    errors: report.errors.slice(0, 30),
    reportPath,
    screenshots: report.screenshots.length,
    verdict: report.errors.length ? 'FAIL' : 'PASS',
  }, null, 2));
  if (report.errors.length) process.exitCode = 1;
}

main()
  .catch((e) => { logger.error({ err: e?.message }, 'qa failed'); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
