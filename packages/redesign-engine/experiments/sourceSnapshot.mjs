import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { ArtifactType } from './types.mjs';
import { createArtifactRef, hashJson, manifestPath } from './manifest.mjs';

/**
 * @typedef {import('./manifest.mjs').ArtifactRef} ArtifactRef
 */

/**
 * @typedef {object} SourceSnapshot
 * @property {string} id
 * @property {string} sourceUrl
 * @property {string} crawler
 * @property {string} [crawlRunId]
 * @property {string} crawledAt
 * @property {ArtifactRef[]} artifacts
 * @property {string} contentHash
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * Resolve a file path relative to a snapshot root, checking existence.
 * @param {string} root
 * @param {string} file
 * @returns {string}
 */
function resolveArtifact(root, file) {
  const candidate = resolve(root, file);
  if (!existsSync(candidate)) {
    throw new Error(`SourceSnapshot artifact missing: ${candidate}`);
  }
  return candidate;
}

/**
 * Create a SourceSnapshot from existing crawl artifacts.
 * @param {Object} opts
 * @param {string} opts.root
 * @param {string} opts.sourceUrl
 * @param {string} [opts.crawler]
 * @param {string} [opts.crawlRunId]
 * @param {string} [opts.crawledAt]
 * @param {string} [opts.id]
 * @returns {Promise<SourceSnapshot>}
 */
export async function createSourceSnapshot({
  root,
  sourceUrl,
  crawler = 'WLA',
  crawlRunId,
  crawledAt,
  id = randomUUID(),
}) {
  const artifacts = [];

  const crawlPath = resolveArtifact(root, 'crawl.json');
  artifacts.push(await createArtifactRef(ArtifactType.SOURCE_CRAWL, crawlPath, { provider: crawler }));

  // Prefer the V2 source documents / graph if present, otherwise fall back to V1.
  const docsV2 = resolve(root, 'v2/source-documents.json');
  const docsV1 = resolve(root, 'v1/source-documents.json');
  if (existsSync(docsV2)) {
    artifacts.push(await createArtifactRef(ArtifactType.SOURCE_DOCUMENTS, docsV2, { provider: crawler }));
  } else if (existsSync(docsV1)) {
    artifacts.push(await createArtifactRef(ArtifactType.SOURCE_DOCUMENTS, docsV1, { provider: crawler }));
  }

  const graphV2 = resolve(root, 'v2/source-content-graph.json');
  const graphV1 = resolve(root, 'v1/source-content-graph.json');
  if (existsSync(graphV2)) {
    artifacts.push(await createArtifactRef(ArtifactType.SOURCE_CONTENT_GRAPH, graphV2, { provider: crawler }));
  } else if (existsSync(graphV1)) {
    artifacts.push(await createArtifactRef(ArtifactType.SOURCE_CONTENT_GRAPH, graphV1, { provider: crawler }));
  }

  const sourceDesktop = resolve(root, 'screenshots/source-desktop.png');
  const sourceMobile = resolve(root, 'screenshots/source-mobile.png');
  if (existsSync(sourceDesktop)) {
    artifacts.push(await createArtifactRef(ArtifactType.SCREENSHOT_SOURCE_DESKTOP, sourceDesktop));
  }
  if (existsSync(sourceMobile)) {
    artifacts.push(await createArtifactRef(ArtifactType.SCREENSHOT_SOURCE_MOBILE, sourceMobile));
  }

  // If a B1 intelligence source crawl exists, reference it too.
  const b1Source = resolve(root, 'b1-intelligence/source-crawl.json');
  if (existsSync(b1Source)) {
    artifacts.push(await createArtifactRef(ArtifactType.SOURCE_CRAWL, b1Source, { provider: 'WLA', label: 'B1 source crawl copy' }));
  }

  const manifest = {
    id,
    sourceUrl,
    crawler,
    crawlRunId,
    crawledAt: crawledAt ?? new Date().toISOString(),
    artifacts,
    contentHash: '',
    metadata: { createdBy: 'foundation' },
  };

  // Content hash covers all artifact metadata so any change invalidates the snapshot.
  manifest.contentHash = hashJson(manifest.artifacts);

  const manifestPath = resolve(root, 'source-snapshot.json');
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return manifest;
}

/**
 * Load a previously created SourceSnapshot.
 * @param {string} manifestPath
 * @returns {Promise<SourceSnapshot>}
 */
export async function loadSourceSnapshot(manifestPath) {
  const raw = await readFile(manifestPath, 'utf8');
  return JSON.parse(raw);
}
