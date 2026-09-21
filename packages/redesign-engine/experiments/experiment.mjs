import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { GenerationRunBuilder } from './generationRun.mjs';
import { createArtifactRef } from './manifest.mjs';
import { ArtifactType, GenerationProvider, GenerationMode, RunStatus } from './types.mjs';
import { writeExperimentReport } from './report.mjs';
import { buildAutomatedEvaluation, buildComparisonMatrix, writeEvaluation } from './evaluation.mjs';
import { aggregateCosts } from './cost.mjs';

/**
 * @typedef {import('./sourceSnapshot.mjs').SourceSnapshot} SourceSnapshot
 */

/**
 * @typedef {Object} ExperimentVariantDef
 * @property {string} name
 * @property {string} generationProvider
 * @property {string} [generationMode]
 * @property {string} [artifactDir]
 * @property {string} [siteId]
 * @property {string} [demoVariantId]
 * @property {string} [contentPath]
 */

/**
 * @typedef {Object} Experiment
 * @property {string} id
 * @property {string} name
 * @property {string} sourceSnapshotId
 * @property {string} sourceUrl
 * @property {string} createdAt
 * @property {ExperimentVariant[]} variants
 * @property {any[]} artifacts
 * @property {any[]} skillUsage
 * @property {any[]} qaFindings
 * @property {any} [automatedEvaluation]
 * @property {any[]} [humanEvaluations]
 * @property {any} [comparisonMatrix]
 * @property {SourceSnapshot} [sourceSnapshot]
 */

/**
 * @typedef {Object} ExperimentVariant
 * @property {string} id
 * @property {string} name
 * @property {string} generationProvider
 * @property {string} generationMode
 * @property {string} status
 * @property {string} [runId]
 * @property {string} [siteId]
 * @property {string} [demoVariantId]
 * @property {string} [startedAt]
 * @property {string} [completedAt]
 * @property {any[]} stages
 * @property {any[]} costs
 * @property {any[]} artifacts
 * @property {string} [artifactDir]
 * @property {string} [contentPath]
 */

/**
 * Create a new experiment tied to a source snapshot.
 * @param {Object} opts
 * @param {string} opts.name
 * @param {SourceSnapshot} opts.sourceSnapshot
 * @param {string} [opts.id]
 * @returns {Experiment}
 */
export function createExperiment({ name, sourceSnapshot, id = randomUUID() }) {
  return {
    id,
    name,
    sourceSnapshotId: sourceSnapshot.id,
    sourceUrl: sourceSnapshot.sourceUrl,
    createdAt: new Date().toISOString(),
    variants: [],
    artifacts: [],
    skillUsage: [],
    qaFindings: [],
    humanEvaluations: [],
    comparisonMatrix: undefined,
    automatedEvaluation: undefined,
    sourceSnapshot,
  };
}

/**
 * Add a variant to an experiment.
 * @param {Experiment} experiment
 * @param {ExperimentVariantDef} def
 * @returns {ExperimentVariant}
 */
export function addVariant(experiment, def) {
  const variant = {
    id: randomUUID(),
    name: def.name,
    generationProvider: def.generationProvider,
    generationMode: def.generationMode ?? GenerationMode.SAFE,
    status: RunStatus.PENDING,
    siteId: def.siteId,
    demoVariantId: def.demoVariantId,
    artifactDir: def.artifactDir,
    contentPath: def.contentPath,
    stages: [],
    costs: [],
    artifacts: [],
  };
  experiment.variants.push(variant);
  return variant;
}

/**
 * Attach a run to a variant.
 * @param {Experiment} experiment
 * @param {ExperimentVariant} variant
 * @param {import('./generationRun.mjs').GenerationRun} run
 * @param {any[]} artifacts
 */
export function attachRun(experiment, variant, run, artifacts = []) {
  variant.runId = run.id;
  variant.status = run.status;
  variant.startedAt = run.startedAt;
  variant.completedAt = run.completedAt;
  variant.stages = run.stages;
  variant.costs = aggregateCosts(run.costs);
  variant.artifacts = [...variant.artifacts, ...artifacts, ...run.artifacts];
  experiment.artifacts.push(...artifacts, ...run.artifacts);
  if (run.provenance) experiment.skillUsage.push(...run.provenance);
}

/**
 * Compute an automated evaluation for each variant and a comparison matrix.
 * @param {Experiment} experiment
 * @param {Object} measurementsByVariant
 */
export function evaluateExperiment(experiment, measurementsByVariant) {
  const evaluations = [];
  for (const variant of experiment.variants) {
    const measurements = measurementsByVariant[variant.name] || {};
    const eval_ = buildAutomatedEvaluation(measurements);
    eval_.notes = `Automated evaluation for ${variant.name}.`;
    variant.automatedEvaluation = eval_;
    evaluations.push({ name: variant.name, evaluation: eval_ });

    for (const finding of measurements.visualQA?.findings || []) {
      experiment.qaFindings.push({ ...finding, variant: variant.name });
    }
  }

  experiment.automatedEvaluation = evaluations[0]?.evaluation;
  experiment.comparisonMatrix = buildComparisonMatrix(evaluations);
}

/**
 * Persist an experiment manifest and report.
 * @param {Experiment} experiment
 * @param {string} outDir
 * @returns {Promise<{ manifestPath: string, reportPath: string }>}
 */
export async function saveExperiment(experiment, outDir) {
  await mkdir(outDir, { recursive: true });
  const manifestPath = join(outDir, 'experiment.json');
  const reportPath = join(outDir, 'REPORT-V2.md');
  await writeFile(manifestPath, JSON.stringify(experiment, null, 2), 'utf8');
  await writeExperimentReport(experiment, reportPath);
  return { manifestPath, reportPath };
}

/**
 * Load an experiment from disk.
 * @param {string} manifestPath
 * @returns {Promise<Experiment>}
 */
export async function loadExperiment(manifestPath) {
  const raw = await readFile(manifestPath, 'utf8');
  return JSON.parse(raw);
}
