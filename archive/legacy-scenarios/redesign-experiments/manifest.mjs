import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/** @typedef {import('./types.mjs').ArtifactType} ArtifactType */

/**
 * @typedef {object} ArtifactRef
 * @property {string} type
 * @property {string} path
 * @property {string} sha256
 * @property {string} createdAt
 * @property {string} [provider]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {object} ArtifactManifest
 * @property {string} runId
 * @property {string} experimentId
 * @property {string} createdAt
 * @property {ArtifactRef[]} artifacts
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * Compute SHA-256 of a file.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export async function hashFile(filePath) {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Hash arbitrary JSON-serializable data.
 * @param {unknown} value
 * @returns {string}
 */
export function hashJson(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/**
 * Resolve a path relative to a manifest root.
 * @param {string} root
 * @param {string} filePath
 * @returns {string}
 */
export function manifestPath(root, filePath) {
  return resolve(root, filePath);
}

/**
 * Load a manifest from disk.
 * @param {string} manifestPath
 * @returns {Promise<ArtifactManifest>}
 */
export async function loadManifest(manifestPath) {
  const raw = await readFile(manifestPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Write a manifest atomically and create parent directories.
 * @param {string} manifestPath
 * @param {ArtifactManifest} manifest
 */
export async function writeManifest(manifestPath, manifest) {
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

/**
 * Create an artifact reference and optionally ensure the artifact exists.
 * @param {string} type
 * @param {string} artifactPath
 * @param {Object} [opts]
 * @param {string} [opts.provider]
 * @param {Record<string, unknown>} [opts.metadata]
 * @returns {Promise<ArtifactRef>}
 */
export async function createArtifactRef(type, artifactPath, opts = {}) {
  if (!existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}`);
  }
  const sha256 = await hashFile(artifactPath);
  const s = await stat(artifactPath);
  return {
    type,
    path: artifactPath,
    sha256,
    createdAt: new Date(s.mtimeMs).toISOString(),
    provider: opts.provider,
    metadata: opts.metadata,
  };
}

/**
 * Build or extend an artifact manifest for a directory of known artifacts.
 * @param {string} root
 * @param {ArtifactRef[]} [known]
 * @returns {Promise<ArtifactManifest>}
 */
export async function buildDirectoryManifest(root, known = []) {
  const manifest = {
    runId: randomUUID(),
    experimentId: '',
    createdAt: new Date().toISOString(),
    artifacts: known,
    metadata: {},
  };
  await writeManifest(join(root, 'artifact-manifest.json'), manifest);
  return manifest;
}

/**
 * Verify all artifacts referenced by a manifest still match their hashes.
 * @param {ArtifactManifest} manifest
 * @returns {Promise<{ok: boolean, mismatches: string[]}>}
 */
export async function verifyManifest(manifest) {
  const mismatches = [];
  for (const a of manifest.artifacts) {
    if (!existsSync(a.path)) {
      mismatches.push(`${a.type}: missing ${a.path}`);
      continue;
    }
    const sha256 = await hashFile(a.path);
    if (sha256 !== a.sha256) {
      mismatches.push(`${a.type}: hash mismatch ${a.path}`);
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

/**
 * List files in a directory recursively, returning relative paths.
 * @param {string} dir
 * @param {string} [base]
 * @returns {Promise<string[]>}
 */
export async function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFiles(full, base);
      files.push(...nested);
    } else {
      files.push(relative(base, full));
    }
  }
  return files;
}
