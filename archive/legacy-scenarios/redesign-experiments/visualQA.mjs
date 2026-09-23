import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ArtifactType, RunStatus, Severity, VisualQAProvider } from './types.mjs';
import { createArtifactRef } from './manifest.mjs';

/**
 * @typedef {import('./manifest.mjs').ArtifactRef} ArtifactRef
 */

/**
 * @typedef {object} VisualQAFinding
 * @property {string} severity
 * @property {string} category
 * @property {string} [section]
 * @property {string} description
 * @property {string} [evidence]
 */

/**
 * @typedef {object} VisualQAReport
 * @property {string} provider
 * @property {string} status
 * @property {string} url
 * @property {VisualQAFinding[]} findings
 * @property {string} [model]
 * @property {string} [promptVersion]
 * @property {number} [durationMs]
 * @property {string} [notes]
 */

/**
 * Create a provider-neutral VisualQA report.
 * @param {Object} opts
 * @param {string} opts.url
 * @param {string} opts.outDir
 * @param {string} [opts.provider]
 * @param {VisualQAFinding[]} [opts.findings]
 * @param {string} [opts.notes]
 * @returns {Promise<{ artifact: ArtifactRef, report: VisualQAReport }>}
 */
export async function createVisualQAReport({
  url,
  outDir,
  provider = VisualQAProvider.IMPECCABLE_GUIDED_AGENT,
  findings = [],
  notes = '',
}) {
  const report = {
    provider,
    status: findings.length ? RunStatus.SUCCESS : RunStatus.SKIPPED,
    url,
    findings,
    notes,
  };

  await mkdir(outDir, { recursive: true });
  const id = `visual-qa-${randomUUID().slice(0, 8)}`;
  const reportPath = join(outDir, `${id}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  const artifact = await createArtifactRef(ArtifactType.VISUAL_QA, reportPath, { url, provider });
  return { artifact, report };
}

/**
 * Add a manual or agent-assisted finding.
 * @param {VisualQAReport} report
 * @param {VisualQAFinding} finding
 */
export function addFinding(report, finding) {
  report.findings.push(finding);
  report.status = RunStatus.SUCCESS;
}
