// Structured-content pipeline regression tests.
// Covers: heading duplication invariant, adjacent-dup collapse, non-adjacent
// preservation, technical-label suppression, FAQ/process typed recovery,
// import idempotency, manual-edit protection, EditorialQA safety bounds.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaClient } from '@prisma/client';
import { buildSourceDocuments, dedupeSectionParagraphs } from '../dist/extract/buildSourceDocuments.js';
import { graphToImportContent, sectionsToBlocks } from '../dist/import/graphToImportContent.js';
import { importToCms } from '../dist/import/importToCms.js';
import { DeterministicEditorialQa } from '../dist/qa/editorialQa.js';

const prisma = new PrismaClient();
const LISHEN_DIR = new URL('../../../data/redesign/pilot-2b/lishen/', import.meta.url).pathname;
const GENERIC_SRC = new URL('../../templates/src/editorial-architecture-v1/components/GenericSection.tsx', import.meta.url).pathname;
const ROUTEVIEWS_SRC = new URL('../../templates/src/editorial-architecture-v1/components/RouteViews.tsx', import.meta.url).pathname;

const norm = (t) => (t || '').replace(/\s+/g, ' ').trim().toLowerCase();

async function lishenDocs() {
  const crawl = JSON.parse(await readFile(join(LISHEN_DIR, 'crawl-full.json'), 'utf8'));
  return buildSourceDocuments(crawl);
}

async function lishenContent() {
  const graph = JSON.parse(await readFile(join(LISHEN_DIR, 'source-content-graph.json'), 'utf8'));
  const sourceDocuments = JSON.parse(await readFile(join(LISHEN_DIR, 'source-documents.json'), 'utf8'));
  return graphToImportContent({ graph, sourceDocuments, baseUrl: 'https://lishen.by', navigation: [] });
}

const makeSection = (over) => ({
  id: 's1', level: 2, region: 'main', paragraphs: [], lists: [], tables: [],
  images: [], links: [], collections: [], order: 0, ...over,
});

describe('extraction dedup invariants', () => {
  it('1. a source heading is never duplicated in paragraphs[0] or mainText', async () => {
    const docs = await lishenDocs();
    assert.ok(docs.length >= 15, 'expected all 15 Lishen pages');
    for (const doc of docs) {
      for (const sec of doc.sections) {
        if (!sec.heading || !sec.paragraphs[0]) continue;
        assert.notEqual(
          norm(sec.paragraphs[0]), norm(sec.heading),
          `${doc.path} section "${sec.heading?.slice(0, 60)}" repeats its heading as first paragraph`,
        );
      }
      // mainText must not contain a heading immediately followed by itself.
      const paras = doc.mainText.split(/\n+/).map(norm).filter(Boolean);
      for (let i = 1; i < paras.length; i++) {
        assert.notEqual(paras[i], paras[i - 1], `${doc.path} mainText has adjacent duplicate: "${paras[i].slice(0, 60)}"`);
      }
    }
  });

  it('2. immediately-adjacent normalized duplicates collapse to one', () => {
    const sec = makeSection({
      heading: 'Гарантии',
      paragraphs: ['Гарантии', 'Гарантии  ', 'Первый абзац.', 'Первый абзац.', 'Второй абзац.'],
    });
    const removed = dedupeSectionParagraphs(sec);
    assert.deepEqual(sec.paragraphs, ['Первый абзац.', 'Второй абзац.']);
    assert.equal(removed.filter((r) => r.kind === 'heading-paragraph').length, 2);
    assert.equal(removed.filter((r) => r.kind === 'adjacent').length, 1);
  });

  it('3. legitimate non-adjacent repetition is preserved', () => {
    const sec = makeSection({
      paragraphs: ['Позвоните нам.', 'Текст.', 'Позвоните нам.'],
    });
    dedupeSectionParagraphs(sec);
    assert.deepEqual(sec.paragraphs, ['Позвоните нам.', 'Текст.', 'Позвоните нам.']);
  });

  it('3b. dedup never collapses non-adjacent facts (phone numbers, addresses)', () => {
    const sec = makeSection({
      paragraphs: ['+375 29 000-00-00', 'Офис в Минске.', '+375 29 000-00-00'],
    });
    const removed = dedupeSectionParagraphs(sec);
    assert.equal(removed.length, 0);
    assert.equal(sec.paragraphs.length, 3);
  });
});

describe('technical labels never render as headings', () => {
  it('4. a text block without heading renders no h2 (source contract)', async () => {
    const src = await readFile(GENERIC_SRC, 'utf8');
    // The only h2 in GenericSection must be gated on section.heading —
    // section.type must never be a heading fallback.
    assert.ok(!/section\.heading\s*\|\|\s*section\.type/.test(src), 'type-as-heading fallback reintroduced');
    assert.ok(/section\.heading\s*\?[\s\S]{0,200}<h2/.test(src), 'h2 must be conditional on a real heading');
  });

  it('5. no block type string is rendered as a visible heading', async () => {
    const src = await readFile(ROUTEVIEWS_SRC, 'utf8');
    // block__title may only ever render `heading` — never section.type or a
    // type-name literal.
    for (const m of src.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)) {
      assert.ok(!/section\.type|b\.type|['"](?:text|gallery|services|projects|certificates)['"]/.test(m[1]),
        `h2 renders a technical value: ${m[1].slice(0, 60)}`);
    }
    // GenericSection type fallback — checked in test 4; here ensure the
    // BlockList default case does not produce a type heading.
    assert.ok(!/\|\|\s*(b|section)\.type/.test(src), 'type fallback heading present in RouteViews');
  });
});

describe('typed structure recovery (real Lishen artifacts)', () => {
  it('6. FAQ questions and answers survive source → typed blocks', async () => {
    const docs = await lishenDocs();
    const faqDoc = docs.find((d) => /faq/i.test(d.path) || /faq/i.test(d.url));
    assert.ok(faqDoc, 'faq source document missing');
    const faqs = faqDoc.sections.flatMap((s) => s.faqs || []);
    assert.ok(faqs.length >= 8, `expected ≥8 recovered Q/A pairs, got ${faqs.length}`);
    for (const f of faqs) {
      assert.ok(f.question?.trim(), 'question must not be empty');
      assert.ok(f.answer?.trim(), `answer missing for "${f.question}"`);
    }

    const { content } = await lishenContent();
    const faqPage = content.pages.find((p) => /faq/i.test(p.slug));
    const faqBlock = faqPage?.blocks.find((b) => b.type === 'faq');
    assert.ok(faqBlock, 'typed faq block missing from faq page');
    assert.ok(faqBlock.items.length >= 8);
    for (const it of faqBlock.items) {
      assert.ok(it.question && it.answer, 'faq item must carry question+answer');
      assert.ok(it.sourceUrl, 'faq item must carry source evidence');
    }
  });

  it('7. process steps keep titles and descriptions separately', async () => {
    const { content } = await lishenContent();
    const monolit = content.services.find((s) => /monolit/i.test(s.slug));
    const steps = monolit?.blocks.find((b) => b.type === 'processSteps');
    assert.ok(steps, 'processSteps block missing on monolit service');
    assert.ok(steps.items.length >= 4);
    for (const it of steps.items) {
      assert.ok(it.title?.trim(), 'step title missing');
      assert.ok(it.text?.trim(), `step "${it.title}" has no separate description`);
      assert.notEqual(norm(it.title), norm(it.text), 'step title must not equal its description');
    }
    const feats = monolit.blocks.find((b) => b.type === 'features');
    assert.ok(feats?.items.length >= 3, 'features block with ≥3 items expected');
  });
});

describe('CMS import safety', () => {
  async function freshLead(tx) {
    const leadId = randomUUID().replace(/-/g, '').slice(0, 25);
    await tx.lead.create({
      data: {
        id: leadId, source: 'manual', sourceId: leadId,
        companyName: 'V362 idempotency test', city: 'Минск',
        categories: [], website: 'https://v362.example', websiteDomain: 'v362.example',
      },
    });
    return leadId;
  }

  const importOpts = (leadId, content, artifactDir, runId) => ({
    leadId,
    lead: { id: leadId, companyName: 'V362 idempotency test', phone: null, address: null },
    siteName: 'V362 idempotency test',
    siteSlug: 'v362-idem',
    previewSlug: `v362-${leadId.slice(0, 8)}`,
    templateId: 'editorial-architecture-v1',
    content,
    artifactDir,
    storageBaseUrl: '/redesign-media',
    runId,
  });

  const snapshot = async (tx, siteId) => ({
    pages: await tx.page.findMany({ where: { siteId }, orderBy: { slug: 'asc' }, select: { id: true, slug: true, blocks: true } }),
    services: await tx.service.count({ where: { siteId } }),
    projects: await tx.project.count({ where: { siteId } }),
    menuItems: await tx.menuItem.count({ where: { siteId } }),
    media: await tx.media.count({ where: { siteId } }),
  });

  it('8. regeneration is idempotent — same rows, same blocks, zero duplicates', async (t) => {
    const { content } = await lishenContent();
    const artifactDir = await mkdtemp(join(tmpdir(), 'v362-idem-'));
    const runId = `v362-test-${randomUUID().slice(0, 8)}`;
    try {
      await prisma.$transaction(async (tx) => {
        const leadId = await freshLead(tx);
        const r1 = await importToCms(importOpts(leadId, content, artifactDir, runId), tx);
        const s1 = await snapshot(tx, r1.siteId);
        const r2 = await importToCms(importOpts(leadId, content, artifactDir, runId), tx);
        assert.equal(r2.siteId, r1.siteId, 'second import must reuse the same site');
        const s2 = await snapshot(tx, r1.siteId);
        assert.equal(s2.pages.length, s1.pages.length, 'page count changed');
        assert.equal(s2.services, s1.services);
        assert.equal(s2.projects, s1.projects);
        assert.equal(s2.menuItems, s1.menuItems);
        for (let i = 0; i < s1.pages.length; i++) {
          assert.equal(s2.pages[i].id, s1.pages[i].id, `page ${s1.pages[i].slug} was recreated`);
          assert.deepEqual(s2.pages[i].blocks, s1.pages[i].blocks, `page ${s1.pages[i].slug} blocks drifted`);
        }
        throw new Error('__ROLLBACK__');
      }, { timeout: 180000 });
    } catch (err) {
      if (err.message !== '__ROLLBACK__') throw err;
    }
  });

  it('9. genuine manual CMS edits remain protected', async (t) => {
    const { content } = await lishenContent();
    const artifactDir = await mkdtemp(join(tmpdir(), 'v362-manual-'));
    const runId = `v362-test-${randomUUID().slice(0, 8)}`;
    try {
      await prisma.$transaction(async (tx) => {
        const leadId = await freshLead(tx);
        const r1 = await importToCms(importOpts(leadId, content, artifactDir, runId), tx);
        const page = await tx.page.findFirst({ where: { siteId: r1.siteId, isHomepage: false } });
        assert.ok(page);
        const manualBlocks = [{ type: 'richText', heading: 'Ручная правка', content: 'Отредактировано вручную.' }];
        await tx.page.update({
          where: { id: page.id },
          data: { blocks: manualBlocks, manualModifiedAt: new Date(), title: 'Ручная правка' },
        });
        const pagesBefore = await tx.page.count({ where: { siteId: r1.siteId } });
        await importToCms(importOpts(leadId, content, artifactDir, runId), tx);
        const after = await tx.page.findUnique({ where: { id: page.id } });
        assert.equal(after.title, 'Ручная правка', 'manual title overwritten');
        assert.deepEqual(after.blocks, manualBlocks, 'manual blocks overwritten');
        assert.equal(await tx.page.count({ where: { siteId: r1.siteId } }), pagesBefore, 'duplicate page spawned for manual row');
        throw new Error('__ROLLBACK__');
      }, { timeout: 180000 });
    } catch (err) {
      if (err.message !== '__ROLLBACK__') throw err;
    }
  });
});

describe('EditorialQA safety bounds (no external calls)', () => {
  const qa = new DeterministicEditorialQa();

  it('10. suggestions never alter numeric facts', async () => {
    const input = [{
      entityId: 'p1', blockId: 'b1',
      text: 'Гарантия 5 лет.\n\nГарантия 5 лет.\n\nЭкономит до 30% времени и более 2 тысяч квадратов опалубки.',
    }];
    const patches = await qa.suggest(input);
    for (const p of patches) {
      // Removing an exact duplicate paragraph is safe; what must never happen
      // is introducing or altering numbers. Every surviving paragraph must
      // exist verbatim in `before`, so no numeric claim can be modified.
      const beforeParas = new Set(p.before.split(/\n{2,}/).map((s) => s.trim()));
      for (const para of p.after.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)) {
        assert.ok(beforeParas.has(para), 'suggestion rewrote paragraph text (numbers at risk)');
      }
    }
    // Every patch must be reviewable — full before/after + reason + evidence.
    for (const p of patches) {
      assert.ok(p.before && p.after && p.reason, 'patch missing reviewable fields');
      assert.ok(Array.isArray(p.evidenceIds), 'evidenceIds must be an array');
      assert.ok(['low', 'medium', 'high'].includes(p.risk));
      assert.ok(typeof p.confidence === 'number');
    }
  });

  it('11. the 5-year/10-year warranty conflict is detected, never resolved', async () => {
    const input = [
      { entityId: 'page:faq', text: 'Мы даём гарантию 5 лет на все работы.' },
      { entityId: 'page:monolit', text: 'Гарантия на несущие конструкции до 10 лет.' },
    ];
    const issues = await qa.lint(input);
    const conflict = issues.find((i) => i.kind === 'contradiction' && i.severity === 'conflict');
    assert.ok(conflict, 'warranty contradiction not detected');
    assert.ok(/5/.test(conflict.text) && /10/.test(conflict.text), 'conflict must cite both durations');
    const patches = await qa.suggest(input);
    for (const p of patches) {
      assert.ok(!/гаранти/i.test(p.after) || /5|10/.test(p.after), 'suggestion touched warranty claim');
    }
  });

  it('11b. required flags: numeric claims, legal refs, informal and malformed wording', async () => {
    const input = [{
      entityId: 'p1', blockId: 'b1',
      text: 'Экономит до 30% времени. Более 2 тысяч квадратов. 100% контроль. Работы по СТБ и СНиП, гарантийные обязательства по законодательству РБ. Доски с мусорки не используем. Сколько стоит монолитные работы?',
    }];
    const issues = await qa.lint(input);
    const kinds = new Set(issues.map((i) => i.kind));
    assert.ok(kinds.has('suspicious-numeric-claim'), 'numeric claims not flagged');
    assert.ok(kinds.has('legal-reference'), 'legal/standards refs not flagged');
    assert.ok(kinds.has('informal-wording'), 'informal wording not flagged');
    assert.ok(kinds.has('malformed-question'), 'malformed question not flagged');
  });
});
