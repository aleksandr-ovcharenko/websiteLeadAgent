// V3.7.5 — republish Forge previews for sites carrying a stale previewError
// or outdated screenshot marker. Verified publish path; clears the marker on
// success. No site/variant regeneration.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { publishForgePreview } from '../packages/redesign-engine/src/pipeline/forgePreview.js';

const prisma = new PrismaClient();

async function main() {
  const sites = await prisma.site.findMany({
    where: { status: { not: 'ARCHIVED' }, mergedIntoSiteId: null },
    select: { id: true, domain: true, settings: true },
  });
  for (const s of sites) {
    const needs = (s.settings as any)?.previewError || true; // republish all active to refresh markers
    if (!needs) continue;
    try {
      const r = await publishForgePreview({ siteId: s.id, prisma });
      console.log(s.id, s.domain ?? '-', '->', r.source, r.url);
    } catch (e: any) {
      console.log(s.id, s.domain ?? '-', 'FAILED:', e?.message);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
