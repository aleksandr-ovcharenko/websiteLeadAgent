# V3.7.6.1 — Universal Pipeline Acceptance Evidence

Machine-readable evidence for `UNIVERSAL_PIPELINE_INDEPENDENT_HOLDOUT_READY`.

## What this pack proves

An independent blind holdout — `minsk-kirpich.by`, a never-processed
direct company site selected only after the code freeze — completed all 11
pipeline gates in a single pass on frozen commit `1bfc28d`, with no code,
fixture, route-list, or CMS changes after selection.

## Correction areas addressed

1. **Qualification contract** — `generate.ts` no longer sets
   `manualReviewStatus: GOOD`. `--url` canonicalizes the domain, creates or
   reuses the canonical lead (merge/archive-safe), drives the real
   qualification workflow in-process, and stops with exit 2
   `LEAD_REVIEW_REQUIRED` until a legal review transitions the lead to GOOD.
   Automated tests cover: no automatic GOOD, UNREVIEWED blocked, GOOD
   generates, merged/archived leads not selected, no duplicate lead on
   repeat/concurrent `--url`.
2. **Honest legacy quarantine** — `scripts/legacy/` moved to tracked
   `archive/legacy-scenarios/` with README (option A). The broken
   fixture-isolation suite (`v35-product-integration`) was rewritten against
   the real ownership mechanism; a tracked synthetic fixture replaced the
   missing-artifact skip in `cms-contract`.
3. **Resume contract tests** — `generateCore` exposes testable
   `parseArgs`/`resolveLead`/`resolveResume`; tests assert same-run resume,
   unchanged `crawlJsonPath`, no recrawl, first-unpassed stage restart,
   preserved PASS history, replace-not-duplicate gate records, and that
   archived sites are never resume targets.
4. **Real blind holdout** — `minsk-kirpich.by` (this pack). Prior candidates
   were disqualified because code changed from their results:
   `antei.by` (d6da514), `savit.by` (3b55c3a), `svisloch.by` (6269fe3),
   `proekt-m.by` (1bfc28d — also failed gates pre-fix).
5. **This pack** — `manifest.json`, `commands.txt`, `test-results.json`,
   `runs/<run>.json`, `artifact-hashes.json`.
6. **Fresh verification** — `test-results.json` records real exit codes:
   vitest 250/250, node 302/302 (0 skipped), engine/templates/platform
   builds, prisma validate, `git diff --check` — all exit 0 on `1bfc28d`.

## Holdout summary

| field | value |
|---|---|
| domain | minsk-kirpich.by |
| leadId | cmud4141z000slh16z99d7t2j |
| runId | cmue1qxk30001xu0gdlk2m39s |
| siteId | cmue1uafy0003xu0gk7cstu40 |
| revisionId | cmue1uia200ebxu0gqdzwt8ta (REVIEW_READY) |
| gates | 11/11 PASS (CMS_IMPORT_READY PASS_WITH_WARNINGS) |
| entities | 40 pages, 3 news, 33 products |
| QA | 989 render checks, 872 visual findings, 0 errors, 0 repairs, 0 missing copy keys |
| screenshots | 156 revision screenshots / 93 PNG artifacts |
| forge preview | 200 image/png, sha256 2cc5e1fe… |

## Fixes landed between freeze candidates

- `d6da514` glued-heading detector no longer flags Latin brand names.
- `3b55c3a` sentence-level dedupe + `DD.MM.YYYY` source date parsing.
- `12d8b7d` tracked synthetic fixture for the cms-contract test.
- `6269fe3` detail-document entity dedupe + decorative divider stripping.
- `1bfc28d` crawl at `domcontentloaded` + bounded networkidle settle;
  `CONTENT_VALIDATED` requires a real `isHomepage` document;
  construction-modern hero renders in-flow.

Gate failures observed during candidate runs were real defects, fixed
generically, then exercised again through `--run-id` resume — the failure →
fix → resume loop itself is covered by the smoke runs' artifacts under
`data/redesign/<leadId>/runs/` (not committed).
