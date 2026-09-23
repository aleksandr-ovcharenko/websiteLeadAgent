# archive/legacy-scenarios — NON-PRODUCTION, QUARANTINED. DO NOT EXECUTE.

Every file in this directory is a **legacy one-off scenario**. These scripts
were used during V3.0–V3.7.5 development/recovery and are retained for
historical evidence only. They are NOT part of the production workflow and
MUST NOT be used for acceptance, recovery, or QA.

Classification (V3.7.6 Phase 0):

- **SITE-SPECIFIC ORCHESTRATION** — `nexttrade-*`, `100m3-*`, `atelit-*`,
  `mapid-*`, `proekt-m-*`, `run-crawl-mapid.mjs`, `run-generate-from-crawl.mjs`:
  hardcoded Lead/Site/CrawlRun IDs, preview tokens, route slugs, output paths.
- **MANUAL CONTENT REPAIR** — `v374-recover-nexttrade.mjs`,
  `v374-consolidate.mjs`, `*-import.mjs`, `*-extract.mjs`, `*-build-cms.mjs`,
  `fix-menu-semantic.ts`: direct Prisma/CMS mutations of specific sites.
- **VERSION-SCOPED QA** — `v3*-*.mjs`, `*-roundtrip.mjs`, `*-editorial-qa.mjs`,
  `ui-qa.mjs`, `e2e-acceptance-ph.mjs`, `final-pack-*`: hardcoded site/token
  evidence runs. Generic QA must go through the universal runners
  (`wla generate`, `wla qa`).
- **THROWAWAY DEBUG** — `tmp-*`, `*-debug*`.
- **ONE-OFF PILOTS** — `gen2-*`, `inspect-*`, `capture-*-ui.mjs` with
  hardcoded targets.

The production path for any site is exactly:

    npm run generate -- --url=<source-site-url>     # or --lead-id=<id>
    npm run qa -- --site-id=<id>                    # generic Playwright QA

See `apps/dashboard/src/cli/generate.ts` and `apps/dashboard/src/cli/qaSite.ts`.
The anti-overfit gate (`packages/redesign-engine/test/antiOverfit.test.ts`)
fails if client-specific values re-enter production code or operational
scripts.
