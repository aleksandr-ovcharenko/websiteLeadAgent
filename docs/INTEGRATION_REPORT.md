# WebsiteLeadAgent — Figma Make Integration Report

## Objective
Integrate the approved Radar, Forge, and Studio Make designs into the existing `apps/platform` application so that Hub, Radar, Factory, Forge, Studio, and Showcase feel like one coherent product, while preserving production data, APIs, routing, and CMS/Showcase contracts.

## What was done

### 1. Shared product shell
- Created `apps/platform/src/cms/ProductHeader.tsx` using the Studio Make header as the visual reference.
- ProductHeader is rendered on every product area (`hub`, `radar`, `factory`, `forge`, `studio`).
- It links to Hub, Radar, Factory, Forge, and in Studio mode shows a real site switcher loaded from `/api/cms/sites`.
- "Open Showcase" in Studio uses the real `previewToken` and opens `/showcase/:previewToken`.
- The user role/avatar is displayed from the real `/api/auth/me` response.

### 2. Hub
- Created `apps/platform/src/Hub.tsx` from the Studio Make reference.
- Fetches real counters from the new `GET /api/hub/stats` endpoint.
- Cards navigate to `/radar`, `/factory`, `/forge`.
- Activity strip shows live Radar/Factory/Forge/lead counts.

### 3. Factory
- Created `apps/platform/src/Factory.tsx` from the Studio Make Factory reference.
- Added `GET /api/factory/runs` and `POST /api/factory/runs/:runId/retry` endpoints in `apps/dashboard/src/platform.ts`.
- Displays real `RedesignRun` + `SiteBuild` pipeline data with status, progress, and retry for failed runs.
- No mock `PIPELINE_RUNS` arrays are used.

### 4. Radar, Forge, Studio
- Radar and Forge keep their existing real-data components (`Radar.tsx`, `ForgeView`) and are now rendered inside the shared product shell.
- Studio remains the existing CMS but is now wrapped in the shared `ProductHeader` and site switcher.
- The canonical routes `/radar`, `/factory`, `/forge`, `/studio/:siteId`, `/showcase/:previewToken` are preserved.
- Existing CMS section/page navigation inside Studio was not changed.

### 5. Routing
- `apps/platform/src/App.tsx` now routes by `pathname` and renders `ProductHeader` + area-specific content.
- `navigate()` uses real `window.history`/`window.location` (full page load for Studio to keep canonical URLs).

### 6. No mock data
- Figma mock arrays (`LEADS`, `FACTORY_RUNS`, `DISCOVERY_RUNS`, `SITES`, `ALL_SITES`) were not copied into production runtime.
- All displayed data comes from the production database and existing/new API endpoints.

## Files changed / added
- `apps/platform/src/App.tsx` — product router, shared shell integration
- `apps/platform/src/Hub.tsx` — new real-data Hub
- `apps/platform/src/Factory.tsx` — new real-data Factory
- `apps/platform/src/cms/ProductHeader.tsx` — shared product header
- `apps/platform/src/cms/api.ts` — `getHubStats`, `getFactoryRuns`, `retryFactoryRun`
- `apps/dashboard/src/platform.ts` — `/api/hub/stats`, `/api/factory/runs`, `/api/factory/runs/:runId/retry`
- `apps/gateway/src/server.ts` — guarded error handler to keep gateway stable during ws errors
- `scripts/product-qa.ts` — end-to-end Playwright QA script
- `.gitignore` — ignore `apps/platform/dist/` and generated QA screenshots

## API surface
| Endpoint | Purpose |
|---|---|
| `GET /api/hub/stats` | Live lead, good-lead, site, and run counts for the Hub |
| `GET /api/factory/runs` | Real redesign pipeline runs |
| `POST /api/factory/runs/:runId/retry` | Retry a failed run by regenerating the site |
| `GET /api/cms/sites` / `GET /api/cms/sites/:siteId` | Site list and current site for the Studio header |

## Playwright QA results
Run: `npx tsx scripts/product-qa.ts`

```json
{
  "results": [
    { "name": "hub", "ok": true },
    { "name": "factory", "ok": true },
    { "name": "forge", "ok": true },
    { "name": "radar", "ok": true },
    { "name": "studio", "ok": true },
    { "name": "showcase", "ok": true, "note": "previewToken=ze6f3z0v" }
  ],
  "consoleErrors": []
}
```

All product areas and the multi-site Studio→Showcase flow verified with no console errors.

## Screenshots
| Screen | File |
|---|---|
| Hub | `docs/screenshots/product-qa/01-hub.png` |
| Factory | `docs/screenshots/product-qa/02-factory.png` |
| Forge | `docs/screenshots/product-qa/03-forge.png` |
| Radar | `docs/screenshots/product-qa/04-radar.png` |
| Studio | `docs/screenshots/product-qa/05-studio.png` |
| Showcase | `docs/screenshots/product-qa/07-showcase.png` |

## Multi-site behaviour
- The Studio site switcher is populated from `/api/cms/sites`.
- Selecting a different site navigates to the canonical `/studio/:siteId` route and reloads Studio.
- "Open Showcase" in the header uses the current site's `previewToken`, proving strict site identity separation.

## Notes
- The existing CMS `Sidebar` and `TopBar` were left intact to preserve section/page navigation.
- The `apps/gateway` error handler was hardened so websocket/upstream errors do not crash the gateway during local development.
- The `apps/platform/dist/` and QA screenshot directories are `.gitignore`d; only source and the report are committed.

## Commit
- `feat: product shell, Hub, Factory and multi-site Studio header`
- Includes the QA script and gateway fix.
