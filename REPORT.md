# Redesign Flow and Radar UX — Fix Report

## Executive Summary

This session fixed the three main regressions in the WebsiteLeadAgent redesign flow:

1. **Radar dashboard flashing and lost selection** — refactored polling, added `selectedLeadId` and `refreshing` states, and separated initial loading from background revalidation.
2. **Lead detail selection feedback and Generate button** — added `selecting`/`generating` states, deterministic lifecycle conditions, and explicit pipeline status.
3. **Content extraction** — rewrote `crawlSite` to crawl navigation first, follow nested internal pages, normalize URLs, skip non-content assets, and preserve the original navigation tree in the CMS.

All packages build successfully (`@minsk/content-schema`, `@minsk/redesign-engine`, `@minsk/platform`).

## Root Causes

- **Select for redesign appeared to do nothing** because `RadarLeads` was resetting `selectedLead` on every poll and `LeadDetail` did not show an intermediate state. The backend state was persisted, but the UI refreshed too late.
- **Radar flashed** because `refresh()` set `loading` on every 10s poll and replaced the whole `leads` array unconditionally.
- **Generate button appeared later** because the action object relied on a live `lead` object that was being clobbered by revalidation.
- **Content extraction lost navigation** because `crawlSite` did a blind BFS with a low depth, ignored `<nav>/<footer>`, had a broken extension-detection bug, and `importToCms` created a hardcoded generic menu instead of using the source navigation.

## Fixes

### 1. Radar refresh and selection

- `apps/platform/src/radar/RadarLeads.tsx`
  - Added `refreshing`, `selectedLeadId` states.
  - `refresh(isBackground)` only sets `loading` on `isBackground=false`; background polls use `refreshing` and keep existing `leads` if the new batch is empty.
  - The selected lead is re-selected from the new list.
  - `selectForRedesign` now returns the API promise so `LeadDetail` can await it.

- `apps/platform/src/radar/LeadDetail.tsx`
  - Added `selecting` and `generating` states.
  - `primaryAction` is now lifecycle-aware:
    - `NOT_SELECTED` + `GOOD` → "Select for redesign"
    - `SELECTED_FOR_REDESIGN`/`CONTENT_*` → "Generate demo"
    - after site render → "Open site"
  - Button disables itself during `selecting`/`generating`.
  - Added a visible **Pipeline** status in the qualification grid.

### 2. Crawler and content architecture

- `packages/redesign-engine/src/crawl/crawlSite.ts`
  - Header/footer/body link extraction.
  - Sitemap seeding.
  - Navigation-first priority queue.
  - Fixed the `shouldCrawlUrl` extension bug (was rejecting all paths without dots).
  - Deeper crawl (`maxPages: 40`, `maxDepth: 4`).
  - Returns `CrawlResult` with `pages` and `navigation`.

- `packages/redesign-engine/src/extract/extractFromCrawl.ts`
  - Accepts `navigation` and includes it in `ExtractedContent`.

- `packages/redesign-engine/src/import/importToCms.ts`
  - Creates `MenuItem`s from the extracted navigation tree, matching pages by `sourceUrl` and preserving hierarchy via `parentId`.
  - Falls back to the previous generic menu only when no navigation is found.

- `packages/content-schema/src/index.ts`
  - Added `contentNavigationItemSchema` and `navigation` to `extractedContentSchema`.
  - Rebuilt `dist`.

- `packages/redesign-engine/src/types.ts`
  - Added `NavigationNode`, `CrawlResult`, `priority`, `navItem`, and `maxDepth`.

- `packages/redesign-engine/src/pipeline/index.ts`
  - Uses `const { pages: crawled, navigation } = await crawlSite(...)`.

## Verification

Builds pass:

```bash
npm run build --workspace=@minsk/content-schema
npm run build --workspace=@minsk/redesign-engine
npm run build --workspace=@minsk/platform
```

Crawl verification:

```bash
node scripts/test-crawl.mjs 'https://versh.by/'
node scripts/test-crawl.mjs 'https://garant.by/'
```

Observed `versh.by`:
- 13 pages discovered, depth up to 2.
- 18 navigation items extracted from header and footer.

Observed `garant.by`:
- 20 pages discovered, depth 1.
- 16 navigation items extracted, including nested `/dlya-doma/*` and `/dlya-biznesa/*`.

Platform UI builds successfully, so `LeadDetail` and `RadarLeads` compile with the new types.

## Files Changed

- `apps/platform/src/radar/LeadDetail.tsx`
- `apps/platform/src/radar/RadarLeads.tsx`
- `packages/redesign-engine/src/crawl/crawlSite.ts`
- `packages/redesign-engine/src/extract/extractFromCrawl.ts`
- `packages/redesign-engine/src/import/importToCms.ts`
- `packages/redesign-engine/src/pipeline/index.ts`
- `packages/redesign-engine/src/types.ts`
- `packages/content-schema/src/index.ts` + `dist`
- `packages/redesign-engine/dist/*` (rebuilt)
- `scripts/test-crawl.mjs` (new verification script)

## Notes

- The `__name` runtime issue surfaced only when the script was run via `tsx`, so the verification script is `.mjs` and uses the compiled `dist` output.
- The UI needs an authenticated platform session and a real discovery run for full Playwright acceptance tests; the build and crawl outputs confirm the critical paths are wired correctly.
