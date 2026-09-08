import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
async function loadPackages(repoRoot) {
    const raw = await readFile(join(repoRoot, 'package-lock.json'), 'utf-8');
    const lock = JSON.parse(raw);
    const pkgs = lock.packages || {};
    const rootDeps = lock.packages?.['']?.dependencies || {};
    const rootDevDeps = lock.packages?.['']?.devDependencies || {};
    const packages = [];
    for (const [nodePath, pkg] of Object.entries(pkgs)) {
        const p = pkg;
        if (!nodePath.includes('node_modules/') || !p?.version)
            continue;
        const name = String(nodePath.split('node_modules/').pop() || nodePath).replace(/^\//, '');
        packages.push({
            nodePath,
            name,
            version: p.version,
            isDev: !!p.dev,
            isDirect: !!rootDeps[name] || !!rootDevDeps[name],
        });
    }
    return packages;
}
function contentHash(packages) {
    const sorted = packages.map((p) => `${p.name}@${p.version}:${p.isDev ? 'dev' : 'runtime'}`).sort();
    return createHash('sha256').update(sorted.join('\n')).digest('hex').slice(0, 32);
}
export async function ensureDependencySnapshot(prisma, templateId, repoRoot, opts) {
    const packages = await loadPackages(repoRoot);
    const hash = contentHash(packages);
    const source = `package-lock.json:${hash}`;
    const name = `template:${templateId}`;
    const existing = await prisma.securityDependencySnapshot.findFirst({
        where: { name, source },
        select: { id: true },
    });
    if (existing)
        return existing.id;
    const snapshot = await prisma.securityDependencySnapshot.create({
        data: {
            name,
            source,
            commitSha: opts?.commitSha,
        },
    });
    const chunkSize = 200;
    for (let i = 0; i < packages.length; i += chunkSize) {
        const chunk = packages.slice(i, i + chunkSize);
        const depIds = new Map();
        for (const pkg of chunk) {
            const dep = await prisma.securityDependency.upsert({
                where: { ecosystem_name_version: { ecosystem: 'npm', name: pkg.name, version: pkg.version } },
                update: { lastCheckedAt: new Date() },
                create: { ecosystem: 'npm', name: pkg.name, version: pkg.version, isDev: pkg.isDev, isDirect: pkg.isDirect },
            });
            depIds.set(`${pkg.name}@${pkg.version}`, dep.id);
        }
        await prisma.dependencyInSnapshot.createMany({
            data: chunk.map((pkg) => ({
                snapshotId: snapshot.id,
                dependencyId: depIds.get(`${pkg.name}@${pkg.version}`),
                path: pkg.nodePath,
                isDev: pkg.isDev,
                isDirect: pkg.isDirect,
            })),
            skipDuplicates: true,
        });
    }
    return snapshot.id;
}
export async function linkSiteBuildSnapshot(prisma, siteBuildId, snapshotId) {
    await prisma.siteBuild.update({
        where: { id: siteBuildId },
        data: { dependencySnapshotId: snapshotId },
    });
}
