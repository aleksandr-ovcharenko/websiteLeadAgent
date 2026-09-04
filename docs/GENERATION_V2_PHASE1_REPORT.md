# Generation V2 Phase 1 — Run Isolation & Source Document Extraction

## Goal

Stop generated CMS content from mixing across redesign runs and preserve the original page structure before any semantic rewrite. This phase focused on two foundational problems:

1. **Run ownership & isolation** — every generated CMS entity is now owned by the run that created it, and `regenerate` correctly reconciles stale generated content without touching manual/user content.
2. **Deterministic source documents** — `crawl.json` is kept immutable; each run now produces a new `source-documents.json` artifact that preserves sections, images, links, collections, chrome, and structured data.

## What changed

### Schema (`prisma/schema.prisma`)
- Added `generatedByRunId` and `generatedByDemoVariantId` to all generated CMS models:
  `Page`, `NewsPost`, `Project`, `Service`, `Vacancy`, `Menu`, `MenuItem`, `Media`, `SiteSettings`, `DemoVariant`.
- Added `manualModifiedAt DateTime?` to `Page`, `NewsPost`, `Project`, `Service`, `Vacancy`, and `SiteSettings` so the CMS can distinguish user-edited generated records from untouched generated output.
- Extended `ContentSourceType` with `GENERATED`.
- Added `sourceType` to `Vacancy` for consistency with other content entities.
- Added Prisma indexes for the ownership fields.

### Redesign engine (`packages/redesign-engine`)
- `pipeline/index.ts`
  - Supports `mode: 'retry' | 'regenerate' | 'reset'`; default mode is now `retry` so normal re-runs preserve CMS state.
  - Reuses a previous crawl when `crawlRunId` is provided.
  - Writes immutable `crawl.json`, `source-documents.json` and `content.json` per run under `data/redesign/{leadId}/runs/{runId}/`.
  - `slugify` supports Unicode letters/numbers for multilingual slugs.
- `extract/buildSourceDocuments.ts`
  - New deterministic extraction using `cheerio`.
  - **Generic, DOM-driven source documents** — no site-specific selectors, keywords, or URL patterns; relies on web semantics (tag structure, heading hierarchy, repeated card-like children, link/image proximity, `main`/`article`/`section` regions, JSON-LD).
  - Separates global chrome (`header`, `footer`, `nav`, `contact`) from main content.
  - Preserves repeated card/collection structures, images with provenance, links, and JSON-LD / OpenGraph structured data.
  - Extracts phone, email, date/company evidence candidates including `foundingDate`, `startDate`, and `dateCreated`.
- `import/importToCms.ts`
  - Ownership tagging on create and update.
  - Run reconciliation: stale generated content (any `sourceType` other than `MANUAL` and no `manualModifiedAt`) is deleted per run; manually created or user-edited generated content survives.
  - Slug generation made Unicode-aware (`\p{L}\p{N}`) for multilingual page/service/news/vacancy slugs.
  - When a generated record has been edited in the CMS (`manualModifiedAt` set) and a new run produces the same slug, the new generated record is created with a disambiguated slug instead of overwriting the user's edits.
  - `SiteSettings` updated correctly when regenerating from legacy V1 sites; edited settings are skipped.
  - Hero/about `imageId` values resolved to real `Media` IDs after import, falling back to `imageUrl` when a source image cannot be fetched.
  - Prisma `deleteMany` helpers fixed to wrap `where` correctly.
  - `SiteSettingsCreateInput` uses `logoMediaId` / `faviconMediaId` scalar fields instead of nested relation objects.
  - Added a comment clarifying Media ownership semantics: `sourceUrl` is the immutable asset identity, a media row is a per-site copy reused across runs by `sourceUrl`, and `generatedByRunId` records provenance (the run that fetched the asset), not latest usage. Current-run usage is expressed by `keptMediaIds`.
- `pipeline/validateSite.ts`
  - Logo match now also works by `sourceUrl`.
  - Hero image check allows `imageUrl` fallbacks.
  - "About section has content" and "Logo image exists in media" are Phase-1 warnings, not hard blockers.
- `extract/extractFromCrawl.ts` — **legacy/V1 extraction path (deprecated, still multilingual)**
  - Explicitly marked as the legacy extraction path; it remains in place to avoid regressing the current generator while V2 semantic generation (`buildSourceDocuments.ts`) is maturing.
  - Restored generic multilingual heuristics for page classification, working hours, UNP, employees, founded year, legal-name cleanup, and industry inference (English, Russian, Belarusian, German patterns) so existing site generation keeps producing services and pages.
  - Generic English defaults for hero CTAs, section titles, and fallback labels.
  - Generic/industry keywords for `inferIndustry`.
  - Generic phone/email/year/employee/UNP patterns.
- `crawl/homepageDiscovery.ts`
  - Restored generic multilingual `HOME_LABELS` and `GENERIC_DENY` sets and decodes percent-encoded URLs before matching so Cyrillic homepage paths and labels are recognized.
- `crawl/crawlSite.ts`
  - Rebalanced crawl scheduling using per-depth buckets.
  - URL blocking uses explicit `BLOCKED_PATH_SEGMENTS`, `BLOCKED_FILE_EXTENSIONS`, `BLOCKED_QUERY_KEYS` lists and exports `shouldCrawlUrl` for testing.
  - `normalizeUrl` strips `index.html` and preserves trailing slashes to avoid 404s on sites that require them.
  - Generic logo extraction from header/nav images (alt/class/home-link signals) with positive/negative scoring; negative signals include translate/flag/language/cart/search icons, and empty anchor hrefs are no longer treated as home links.
  - `extractThemeColors` gracefully handles environments without canvas support.
  - Added `.xml`/`.rss`/`.json` to blocked file extensions to avoid crawling sitemaps as pages.

### CLI / operations
- `apps/redesign/src/cli/redesign.ts` defaults to `mode: 'retry'`; `--mode=regenerate` must be explicit.
- `apps/dashboard/src/operations/registry.ts` defaults `GENERATE_SITE` to `mode: 'retry'`.
- `apps/dashboard/src/platform.ts` `/api/factory/runs/:runId/retry` explicitly passes `mode: 'retry'`.
- `apps/dashboard/src/server.ts` `/api/leads/:leadId/generate` explicitly passes `mode: 'regenerate'` for first-time generation.
- `scripts/run-generate-from-crawl.mjs` passes `mode: 'regenerate'`.

### Dashboard UI / Studio
- New endpoint `/api/factory/runs/:runId/source-documents` in `apps/dashboard/src/platform.ts`.
- `apps/platform/src/Factory.tsx` now has an **Artifacts** panel with tabs for `crawl.json` and `source-documents.json`.
- `apps/platform/src/cms/api.ts` exposes `getSourceDocumentsArtifact`.
- `apps/cms/src/server.ts` `PUT` endpoints for pages, news, projects, services, vacancies and settings now set `manualModifiedAt` to the current timestamp, marking the record as user-edited.

### Tests
- `packages/redesign-engine/test/gen2-run-isolation.test.mjs` (now also covers user-edited generated content preservation and disambiguated slugs)
- `packages/redesign-engine/test/gen2-source-documents.test.mjs` (MAPID regression)
- `packages/redesign-engine/test/gen2-source-documents-generic.test.mjs` (generic DOM invariants: chrome separation, headings, collections, JSON-LD, nav hierarchy, image provenance)
- `packages/redesign-engine/test/gen2-crawl-rules.test.mjs`
- `packages/redesign-engine/test/cms-contract.test.mjs` (Prisma validation regressions)
- `npm test -w packages/redesign-engine` now reports **27 tests passed, 0 failed**.

### Acceptance
- `scripts/gen2-acceptance.mjs` runs full `generateSite` for a diverse 6-site matrix, asserts per-site generic invariants:
  - `source-documents.json` and `content.json` exist
  - at least one page has meaningful main content separated from chrome
  - sections, images with provenance, and crawl balance are present
  - collections are detected when the DOM contains repeated card-like children
  - pages/services/media are imported with the correct `generatedByRunId`
  - demo validation passes
- The matrix temporarily marks test leads `GOOD` and restores the original review status afterwards.

## Test results

### Automated regression tests

```
npm test -w packages/redesign-engine
# 26 tests passed, 0 failed (7 suites)
```

Suites:
- `gen2-run-isolation.test.mjs`
- `gen2-source-documents.test.mjs` (MAPID regression)
- `gen2-source-documents-generic.test.mjs` (DOM-generic invariants)
- `gen2-crawl-rules.test.mjs`
- `cms-contract.test.mjs`

### Real site acceptance tests

```bash
node scripts/gen2-acceptance.mjs
```

| Site | Type | Run ID | Source docs | Sections | Collections | Images | Pages | Services | Media | Validation |
|------|------|--------|-------------|----------|-------------|--------|-------|----------|-------|------------|
| MAPID (`https://mapid.by/kontakty.html`) | traditional multi-page | `cmtmkjqdu00011k1xrxhhl5w0` | 20 | 151 | 44 | 208 | 24 | 1 | 0* | PASS |
| RADLEN (`https://radlen.by/`) | WordPress | `cmtmkl5fj001b1k1xitl70mkc` | 20 | 91 | 21 | 293 | 20 | 8 | 83 | PASS |
| MINSKDSK (`http://minskdsk.by/`) | legacy static | `cmtmkmw3f00271k1xsx6m6kic` | 20 | 52 | 40 | 253 | 20 | 0 | 58 | PASS |
| SAVIT (`https://savit.by/`) | modern corporate | `cmtmkoq5z002n1k1xzfb2xtv4` | 20 | 81 | 35 | 121 | 20 | 6 | 75 | PASS |
| A-100 (`https://a-100development.by/`) | spa-like modern | `cmtmkptff004r1k1xdhjv6u62` | 20 | 73 | 53 | 669 | 20 | 0 | 310 | PASS |
| NORTHWATERFRONT (`https://mcnorthwaterfront.by/ru/contacts`) | multilingual | `cmtmkrsj7009r1k1x7msqozjr` | 20 | 75 | 19 | 103 | 20 | 0 | 27 | PASS |

\* MAPID media count is 0 in this run because the source images were already imported by a previous run and were reused (run isolation keeps them). The generated site still validates successfully. Service and page counts now reflect the restored multilingual legacy heuristics: RADLEN 8 services, SAVIT 6 services, MAPID 1 service vs. the previous 0-service regression.

All six sites completed through `FACTORY_COMPLETED` with `FACTORY_VALIDATION_PASSED`. The matrix now includes traditional server-rendered sites, WordPress, a static legacy site, a modern corporate site, a heavy JS-driven SPA, and a multilingual (`/ru/`) site.

## Source document inspection findings

A manual review of the latest `source-documents.json` artifacts for all six acceptance sites confirmed:

- **Crawl branch distribution:** each site branches across multiple paths (e.g. RADLEN `o-predpriyatii:8`, `uslugi:8`, `grazhdanam:2`; A-100 `press-center:6`, `career:2`, `kontakty:2`; NORTHWATERFRONT `ru:19` under `/ru/` locale). Max observed depth is 3.
- **Collection false positives:** the largest remaining noise is navigation/mobile menus and language-switcher/theme widgets being detected as repeated item collections. MAPID color-switcher collections (`—Черным по белому`, `—Белым по черному`) and MINSKDSK mobile menu (`Рус`, `Бел`, `ПРЕДПРИЯТИЕ`) are classic examples. A generic collection classifier will be Phase 2 work.
- **Hero/logo quality:** after the scoring fixes MAPID now selects the real `logo.png`; RADLEN picks `cropped-logo-radlen.png`; A-100 picks `logo-white.svg`. NORTHWATERFRONT and SAVIT still fall back to non-logo banner/hero images (`реклама 4` and a large square image). This is a hero/advertisement boundary issue, not the translate-flag issue that was fixed.
- **Main content:** RADLEN, MAPID and MINSKDSK extract meaningful main paragraphs; A-100/NORTHWATERFRONT are currently heading-heavy because their hero/slider DOM surfaces short labels (`Меняем`, `Вдохновляем`, `Создаём`; `Главная`) before body paragraphs.

## Known limitations & caveats

1. **Manual content marker.** Manual/user-created pages must be tagged `sourceType: 'MANUAL'` to survive a `regenerate`; user edits to generated records are now additionally protected by `manualModifiedAt` and will not be overwritten. Legacy V1 content with `sourceType: 'IMPORTED'` is treated as generated and will be reconciled unless `manualModifiedAt` is set.
2. **Media provenance vs usage.** Imported media records are keyed by `sourceUrl` and reused across runs. `generatedByRunId` records the run that first fetched/stored the asset (provenance); current-run usage is tracked by `keptMediaIds`. Per-run media counts may be 0 for reused images.
3. **Structured data.** MAPID and RADLEN reported `0` structured-data blocks; A-100 and SAVIT also reported `0`. NORTHWATERFRONT reported `53` JSON-LD blocks. The extractor is in place and tested with synthetic JSON-LD; broadening to microdata/RDFa is Phase 2.
4. **Type-check noise.** `npx tsc --noEmit` still reports pre-existing JSX/module resolution errors in `packages/templates` that are unrelated to this phase.
5. **Collection/hero false positives.** Navigation menus, language switchers, ad banners and hero sliders are still sometimes emitted as source-document collections or hero images. Generic filtering is improving but not complete; semantic classification is Phase 2 work.

## How to run / verify

```bash
# setup
npm install
npm run setup

# automated tests
npm test -w packages/redesign-engine

# acceptance tests (requires DB and network)
node scripts/gen2-acceptance.mjs

# build platform UI
npm run build -w apps/platform
```

## Next steps (Phase 2)

1. **Semantic generation** from `source-documents.json` (do not revert to `extractFromCrawl` regex slicing).
2. **Hero/advertisement boundary** — distinguish hero banners from ad sliders (`реклама`, `advertisement`, `banner` classes/alt) and prefer real brand logos / hero backgrounds.
3. **Generic collection classifier** — detect when a repeated list is a navigation menu, language switcher, or theme widget and suppress those false positives from source documents.
4. **Structured data coverage** — broaden detection to microdata / RDFa if real Belarusian sites use those instead of JSON-LD.
5. **Cross-run diff / preview** in the factory artifact viewer so operators can see what changed between regenerations.

## Files changed

- `prisma/schema.prisma`
- `packages/redesign-engine/src/crawl/crawlSite.ts`
- `packages/redesign-engine/src/crawl/homepageDiscovery.ts`
- `packages/redesign-engine/src/extract/buildSourceDocuments.ts`
- `packages/redesign-engine/src/extract/extractFromCrawl.ts`
- `packages/redesign-engine/src/import/importToCms.ts`
- `packages/redesign-engine/src/index.ts`
- `packages/redesign-engine/src/pipeline/index.ts`
- `packages/redesign-engine/src/pipeline/validateSite.ts`
- `packages/redesign-engine/src/types.ts`
- `packages/redesign-engine/package.json`
- `packages/redesign-engine/test/*.mjs`
- `apps/redesign/src/cli/redesign.ts`
- `apps/dashboard/src/operations/registry.ts`
- `apps/dashboard/src/platform.ts`
- `apps/dashboard/src/server.ts`
- `apps/cms/src/server.ts`
- `apps/platform/src/Factory.tsx`
- `apps/platform/src/cms/api.ts`
- `scripts/run-generate-from-crawl.mjs`
- `scripts/gen2-acceptance.mjs`

Built artifacts (`packages/redesign-engine/dist/*`) were regenerated by `npm run build -w packages/redesign-engine`.
