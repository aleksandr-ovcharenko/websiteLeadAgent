import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { NOT_MEASURED } from './types.mjs';

/**
 * @typedef {import('./generationRun.mjs').GenerationRun} GenerationRun
 * @typedef {import('./sourceSnapshot.mjs').SourceSnapshot} SourceSnapshot
 */

function fmtScore(score) {
  if (score === NOT_MEASURED || score === undefined || score === null) return 'NOT MEASURED';
  if (typeof score === 'number') return String(score);
  return String(score);
}

function fmtQuality(quality) {
  return quality ? `(${quality})` : '';
}

function header(level, text) {
  return `${'#'.repeat(level)} ${text}`;
}

/**
 * Generate a Markdown experiment report from a populated experiment object.
 * @param {Object} experiment
 * @returns {string}
 */
export function generateExperimentReport(experiment) {
  const lines = [];

  lines.push(header(1, `Experiment: ${experiment.name}`));
  lines.push(`  id: ${experiment.id}`);
  lines.push(`  sourceSnapshotId: ${experiment.sourceSnapshotId}`);
  lines.push(`  sourceUrl: ${experiment.sourceUrl}`);
  lines.push(`  createdAt: ${experiment.createdAt}`);
  lines.push('');

  // Source snapshot
  if (experiment.sourceSnapshot) {
    lines.push(header(2, 'Source Snapshot'));
    lines.push(`  id: ${experiment.sourceSnapshot.id}`);
    lines.push(`  crawler: ${experiment.sourceSnapshot.crawler}`);
    lines.push(`  crawledAt: ${experiment.sourceSnapshot.crawledAt}`);
    lines.push(`  contentHash: ${experiment.sourceSnapshot.contentHash}`);
    lines.push('');
    lines.push('Artifacts:');
    for (const a of experiment.sourceSnapshot.artifacts) {
      lines.push(`- [${a.type}] ${basename(a.path)} (${a.sha256.slice(0, 12)}…)`);
    }
    lines.push('');
  }

  // Variants
  lines.push(header(2, 'Variants'));
  for (const v of experiment.variants) {
    lines.push(header(3, v.name));
    lines.push(`  provider: ${v.generationProvider}`);
    lines.push(`  mode: ${v.generationMode}`);
    lines.push(`  status: ${v.status}`);
    lines.push(`  runId: ${v.runId ?? 'NOT RUN'}`);
    lines.push(`  durationMs: ${v.completedAt && v.startedAt ? new Date(v.completedAt).getTime() - new Date(v.startedAt).getTime() : 'NOT MEASURED'}`);
    lines.push('');
    lines.push('  Stages:');
    for (const s of v.stages || []) {
      const duration = s.durationMs != null ? `${s.durationMs}ms` : 'NOT MEASURED';
      lines.push(`    - ${s.name}: ${s.status} (${duration})`);
    }
    lines.push('');
    if (v.costs && v.costs.length) {
      lines.push('  Costs:');
      for (const c of v.costs) {
        const tokens = (c.inputTokens || 0) + (c.outputTokens || 0);
        const cost = c.estimatedCost != null ? `$${c.estimatedCost.toFixed(6)}` : 'NOT MEASURED';
        lines.push(`    - ${c.provider}/${c.operation}: requests=${c.requests ?? 0}, tokens=${tokens}, credits=${c.credits ?? 0}, cost=${cost}`);
      }
      lines.push('');
    }
  }

  // Comparison matrix
  if (experiment.comparisonMatrix) {
    lines.push(header(2, 'Comparison Matrix'));
    const { metrics, variants } = experiment.comparisonMatrix;
    lines.push(`| Metric | ${variants.map((v) => v.name).join(' | ')} |`);
    lines.push(`| --- | ${variants.map(() => '---').join(' | ')} |`);
    for (const m of metrics) {
      const cells = variants.map((v) => `${fmtScore(v.scores[m])} ${fmtQuality(v.quality?.[m])}`.trim());
      lines.push(`| ${m} | ${cells.join(' | ')} |`);
    }
    lines.push('');
  }

  // Automated evaluation details
  if (experiment.automatedEvaluation) {
    lines.push(header(2, 'Automated Evaluation'));
    const { scores, measurementQuality, notes } = experiment.automatedEvaluation;
    lines.push(notes || '');
    lines.push('');
    for (const [k, v] of Object.entries(scores)) {
      lines.push(`- ${k}: ${fmtScore(v)} ${fmtQuality(measurementQuality?.[k])}`.trim());
    }
    lines.push('');
  }

  if (experiment.humanEvaluations && experiment.humanEvaluations.length) {
    lines.push(header(2, `Human Evaluations (${experiment.humanEvaluations.length})`));
    for (const h of experiment.humanEvaluations) {
      lines.push(`- Evaluator: ${h.evaluator ?? 'anonymous'}`);
      for (const [k, v] of Object.entries(h.scores)) {
        lines.push(`  - ${k}: ${fmtScore(v)}`);
      }
    }
    lines.push('');
  }

  // Skill provenance
  if (experiment.skillUsage && experiment.skillUsage.length) {
    lines.push(header(2, 'Skill Provenance'));
    for (const u of experiment.skillUsage) {
      lines.push(`- ${u.skill} (${u.source}, ${u.version ?? 'unknown'}) → stage ${u.stage}`);
    }
    lines.push('');
  }

  // QA findings summary
  if (experiment.qaFindings && experiment.qaFindings.length) {
    lines.push(header(2, 'QA Findings Summary'));
    for (const f of experiment.qaFindings) {
      lines.push(`- [${f.severity}] ${f.category}: ${f.description}`);
      if (f.evidence) lines.push(`  evidence: ${f.evidence.slice(0, 140)}`);
    }
    lines.push('');
  }

  // Missing data
  const missing = [];
  if (!experiment.automatedEvaluation) missing.push('automated evaluation');
  if (!experiment.humanEvaluations?.length) missing.push('human evaluation');
  if (!experiment.comparisonMatrix) missing.push('comparison matrix');
  if (missing.length) {
    lines.push(header(2, 'Not Measured'));
    for (const m of missing) lines.push(`- ${m}: NOT MEASURED`);
    lines.push('');
  }

  lines.push(header(2, 'Artifacts'));
  for (const a of experiment.artifacts || []) {
    lines.push(`- [${a.type}] ${basename(a.path)}`);
  }

  return lines.join('\n');
}

/**
 * Write a Markdown experiment report to disk.
 * @param {Object} experiment
 * @param {string} outPath
 */
export async function writeExperimentReport(experiment, outPath) {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(dirname(outPath), { recursive: true });
  const md = generateExperimentReport(experiment);
  await writeFile(outPath, md, 'utf8');
  return md;
}
