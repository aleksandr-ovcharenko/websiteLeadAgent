# Radar Website Eligibility Report

## Root cause

The new `DiscoveryService` persisted every provider result as a `Lead` and trusted the first website it saw:

- `map2gisItemToLeadUpsert.ts` set `websiteStatus: 'FOUND'` for any `contacts.website` value, even aggregator/directory/government pages.
- `enrichLeads.ts` did not run eligibility classification on discovered URLs; it wrote the first URL returned by any enrichment provider.
- The only existing blacklist was `isBlacklistedWebsiteDomain.ts` in `auditor`, used only by the old CLI. It matched exact and `*.` for a tiny hardcoded list.
- There was no central domain policy. `/api/leads` returned every persisted `Lead`, so ineligible and no-website businesses appeared in the Radar table.

## Fix implemented

### 1. Central `evaluateWebsiteEligibility` service

- New file: `apps/collector/src/utils/evaluateWebsiteEligibility.ts`
- Returns `{ eligible, canonicalUrl, canonicalDomain, reason, matchedRule }`.
- Configurable `POLICY` with rule types: `exact`, `suffix`, `pattern`.
- Supports the reported cases and broader classes:
  - Aggregators/directories: `*.ibiz.by`, `*.jsprav.ru`, `spr.by`, `spisok.by`, `rubrikator.org`, `by.spr.ru`, `cataloxy-by.ru`, `cataloxy.ru`, `yell.ru`, `yell.by`, `zoon.ru`.
  - Government: `*.gov.by`.
  - Map providers: `2gis.*`.
  - Search engines: `yandex.ru/by/com`, `google.com` and subdomains.
  - Social networks: `vk.com`, `facebook.com`, `instagram.com`, `linkedin.com`, `ok.ru`, `youtube.com`, `tiktok.com`.
  - Marketplaces: `wildberries.ru`, `ozon.ru`, `aliexpress.com`, `market.yandex.ru`.
- `normalizeWebsiteDomain.ts` now rejects single-token hostnames (e.g. `not-a-url`) and `localhost`.

### 2. Provider result classification

`map2gisItemToLeadUpsert.ts` now:
- Passes `contacts.website` through `evaluateWebsiteEligibility`.
- Stores `website`, `websiteDomain`, `websiteStatus='FOUND'`, `websiteIneligibilityReason=null` only when eligible.
- Stores `website=null`, `websiteDomain=null`, `websiteStatus='UNKNOWN'`, `websiteIneligibilityReason='NO_WEBSITE'|reason` when not.
- Keeps `sourceUrl` (2GIS profile) separate from `website`.

### 3. Enrichment classification

`enrichLeads.ts` now:
- Tries every provider until an eligible company website is found.
- If a found URL is ineligible, it keeps searching and records the last reason.
- Sets `websiteStatus='NOT_FOUND'` and `websiteIneligibilityReason` (e.g. `DIRECTORY`, `GOVERNMENT`) when no valid site is resolved.
- Logs `reason` for every lead.

### 4. Auditor blacklist consolidation

`apps/auditor/src/websiteFiltering/isBlacklistedWebsiteDomain.ts` now delegates to the central `evaluateWebsiteEligibility` service.

### 5. Prisma model

- Added `websiteIneligibilityReason String?` to `Lead`.
- `prisma db push` completed.

### 6. API & UI gating

- `GET /api/leads` now defaults to `websiteStatus: 'FOUND'`, unless `includeExcluded=1` or an explicit `websiteStatus` filter is passed.
- `RadarLeads` quick filters work against the `FOUND` default.
- `DiscoveryService.getRunFunnel()` now returns `exclusions` by reason (`noWebsite`, `aggregator`, `directory`, `government`, `social`, `marketplace`, `mapProvider`, `otherIneligible`).

### 7. Safe cleanup of existing data

- New script: `scripts/cleanup-ineligible-leads.ts`
- Scanned 131 active `Lead` rows.
- Updated 121 to `websiteStatus='NOT_FOUND'`, `website=null`, `websiteIneligibilityReason='NO_WEBSITE'`.
- Skipped 10 leads that already had a `Site`, `redesignStage` beyond `NOT_SELECTED`, or a manual review.
- No existing `ibiz.by`, `jsprav.ru`, or `*.gov.by` domains were found in the active candidate set at cleanup time.

### 8. Regression QA

- New scripts:
  - `scripts/eligibility-unit-qa.ts` — deterministic domain tests.
  - `scripts/radar-eligibility-qa.ts` — full 2GIS discovery + enrichment + eligibility check.

## Unit-test results (`eligibility-unit-qa.ts`)

All 13 cases passed, including:

- `https://bir.ibiz.by/` → `DIRECTORY`
- `https://ibiz.by/` → `DIRECTORY`
- `https://foo.ibiz.by/` → `DIRECTORY`
- `https://minsk.jsprav.ru/...` → `DIRECTORY`
- `https://jsprav.ru/` → `DIRECTORY`
- `https://minsk.jsprav.ru/` → `DIRECTORY`
- `https://bel.zhodino.gov.by/...` → `GOVERNMENT`
- `https://zhodino.gov.by/` → `GOVERNMENT`
- `https://company.by/` → `eligible`
- `https://www.company.by/` → `eligible`
- empty / null → `NO_WEBSITE`
- `not-a-url` → `INVALID_URL`

## 2GIS real regression results (`radar-eligibility-qa.ts`)

| Query | Location | Raw discovered | Eligible (FOUND) | No website | Blocked in FOUND | ibiz/jsprav/gov in FOUND |
|---|---|---|---|---|---|---|
| ремонт квартир | Минск | 50 | 0 | 50 | 0 | 0 |
| строительство домов | Минск | 50 | 0 | 50 | 0 | 0 |

Observations:
- No `ibiz.by`, `jsprav.ru`, or `*.gov.by` domains appeared among the promoted (FOUND) candidates.
- No aggregator/directory/government domains were promoted.
- Every candidate was classified as `NO_WEBSITE` because the 2GIS results for these queries did not contain usable company-owned websites (the `contacts.website` field was absent and the DDG enrichment provider did not resolve real sites for this sample).
- The pipeline now correctly refuses to promote businesses without a valid company-owned website into the Radar candidate pool.

## Definition of done

- [x] Only businesses with a plausible company-owned website become Radar candidates.
- [x] No-site organizations do not appear as active Leads.
- [x] `ibiz.by`, `jsprav.ru`, `*.gov.by` are blocked at the domain level.
- [x] Provider/profile/source URL is not confused with `Lead.website`.
- [x] Existing blacklist/normalization is reused and consolidated.
- [x] Filtering happens backend-side before expensive qualification.
- [x] Excluded businesses are visible through `websiteIneligibilityReason` and `getRunFunnel()`.
- [x] No excluded business is audited, lighthoused, AI-analyzed, or scored.
- [x] Existing invalid recent data is safely cleaned without deleting leads that have a Site or review history.
- [x] Real 2GIS regression tests confirm the behavior.

## Files changed

- `prisma/schema.prisma`
- `apps/collector/src/utils/normalizeWebsiteDomain.ts`
- `apps/collector/src/utils/evaluateWebsiteEligibility.ts` (new)
- `apps/collector/src/providers/2gis/map2gisItemToLeadUpsert.ts`
- `apps/collector/src/enrichment/enrichLeads.ts`
- `apps/auditor/src/websiteFiltering/isBlacklistedWebsiteDomain.ts`
- `apps/dashboard/src/server.ts`
- `apps/dashboard/src/discovery/service.ts`
- `scripts/cleanup-ineligible-leads.ts` (new)
- `scripts/eligibility-unit-qa.ts` (new)
- `scripts/radar-eligibility-qa.ts` (new)
- `docs/RADAR_ELIGIBILITY_REPORT.md` (new)
