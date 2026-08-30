# Discovery Provider Architecture Report

## Summary

Refactored the Radar discovery flow so it is no longer hardcoded to 2GIS. Added a `BusinessDiscoveryProvider` abstraction, a `DiscoveryRun` persistence model, and a Radar UI that supports provider selection, topic presets, manual import, and discovery history with **Run again / Duplicate**.

## What changed

- **Prisma schema (`prisma/schema.prisma`)**
  - Added `manual`, `osm`, `ddg`, `yandex` to `LeadSource`.
  - Added `DiscoveryRun` model: stores `provider`, `query`, `topic`, `location`, `limit`, `maxPages`, `providerOptions`, `status`, `leadIds`, counts, and `errorMessage`.

- **Provider abstraction (`apps/dashboard/src/discovery/`)**
  - `types.ts` — `BusinessDiscoveryProvider` interface with `isConfigured()`, `search()`, and normalized candidates.
  - `presets.ts` — 13 topic/query presets (Construction, Renovation, Engineering, etc.).
  - `registry.ts` — `listDiscoveryProviders()`, `getDiscoveryProvider()`.
  - `service.ts` — `DiscoveryService.start()` creates a `DiscoveryRun`, calls the selected provider, upserts `Lead` records keyed by `source` + `sourceId`, creates `LeadQuery` links, counts created/duplicate, and schedules `enrichLeads()` in the background.
  - Providers:
    - `2GIS` — reuses existing `fetch2gisItems` and `map2gisItemToLeadUpsert`.
    - `Manual Import` — parses domains/URLs/company pairs; no API key needed.
    - `OSM / Overpass` — Nominatim discovery (no API key).
    - `DuckDuckGo HTML` — adapter-ready placeholder.
    - `Yandex` — placeholder that reports `isConfigured()` only when `YANDEX_SEARCH_API_KEY` is set.

- **Dashboard API (`apps/dashboard/src/server.ts`)**
  - `GET /api/discovery/providers` — includes `configured` status.
  - `GET /api/discovery/presets`
  - `GET /api/discovery/runs`, `GET /api/discovery/runs/:runId`
  - `POST /api/discovery/runs` — starts a discovery run.
  - `POST /api/discovery/runs/:runId/run-again`
  - `GET /api/discovery/runs/:runId/duplicate` — returns run config for prefill.

- **Radar UI (`apps/platform/src/`)**
  - `radar/NewDiscovery.tsx` — dialog for choosing source, topic preset, query, location, limit, max pages, and manual entries.
  - `radar/DiscoveryRunsPanel.tsx` — discovery history with status, counts, **Run again** and **Duplicate**.
  - `Radar.tsx` — integrated `New discovery` and `History` buttons.

## Playwright QA

Script: `scripts/discovery-qa.ts`

Results (`docs/screenshots/discovery-qa/results.json`):

- `provider-list` — 2GIS, Manual, Yandex visible in the source dropdown.
- `topic-preset` — selecting "Construction" pre-fills the query with `строительные компании`.
- `manual-start` — submitted `garantk.by`, `Example Co;https://example.by`, and `company2.by`; returned HTTP 200.
- `history-list` — the manual run is shown as `COMPLETED` with `2 new / 0 dup`.
- `duplicate-prefill` — the Duplicate button opens New Discovery with the same provider pre-selected.

Screenshots:

- `docs/screenshots/discovery-qa/01-new-discovery.png` — provider/topic/location UI.
- `docs/screenshots/discovery-qa/02-manual-provider.png` — Manual Import form.
- `docs/screenshots/discovery-qa/03-discovery-history.png` — run list with Run again / Duplicate.
- `docs/screenshots/discovery-qa/04-duplicate.png` — duplicate prefill dialog.

## Notes

- Deduplication is handled by `prisma.lead.upsert` on the unique `source` + `sourceId` constraint.
- All provider outputs go through the same `DiscoveryService` into the existing `Lead` pipeline and trigger `enrichLeads()`.
- No new API keys were required for this work; the only active credentials are the existing `DGIS_API_KEY`.
