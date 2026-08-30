# Radar Discovery Regression Report

## Exact run investigated

- **DiscoveryRun.id**: `cmtgcwjdy00552dpcpf53o03u`
- **Provider**: `dgis`
- **Query**: `строительная фирма`
- **Location**: `Минск`
- **Created**: `2026-08-30T22:03:50.182Z`
- **Updated**: `2026-08-30T22:03:51.282Z` (marked `COMPLETED`)

## What "8 new · 42 dup" means

`8 new` = **8 new canonical `Lead` records** were inserted because `source` + `sourceId` did not exist yet.

`42 dup` = **42 discovered businesses already matched an existing `Lead` record**, so the existing `Lead` was linked/reused.

The History label previously presented `8 new` as if it meant 8 new Radar candidates. It did not.

## 8 new candidates and their disposition

All 8 were inserted at `2026-08-30T22:03:51` and are `websiteStatus: NOT_FOUND` with `websiteIneligibilityReason: NO_WEBSITE`.

| # | Lead.id | 2GIS sourceId | Company | Website | Final state | Visible in Radar |
|---|---|---|---|---|---|---|
| 1 | cmtgcwk51008n2dpcs4kbrbkc | 70000001084527331 | Teplone. by, магазин товаров для бань | null | NO_WEBSITE | no |
| 2 | cmtgcwk5l008w2dpcbyq260qb | 70000001042261099 | Белавтодор, компания | null | NO_WEBSITE | no |
| 3 | cmtgcwk5r008z2dpc04xxl69b | 70000001042366200 | Ремавтодор Октябрьского района г. Минска | null | NO_WEBSITE | no |
| 4 | cmtgcwk6k00982dpccg1f1wn0 | 70000001042366251 | Ремавтодор Фрунзенского района г. Минска | null | NO_WEBSITE | no |
| 5 | cmtgcwk6x009b2dpcp1zkoxjt | 70000001054785580 | Управление СтройМеханизации | null | NO_WEBSITE | no |
| 6 | cmtgcwk77009e2dpc9cd2ye37 | 70000001042021618 | Белсвязьстрой, компания | null | NO_WEBSITE | no |
| 7 | cmtgcwk7v009k2dpc5y0g6nq4 | 70000001042265918 | Белпромстрой, компания | null | NO_WEBSITE | no |
| 8 | cmtgcwk8a009n2dpcu7b9kkx5 | 70000001042270309 | Бк-телеком, компания | null | NO_WEBSITE | no |

## Why they did not appear in `/radar`

`/api/leads` now defaults to `websiteStatus: 'FOUND'`. All 50 linked leads in this run are `NOT_FOUND`, so none are returned to the Radar table. This is the expected, correct eligibility gating.

## Root cause: COMPLETED before enrichment

- `DiscoveryRun` was marked `COMPLETED` at `22:03:51.282Z`.
- The same leads were updated by enrichment between `22:04:35` and `22:05:33`.
- `DiscoveryService.start()` launched `enrichLeads` with `setImmediate()` and returned immediately.
- The UI could see `COMPLETED` while the required work (website resolution + eligibility) was still in progress.

## Fixes applied

### Backend lifecycle

`apps/dashboard/src/discovery/service.ts` now:
1. Creates the run with `status: 'DISCOVERING'`.
2. After provider search and upsert, updates to `status: 'ENRICHING'` with `collected`, `createdCount`, `duplicateCount`, `leadIds`.
3. `await`s `enrichLeads(...)`.
4. Only then sets `status: 'COMPLETED'`.
5. On any error sets `status: 'FAILED'`.

### Funnel API

`getRunFunnel()` already returns `exclusions` by reason; now also returns `newLeadCount` and `reusedLeadCount` from the run counts.

### UI updates

- `apps/platform/src/radar/RadarHistory.tsx`:
  - Polls every 3 seconds so `ENRICHING` → `COMPLETED` is visible.
  - Understands `DISCOVERING` and `ENRICHING` status badges.
  - History row now shows: `{collected} found · {createdCount} new leads · {duplicateCount} known`.

- `apps/platform/src/radar/RadarLeads.tsx`:
  - Auto-refreshes every 10 seconds so eligible new Leads appear without a full page reload.

## New real 2GIS regression tests

### `discovery-lifecycle-qa.ts`

| Query | Limit | Status | Collected | New Leads | Known | FOUND (visible) | NOT_FOUND |
|---|---|---|---|---|---|---|---|
| строительная фирма | 50 | `COMPLETED` (after enrichment) | 50 | 0 | 50 | 33 | 17 |
| строительство домов | 20 | `COMPLETED` (after enrichment) | 20 | 0 | 20 | 13 | 7 |

In the `строительная фирма` test, exclusion reasons were: `NO_WEBSITE` 10, `DIRECTORY` 6, `GOVERNMENT` 1.

### `discovery-invariant-qa.ts`

Ran a `ремонт квартир` query with `limit: 10` and asserted:

- `run.status === 'COMPLETED'`
- `collected === createdCount + duplicateCount`
- `collected === linkedLeadCount`
- `FOUND + NOT_FOUND === collected`
- `Radar-visible count === FOUND count`

Result: `ok: true`, `collected: 10`, `found: 8`, `apiLeads: 8`.

## Definition of done

- [x] Exact run traced; all 8 new candidates and their disposition reported.
- [x] Root cause identified: `COMPLETED` before enrichment.
- [x] `DiscoveryRun` no longer completes until enrichment + eligibility finish.
- [x] History semantics clarified: `found · new leads · known`.
- [x] `ENRICHING` status exposed and visible.
- [x] `RadarHistory` and `RadarLeads` auto-refresh.
- [x] New real 2GIS tests confirm accounting and Radar visibility are consistent.
- [x] Automated invariant test added and passing.

## Files changed

- `apps/dashboard/src/discovery/service.ts`
- `apps/platform/src/radar/RadarHistory.tsx`
- `apps/platform/src/radar/RadarLeads.tsx`
- `scripts/investigate-run.ts`
- `scripts/discovery-lifecycle-qa.ts`
- `scripts/discovery-invariant-qa.ts`
- `docs/investigate-run-result.json`
- `docs/investigate-new-leads.json`
- `docs/RADAR_DISCOVERY_REGRESSION_REPORT.md`
