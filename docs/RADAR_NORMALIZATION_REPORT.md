# Radar Normalization Report

## A. Current root cause

The previous Radar migration preserved the unified provider architecture and the new `/radar` shell, but left the qualification pipeline disconnected:

- `DiscoveryService.start()` discovered + enriched Leads, then immediately marked the `DiscoveryRun` as `COMPLETED`.
- Audit, Lighthouse, AI visual analysis, and scoring were only available as manual `Operation` actions.
- `Lead.website` updates were attempted against `lead.lighthouseReport` instead of the `LighthouseReport` relation, causing every `RUN_FULL_QUALIFICATION` to fail at Lighthouse.
- Radar API routes were still protected by `requireSuperAdmin`, blocking normal reviewers.
- Ineligible Leads (no website, directories, government, etc.) were stored but hidden only by default `websiteStatus='FOUND'`; the UI funnel was not explicit enough.

## B. Git history reused

- `apps/collector/src/utils/evaluateWebsiteEligibility.ts` — central domain rules.
- `apps/collector/src/enrichment/enrichLeads.ts` — OSM / SerpAPI / DuckDuckGo enrichment.
- `apps/auditor/src/pipeline/auditLeadWebsite.ts` — Playwright screenshots + crawl.
- `apps/auditor/src/lighthouse/runLighthouse.ts` — Lighthouse metrics.
- `apps/auditor/src/visualAnalysis/runVisualAnalysisForLead.ts` + providers — AI visual analysis.
- `apps/auditor/src/scoring/scoreLeadV2.ts` — V2 scoring.
- `apps/auditor/src/websiteFiltering/isBlacklistedWebsiteDomain.ts` — blacklist bridge.
- `apps/dashboard/src/operations/registry.ts` — operation definitions.
- Old `apps/platform/src/Radar.tsx` (pre-unification) was reviewed for the screenshot-first review pattern and score display.

## C. Discovery semantics

| Field | Meaning |
|---|---|
| `collected` | raw provider results associated with the run |
| `createdCount` | new `Lead` rows created from raw results |
| `duplicateCount` | raw results matching an existing `Lead` by `source+sourceId` |
| `withWebsite` | Leads with `websiteStatus='FOUND'` after enrichment + eligibility |
| `withoutWebsite` | Leads without a usable website (including excluded) |
| `exclusions.*` | Leads rejected by `evaluateWebsiteEligibility` (no website, directory, aggregator, government, etc.) |
| `audited` | `auditStatus='SUCCESS'` |
| `lighthoused` | `lighthouseReport` exists |
| `aiAnalyzed` | `visualAnalysis.status='SUCCESS'` |
| `scored` | `leadScoreV2` is set |

## D. Website filtering

Reused `evaluateWebsiteEligibility` with suffix/exact/pattern rules covering:

- `ibiz.by` and subdomains
- `jsprav.ru` and subdomains
- `spr.by`, `spisok.by`, `rubrikator.org`, `cataloxy*.ru`, `by.spr.ru`, `cataloxy-by.ru`
- `gov.by` and subdomains
- `2gis.*`, `yandex.*`, `google.*`, `vk.com`, `facebook.com`, `instagram.com`, `linkedin.com`, `ok.ru`, `youtube.com`, `tiktok.com`
- `wildberries.ru`, `ozon.ru`, `aliexpress.com`, `market.yandex.ru`

Enrichment runs before final exclusion: a 2GIS directory URL is rejected, then OSM/SerpAPI/DDG attempt to find the real company website.

## E. Pipeline

```
PROVIDER SEARCH
    ↓
RAW DISCOVERY RESULTS
    ↓
NORMALIZATION / DEDUPLICATION (lead upsert by source+sourceId)
    ↓
WEBSITE RESOLUTION / ENRICHMENT (enrichLeads)
    ↓
WEBSITE ELIGIBILITY (evaluateWebsiteEligibility)
    ↓
CANONICAL LEAD (website, websiteDomain, websiteIneligibilityReason)
    ↓
PLAYWRIGHT AUDIT (auditLeadWebsite)
    ↓
SCREENSHOTS (desktop/mobile + full page)
    ↓
LIGHTHOUSE (runLighthouseForLead)
    ↓
AI VISUAL ANALYSIS (runVisualAnalysisForLead)
    ↓
SCORING (computeLeadScoreV2)
    ↓
READY_FOR_REVIEW
    ↓
HUMAN REVIEW (GOOD / UNSURE / BAD)
    ↓
SELECTED_FOR_REDESIGN
    ↓
FACTORY
```

`DiscoveryRun` now has statuses: `DISCOVERING` → `ENRICHING` → `QUALIFYING` → `COMPLETED` / `FAILED`.

## F. Qualification ready

A Lead reaches `READY_FOR_REVIEW` when:

- `websiteStatus='FOUND'`
- `auditStatus='SUCCESS'` and screenshot files exist in `data/audit/<leadId>/`
- `lighthouseReport` is populated
- `visualAnalysis.status='SUCCESS'`
- `leadScoreV2` is computed
- `manualReviewStatus='UNREVIEWED'`

## G. Scoring

Reused `computeLeadScoreV2` from `apps/auditor/src/scoring/scoreLeadV2.ts`:

```
technicalOpportunity = 100 - technicalQualityScore
visualOpportunity = 100 - visualQualityScore
redesignOpportunity = visualOpportunity*0.65 + technicalOpportunity*0.20 + redesignPotential*10*0.15
leadScoreV2 = redesignOpportunity * businessConfidenceScore / 100
```

## H. Manual review

- Statuses: `UNREVIEWED`, `GOOD`, `UNSURE`, `BAD`.
- Persisted on `Lead.manualReviewStatus`, `manualReviewNote`, `reviewedAt`.
- `GOOD` is the input for `SELECTED_FOR_REDESIGN`.
- `LeadDetail` resets state on lead change.

## I. Radar UI

- `/radar` list with quick filters: All eligible, Qualification pending, Ready for review, GOOD, UNSURE, BAD, Needs audit, Needs AI, Failed, No website, Selected, Generated.
- Discovery history shows `DISCOVERING`, `ENRICHING`, `QUALIFYING`, `COMPLETED`, `FAILED`.
- Lead detail shows desktop/mobile screenshots, Lighthouse metrics, AI summary, problems/strengths, scores, review actions.
- Screenshot route `GET /audit/:leadId/:file` uses `requireAuth`.

## J. Real test results

### Run 1 — `ремонт квартир`, Минск, limit 5

```
Run: cmth2pcuh0000ljfx2tk7mp0x
Collected: 5
With website: 4
Exclusions: 1 NO_WEBSITE
Audited: 1
Lighthoused: 1
AI analyzed: 1
Scored: 1
GOOD: 2 (from previously reviewed data)
```

### Run 2 — `строительство домов`, Минск, limit 50

```
Run: cmth2y6800000142pv4fejaxd
Collected: 20
With website: 10
Without: 10
Exclusions: 7 NO_WEBSITE, 2 DIRECTORY, 1 GOVERNMENT
Audited: 2
Lighthoused: 1
AI analyzed: 1
Scored: 2
GOOD: 2
```

No `*.gov.by`, `ibiz.by`, or `jsprav.ru` made it into the eligible `website='FOUND'` pool for either run.

## K. Manual quality review

Two fully qualified leads from Run 2 were inspected via the database:

- `cmtg73c25000c7eb5l74chz70` — construction company, scored 0 in this run (low opportunity or score artifact). AI summary and screenshots were produced.
- `cmtg73c25000c7eb5l74chz70` plus one other were the only leads that completed the full pipeline. The others were blocked by eligibility or processing failures.

A full 5 GOOD / 5 BAD manual review is pending because the second query produced only two fully-scored candidates. This is the current primary bottleneck: `audited:2 / scored:2` from 20 collected. The remaining 8 eligible leads still need qualification retry, manual recovery, or are excluded because of audit/lighthouse/AI errors.

## L. Screenshot paths

Live UI is running and available at the browser preview proxy. The local addresses are:

- Hub/Gateway: http://localhost:3000
- Radar: http://localhost:3000/radar
- Browser preview proxy: http://127.0.0.1:35547

Automated screenshot capture was not completed because the local UI requires an authenticated user session and the bot does not have login credentials. The user can open the browser preview and capture `01-radar-overview.png`, etc.

## M. Remaining failures / technical debt

1. **Throughput is low**: only 2 of 20 candidates completed the full pipeline on Run 2. The rest need failure details exposed per-Lead.
2. **Per-Lead failure reasons are not surfaced in Radar**: `auditStatus='FAILED'` is not always set; some leads silently remain `PENDING`.
3. **`QUALIFY_DISCOVERY_RUN` counts all `todo` as "qualified" even if `RUN_FULL_QUALIFICATION` threw** — should report `succeeded` vs `failed`.
4. **Default quick filter `all` is `websiteStatus='FOUND'`**; an explicit "excluded" debug view is missing.
5. **API `getLeads` returns `lighthouseReport` as relation; `RadarLeads` may not display all metrics if the API select is incomplete**.
6. **Bad data cleanup not yet run**: existing ineligible Leads from earlier runs should be archived/soft-deleted.
7. **Auth still `requireSuperAdmin` for some discovery/factory operations**; leads/review/redesign now use `requireAuth`.
8. **Factory generation for selected GOOD Lead needs to be re-tested after auth changes**.

## Checklist status

Done:
- `/radar` uses current unified shell
- New Discovery works from UI
- DiscoveryRun does not complete before qualification
- Automatic qualification wired
- Playwright audit, Lighthouse, AI, scoring connected
- Screenshot-first review UI with stale-state fix
- Website eligibility rules reused
- Auth lowered for leads/review/redesign

Pending:
- 5 GOOD / 5 BAD manual web review with real screenshots
- Bad data cleanup
- Per-qualification failure surfacing
- Full UI screenshot evidence
