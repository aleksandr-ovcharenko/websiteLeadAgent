// Final visual acceptance pack: hub screenshot + all 3 variants per site +
// preferred desktop/mobile full-page + one detail page per site.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const OUT = path.resolve('data/redesign/showcase-final-review');
const RENDERER = 'http://localhost:3336';
const HUB = 'http://localhost:3004';
const SITES = {
  lishen: 'cmtprwtqr0004141vvep7t2so',
  puzzlehouse: 'cmtprwuik001z141vn1qnped4',
  sdke: 'cmtprx0el0034141vmoczn0zm',
};

async function shot(page, url, file, { mobile = false } = {}) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  try { await page.evaluate(() => document.fonts?.ready); } catch {}
  await page.waitForTimeout(2200);
  await page.evaluate(async () => { // force lazy content
    await new Promise((r) => { let y = 0; const t = setInterval(() => { y += 600; window.scrollTo(0, y); if (y >= document.body.scrollHeight) { clearInterval(t); r(); } }, 60); });
    window.scrollTo(0, 0);
  }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: file, fullPage: true });
  console.log('  shot', path.basename(file), url);
}

async function main() {
  for (const k of Object.keys(SITES)) fs.mkdirSync(path.join(OUT, k), { recursive: true });
  const browser = await chromium.launch();

  // ── Hub ──
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
    // session cookie via API (cookie is host-scoped to localhost, works across ports)
    const lr = await ctx.request.post(`${HUB}/api/auth/login`, { data: { email: 'admin@minsk.local', password: 'admin123' } });
    console.log('login:', lr.status(), (await lr.text()).slice(0, 120));
    const page = await ctx.newPage();
    await page.goto(`${HUB}/forge`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, 'hub.png'), fullPage: true });
    console.log('hub.png captured');
    await ctx.close();
  }

  if (process.env.HUB_ONLY) { await browser.close(); await prisma.$disconnect(); console.log('HUB_ONLY done'); return; }
  // ── per-site captures ──
  const summary = {};
  for (const [key, siteId] of Object.entries(SITES)) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { demoVariants: { orderBy: { createdAt: 'desc' }, take: 3 } },
    });
    if (!site) { console.log(key, 'site missing'); continue; }
    const variants = site.demoVariants.slice(0, 3);
    const preferred = (site.preferredDemoVariantId && variants.find((v) => v.id === site.preferredDemoVariantId))
      || (await prisma.demoVariant.findUnique({ where: { id: site.preferredDemoVariantId || '' } }).catch(() => null))
      || variants.find((v) => v.isPreferred) || variants[0];
    summary[key] = { siteId, variants: variants.map((v) => ({ id: v.id, name: v.name, preset: (v.themeConfig || {}).stylePreset, isPreferred: v.id === preferred?.id })), preferredId: preferred?.id };

    const dir = path.join(OUT, key);
    // all 3 variants, desktop
    let n = 0;
    for (const v of variants) {
      n += 1;
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
      const page = await ctx.newPage();
      await shot(page, `${RENDERER}/preview/${v.previewToken}`, path.join(dir, `variant-${n}-desktop.png`));
      await ctx.close();
    }
    // preferred desktop + mobile
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
      const page = await ctx.newPage();
      await shot(page, `${RENDERER}/preview/${preferred.previewToken}`, path.join(dir, 'preferred-desktop-full.png'));
      await ctx.close();
      const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
      const mp = await mctx.newPage();
      await shot(mp, `${RENDERER}/preview/${preferred.previewToken}`, path.join(dir, 'preferred-mobile-full.png'), { mobile: true });
      await mctx.close();
    }
    // detail page: first project (lishen/sdke) or product (puzzlehouse)
    const coll = key === 'puzzlehouse' ? 'product' : 'project';
    const detail = coll === 'product'
      ? await prisma.product.findFirst({ where: { siteId, status: 'PUBLISHED' }, select: { slug: true } })
      : await prisma.project.findFirst({ where: { siteId, status: 'PUBLISHED' }, select: { slug: true } });
    if (detail) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
      const page = await ctx.newPage();
      await shot(page, `${RENDERER}/preview/${preferred.previewToken}/${coll === 'product' ? 'products' : 'projects'}/${detail.slug}`, path.join(dir, `${coll}-detail.png`));
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(summary, null, 2));
  await browser.close();
  await prisma.$disconnect();
  console.log('DONE', JSON.stringify(summary, null, 1).slice(0, 1500));
}
main().catch((e) => { console.error(e); process.exit(1); });
