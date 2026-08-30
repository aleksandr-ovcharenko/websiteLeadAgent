# Radar Restoration Report

## Scope

Restore and improve the Radar product inside the new unified `RadarConfiguration` shell. The new shell remains the single source of truth; the legacy `Radar.tsx` shell was not brought back and no second Radar implementation was created.

## What was delivered

### Backend

- **Extended `/api/leads`** with filters and fields required for an operational Radar:
  - query params: `q`, `sort`, `websiteStatus`, `enrichmentStatus`, `auditStatus`, `manual`, `discoveryRunId`.
  - select now includes `websiteStatus`, `enrichmentStatus`, `scoreStatus`, `generationStatus`, `websiteDomain`.
  - `discoveryRunId` filters by the `leadIds` stored on a `DiscoveryRun`, giving exact discovery context.
- **New `/api/leads/stats`** returns funnel counts (total, with/without website, enriched, audited, lighthoused, AI-analyzed, scored, GOOD, selected, generated, failed) with optional `discoveryRunId` filter.
- **New `/api/discovery/runs/:runId/stats`** returns funnel counts for a specific run via `DiscoveryService.getRunFunnel()`.
- **New `QUALIFY_DISCOVERY_RUN` operation** (`apps/dashboard/src/operations/registry.ts`) runs the full qualification pipeline (audit → Lighthouse → visual analysis → score) for all eligible leads from a discovery run, skipping leads without websites, with concurrency control. This restores the old CLI workflow of only running expensive stages on website-eligible candidates.

### Frontend

- **New `RadarStats.tsx`**: overview cards for every funnel stage and a discovery-run selector with a `Qualify eligible` CTA.
- **New `RadarFilters.tsx`**: search, website/audit/review filters, sort, and quick filters (All, GOOD, Needs audit, Needs AI, No website, Selected, Generated).
- **New `LeadDetail.tsx`**: side panel with:
  - desktop/mobile screenshot toggle
  - company/website/identity
  - qualification completeness (website, audit, Lighthouse, AI, score, review)
  - score breakdown (visual, technical, business, redesign potential)
  - AI summary, problems, strengths
  - Lighthouse scores
  - manual review decision (GOOD / BAD / MAYBE) with note
  - primary CTA (Qualify / Generate / Open demo) and secondary CTAs (Re-qualify, Open original).
- **New `RadarScoreRing.tsx`**: reusable lead score ring and score pills.
- **Rewritten `RadarLeads.tsx`**: dense qualification table with columns for score, visual, technical, business, audit, AI, review, actions, and an integrated side panel.
- Updated `api.ts` client with `getLeads(filters)`, `getLeadStats`, `getDiscoveryRunStats`, `reviewLead`, `setRedesignStage`.

### Qualification funnel restored

`DiscoveryService` already stores `leadIds` on `DiscoveryRun` and `enrichLeads` already sets `websiteStatus = FOUND/NOT_FOUND`. The new operation and UI make the funnel explicit and observable:

1. Discover → `DiscoveryRun.leadIds` persisted.
2. Enrich → `enrichmentStatus` set; `websiteStatus` becomes `FOUND` or `NOT_FOUND`.
3. **Eligibility check** — `QUALIFY_DISCOVERY_RUN` filters to `websiteStatus == FOUND` and `website`/`websiteDomain` present.
4. Audit → `auditStatus` = `SUCCESS` / `FAILED`; screenshots written.
5. Lighthouse → `lighthouseReport` populated.
6. AI analysis → `visualAnalysis` with summary and scores.
7. Score → `leadScoreV2` computed.
8. Manual review → `manualReviewStatus` and `manualReviewNote`.
9. Select → `redesignStage` = `SELECTED_FOR_REDESIGN`.
10. Generate → `site` created.

## QA

- Added `scripts/radar-smoke.ts` Playwright smoke test.
- Run results:

```json
{
  "results": [
    { "name": "radar-loaded", "ok": true },
    { "name": "leads-table", "ok": true, "note": "table visible" },
    { "name": "lead-detail", "ok": true }
  ],
  "consoleErrors": [
    "Failed to load resource: the server responded with a status of 401 (Unauthorized)",
    "Failed to load resource: the server responded with a status of 401 (Unauthorized)"
  ]
}
```

The 401s are from the unauthenticated landing redirect and are resolved after sign-in. Screenshots saved to `docs/screenshots/radar-smoke/`.

## Screenshots

- `docs/screenshots/radar-smoke/01-radar-overview.png`
- `docs/screenshots/radar-smoke/02-lead-detail.png`

## Files changed

- `apps/platform/src/radar/RadarLeads.tsx` (rewritten)
- `apps/platform/src/radar/RadarStats.tsx` (new)
- `apps/platform/src/radar/RadarFilters.tsx` (new)
- `apps/platform/src/radar/LeadDetail.tsx` (new)
- `apps/platform/src/radar/RadarScoreRing.tsx` (new)
- `apps/platform/src/cms/api.ts`
- `apps/dashboard/src/server.ts`
- `apps/dashboard/src/discovery/service.ts`
- `apps/dashboard/src/operations/registry.ts`
- `docs/RADAR_INVENTORY.md`
- `docs/RADAR_RESTORATION_REPORT.md`
- `scripts/radar-smoke.ts`

## Old vs new capabilities

| Capability | Old `Radar.tsx` | New unified Radar |
|---|---|---|
| Stats overview | Inline local counts | Real `/api/leads/stats` + discovery-run funnel |
| Discovery context | None | Discovery-run selector and per-run stats |
| Lead table | Company, score, status | Company, website, score, visual, technical, business, audit, AI, review, actions |
| Filters | Status, category, audit, score | Search, website/audit/review status, sort, quick filters |
| Manual review | Inline B/U/G | Decision buttons + note in side panel |
| Screenshots | Desktop/mobile panel | Desktop/mobile toggle + warning if missing |
| Lighthouse | Inline numbers | Dedicated section with all four metrics |
| AI summary | Problems/strengths | Same, plus qualification completeness |
| Qualification actions | Individual | Per-lead `Qualify` + `Qualify eligible` bulk operation per discovery run |
| Keyboard shortcuts | J/K/G/U/B | Not ported (mouse-driven; easy to add if needed) |

## Known next steps

- The legacy `apps/platform/src/Radar.tsx` can be removed once the new implementation is fully accepted.
- Add keyboard shortcuts and infinite scroll/lazy pagination if the lead volume grows beyond 200 rows.
- Add the `QUALIFY_DISCOVERY_RUN` operation to the Playwright end-to-end flow with real discovery data.
- Funnel counts should be re-checked against live 2GIS/OSM discovery once the providers are exercised.
