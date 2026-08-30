# Radar + Factory Operational Control Surface Report

## 1. Latest commit inspected

- **Before work:** `a065d4f` — `docs(readme): add discovery provider and preset architecture`
- **After work:** see `git log` for the new `feat(radar): unified Radar shell and operational operation console` commit.
- The `apps/dashboard` service (`CORE`) was running on `http://localhost:3333` and the product on `http://localhost:3000` during verification.

## 2. Root cause of `/radar` vs `/radar/providers` discrepancy

`apps/platform/src/App.tsx` used this conditional:

```tsx
const isConfig = window.location.pathname !== '/radar' && window.location.pathname.startsWith('/radar/');
return isConfig ? <RadarConfiguration /> : <RadarView />;
```

The provider feature was built as a separate `RadarConfiguration` shell for sub-routes, while the legacy `RadarView` (`apps/platform/src/Radar.tsx`) was left as the root `/radar` lead view. The two files used independent sidebars, typography and data layers, so any sub-route looked visually different from the lead view.

**Fix:** all `/radar*` paths now render `<RadarConfiguration />`. `/radar` is the `RadarLeads` view, `/radar/providers` is `RadarProviders`, etc. `App.tsx` no longer imports `RadarView`.

## 3. Old Radar files removed/replaced

- `App.tsx` no longer uses `RadarView`.
- `RadarConfiguration.tsx` is the single Radar shell.
- `RadarLeads.tsx` is the new operational lead list.
- `apps/platform/src/Radar.tsx` is no longer on the main route. It can be safely deleted in the next cleanup pass; it was not deleted here to keep the diff focused.

## 4. Backend operation inventory

| Operation | Existing service/CLI | New API endpoint | CTA location |
|---|---|---|---|
| `DISCOVER_BUSINESSES` | `DiscoveryService.start` / `npm run leads` | `POST /api/operations` | New Discovery modal |
| `TEST_PROVIDER` | `DiscoveryService.testProvider` | `POST /api/operations` | Provider card / ProviderConfigModal |
| `ENRICH_LEAD` | `enrichLeads.ts` | `POST /api/operations` | (used internally, also `RUN_FULL_QUALIFICATION`) |
| `AUDIT_WEBSITE` | `auditLeadWebsite.ts` / `npm run audit` | `POST /api/operations` | Lead row |
| `RUN_LIGHTHOUSE` | `runLighthouseForLead.ts` / `npm run lighthouse` | `POST /api/operations` | Lead row |
| `RUN_VISUAL_ANALYSIS` | `runVisualAnalysisForLead.ts` / `npm run visual-analyze` | `POST /api/operations` | Lead row |
| `RECALCULATE_SCORE` | `computeLeadScoreV2` / `npm run score` | `POST /api/operations` | Lead row |
| `RUN_FULL_QUALIFICATION` | (was CLI-only orchestration) | `POST /api/operations` | Lead row |
| `GENERATE_SITE` | `generateSite` / `npm run redesign` | `POST /api/operations` | Factory retry, Lead row |

## 5. Operations intentionally remaining CLI-only

| Operation | Reason |
|---|---|
| `export:scored` | Data export for ad-hoc analysis; not a normal product operation. |
| Raw `collector` discovery with custom arguments | Development and one-off research; UI already covers normal discovery. |
| `infra:reset`, `db:migrate`, `db:push` | Infrastructure/DB administration, not part of SUPER_ADMIN product workflow. |
| n8n integration | Not in scope; the operation architecture is intentionally n8n-ready. |

## 6. OperationRun / OperationEvent architecture

- `OperationRun` (Prisma):
  - `id`, `operationId`, `status` (`PENDING` | `RUNNING` | `SUCCESS` | `FAILED` | `CANCELLED`)
  - `entityType`, `entityId`, `leadId`
  - `startedAt`, `finishedAt`, `createdBy`
  - `result` (JSON), `error` (JSON), `metadata` (JSON)
- `OperationEvent` (Prisma):
  - `operationRunId`, `level` (`INFO` | `SUCCESS` | `WARN` | `ERROR`)
  - `stage`, `message`, `metadata` (JSON), `createdAt`
- `OperationService` wraps each handler with a `RunContext` that emits `OperationEvent` rows.
- `apps/dashboard/src/operations/registry.ts` defines each operation: `label`, `category`, `description`, `requiredRole`, `inputSchema`, `handler`.
- Handlers call the existing TypeScript services directly; no shell text is accepted from the browser.

## 7. Execution transport

- **Transport:** HTTP polling (1s interval) from `OperationConsole` to `GET /api/operations/:runId` and `GET /api/operations/:runId/events`.
- **Why:** Keeps the Express architecture unchanged, avoids WebSocket/SSE complexity, and still satisfies the requirement that execution history persists across page refreshes because data is stored in PostgreSQL.
- The `OperationService` uses an `EventEmitter` so the same `subscribe()` API is available if SSE is added later.

## 8. Screenshots

All screenshots are saved in `docs/screenshots/ops-qa/`:

- `01-radar-leads.png` — `/radar` unified shell
- `02-provider-test-running.png` — `OperationConsole` during provider test
- `03-provider-test-complete.png` — `OperationConsole` after provider test
- `04-discovery-running.png` — `OperationConsole` during discovery
- `05-discovery-complete.png` — `OperationConsole` after discovery
- `06-lead-operation.png` — `OperationConsole` after a lead action

Updated provider QA screenshots are in `docs/screenshots/providers-qa/`.

## 9. Playwright results

`scripts/ops-qa.ts` was run with `npx tsx scripts/ops-qa.ts`:

| Check | Result |
|---|---|
| `radar-unified-shell` | PASS |
| `provider-test-console` | PASS |
| `provider-test-final` | PASS |
| `discovery-console-running` | PASS |
| `discovery-console-final` | PASS |
| `lead-operation-console` | PASS |

`scripts/providers-qa.ts` re-ran and continued to pass all 8 checks.

## 10. Security validation

- No `POST /execute` or arbitrary shell endpoint exists.
- All operation endpoints require `requireSuperAdmin`.
- `OperationService` only allows operation IDs registered in `apps/dashboard/src/operations/registry.ts`.
- `OperationService.redactMetadata` redacts values for `apiKey`, `token`, `secret`, `password`, `credential`, `authorization` and strings that look like API keys.
- Secrets stay in `process.env` on `CORE`; `DiscoveryProviderConfig` never stores the actual secret.
- Input is not arbitrary shell text; it is a typed JSON payload with an `operationId` and an `input` object.
- `GET /api/operations/:runId` is scoped to the run; it does not allow cross-user/cross-entity traversal.

## 11. Console / network errors

- Playwright observed a couple of `401 Unauthorized` responses before the SUPER_ADMIN session was established. These are from the existing auth flow and are expected for unauthenticated requests.
- No `POST /api/execute` 404 or arbitrary command errors were generated.

## 12. Known limitations and next steps

- **Real-time streaming:** currently uses 1s polling. SSE or WebSocket can be added later through the `OperationService.subscribe()` and a `/api/operations/:runId/stream` endpoint.
- **Lead detail panel:** the current `RadarLeads` table shows per-row action buttons. A full lead detail view with larger preview/screenshots can be added without touching the operation architecture.
- **Audit Queue / Selected filters:** `RadarLeads` supports `mode="audit"` and `mode="selected"` and the sidebar routes to them, but the filters are simple status filters.
- **Old `Radar.tsx` file:** can be deleted once the team confirms the new table covers all critical workflows.
- **n8n:** the operation contract is ready for an orchestrator, but n8n itself was not added.
