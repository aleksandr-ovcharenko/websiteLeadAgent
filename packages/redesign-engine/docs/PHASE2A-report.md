# Phase 2A — Semantic Content Graph Report

**Date:** 2026-09-04
**Scope:** Build a deterministic, language-agnostic semantic interpretation layer that transforms `source-documents.json` into `source-content-graph.json` (shadow mode, no CMS mutation).

## 1. Objective

Produce a typed, provenanced `source-content-graph.json` artifact from a raw crawl. The graph must contain:

- one `Company` entity with legal/display names, founded date, employee count, UNP
- `Service`, `Project`, `News`, `Vacancy`, `Product`, `Fact`, `Media` entities
- `Contact` records (phones, emails, addresses, social links)
- page and collection classifications (home, about, services, projects, news, vacancies, products, contacts, legal)
- collection classes: `NAVIGATION`, `LANGUAGE_SWITCHER`, `THEME_WIDGET`, `UTILITY`, `ADVERTISEMENT`, `CONTENT_COLLECTION`, `UNKNOWN`
- source evidence for every extracted field

## 2. Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| `SourceContentGraph` Zod schema | `packages/redesign-engine/src/semantic/graph.ts` | Immutable, typed graph contract |
| `GenerationSemanticProvider` interface | `packages/redesign-engine/src/semantic/provider.ts` | Strategy for classification/extraction |
| `RuleBasedSemanticProvider` | `packages/redesign-engine/src/semantic/ruleBasedProvider.ts` | Deterministic heuristics, Unicode regex, multilingual keyword lists |
| `buildSourceContentGraph` | `packages/redesign-engine/src/pipeline/index.ts` | Orchestrates provider + writes artifact (shadow mode) |
| Acceptance runner | `scripts/gen2-semantic-acceptance.mjs` | Runs the pipeline on a 6-site matrix and aggregates results |

The provider is rule-based by design: AI is used only where it genuinely helps (none in this phase), and all signals are traceable to source text, JSON-LD, URL paths, or headings.

## 3. Methodology

1. **Unit tests** — `packages/redesign-engine/test/gen2-semantic-graph.test.mjs` validates:
   - valid `source-content-graph.json` via Zod
   - home page and company name extraction
   - service/news/contact classification and extraction
   - language switcher / theme widget / ad rejection
   - navigation vs utility collection handling
2. **Acceptance matrix** — 6 real sites:
   - `mapid.by` — multi-service construction holding
   - `radlen.by` — municipal road service
   - `minskdsk.by` — house-building combine
   - `savit.by` — construction / house projects
   - `a-100development.by` — real-estate developer
   - `mcnorthwaterfront.by` — residential complex
3. **Manual review** — sampled 30+ pages and 20+ collections from the generated review file and source traces.

## 4. Results Summary

| Site | Pages | Page Types (top) | Collections | Services | Projects | News | Products | Contacts | Warnings |
|------|-------|------------------|-------------|----------|----------|------|----------|----------|----------|
| mapid | 20 | HOME 1, ABOUT 9, SERVICES_INDEX 1, PRODUCTS_INDEX 2, NEWS_DETAIL 1 | 44 (THEME 18, UTILITY 12, CONTENT 10) | 60 | 0 | 25 | 0 | yes (5 phones) | 5 |
| radlen | 20 | HOME 1, ABOUT 7, SERVICE_DETAIL 7, NEWS_INDEX 1 | 21 (UNKNOWN 19, LANG 2) | 7 | 0 | 1 | 0 | yes | 2 |
| minskdsk | 20 | HOME 1, ABOUT 1, NEWS_INDEX 1, OTHER 15, LEGAL 1, CONTACTS 1 | 40 (NAVIGATION 40) | 0 | 0 | 0 | 0 | yes | 18 |
| savit | 20 | PROJECT_DETAIL 5, HOME 1, PRODUCT_DETAIL 1, NEWS_DETAIL 11 | 35 (NAVIGATION 20, ADS 7, CONTENT 6) | 0 | 16 | 11 | 25 | yes | 1 |
| a100 | 20 | HOME 1, NEWS_DETAIL 5, LEGAL 3, CONTACTS 2, PROJECTS_INDEX 1 | 53 (UNKNOWN 37, CONTENT 12, ADS 3) | 0 | 0 | 12 | 0 | yes | 7 |
| northwaterfront | 20 | HOME 1, NEWS_DETAIL 13, NEWS_INDEX 1, ABOUT 1 | 19 (CONTENT 14, UNKNOWN 4) | 0 | 0 | 26 | 0 | yes | 3 |

**Company names extracted:**
- mapid → `МАПИД`
- radlen → `Ремавтодор Ленинского района г. Минска`
- minskdsk → `Минский домостроительный комбинат`
- savit → `SAVIT`
- a100 → `A-100 Девелопмент`
- northwaterfront → `North Waterfront`

## 5. Manual Review Findings

**Correct classifications observed:**
- `mapid` home, about, services, products, projects indices are correct; 60 services extracted from service collection.
- `radlen` home and 7 service detail pages correctly identified; service detail pages have path `uslugi/...`.
- `a100` home, projects index, contacts, legal pages correctly classified; news detail pages dated and extracted.
- `northwaterfront` home + news detail pages correct; news index page detected.

**Known false positives/edge cases:**
- `mapid` — 18 `THEME_WIDGET` collections are actually style/colour switchers; correctly rejected as content.
- `savit` — 5 `PROJECT_DETAIL` pages are catalog listing pages (`catalog/proekty-domov`) that contain project collections; they should be `PROJECTS_INDEX`. The detail→index heuristic did not trigger because `h1` is specific per project card.
- `a100` — 5 `OTHER` pages are team/career/generic corporate pages without strong signals; some should likely be `ABOUT`/`VACANCIES_INDEX`.
- `minskdsk` — 15 pages classified `OTHER` because the site is anti-corruption / legal heavy; no service/news/project entities were extracted. This is the weakest site in the matrix.
- `northwaterfront` — `LEGAL` page is likely a privacy-policy page; correct.

**Collections:**
- Navigation menus dominate `minskdsk` and `savit` because they are the only detectable repeated lists.
- `ADVERTISEMENT` classifications in `savit` / `a100` are caused by repeated external partner/social links; a minority are true ads.

## 6. Source Traces

Sampled entity traces were written to:

- `data/redesign/source-traces-2026-09-04T08-15-57-105Z.json`

Each sample contains the entity type, display name/value, source document URL, source title, and the first 3 evidence objects (type, value snippet, confidence, source URL).

## 7. Known Weaknesses

1. **Service extraction from non-service sites** — `savit` and `a100` have construction services, but their wording is project/product centric; regex does not reliably separate service descriptions from project descriptions.
2. **Index vs detail discrimination** — catalog pages with many items but a specific per-item `h1` are still labelled `*_DETAIL`. A future improvement is to inspect the number of collection items and the genericity of the first heading.
3. **Minskdsk** — the site is mostly compliance/navigation; extraction yields almost no business entities. More targeted legal/anti-corruption page types are not yet modelled.
4. **Theme/utility/ad boundaries** — repeated social/partner links trigger `ADVERTISEMENT`; we need a broader partner-link / footer-social marker.
5. **Fact extraction** — founding date, employee count, UNP depend on visible text patterns. Only 8 facts total across the matrix (mostly mapid/a100); employee count matching is noisy.

## 8. Artifacts

- `data/redesign/semantic-acceptance-2026-09-04T08-09-36.json` — full per-site matrix with summaries and sampled pages/collections.
- `data/redesign/semantic-review.txt` — sampled page and collection classifications for manual review.
- `data/redesign/source-traces-2026-09-04T08-15-57-105Z.json` — sampled entity source traces.
- `packages/redesign-engine/docs/PHASE2A-report.md` — this report.

## 9. Factory Viewer Update

The Factory artifact viewer now has a **"source-content-graph.json"** tab:

- `apps/platform/src/Factory.tsx` — added `semantic` tab to `ArtifactPanel`.
- `apps/platform/src/cms/api.ts` — added `getSourceContentGraphArtifact`.
- `apps/dashboard/src/platform.ts` — added `/api/factory/runs/:runId/source-content-graph` route.

## 10. Next Steps

1. Refine index/detail discrimination using collection cardinality and heading genericity.
2. Add explicit `SERVICE` extraction for construction/real-estate sites where services are described as process or work stages.
3. Improve collection ad detection by distinguishing footer social links from true advertisements.
4. Expand `LEGAL` and `CORPORATE` page-type coverage for compliance-heavy sites.
5. Integrate optional LLM fallback for ambiguous pages while keeping deterministic traces.
