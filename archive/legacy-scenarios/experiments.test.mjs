import assert from 'node:assert/strict';
import { describe, it, before } from 'node:test';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createArtifactRef,
  hashFile,
  verifyManifest,
  createSourceSnapshot,
  loadSourceSnapshot,
  GenerationRunBuilder,
  StageStatus,
  RunStatus,
  GenerationProvider,
  checkGeneratedContent,
  createEmptyEvaluation,
  buildAutomatedEvaluation,
  buildComparisonMatrix,
  createExperiment,
  addVariant,
} from '../experiments/index.mjs';

describe('Generation Intelligence Foundation', () => {
  let tmpRoot;

  before(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'wla-foundation-'));
  });

  it('hashes a file and detects tampering', async () => {
    const file = join(tmpRoot, 'hello.txt');
    await writeFile(file, 'hello');
    const h1 = await hashFile(file);
    assert.strictEqual(h1.length, 64);
    await writeFile(file, 'hello2');
    const h2 = await hashFile(file);
    assert.notStrictEqual(h1, h2);
  });

  it('creates an artifact reference', async () => {
    const file = join(tmpRoot, 'artifact.json');
    await writeFile(file, '{"a":1}');
    const ref = await createArtifactRef('SOURCE_CRAWL', file, { provider: 'WLA' });
    assert.strictEqual(ref.type, 'SOURCE_CRAWL');
    assert.strictEqual(ref.sha256.length, 64);
    assert.strictEqual(ref.provider, 'WLA');
    assert.ok(existsSync(ref.path));
  });

  it('verifies a manifest', async () => {
    const file = join(tmpRoot, 'manifest.json');
    await writeFile(file, '{"a":1}');
    const ref = await createArtifactRef('SOURCE_CRAWL', file);
    const { ok, mismatches } = await verifyManifest({ artifacts: [ref] });
    assert.strictEqual(ok, true);
    assert.deepStrictEqual(mismatches, []);
  });

  it('creates and loads a source snapshot', async () => {
    const snapshotDir = join(tmpRoot, 'snapshot');
    await mkdir(snapshotDir, { recursive: true });
    await writeFile(join(snapshotDir, 'crawl.json'), '{"pages":[]}');

    const snapshot = await createSourceSnapshot({
      root: snapshotDir,
      sourceUrl: 'https://example.com',
      crawler: 'WLA',
      crawledAt: '2026-01-01T00:00:00Z',
    });

    assert.strictEqual(snapshot.sourceUrl, 'https://example.com');
    assert.strictEqual(snapshot.artifacts.length, 1);
    assert.strictEqual(typeof snapshot.contentHash, 'string');

    const loaded = await loadSourceSnapshot(join(snapshotDir, 'source-snapshot.json'));
    assert.strictEqual(loaded.id, snapshot.id);
  });

  it('tracks stages and costs in a generation run', async () => {
    const run = new GenerationRunBuilder({
      sourceSnapshotId: 'snap-1',
      generationProvider: GenerationProvider.TEMPLATE,
    });

    const stage = run.startStage('GENERATION');
    assert.strictEqual(stage.status, StageStatus.RUNNING);
    run.addCost({ provider: 'gemini', operation: 'analysis', inputTokens: 100, outputTokens: 50 });
    run.endStage(StageStatus.SUCCESS);
    run.complete(RunStatus.SUCCESS);

    assert.strictEqual(run.build().stages.length, 1);
    assert.strictEqual(run.build().stages[0].status, StageStatus.SUCCESS);
    assert.strictEqual(run.build().costs.length, 1);
    assert.strictEqual(run.build().costs[0].inputTokens, 100);
    assert.ok(run.build().completedAt);
  });

  it('detects integrity defects in generated content', async () => {
    const content = {
      hero: {
        title: 'Welcome',
        subtitle: 'MAPIД — Internet provider Main services...',
        industry: 'Internet provider',
        buttonLabel: '',
      },
      navigation: [{ label: 'Home' }, { label: 'Services' }],
      contacts: { phone: '+123' },
      homepageSections: [{ heading: 'About' }, { heading: 'About' }],
      media: [{ url: 'a.png' }, { url: 'a.png' }, { url: 'a.png' }, { url: 'a.png' }],
    };
    const file = join(tmpRoot, 'content.json');
    await writeFile(file, JSON.stringify(content));
    const report = await checkGeneratedContent(file, 'http://localhost/showcase');

    const categories = report.findings.map((f) => f.category);
    assert.ok(categories.includes('TRUNCATED_TEXT'));
    assert.ok(categories.includes('PLACEHOLDER_OR_INCORRECT_CONTENT'));
    assert.ok(categories.includes('INCORRECT_BUSINESS_CLASSIFICATION'));
    assert.ok(categories.includes('DUPLICATE_SECTION_HEADING'));
    assert.ok(categories.includes('DUPLICATE_MEDIA_OVERUSE'));
    assert.ok(categories.includes('MISSING_HERO_CTA'));
    assert.ok(report.findingCount > 0);
  });

  it('builds an automated evaluation and comparison matrix', async () => {
    const eval1 = buildAutomatedEvaluation({
      lighthouse: { performance: 90, accessibility: 80, bestPractices: 93, seo: 70 },
      navigation: { validPercent: 85 },
      integrity: { findings: [{ severity: 'HIGH' }] },
      durationMs: 5000,
      costUsd: 0.01,
    });
    assert.strictEqual(eval1.scores.performance, 90);
    assert.strictEqual(eval1.scores.navigationIntegrity, 85);
    assert.strictEqual(eval1.scores.contentCorrectness, 70);
    assert.strictEqual(eval1.scores.duration, 5000);
    assert.strictEqual(eval1.scores.cost, 0.01);
    assert.strictEqual(eval1.scores.businessRelevance, 'NOT_MEASURED');

    const eval2 = createEmptyEvaluation('HUMAN', 'tester');
    const matrix = buildComparisonMatrix([
      { name: 'A', evaluation: eval1 },
      { name: 'B', evaluation: eval2 },
    ]);
    assert.strictEqual(matrix.variants.length, 2);
    assert.ok(matrix.metrics.includes('performance'));
    assert.strictEqual(matrix.variants[1].scores.performance, 'NOT_MEASURED');
  });

  it('creates an experiment with variants sharing the same source snapshot', () => {
    const snapshot = { id: 'snap-1', sourceUrl: 'https://example.com', artifacts: [], contentHash: 'abc' };
    const experiment = createExperiment({ name: 'Test', sourceSnapshot: snapshot });
    const variantA = addVariant(experiment, { name: 'A', generationProvider: GenerationProvider.TEMPLATE });
    const variantB = addVariant(experiment, { name: 'B', generationProvider: GenerationProvider.BLUEPRINT });

    assert.strictEqual(experiment.variants.length, 2);
    assert.strictEqual(variantA.sourceSnapshotId, undefined); // variant stores through experiment
    assert.strictEqual(experiment.sourceSnapshotId, 'snap-1');
    assert.strictEqual(variantA.generationProvider, GenerationProvider.TEMPLATE);
    assert.strictEqual(variantB.generationProvider, GenerationProvider.BLUEPRINT);
  });
});
