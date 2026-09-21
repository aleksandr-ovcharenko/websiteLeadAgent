import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ArtifactType, EvaluationMetric, MeasurementQuality, NOT_MEASURED } from './types.mjs';
import { createArtifactRef } from './manifest.mjs';

/**
 * @typedef {import('./manifest.mjs').ArtifactRef} ArtifactRef
 */

/**
 * @typedef {string | number | 'NOT_MEASURED'} Score
 */

/**
 * @typedef {Object} Evaluation
 * @property {string} source
 * @property {string} [evaluator]
 * @property {Record<string, Score>} scores
 * @property {Record<string, string>} measurementQuality
 * @property {string} [notes]
 */

/**
 * @typedef {Object} ExperimentEvaluation
 * @property {string} experimentId
 * @property {Evaluation} [automated]
 * @property {Evaluation[]} human
 * @property {Object} [comparisonMatrix]
 */

/**
 * Create an empty evaluation where every metric is explicitly NOT_MEASURED.
 * @param {string} source
 * @param {string} [evaluator]
 * @returns {Evaluation}
 */
export function createEmptyEvaluation(source = 'AUTOMATED', evaluator) {
  /** @type {Record<string, Score>} */
  const scores = {};
  /** @type {Record<string, string>} */
  const measurementQuality = {};
  for (const key of Object.keys(EvaluationMetric)) {
    scores[key] = NOT_MEASURED;
    measurementQuality[key] = MeasurementQuality.NOT_MEASURED;
  }
  return { source, evaluator, scores, measurementQuality, notes: 'No evaluation recorded yet.' };
}

/**
 * Fill automated scores from available measurements.
 * @param {Object} measurements
 * @returns {Evaluation}
 */
export function buildAutomatedEvaluation(measurements) {
  const eval_ = createEmptyEvaluation('AUTOMATED', 'foundation');
  if (measurements.lighthouse) {
    eval_.scores.performance = measurements.lighthouse.performance ?? NOT_MEASURED;
    eval_.scores.accessibility = measurements.lighthouse.accessibility ?? NOT_MEASURED;
    eval_.scores.bestPractices = measurements.lighthouse.bestPractices ?? NOT_MEASURED;
    eval_.scores.seo = measurements.lighthouse.seo ?? NOT_MEASURED;
    eval_.measurementQuality.performance = MeasurementQuality.DETERMINISTIC;
    eval_.measurementQuality.accessibility = MeasurementQuality.DETERMINISTIC;
    eval_.measurementQuality.bestPractices = MeasurementQuality.DETERMINISTIC;
    eval_.measurementQuality.seo = MeasurementQuality.DETERMINISTIC;
  }
  if (measurements.navigation) {
    eval_.scores.navigationIntegrity = measurements.navigation.validPercent ?? NOT_MEASURED;
    eval_.measurementQuality.navigationIntegrity = MeasurementQuality.HEURISTIC;
  }
  if (measurements.integrity) {
    const high = measurements.integrity.findings.filter((f) => f.severity === 'HIGH' || f.severity === 'CRITICAL').length;
    // Inverse: fewer high-severity findings = higher score. This is a coarse heuristic.
    eval_.scores.contentCorrectness = high > 5 ? 20 : high > 2 ? 40 : high > 0 ? 70 : 90;
    eval_.measurementQuality.contentCorrectness = MeasurementQuality.HEURISTIC;
  }
  if (measurements.durationMs != null) {
    eval_.scores.duration = measurements.durationMs;
    eval_.measurementQuality.duration = MeasurementQuality.DETERMINISTIC;
  }
  if (measurements.costUsd != null) {
    eval_.scores.cost = measurements.costUsd;
    eval_.measurementQuality.cost = MeasurementQuality.DETERMINISTIC;
  }
  eval_.notes = 'Automated scores derived from Lighthouse, navigation and integrity reports. Content correctness is a coarse heuristic; do not treat it as authoritative.';
  return eval_;
}

/**
 * Add a human evaluation.
 * @param {ExperimentEvaluation} experimentEval
 * @param {Evaluation} evaluation
 */
export function addHumanEvaluation(experimentEval, evaluation) {
  experimentEval.human.push(evaluation);
}

/**
 * Build a comparison matrix across variants.
 * @param {Array<{ name: string, evaluation: Evaluation }>} variants
 * @returns {{ metrics: string[], variants: Array<{ name: string, scores: Record<string, Score>, quality: Record<string, string> }> }}
 */
export function buildComparisonMatrix(variants) {
  const metrics = Object.keys(EvaluationMetric);
  return {
    metrics,
    variants: variants.map((v) => ({
      name: v.name,
      scores: v.evaluation.scores,
      quality: v.evaluation.measurementQuality,
    })),
  };
}

/**
 * Create an experiment evaluation artifact and write it to disk.
 * @param {ExperimentEvaluation} evaluation
 * @param {string} outDir
 * @returns {Promise<ArtifactRef>}
 */
export async function writeEvaluation(evaluation, outDir) {
  await mkdir(outDir, { recursive: true });
  const id = `evaluation-${randomUUID().slice(0, 8)}`;
  const path = join(outDir, `${id}.json`);
  await writeFile(path, JSON.stringify(evaluation, null, 2), 'utf8');
  return createArtifactRef(ArtifactType.EVALUATION, path, { experimentId: evaluation.experimentId });
}
