import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createArtifactRef, hashFile } from './manifest.mjs';
import { ArtifactType } from './types.mjs';

/**
 * @typedef {import('./manifest.mjs').ArtifactRef} ArtifactRef
 */

/**
 * @typedef {object} SkillRecord
 * @property {string} id
 * @property {string} name
 * @property {string} source
 * @property {string} [version]
 * @property {string} [license]
 * @property {string[]} stages
 * @property {string} path
 */

/**
 * Discover installed skills and build a machine-readable registry.
 * @param {string} [skillsDir]
 * @returns {Promise<SkillRecord[]>}
 */
export async function discoverSkills(skillsDir = '.agents/skills') {
  const root = resolve(skillsDir);
  if (!existsSync(root)) return [];

  const records = [];
  const scopes = await readdir(root, { withFileTypes: true });

  for (const scope of scopes) {
    if (!scope.isDirectory()) continue;
    const scopePath = join(root, scope.name);
    const skillDirs = await readdir(scopePath, { withFileTypes: true });

    for (const skillDir of skillDirs) {
      if (!skillDir.isDirectory()) continue;
      const skillPath = join(scopePath, skillDir.name);
      const skillMd = join(skillPath, 'SKILL.md');
      const packageJson = join(skillPath, 'package.json');
      const versionFile = join(skillPath, 'VERSION');

      let metadata = { name: skillDir.name, license: 'unknown', stages: [] };
      if (existsSync(skillMd)) {
        const md = await readFile(skillMd, 'utf8');
        const frontmatter = md.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatter) {
          for (const line of frontmatter[1].split('\n')) {
            const [k, ...rest] = line.split(':');
            if (k && rest.length) metadata[k.trim()] = rest.join(':').trim();
          }
        }
      }
      if (existsSync(packageJson)) {
        const pkg = JSON.parse(await readFile(packageJson, 'utf8'));
        metadata.name = pkg.name ?? metadata.name;
        metadata.license = pkg.license ?? metadata.license;
      }
      if (existsSync(versionFile)) {
        metadata.version = (await readFile(versionFile, 'utf8')).trim();
      }

      records.push({
        id: `${scope.name}/${skillDir.name}`,
        name: metadata.name,
        source: `${scope.name}/${skillDir.name}`,
        version: metadata.version,
        license: metadata.license,
        stages: metadata.stages ? String(metadata.stages).split(',').map((s) => s.trim()).filter(Boolean) : [],
        path: skillPath,
      });
    }
  }

  return records;
}

/**
 * Write a skill registry manifest.
 * @param {SkillRecord[]} skills
 * @param {string} outDir
 * @returns {Promise<ArtifactRef>}
 */
export async function writeSkillRegistry(skills, outDir) {
  await mkdir(outDir, { recursive: true });
  const id = `skill-registry-${randomUUID().slice(0, 8)}`;
  const path = join(outDir, `${id}.json`);
  await writeFile(path, JSON.stringify({ generatedAt: new Date().toISOString(), skills }, null, 2), 'utf8');
  return createArtifactRef(ArtifactType.SKILL_REGISTRY, path);
}
