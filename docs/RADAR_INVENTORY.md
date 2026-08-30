# Radar capability inventory

Based on `apps/platform/src/Radar.tsx` (old) vs `apps/platform/src/radar/RadarLeads.tsx` (new) and the new `RadarConfiguration` shell.

## 1. Capabilities still present

| Feature | Old implementation | Current new Radar | Decision | New location |
|---|---|---|---|---|
| Lead list table | Yes | Yes (basic) | **IMPROVE** | `RadarLeads.tsx` |
| Search by company/domain | Yes | Yes (text) | **IMPROVE** | `RadarLeads.tsx` |
| Manual review status (UNREVIEWED / GOOD / BAD / UNSURE) | Yes | No (field not used) | **RESTORE** | `RadarLeads.tsx`, side panel |
| Bulk select + mark Good/Bad/Unsure | Yes | No | **RESTORE** | `RadarLeads.tsx` |
| Score ring / score pills | Yes | No | **RESTORE** | `RadarLeads.tsx` table + panel |
| Side panel / lead detail | Yes (`SidePanel`) | No | **RESTORE** | `LeadDetail.tsx` |
| Desktop/mobile screenshots in detail | Yes | No | **RESTORE** | `LeadDetail.tsx` |
| Screenshot hover "Open original site" | Yes | No | **RESTORE/IMPROVE** | `LeadDetail.tsx` |
| Lighthouse summary | Yes | Bare checkmark | **RESTORE** | `LeadDetail.tsx`, table badges |
| AI visual analysis summary (problems/strengths) | Yes | No | **RESTORE** | `LeadDetail.tsx` |
| Score bars (Business / Visual / Technical / Redesign) | Yes | No | **RESTORE** | `LeadDetail.tsx` |
| Keyboard shortcuts (G/U/B, J/K, Enter, Escape) | Yes | No | **IMPROVE** (optional) | `RadarLeads.tsx` |
| Original website link | Yes | Yes (row) | **IMPROVE** | `LeadDetail.tsx` + table |
| "Generate demo" / "View demo" action | Yes | Yes (per row) | **IMPROVE** | Action menu |

## 2. Capabilities missing in new Radar

| Feature | Old implementation | Current new Radar | Decision | New location |
|---|---|---|---|---|
| Compact statistics / KPI cards | No | No | **ADD** | `RadarStats.tsx` above table |
| DiscoveryRun filter / context | No | No | **ADD** | `RadarFilters.tsx` |
| Audit queue as real work queue | Sidebar link only | `mode="audit"` (rudimentary) | **IMPROVE** | `RadarLeads.tsx` + `mode=audit` |
| Selected view | Sidebar link | `mode="selected"` (rudimentary) | **IMPROVE** | `RadarLeads.tsx` + `mode=selected` |
| Filtering by status, audit, category, min score | Yes | No | **RESTORE** | `RadarFilters.tsx` |
| Sorting (score, redesign, discovered, reviewed) | Yes | No | **RESTORE** | `RadarFilters.tsx` |
| Lead lifecycle / qualification completeness | No | No | **ADD** | `LeadDetail.tsx` |
| Operation history per Lead | No | No | **ADD** | `LeadDetail.tsx` |
| Bulk qualification CTA | No | Per-Lead actions | **ADD** | `RadarLeads.tsx` bulk bar |
| Screenshot-first review layout | No | No | **ADD** | `LeadDetail.tsx` |
| Review notes / human decision status | No | No | **ADD** | `LeadDetail.tsx` + backend |

## 3. To keep from new shell (do NOT remove)

- New discovery modal + providers (`RadarProviders`, `NewDiscovery`)
- Discovery history (`RadarHistory`)
- Search presets (`RadarPresets`)
- Operation console (`OperationConsole`)
- DiscoveryRun persistence
- Backend operation registry (`DISCOVER_BUSINESSES`, `RUN_FULL_QUALIFICATION`, etc.)
- Unified `RadarConfiguration` shell and sidebar

## 4. Intentionally removed

| Old feature | Why | Replacement |
|---|---|---|
| Old 1252-line `RadarView` | Superseded by new shell | Decomposed components |
| `viewMode` review/table toggle | Simpler to use a single dense table with optional review panel | Dense table + expandable detail |
| Old sidebar nav | New unified sidebar | `RadarConfiguration` nav |

## 5. New backend / data requirements

- Consolidated `LeadRadarDTO` (or `/api/leads?radar=1`) including:
  - lead identity, website, domain, source, discoveryRun
  - `websiteStatus`, `enrichmentStatus`, `auditStatus`, `lighthouseReport`, `visualAnalysis`, `scoreStatus`, `manualReviewStatus`, `redesignStage`
  - `leadScoreV2`, `businessConfidenceScore`, `technicalQualityScore`, `visualQualityScore`, `scoreDetailsV2`
  - `site` (if generated) with `previewToken`
- Radar statistics endpoint: `/api/leads/stats?discoveryRunId=...`
- Lead detail endpoint: `/api/leads/:id/radar` (heavy DTO)
- Operation history per Lead: list recent `OperationRun`s for a Lead
- Manual review endpoint: `POST /api/leads/:id/review` (persist `manualReviewStatus`, `manualReviewNote`, `reviewedAt`)

## 6. Pre-qualification funnel issues to fix

The new `DiscoveryService.start` persists ALL provider results directly as `Lead` rows without:

- checking `websiteStatus` / website validity
- applying blacklist/aggregator filtering
- separating website-less companies
- cheap pre-qualification before expensive stages

The old CLI pipeline (`apps/collector/src/cli/leads.ts` → `apps/collector/src/cli/audit.ts`) effectively did:

1. Discover raw businesses (`collect2gisLeads.ts`)
2. Persist leads with `websiteStatus` (FOUND / UNKNOWN)
3. `audit --limit=24` selected ONLY leads with `website` (`WHERE website IS NOT NULL`) and only ran Lighthouse/AI for those

So the old workflow never ran Playwright/Lighthouse against website-less leads. The new web UI must re-implement this funnel explicitly:

- `websiteStatus = FOUND` but not yet eligible → `enrichmentStatus`
- `enrichmentStatus = SUCCESS` / website valid → `auditStatus PENDING`
- `auditStatus = SUCCESS` → `lighthouseReport` / `visualAnalysis`
- `visualAnalysis = SUCCESS` → `scoreStatus = SUCCESS` (`leadScoreV2` ready)
- `leadScoreV2 >= threshold` and `manualReviewStatus = GOOD` → `SELECTED_FOR_REDESIGN`

`DiscoveryRun` statistics must show funnel counts.
