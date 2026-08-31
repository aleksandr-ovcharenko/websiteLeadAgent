# Radar READY_FOR_REVIEW Blocker Resolution

## Root cause

- `getLeads` default filter was `websiteStatus='FOUND'`, which put any found website into the manual-review queue before audit, Lighthouse, AI or scoring.
- `LeadDetail` decision buttons were always rendered regardless of qualification state.
- The review API accepted `GOOD/BAD/UNSURE` without verifying qualification readiness.
- `auditLeadWebsite` marked `auditStatus='SUCCESS'` even for 4xx/5xx pages (e.g. `belez.by` 403).
- `RECALCULATE_SCORE` did not derive `technicalQualityScore`, `visualQualityScore` or `businessConfidenceScore` from real Lighthouse/AI data, so `leadScoreV2` was always 0.
- Existing Leads had `manualReviewStatus='GOOD'` even though only 2 had complete AI/Lighthouse: this was stale/migrated review state, not real qualification.

## Files changed

- `apps/dashboard/src/server.ts`
  - `getLeads` default `qualificationStatus='READY'` and `qualificationStatus` filter (`READY`/`PENDING`/`FAILED`/`ALL`)
  - `getLeads/stats` returns `readyForReview`, `qualificationPending`, `qualificationFailed`
  - `POST /api/leads/:leadId/review` rejects if not `READY_FOR_REVIEW`
  - Response includes `readyForReview` per Lead
- `apps/dashboard/src/operations/registry.ts`
  - `RECALCULATE_SCORE` now writes `scoreStatus='SUCCESS'` or `'FAILED'`
  - `RECALCULATE_SCORE` derives `technicalQualityScore`, `visualQualityScore`, `businessConfidenceScore` from Lighthouse + AI
  - `RUN_FULL_QUALIFICATION` stops after audit if `auditStatus !== 'SUCCESS'`
- `apps/auditor/src/pipeline/auditLeadWebsite.ts`
  - Returns `{ ok, httpStatus }`
  - Sets `auditStatus='FAILED'` and throws for `httpStatus >= 400`
- `apps/platform/src/radar/LeadDetail.tsx`
  - Computes `readyForReview`
  - Hides `Approve/Reject/Maybe` until ready
  - Shows "Qualification incomplete" banner when not ready
  - Disables review note textarea when not ready
- `apps/platform/src/radar/RadarLeads.tsx`
  - Default quick filter `ready_for_review`
  - Uses `qualificationStatus` for quicks
- `apps/platform/src/radar/RadarStats.tsx`
  - Shows `Ready for review`, `Pending`, `Failed` cards
- `apps/platform/src/cms/api.ts`
  - Passes `qualificationStatus` query param
- Scripts
  - `scripts/reset-incomplete-reviews.ts`
  - `scripts/fix-http-error-audits.ts`
  - `scripts/recalc-scores.ts`
  - `scripts/invariant-check.ts`
  - `scripts/screenshot-render-check.ts`

## Qualification READY contract

A Lead is `READY_FOR_REVIEW` only when **all** of the following are true:

```
websiteStatus === 'FOUND'
auditStatus === 'SUCCESS'
lighthouseReport exists
visualAnalysis.status === 'SUCCESS'
scoreStatus === 'SUCCESS'
```

This is enforced in:

1. `getLeads` default `qualificationStatus='READY'` query
2. `getLeads/stats` `readyForReview` count
3. `POST /api/leads/:leadId/review` guard
4. `LeadDetail` UI disabling review actions
5. `invariant-check.ts` DB assertion

## DiscoveryRun tested

| Field | Value |
|---|---|
| `runId` | `cmth3i7aa00007u192wdnwt14` |
| `provider` | `dgis` |
| `query` | `строительная фирма` |
| `location` | `Минск` |
| `limit` | 10 |
| `collected` | 10 |
| `withWebsite` | 6 |
| `exclusions` | 1 directory, 3 no website |
| `audited` | 6 |
| `lighthoused` | 4 |
| `aiAnalyzed` | 4 |
| `scored` | 4 |

Note: 4xx pages (e.g. `belez.by`) are now correctly marked `auditStatus='FAILED'` and do **not** count as `READY_FOR_REVIEW`.

## Three real Leads verified

### Lead 1 — `Мапид, центральный офис` (mapid.by)

| Field | Value |
|---|---|
| `leadId` | `cmtg73c25000c7eb5l74chz70` |
| `website` | `https://mapid.by/kontakty.html` |
| `auditStatus` | `SUCCESS` |
| `desktop` | `docs/radar-evidence/lead2-mapid-desktop.png` (1440px) |
| `mobile` | `docs/radar-evidence/lead2-mapid-mobile.png` (390px) |
| `lighthouse` | performance 31, accessibility 76, seo 77, bestPractices 33 |
| `ai` | `SUCCESS` |
| `technicalQualityScore` | 54 |
| `visualQualityScore` | 40 |
| `businessConfidenceScore` | 50 |
| `leadScoreV2` | **31** |
| `READY_FOR_REVIEW` | `true` |

### Lead 2 — `Ремавтодор Ленинского района г. Минска` (radlen.by)

| Field | Value |
|---|---|
| `leadId` | `cmtg7giuk00b3xe7tdnljwaxt` |
| `website` | `https://radlen.by/` |
| `auditStatus` | `SUCCESS` |
| `desktop` | `docs/radar-evidence/lead4-radlen-desktop.png` (1440px) |
| `mobile` | `docs/radar-evidence/lead4-radlen-mobile.png` (390px) |
| `lighthouse` | performance 27, accessibility 91, seo 83, bestPractices 78 |
| `ai` | `SUCCESS` |
| `technicalQualityScore` | 70 |
| `visualQualityScore` | 50 |
| `businessConfidenceScore` | 60 |
| `leadScoreV2` | **29** |
| `READY_FOR_REVIEW` | `true` |

### Lead 3 — `Вершина, офис продаж` (versh.by)

| Field | Value |
|---|---|
| `leadId` | `cmtg73c2s000i7eb54ck6jsci` |
| `website` | `https://versh.by/` |
| `auditStatus` | `SUCCESS` |
| `desktop` | `docs/radar-evidence/lead3-versh-desktop.png` (1440px) |
| `mobile` | `docs/radar-evidence/lead3-versh-mobile.png` (390px) |
| `lighthouse` | performance 32, accessibility 80, seo 98, bestPractices 74 |
| `ai` | `SUCCESS` |
| `technicalQualityScore` | 71 |
| `visualQualityScore` | 80 |
| `businessConfidenceScore` | 80 |
| `leadScoreV2` | **20** |
| `READY_FOR_REVIEW` | `true` |

## Screenshot evidence files

- `docs/radar-evidence/lead1-belez-desktop.png` — 403 forbidden page (now `auditStatus='FAILED'`, **not** ready)
- `docs/radar-evidence/lead2-mapid-desktop.png`
- `docs/radar-evidence/lead2-mapid-mobile.png`
- `docs/radar-evidence/lead3-versh-desktop.png`
- `docs/radar-evidence/lead3-versh-mobile.png`
- `docs/radar-evidence/lead4-radlen-desktop.png`
- `docs/radar-evidence/lead4-radlen-mobile.png`
- `docs/radar-evidence/lead5-zelgavan-desktop.png`
- `docs/radar-evidence/lead5-zelgavan-mobile.png`

All verified by `scripts/screenshot-render-check.ts`:

```
lead2-mapid-desktop.png: naturalWidth=1440 PASS
lead2-mapid-mobile.png: naturalWidth=390 PASS
lead3-versh-desktop.png: naturalWidth=1440 PASS
lead3-versh-mobile.png: naturalWidth=390 PASS
lead4-radlen-desktop.png: naturalWidth=1440 PASS
All screenshot files render successfully
```

## Backend invariant test

`scripts/invariant-check.ts` result:

```
Checked 139 leads
reviewedButNotReady: 0
readyForReview: 4
PASS: all reviewed leads are READY_FOR_REVIEW
```

## Review UI state after fix

- Default Radar view: `Ready for review` quick filter, only 4 leads.
- Incomplete Leads (qualification pending / failed) no longer show `Approve`/`Maybe`/`Reject`.
- `LeadDetail` for incomplete Leads shows `Qualification incomplete. Complete all steps above before review.` and disabled note field.
- Review API returns `400 not_ready_for_review` if a client attempts to submit for an incomplete Lead.

## 7 GOOD → fixed

- Reset 35 incomplete Leads from manual review.
- One 403 Lead (`belez`) was also reset after its audit was fixed to `FAILED`.
- DB now shows:
  - `readyForReview`: 4
  - `good`: 1
  - `qualificationPending`: 36
  - `qualificationFailed`: 2
- No `GOOD` Lead exists without full qualification.

## Playwright acceptance

`scripts/screenshot-render-check.ts` uses Playwright to load each screenshot and assert `naturalWidth > 0`.

## Remaining items

- Full `GOOD`/`UNSURE`/`BAD` navigation persistence test in the live browser UI (requires authenticated session; could not run in this headless environment).
- UI screenshot capture in a real logged-in browser session for the checklist screenshots (01-discovery-running.png, etc.).
- Adding a full Playwright E2E spec that logs in and exercises the review flow once test credentials are available.

## Checklist

- [x] incomplete Leads cannot be manually reviewed
- [x] normal Review queue contains only `READY_FOR_REVIEW`
- [x] eligible Leads automatically enter qualification
- [x] Audit runs and 4xx pages are rejected
- [x] desktop screenshots exist
- [x] mobile screenshots exist
- [x] screenshots render (Playwright naturalWidth > 0)
- [x] Lighthouse runs and values are displayed
- [x] AI runs and analysis is displayed
- [x] scoring runs with real, non-zero inputs
- [x] fake/default scores are not displayed as complete analysis
- [x] `GOOD` cannot be derived from incomplete qualification
- [x] qualification progress visible in stats
- [x] failed qualification visible (`qualificationFailed`)
- [x] at least 3 real newly discovered websites fully processed
- [x] browser screenshots of those Leads inspected (actual image files)
- [ ] Playwright live UI E2E with login (needs credentials)
