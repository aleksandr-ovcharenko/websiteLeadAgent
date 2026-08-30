# Discovery Provider Configuration Report

## 1. Objective

Add a dedicated **Discovery Providers / Configuration** area inside the Radar module so SUPER_ADMIN users can view, configure, test, enable/disable and start discoveries without editing `.env` files or running CLI commands.

## 2. What was implemented

### 2.1 Schema

Extended `prisma/schema.prisma` with:

- `DiscoveryProviderConfig` — stores `providerId`, `enabled`, `defaults`, test history.
- `DiscoveryPreset` — persistent search topics / presets with `defaultProvider`, `query`, `queries`, `defaultLimit`, `defaultMaxPages`, etc.
- `DiscoverySetting` — global defaults row (`id = global`).

### 2.2 API

Added to `apps/dashboard/src/server.ts` and `apps/dashboard/src/discovery/service.ts`:

- `GET /api/discovery/providers` — list all providers with real-time status.
- `GET /api/discovery/providers/:id` — get a provider.
- `PUT /api/discovery/providers/:id/config` — enable/disable and set defaults.
- `POST /api/discovery/providers/:id/test` — safe connection test, stores result.
- `GET /api/discovery/presets` — list presets from DB.
- `POST /api/discovery/presets` — create a preset.
- `PUT /api/discovery/presets/:id` — update a preset.
- `DELETE /api/discovery/presets/:id` — delete a preset.
- `GET /api/discovery/settings` — global defaults.
- `PUT /api/discovery/settings` — save global defaults.

### 2.3 UI

New components under `apps/platform/src/radar/`:

- `RadarConfiguration.tsx` — shell for provider/preset/history routes.
- `RadarProviders.tsx` — provider cards with status, capabilities, env binding, last test and CTAs.
- `ProviderConfigModal` (inside `RadarProviders.tsx`) — toggle enable, set default location/limit/max pages, recheck.
- `RadarPresets.tsx` — CRUD table for search presets.
- `RadarHistory.tsx` — full-page discovery run history.

Updated:

- `apps/platform/src/App.tsx` — routes `/radar/providers`, `/radar/presets`, `/radar/discoveries` to `RadarConfiguration`.
- `apps/platform/src/radar/NewDiscovery.tsx` — shows **Configure provider** CTA when an unconfigured source is selected.
- `apps/platform/src/cms/api.ts` — added provider/preset/settings helpers.

### 2.4 Security

- No API keys or secrets are sent to the browser.
- Provider configuration is persisted in the database; credentials are only read from `process.env` on the backend.
- The recheck / test endpoint runs the provider on the server and returns only a status and message.

## 3. QA results

Run with `npx tsx scripts/providers-qa.ts`.

| Check | Result | Note |
|-------|--------|------|
| All providers loaded | pass | 2GIS, Manual, OSM, DuckDuckGo, Yandex |
| 2GIS card shows Ready | pass | — |
| Configure modal opens | pass | — |
| Provider test succeeds | pass | — |
| New discovery preselected | pass | `dgis` selected |
| Unconfigured CTA | pass | `Configure provider` visible for Yandex |
| Presets loaded | pass | seeded defaults visible |
| Create preset | pass | `Test Preset QA` appears in list |

Screenshots and the run result JSON are saved in `docs/screenshots/providers-qa/`.

## 4. Known limitations

- `Radar.tsx` still uses a static sidebar; provider/preset navigation is fully live via `RadarConfiguration` at `/radar/providers`, `/radar/presets` and `/radar/discoveries`.
- `Discovery history` is a full-page; the existing `DiscoveryRunsPanel` inside `RadarView` is kept unchanged.
- Provider enable/disable currently only affects UI and the `New discovery` preselection; the `start` flow still validates `isConfigured`.

## 5. How to verify

1. Open `http://localhost:3000/radar/providers` as SUPER_ADMIN.
2. Click **Configure**, check defaults, click **Test / Recheck**.
3. Click **+ New discovery** to start a pre-filled discovery.
4. Open `http://localhost:3000/radar/presets` to create or edit topics.
5. Run `npx tsx scripts/providers-qa.ts` for automated verification.
