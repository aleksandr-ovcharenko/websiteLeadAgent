# Radar Normalization — BEFORE / NOW Capability Matrix

## 1. Data model

| Capability | Old Radar (pre-unification) | Current HEAD (main) | Gap |
|---|---|---|---|
| Lead entity | `Lead` with `companyName`, `website`, `leadScore`, `visualAnalysis`, `lighthouseReport`, `manualReviewStatus`, `redesignStage` | Same model, plus `leadScoreV2`, `scoreDetailsV2`, `technicalQualityScore`, `visualQualityScore`, `businessConfidenceScore`, `scoreStatus`, `generationStatus` | Good — model preserved/extended |
| DiscoveryRun | Not present; ad-hoc runs | `DiscoveryRun` with `provider`, `query`, `location`, `status`, `leadIds`, `collected`, `createdCount`, `duplicateCount`, `errorMessage` | New but still coarse-grained; missing `rawFound`, `websitesResolved`, `excluded`, `eligibleLeads`, `qualified` as first-class counts |
| VisualAnalysis | Embedded-ish `visualAnalysis` relation | Separate `VisualAnalysis` model with `status`, `redesignPotential`, `modernity`, `visualQuality`, etc. | Good |
| LighthouseReport | `lighthouseReport` Json/embedded | Separate `LighthouseReport` relation with metrics | Good |

## 2. Discovery provider & raw results

| Capability | Old | Current | Gap |
|---|---|---|---|
| Provider abstraction | Hard-coded 2GIS runner | `DiscoveryProvider` registry with 2GIS, OSM, DDG, Manual; presets/configs | Good |
| Raw discovery result → Lead | Provider result directly mapped to `Lead` upsert | Provider result mapped to `Lead` upsert; then `enrichLeads` re-evaluates website eligibility | Partial — ineligible Leads are still created before eligibility decision; `getLeads` does not hide them by default |
| Excluded results kept for stats | No | `websiteIneligibilityReason` is stored on `Lead`; `getRunFunnel` counts exclusions | Partial — excluded rows live in `Lead` table, no separate excluded-results table; UI still shows them unless filtered |

## 3. Website resolution & eligibility

| Capability | Old | Current | Gap |
|---|---|---|---|
| Central eligibility | `evaluateWebsiteEligibility.ts` with domain rules | Same file, same rules; reused in `enrichLeads` and `isBlacklistedWebsiteDomain` | Good, rules cover `ibiz.by`, `jsprav.ru`, `*.gov.by`, subdomains |
| Enrichment before exclusion | OSM / SerpAPI / DDG | Same providers in `enrichLeads.ts` | Good |
| Canonical URL stored | `website` (post-eligibility) | `website` and `websiteDomain` (post-eligibility) | Good |
| Source URL tracking | `sourceUrl` | `sourceUrl` exists | Good |

## 4. DiscoveryRun lifecycle

| Capability | Old | Current | Gap |
|---|---|---|---|
| Stages | `PENDING` → `RUNNING` → `COMPLETED`/`FAILED` | `PENDING` → `DISCOVERING` → `ENRICHING` → `COMPLETED`/`FAILED` | Missing `QUALIFYING` stage; qualification is an optional manual operation (`QUALIFY_DISCOVERY_RUN`), not automatic |
| Fire-and-forget enrichment | `setImmediate` | Fixed: `await enrichLeads` | Fixed |
| Discovery does not complete early | No | `COMPLETED` after enrichment, but before Lighthouse/AI/score | Still completes before required qualification |

## 5. Automated qualification

| Capability | Old | Current | Gap |
|---|---|---|---|
| Audit | `auditLeadWebsite.ts` Playwright screenshots | Same | Good |
| Lighthouse | `runLighthouse.ts` | Same, fixed `__name` esbuild error | Good |
| AI visual analysis | `runVisualAnalysisForLead.ts` with Gemini/OpenAI | Same | Good |
| Scoring V2 | `computeLeadScoreV2` in `scoreLeadV2.ts` | Same; `RECALCULATE_SCORE` operation persists `leadScoreV2` | Good |
| Auto-qualify after discovery | Partial / CLI-driven | `QUALIFY_DISCOVERY_RUN` operation exists but is not invoked automatically; `RUN_FULL_QUALIFICATION` is per-Lead manual/operation | Missing: `DiscoveryService.start` does not call qualification pipeline after enrichment |

## 6. Radar UI

| Capability | Old `Radar.tsx` (1251 lines) | Current `apps/platform/src/radar/*.tsx` | Gap |
|---|---|---|---|
| Main table | Yes — `toRadarLead` mapping, sort, filters | `RadarLeads.tsx` with filters, `LeadDetail` side panel, `RadarStats` | Good |
| Screenshot-first review | Screenshots prominent, desktop/mobile toggle, full preview | `LeadDetail.tsx` now renders `/audit/{id}/{tab}.png` with full-size link and `__name` fixed | Good |
| Stale review state | Buggy | Fixed with `useEffect` on lead id | Good |
| Ready for review filter | "Needs AI" / "Good" | Added `ready_for_review` quick filter | Good |
| Statistics | Minimal | `RadarStats.tsx` + `DiscoveryRunsPanel` funnel | Partial — not all required counts shown; not tied to active filter subset |
| Review actions | GOOD/UNSURE/BAD, prev/next | Present but no `Next unreviewed` yet | Minor |
| Selected / Factory | `selectedForRedesign`, `generateSite` | `redesignStage` `SELECTED_FOR_REDESIGN` → `Generate site` operation | Good |

## 7. API / auth

| Capability | Old | Current | Gap |
|---|---|---|---|
| Leads API | `requireSuperAdmin` | `requireSuperAdmin` | Still super-admin only; blocks normal reviewer |
| Review API | `requireSuperAdmin` | `requireSuperAdmin` | Same |
| Screenshot route | `requireSuperAdmin` | `requireAuth` | Fixed |

## 8. Operations / execution output

| Capability | Old | Current | Gap |
|---|---|---|---|
| Operation registry | None | `OperationService`, `OperationConsole`, `OperationRun`/`OperationEvent` | Good |
| Operations available | Discovery, Audit, Lighthouse, AI, Score, Full Qualification, Generate, Qualify discovery run | Same | Good |
| Progress visible | No | `OperationConsole` polling events | Good |

## 9. Bad data cleanup

| Capability | Old | Current | Gap |
|---|---|---|---|
| Ineligible lead cleanup | Manual/CLI | No batch cleanup yet | Missing |

## Summary of critical remaining work

1. Wire automatic qualification into `DiscoveryService.start()` so every eligible Lead is audited → Lighthouse → AI → scored before `DiscoveryRun` becomes `COMPLETED`.
2. Add `QUALIFYING` stage to `DiscoveryRun` lifecycle and do not mark `COMPLETED` until qualification finishes.
3. Update `getLeads` default / quick filters so the main Radar table only shows eligible Leads unless the user explicitly asks for excluded/debug.
4. Lower auth from `requireSuperAdmin` to `requireAuth` for leads/review/screenshots so a normal reviewer can use Radar.
5. Update `RadarStats` and `DiscoveryRunsPanel` to display the unambiguous funnel counts required by the spec.
6. Add `Next unreviewed` navigation in `LeadDetail`.
7. Add a bad-data cleanup script to archive/exclude existing ineligible Leads.
8. Run end-to-end 2GIS discovery and verify the full pipeline in the web UI.
