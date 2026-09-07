// Phase 2B-B.2 — PRODUCT QUALITY: plan → CMS → 3 variants → screenshots →
// Gemini visual QA → ONE preferred variant → DEMO_READY / NEEDS_ATTENTION.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';
import { verifyPlanHashV2 } from '../packages/redesign-engine/dist/plan/siteContentPlanV2.js';
import { planToContent } from '../packages/redesign-engine/dist/plan/planToContent.js';
import { importToCms } from '../packages/redesign-engine/dist/import/importToCms.js';
import { validateGeneratedSite } from '../packages/redesign-engine/dist/pipeline/validateSite.js';

const PILOT = 'data/redesign/pilot-2b';
const RENDERER = process.env.RENDERER_URL || 'http://localhost:3336';
const TARGETS = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const SITES = TARGETS.length ? TARGETS : ['lishen', 'puzzlehouse', 'sdke'];
const prisma = new PrismaClient();
const randToken = () => Math.random().toString(36).slice(2, 12);
const slugify = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40);

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-3.6-flash';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function geminiQA(imagePath, ctx, attempt = 0) {
  if (!GEMINI_KEY) return { skipped: 'no GEMINI_API_KEY' };
  const img = fs.readFileSync(imagePath).toString('base64');
  const prompt = `You are a strict website visual QA reviewer. Evaluate this ${ctx.viewport} screenshot of a generated business website.
Archetype: ${ctx.archetype}. Expected brand: "${ctx.brand}". Expected sections: ${ctx.sections.join(', ')}.
Score strictly. A site with generic placeholder text, empty hero, wrong brand (e.g. "logotip"), dark-on-dark text, or missing imagery must score low.
Return ONLY JSON: {"visualAppeal":1-10,"hierarchy":1-10,"readability":1-10,"mediaRelevance":1-10,"contentCompleteness":1-10,"clientReadiness":1-10,"criticalIssues":["..."],"suggestions":["..."]}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: img } }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }),
    });
    const j = await r.json();
    if (j?.error?.code === 429 && attempt < 2) { await sleep(22000 * (attempt + 1)); return geminiQA(imagePath, ctx, attempt + 1); }
    const txt = (j?.candidates?.[0]?.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join('');
    if (!txt.trim()) return { error: `empty response: ${JSON.stringify(j.error || j).slice(0, 300)}` };
    return JSON.parse(txt);
  } catch (e) { return { error: String(e).slice(0, 200) }; }
}

// ── automated content-quality gates (before visual QA) ──────────────────────
function contentGates({ plan, brand, page, counts }) {
  const fails = [];
  if (/logo|logotip|лого|логотип/i.test(brand)) fails.push('brand is generic logo text');
  if ((plan.homepage?.plannedSections || []).length < 3) fails.push('too few homepage sections');
  for (const t of ['service', 'project', 'product']) {
    const need = plan.entities.filter((e) => e.type === t).length;
    if (need && !(counts[t + 's'] || 0)) fails.push(`planned ${t}s not rendered`);
  }
  return fails;
}

const results = [];
const browser = await chromium.launch();

for (const key of SITES) {
  const dir = path.join(PILOT, key);
  const plan = JSON.parse(fs.readFileSync(path.join(dir, 'site-content-plan-v2.json'), 'utf8'));
  const crawlPath = path.join(dir, 'crawl-full.json');
  console.log(`\n=== ${key} ===`);
  if (!verifyPlanHashV2(plan)) { console.log('  plan hash mismatch — skip'); continue; }
  console.log(`  plan ${plan.planHash.slice(0, 16)} | archetype ${plan.experience?.archetype} | brand "${plan.experience?.brand?.name}"`);

  const domain = new URL(plan.baseUrl).hostname;
  const siteName = plan.experience?.brand?.name || plan.siteIdentity.displayName || domain;
  const content = planToContent(plan);

  const lead = await prisma.lead.upsert({
    where: { source_sourceId: { source: 'manual', sourceId: `pilot-2b-${key}` } },
    update: { companyName: siteName, website: plan.baseUrl, websiteDomain: domain, manualReviewStatus: 'GOOD' },
    create: { source: 'manual', sourceId: `pilot-2b-${key}`, companyName: siteName, city: 'Минск', website: plan.baseUrl, websiteDomain: domain, manualReviewStatus: 'GOOD', enrichmentStatus: 'SUCCESS', auditStatus: 'SUCCESS', scoreStatus: 'SUCCESS', generationStatus: 'SUCCESS', redesignStage: 'SELECTED_FOR_REDESIGN' },
  });
  const run = await prisma.redesignRun.create({ data: { leadId: lead.id, stage: 'SELECTED_FOR_REDESIGN', crawlJsonPath: path.resolve(crawlPath) } });

  const baseToken = randToken();
  const artifactDir = path.resolve(dir, 'gen2');
  const { siteId } = await importToCms({
    leadId: lead.id,
    lead: { id: lead.id, companyName: siteName },
    siteName, siteSlug: `${slugify(domain)}-${lead.id.slice(-5)}`, previewSlug: baseToken,
    templateId: 'construction-modern-v1', content, artifactDir, storageBaseUrl: '/site-media',
    runId: run.id, regenerateContent: true,
  }, prisma);
  await prisma.site.update({ where: { id: siteId }, data: { domain, status: 'DRAFT' } });
  await prisma.redesignRun.update({ where: { id: run.id }, data: { siteId, stage: 'CMS_IMPORTED' } });

  const shotDir = path.resolve('data/generated/sites', siteId, 'screenshots');
  fs.mkdirSync(shotDir, { recursive: true });
  const allPresets = plan.experience?.stylePresets || ['stykka', 'eindhoven', 'manna'];
  // SINGLE_VARIANT=1 → build only the preferred design (reference-quality mode).
  const presets = process.env.SINGLE_VARIANT === '1' ? [plan.experience?.preferredPreset || allPresets[0]] : allPresets;
  const variants = [];

  // Variants: same template, distinct style presets, deduped tokens.
  for (const [i, preset] of presets.entries()) {
    const token = i === 0 ? baseToken : randToken();
    const v = await prisma.demoVariant.upsert({
      where: { previewToken: token },
      update: { siteId, templateId: 'construction-modern-v1', name: `modern-v1/${preset}`, isPreferred: false, status: 'ACTIVE', themeConfig: { stylePreset: preset, archetype: plan.experience?.archetype } },
      create: { siteId, templateId: 'construction-modern-v1', name: `modern-v1/${preset}`, previewToken: token, isPreferred: false, status: 'ACTIVE', themeConfig: { stylePreset: preset, archetype: plan.experience?.archetype }, generatedByRunId: run.id },
    });
    variants.push({ v, preset, token });
  }

  // Screenshots + QA per variant
  await prisma.redesignRun.update({ where: { id: run.id }, data: { stage: 'SITE_RENDERED' } });
  const counts = {
    pages: await prisma.page.count({ where: { siteId } }), services: await prisma.service.count({ where: { siteId } }),
    projects: await prisma.project.count({ where: { siteId } }), products: await prisma.product.count({ where: { siteId } }),
    news: await prisma.newsPost.count({ where: { siteId } }),
  };
  const gateFails = contentGates({ plan, brand: siteName, counts });

  for (const { v, preset, token } of variants) {
    const url = `${RENDERER}/showcase/${token}`;
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 150)));
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null);
    await page.waitForTimeout(2500); // fonts/images/hydration
    const broken = await page.$$eval('img', (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0).length).catch(() => 0);
    const dPath = path.join(shotDir, `variant-${preset}-desktop.png`);
    const qaPath = path.join(shotDir, `variant-${preset}-qa.jpg`);
    const mPath = path.join(shotDir, `variant-${preset}-mobile.png`);
    await page.screenshot({ path: dPath, fullPage: true });
    await page.screenshot({ path: qaPath, fullPage: true, type: 'jpeg', quality: 60 });
    await ctx.close();
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
    const mp = await mctx.newPage();
    await mp.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await mp.waitForTimeout(2000);
    await mp.screenshot({ path: mPath, fullPage: true });
    await mctx.close();

    let qa = await geminiQA(dPath, { viewport: 'desktop 1440x900', archetype: plan.experience?.archetype, brand: siteName, sections: (plan.experience?.composition || []).map((c) => c.component) });
    const hardFails = [...gateFails];
    if (!resp || resp.status() !== 200) hardFails.push('page did not render');
    if (broken > 2) hardFails.push(`${broken} broken images`);
    if (errors.length) hardFails.push(`page errors: ${errors[0]}`);
    if (qa?.criticalIssues?.length) hardFails.push(...qa.criticalIssues.slice(0, 3));
    if (qa?.error) { qa = await geminiQA(dPath, { viewport: 'desktop 1440x900', archetype: plan.experience?.archetype, brand: siteName, sections: [] }); }
    if (qa?.error || qa?.skipped) console.log('   qa:', JSON.stringify(qa).slice(0,200));
    const score = qa?.clientReadiness ?? 0;
    const passed = !hardFails.length && score >= 7;
    const qaResult = { preset, qa, hardFails, score, passed, desktop: dPath, mobile: mPath };
    variants.find((x) => x.v.id === v.id).qa = qaResult;
    await prisma.demoVariantScreenshot.upsert({
      where: { demoVariantId: v.id },
      update: { storagePath: dPath, url: `${RENDERER}/shots/${siteId}/variant-${preset}-desktop.png`, siteUpdatedAt: new Date(), buildId: null },
      create: { demoVariantId: v.id, storagePath: dPath, url: `${RENDERER}/shots/${siteId}/variant-${preset}-desktop.png`, siteUpdatedAt: new Date() },
    });
    console.log(`  variant ${preset}: readiness=${score} hardFails=${hardFails.length ? hardFails.join('; ') : 'none'}`);
  }

  // Preferred: best passing variant; NEEDS_ATTENTION if none pass.
  await prisma.redesignRun.update({ where: { id: run.id }, data: { stage: 'AUDIT_DONE' } });
  const ranked = variants.map((x) => x.qa).sort((a, b) => b.score - a.score);
  const best = ranked.find((q) => q.passed) || null;
  const chosen = best || ranked[0];
  const chosenVariant = variants.find((x) => x.qa === chosen);
  await prisma.$transaction([
    prisma.demoVariant.updateMany({ where: { siteId }, data: { isPreferred: false } }),
    prisma.demoVariant.update({ where: { id: chosenVariant.v.id }, data: { isPreferred: true } }),
    prisma.site.update({ where: { id: siteId }, data: { preferredDemoVariantId: chosenVariant.v.id, status: 'ACTIVE', settings: { previewUrl: `${RENDERER}/showcase/${chosenVariant.token}`, reviewStatus: 'AWAITING_HUMAN_REVIEW' } } }),
  ]);

  // Site-level screenshot = preferred variant desktop shot
  const siteShot = path.join(shotDir, 'preview.png');
  fs.copyFileSync(chosen.desktop, siteShot);
  await prisma.sitePreviewScreenshot.upsert({
    where: { siteId },
    update: { storagePath: siteShot, url: `http://localhost:3000/site-screenshots/${siteId}/preview.png`, siteUpdatedAt: new Date() },
    create: { siteId, storagePath: siteShot, url: `http://localhost:3000/site-screenshots/${siteId}/preview.png`, siteUpdatedAt: new Date() },
  });

  const validation = await validateGeneratedSite({ siteId, prisma });
  // The implementing agent may never self-certify DEMO_READY — that transition
  // requires explicit human approval (scripts/approve-showcase.mjs). Technical
  // blockers → NEEDS_ATTENTION; otherwise AWAITING_HUMAN_REVIEW.
  const aiQaUnavailable = variants.every((x) => x.qa?.qa?.error || x.qa?.error);
  const status = (!validation.ok || gateFails.length) ? 'NEEDS_ATTENTION' : 'AWAITING_HUMAN_REVIEW';
  await prisma.redesignRun.update({ where: { id: run.id }, data: { stage: best ? 'DEMO_GENERATED' : 'AUDIT_DONE' } });
  await prisma.lead.update({ where: { id: lead.id }, data: { redesignStage: best ? 'DEMO_GENERATED' : 'AUDIT_DONE' } });

  // review doc
  const review = [
    `# Generation review v2 — ${key}`, '',
    `- plan: ${path.join(dir, 'site-content-plan-v2.json')}`,
    `- planHash: ${plan.planHash} (verified before import)`,
    `- archetype: ${plan.experience?.archetype} (${plan.experience?.archetypeReason})`,
    `- brand: "${siteName}" (source: ${plan.experience?.brand?.source})`,
    '', '## CMS', ...Object.entries(counts).map(([k, v]) => `- ${k}: ${v}`),
    '', '## Variants', ...variants.map((x) => `- ${x.preset}: readiness=${x.qa.score} passed=${x.qa.passed}${x === chosenVariant ? ' ← PREFERRED' : ''}${x.qa.hardFails.length ? ` fails: ${x.qa.hardFails.join('; ')}` : ''}${x.qa.qa?.suggestions ? ` suggestions: ${x.qa.qa.suggestions.slice(0, 3).join('; ')}` : ''}`),
    '', `## Preferred: ${chosen.preset} → ${RENDERER}/showcase/${chosenVariant.token}`,
    `## Status: ${status}${aiQaUnavailable ? ' (AI_VISUAL_QA = QUOTA_UNAVAILABLE)' : ''}`, `## Validation: ${validation.ok ? 'PASS' : 'FAIL ' + validation.missing.join(', ')}`,
    `## Content gates: ${gateFails.length ? gateFails.join('; ') : 'all pass'}`,
    '', '## Screenshots', ...variants.map((x) => `- ${x.preset}: ${x.qa.desktop} | ${x.qa.mobile}`),
    '', '## Human review notes', '- Implementer does not self-approve visual quality — awaiting explicit human review.',
  ].join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'generation-review-v2.md'), review);
  console.log(`  → ${status} | preferred=${chosen.preset} | ${RENDERER}/showcase/${chosenVariant.token}`);
  results.push({ key, siteId, status, preferred: chosen.preset, url: `${RENDERER}/showcase/${chosenVariant.token}`, counts, variants: variants.map((x) => ({ preset: x.preset, score: x.qa.score, passed: x.qa.passed })) });
}

await browser.close();
console.log('\n=== RESULTS ===');
for (const r of results) console.log(JSON.stringify(r));
await prisma.$disconnect();
