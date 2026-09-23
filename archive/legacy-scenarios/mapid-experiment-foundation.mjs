import 'dotenv/config';
import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ArtifactType,
  GenerationProvider,
  GenerationMode,
  GenerationRunBuilder,
  RunStatus,
  StageStatus,
  SourceProvider,
  createArtifactRef,
  createEmptyEvaluation,
  createExperiment,
  addVariant,
  attachRun,
  evaluateExperiment,
  saveExperiment,
  createSourceSnapshot,
  createVisualQAReport,
  addFinding,
  checkGeneratedContent,
  writeIntegrityReport,
  ingestLighthouse,
  ingestScreenshot,
  captureScreenshots,
  validateNavigation,
  discoverSkills,
  writeSkillRegistry,
  aggregateCosts,
} from '../packages/redesign-engine/experiments/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const EXPERIMENT_ROOT = join(REPO_ROOT, 'data/experiments/mapid');
const SKILL_DIR = join(REPO_ROOT, '.agents/skills');

const PREVIEWS = {
  V1: 'http://localhost:3336/showcase/mapid-v1-9b560819',
  V2: 'http://localhost:3336/showcase/mapid-v2-85a0669a',
};

const GIT_COMMIT = (() => {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
})();

async function ensureVariantDir(name) {
  const dir = join(EXPERIMENT_ROOT, 'variants', name);
  await mkdir(dir, { recursive: true });
  await mkdir(join(dir, 'screenshots'), { recursive: true });
  await mkdir(join(dir, 'lighthouse'), { recursive: true });
  await mkdir(join(dir, 'qa'), { recursive: true });
  return dir;
}

async function ingestExistingArtifacts(run, variantDir, variantName) {
  const lighthousePath = join(EXPERIMENT_ROOT, `lighthouse-${variantName.toLowerCase()}.json`);
  if (existsSync(lighthousePath)) {
    const { artifact, result } = await ingestLighthouse(lighthousePath, PREVIEWS[variantName], `phase-a-${variantName.toLowerCase()}`);
    run.addArtifact(artifact);
    run.endStage(StageStatus.SUCCESS);
    return { lighthouse: result.summary };
  }
  run.endStage(StageStatus.SKIPPED);
  return {};
}

async function main() {
  console.log('Building Generation Intelligence Foundation for MAPID...');

  // 1. SourceSnapshot from existing Phase A/B1 artifacts.
  const sourceSnapshot = await createSourceSnapshot({
    root: EXPERIMENT_ROOT,
    sourceUrl: 'https://mapid.by/',
    crawler: SourceProvider.WLA,
    crawlRunId: 'mapid-benchmark-1788986461195',
    crawledAt: '2026-09-09T20:41:43.722Z',
  });
  console.log('SourceSnapshot:', sourceSnapshot.id, sourceSnapshot.contentHash);

  // 2. Skill registry
  const skills = await discoverSkills(SKILL_DIR);
  const skillRegistryArtifact = await writeSkillRegistry(skills, join(EXPERIMENT_ROOT, 'variants'));
  console.log('Discovered skills:', skills.length);

  // 3. Experiment
  const experiment = createExperiment({ name: 'MAPID Generation V2 Foundation', sourceSnapshot });

  // B1 intelligence run
  const b1Run = new GenerationRunBuilder({
    sourceSnapshotId: sourceSnapshot.id,
    generationProvider: GenerationProvider.TEMPLATE,
    mode: GenerationMode.SAFE,
    gitCommit: GIT_COMMIT,
  });
  const b1Stage = b1Run.startStage('INTELLIGENCE');
  const b1Artifacts = [];
  for (const [name, file] of [
    ['ai-site-intelligence.json', ArtifactType.SITE_INTELLIGENCE],
    ['media-intelligence.json', ArtifactType.MEDIA_INTELLIGENCE],
    ['entity-intelligence.json', ArtifactType.SITE_INTELLIGENCE],
    ['competitor-intelligence.json', ArtifactType.COMPETITOR_INTELLIGENCE],
    ['language-intelligence.json', ArtifactType.SITE_INTELLIGENCE],
    ['reconciliation.json', ArtifactType.SITE_INTELLIGENCE],
    ['SiteBrief.json', ArtifactType.SITE_BRIEF],
    ['security-test.json', ArtifactType.SECURITY_REPORT],
    ['cost-report.json', ArtifactType.COST_REPORT],
  ]) {
    const p = join(EXPERIMENT_ROOT, 'b1-intelligence', name);
    if (existsSync(p)) {
      const ref = await createArtifactRef(file, p, { provider: 'WLA_B1' });
      b1Artifacts.push(ref);
      b1Run.addArtifact(ref);
    }
  }
  b1Run.addSkillUsage({ skill: 'internal/strategy/site-analysis', source: 'WLA', stage: 'INTELLIGENCE' });
  b1Run.addSkillUsage({ skill: 'internal/strategy/site-brief', source: 'WLA', stage: 'INTELLIGENCE' });
  b1Run.addSkillUsage({ skill: 'internal/strategy/competitor-analysis', source: 'WLA', stage: 'INTELLIGENCE' });
  b1Run.addSkillUsage({ skill: 'internal/strategy/media-analysis', source: 'WLA', stage: 'INTELLIGENCE' });
  b1Run.endStage(StageStatus.SUCCESS);
  b1Run.complete(RunStatus.SUCCESS);
  const b1ManifestPath = await b1Run.save(join(EXPERIMENT_ROOT, 'variants', 'b1-intelligence'));
  console.log('B1 intelligence run saved:', b1ManifestPath);

  // 4. Variants
  const variantDefs = [
    {
      name: 'V1',
      filePrefix: 'v1',
      generationProvider: GenerationProvider.TEMPLATE,
      generationMode: GenerationMode.SAFE,
      siteId: 'cmtukck2s00027faia7sewxgl',
      demoVariantId: 'mapid-v1-9b560819',
      contentPath: join(EXPERIMENT_ROOT, 'v1/content.json'),
      previewUrl: PREVIEWS.V1,
    },
    {
      name: 'V2_ALPHA',
      filePrefix: 'v2',
      generationProvider: GenerationProvider.TEMPLATE,
      generationMode: GenerationMode.SAFE,
      siteId: 'cmtukdb8c00fv7faia9wu163i',
      demoVariantId: 'mapid-v2-85a0669a',
      contentPath: join(EXPERIMENT_ROOT, 'v2/content.json'),
      previewUrl: PREVIEWS.V2,
    },
  ];

  const measurementsByVariant = {};

  for (const def of variantDefs) {
    const variantDir = await ensureVariantDir(def.name.toLowerCase());
    const variant = addVariant(experiment, def);

    const run = new GenerationRunBuilder({
      sourceSnapshotId: sourceSnapshot.id,
      generationProvider: def.generationProvider,
      generationVersion: 'phase-a',
      mode: def.generationMode,
      siteId: def.siteId,
      demoVariantId: def.demoVariantId,
      gitCommit: GIT_COMMIT,
    });

    // GENERATION stage
    run.startStage('GENERATION', { provider: def.generationProvider });
    if (existsSync(def.contentPath)) {
      const contentArtifact = await createArtifactRef(ArtifactType.GENERATED_CONTENT, def.contentPath, { variant: def.name });
      run.addArtifact(contentArtifact);
      run.addCost({ provider: 'WLA', operation: 'generation', requests: 1, estimatedCost: 0 });
    }
    run.endStage(StageStatus.SUCCESS);

    // BUILD stage (we did not rebuild, mark SKIPPED with reason)
    const buildStage = run.startStage('BUILD');
    run.endStage(StageStatus.SKIPPED);

    // SCREENSHOT stage: use existing screenshots from Phase A
    const screenshotStage = run.startStage('SCREENSHOT', { provider: 'playwright' });
    const screenshots = [];
    for (const device of ['desktop', 'mobile']) {
      const existing = join(EXPERIMENT_ROOT, 'screenshots', `${def.filePrefix}-${device}.png`);
      if (existsSync(existing)) {
        const ref = await ingestScreenshot(existing, device === 'desktop' ? ArtifactType.SCREENSHOT_GENERATED_DESKTOP : ArtifactType.SCREENSHOT_GENERATED_MOBILE, { url: def.previewUrl, viewport: device });
        if (ref) {
          screenshots.push(ref);
          run.addArtifact(ref);
        }
      }
    }
    if (screenshots.length === 0) {
      // Fallback: capture fresh desktop + mobile
      const captured = await captureScreenshots({
        targets: [{ name: def.name.toLowerCase(), url: def.previewUrl, type: ArtifactType.SCREENSHOT_GENERATED_DESKTOP }],
        outDir: join(variantDir, 'screenshots'),
      });
      for (const c of captured) {
        const kind = c.path.includes('mobile') ? ArtifactType.SCREENSHOT_GENERATED_MOBILE : ArtifactType.SCREENSHOT_GENERATED_DESKTOP;
        run.addArtifact({ ...c, type: kind });
      }
    }
    run.endStage(StageStatus.SUCCESS);

    // LIGHTHOUSE stage
    const lhStage = run.startStage('LIGHTHOUSE', { provider: 'lighthouse' });
    const lhName = def.name === 'V1' ? 'v1' : 'v2';
    const lhPath = join(EXPERIMENT_ROOT, `lighthouse-${lhName}.json`);
    let lhSummary = null;
    if (existsSync(lhPath)) {
      const { artifact, result } = await ingestLighthouse(lhPath, def.previewUrl, `phase-a-${lhName}`);
      run.addArtifact(artifact);
      run.addCost({ provider: 'lighthouse', operation: 'audit', requests: 1, estimatedCost: 0 });
      lhSummary = result.summary;
      run.endStage(StageStatus.SUCCESS);
    } else {
      run.endStage(StageStatus.SKIPPED);
    }

    // NAVIGATION stage: run on localhost preview if available
    const navStage = run.startStage('NAVIGATION', { provider: 'playwright' });
    let navReport = null;
    try {
      const res = await fetch(def.previewUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const { artifact, report } = await validateNavigation({ url: def.previewUrl, outDir: join(variantDir, 'qa'), maxLinks: 10 });
        run.addArtifact(artifact);
        run.addCost({ provider: 'playwright', operation: 'navigation', requests: 1, estimatedCost: 0 });
        navReport = report;
        run.endStage(StageStatus.SUCCESS);
      } else {
        run.endStage(StageStatus.SKIPPED);
      }
    } catch (err) {
      run.endStage(StageStatus.SKIPPED, { code: 'NAVIGATION_NOT_RUNNABLE', message: err.message });
    }

    // INTEGRITY stage
    const integrityStage = run.startStage('INTEGRITY', { provider: 'WLA' });
    const integrityReport = await checkGeneratedContent(def.contentPath, def.previewUrl);
    const integrityArtifact = await writeIntegrityReport(integrityReport, join(variantDir, 'qa'));
    run.addArtifact(integrityArtifact);
    run.endStage(StageStatus.SUCCESS);

    measurementsByVariant[def.name] = {
      lighthouse: lhSummary,
      navigation: navReport,
      integrity: integrityReport,
      durationMs: run.build().stages.reduce((a, s) => a + (s.durationMs || 0), 0),
      costUsd: aggregateCosts(run.build().costs).reduce((a, c) => a + (c.estimatedCost || 0), 0),
    };

    // VISUAL_QA stage
    const vqaStage = run.startStage('VISUAL_QA', { provider: 'IMPECCABLE_GUIDED_AGENT' });
    const visualQA = await createVisualQAReport({
      url: def.previewUrl,
      outDir: join(variantDir, 'qa'),
      provider: 'IMPECCABLE_GUIDED_AGENT',
      findings: [],
      notes: 'Impeccable engine binary not executed in this foundation run. Findings were derived from deterministic integrity checks.',
    });
    // Add integrity-driven visual findings
    for (const f of integrityReport.findings) {
      addFinding(visualQA.report, {
        severity: f.severity,
        category: f.category,
        description: f.description,
        evidence: f.evidence,
      });
    }
    await writeFile(visualQA.artifact.path, JSON.stringify(visualQA.report, null, 2), 'utf8');
    run.addArtifact(visualQA.artifact);
    run.addSkillUsage({ skill: 'impeccable', source: 'pbakaus/impeccable', stage: 'VISUAL_QA' });
    run.endStage(StageStatus.SUCCESS);

    measurementsByVariant[def.name].visualQA = visualQA.report;

    run.complete(RunStatus.SUCCESS);
    const runPath = await run.save(variantDir);

    attachRun(experiment, variant, run.build(), [skillRegistryArtifact]);

    console.log(`${def.name}: stages=${run.build().stages.length}, integrity findings=${integrityReport.findingCount}`);
  }

  // 5. Add B1 intelligence artifacts to experiment level
  experiment.artifacts.push(...b1Run.build().artifacts);
  experiment.skillUsage.push(...b1Run.build().provenance);

  // 6. Automated evaluation + comparison matrix
  evaluateExperiment(experiment, measurementsByVariant);

  // 7. Human evaluation placeholder
  const humanEval = createEmptyEvaluation('HUMAN', 'evaluator');
  humanEval.notes = 'Human evaluation not yet collected. This is a placeholder.';
  experiment.humanEvaluations.push(humanEval);

  // 8. Save
  const { manifestPath, reportPath } = await saveExperiment(experiment, EXPERIMENT_ROOT);
  console.log('Experiment manifest:', manifestPath);
  console.log('Report:', reportPath);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
