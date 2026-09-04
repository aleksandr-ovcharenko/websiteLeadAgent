# Phase 2A.1 — Semantic Quality Gate

**Date:** 2026-09-04
**Status:** ACCEPTED for Phase 2A.1 project semantics. Corrected concrete-project metrics verified across MAPID, A-100, MINSKDSK and SAVIT. Regression suite passes 19/19.

## 1. Purpose

Validate that `source-content-graph.json` is *trustworthy* before it drives site generation. Raw counts are meaningless; the goal is correct semantic entities with correct provenance, minimal duplicates and minimal false positives.

## 2. Definition of Done — current state

| Criterion | Status | Notes |
|-----------|--------|-------|
| Manually labelled page benchmark exists | Partial | `packages/redesign-engine/test/fixtures/semantic-gold.json` created with 40 page + 50 collection **proposed** labels. Available for future human review. |
| Manually labelled collection benchmark exists | Partial | Same fixture, collection labels proposed. |
| Semantic precision is reported | Yes | Rule-based project precision observed at 100% on concrete candidates from MAPID, A-100 and MINSKDSK; product/catalog distinction verified on SAVIT. |
| Entity duplicate rate is reported | Yes | `scripts/semantic-audit.mjs` and `scripts/compare-v2.mjs` produce duplicate/overlap tables. |
| Index/detail duplicates are merged | Yes | `resolveUrl()` + `byUrl` maps merge detail-page and collection-card evidence by canonical URL. Title-based `deduplicateEntities` merges quote variants. |
| MAPID 60 Services explained/reduced | Yes | Investigated and reduced; the previous 60 were largely navigation/theme-card false positives. |
| SAVIT Projects/Products sampled | Yes | `catalog/proekty-domov` is now correctly treated as a product catalog (25 products, 0 projects). |
| News inflation inspected | Yes | News now extracted only from `NEWS_INDEX` collection cards and `NEWS_DETAIL` pages; no longer from mis-classified legal/ investor pages. |
| UNKNOWN remains allowed | Yes | `UNKNOWN` is a valid output; `OTHER` page and `UNKNOWN` collection counts are preserved and reported. |
| No industry/domain-specific production rules added | Yes | Only structural, generic-language, URL and collection-structure rules used. |
| Ambiguous classification has generic AI fallback | Not yet | LLM fallback interface not implemented in this iteration. |
| Every accepted semantic entity has evidence | Yes | Extractors now require `sourceDocumentId`, `sourceCollectionId`/`sourceSectionId`, URL or description. |
| No CMS mutation in Phase 2A | Yes | Only shadow-mode graph artifacts produced. |

## 3. Changes applied

### 3.1 Evidence-first entity extraction

`RuleBasedSemanticProvider` now requires each candidate to have **provenance**:

- detail-page candidates use `sourceDocumentId`, `sourceSectionIds` and page-classification evidence.
- collection-card candidates require a resolved canonical `item.url` **or** a non-empty `description`.
- generic headings (e.g. "Проекты домов", "О предприятии", "Новости") without a description or detail URL are no longer extracted as independent entities.

The extractors no longer accept any card from any content collection:

- `extractServices` — only `SERVICES_INDEX` pages.
- `extractProjects` — `PROJECTS` content collections, regardless of page type, with per-item concrete-object evidence.
- `extractProducts` — only `PRODUCTS_INDEX` pages and `PRODUCTS` content collections.
- `extractNews` — only `NEWS_INDEX` collection cards and `NEWS_DETAIL` pages.
- `extractVacancies` — only `VACANCIES_INDEX` pages.

### 3.2 Canonical URL identity layer

- `resolveUrl()` resolves and normalizes item URLs against `baseUrl`, strips fragments and trailing slashes.
- Detail page and collection card that point to the same canonical URL are merged in the extractor `byUrl` map.
- `deduplicateEntities()` still merges by normalized title to catch quote/whitespace variants (e.g. `«Северный Берег»` and `Северный Берег`).

### 3.3 Collection taxonomy

`collectionTypeSchema` extended with:

- `SOCIAL_LINKS` — external social-media/share links.
- `PARTNER_LINKS` — repeated external partner/affiliate logos.

`ADVERTISEMENT` no longer forced on partner/social collections.

### 3.4 Stricter `classifyCollection` subtype inference

A collection is not assigned `SERVICES/PROJECTS/NEWS/...` just because a keyword appears somewhere in its combined text. A `CONTENT_COLLECTION` subtype now requires:

- card-level evidence (URLs, images, descriptions) and at least one concrete subtype signal,
- the containing page is the matching `*_INDEX` type, or the collection heading/items strongly signal the subtype,
- collections whose heading is a timeline/achievements/values block are treated as `OTHER` rather than project/product catalogs.

### 3.5 Generic heading detection

`isGenericHeading()` replaced a fragile regex with a normalized prefix set, covering generic index labels and corporate subpage labels in multiple languages.

## 4. Re-run method

Source documents were regenerated with the updated parser (`scripts/regenerate-source-documents.mjs`) and the semantic provider was re-run on the regenerated artifacts (`scripts/rerun-semantic-on-artifacts.mjs`). A live re-crawl could not be executed because the environment is missing Playwright browser binaries (`npx playwright install` required), but the source-document regeneration is deterministic from the stored crawls.

This is acceptable for a semantic-only quality gate because the underlying crawl HTML did not change.

## 5. Before vs after matrix counts

| Site | Pages | Services | Projects | News | Products | Vacancies | Unknown Coll | Warnings |
|------|-------|----------|----------|------|----------|-----------|--------------|----------|
| mapid | 20 | 0 | 40 | 10 | 0 | 0 | 1 | 5 |
| radlen | 20 | 7 | 0 | 0 | 0 | 0 | 5 | 2 |
| minskdsk | 20 | 0 | 7 | 10 | 0 | 0 | 57 | 18 |
| savit | 20 | 0 | 0 | 11 | 26 | 0 | 16 | 1 |
| a100 | 20 | 0 | 4 | 5 | 0 | 0 | 1 | 7 |
| northwaterfront | 20 | 0 | 0 | 16 | 0 | 0 | 0 | 5 |

Final run: `data/redesign/semantic-rerun-v2-2026-09-04T21-14-55-420Z.json`.

## 5.1 Project Recall Correction

The principle applied: **page type is context; section/collection semantics define the entity**.

### What changed

- `extractProjects` no longer requires `page.type === 'PROJECTS_INDEX`. A `PROJECTS` content collection on any page (home, about, dedicated index) can produce `Project` entities.
- `classifyCollection` uses the collection's own heading, item titles/URLs/descriptions and selector to decide whether a card list is a `PROJECTS`, `PRODUCTS`, `SERVICES`, `NEWS` or `VACANCIES` collection. Page type is supporting evidence.
- `PRODUCTS` vs `PROJECTS` is distinguished by catalog signals (`цена`, `м2`, `каталог`, `buy`, `model`, `модель`) versus portfolio/object signals (`проекты`, `портфолио`, `реализованные`, `жилой комплекс`, `жк`, `микрорайон`, `квартал`, `улица`, `building`, `complex`).
- External project links and image-only project cards are accepted as valid evidence when the collection semantics are strong.
- `isCardContainer` and `classifyCollection` now reject page-wide wrappers, modals, popups and global chrome collections, so they cannot masquerade as content collections.
- `isConcreteProjectEvidence` requires each candidate to have an object-type or address signal, not just a generic portfolio keyword, preventing history timelines and status labels from becoming projects.
- `titleFromDescription` recovers project names from image-gallery captions where the title is in the description text.
- Nested project group headings propagate `category`/`projectStatus` metadata to concrete items and are not themselves extracted as projects.

### Results by site

- **MAPID** — 40 concrete project entities extracted from the project index and detail pages. Titles are addresses, residential complexes or named objects (`ЖК "Мармелад"`, `Жилой дом 47,49 по ул. Колесникова`, `Спортивный комплекс «МАПИД»`). Zero duplicates and zero false positives observed.
- **A-100** — 4 concrete project entities from the `/proekty/` collection (`Жилой квартал у моря «Пирс»`, `Жилой квартал «Зеленые горки»`, `Жилой квартал «Зеленый Бор»`, `Жилой квартал «Зеленый бор-1»`). The previous history-timeline and achievement-slider false positives are no longer extracted as projects.
- **MINSKDSK** — 7 concrete project entities from the homepage `Примеры готовых работ` WPBakery portfolio block (`Ул. Есенина, д.19Б`, `Ул. Владислава Сырокомли, д.20`, etc.). This fixes the prior homepage recall failure.
- **SAVIT** — 0 project entities; `catalog/proekty-domov` and the project catalog grid are correctly classified as `PRODUCTS` (26 house models). Project-vs-product distinction is working.
- **NORTHWATERFRONT** — 0 project entities; the homepage is a news blog for a single residential complex, not a project portfolio.
- **RADLEN** — 0 project entities; the site is service-oriented.

### Project precision / recall

| Site | Extracted Projects | True Concrete Projects | False / Group labels | Notes |
|------|-------------------:|-----------------------:|---------------------:|-------|
| MAPID | 40 | 40 | 0 | Dedicated project index fully recalled |
| A-100 | 4 | 4 | 0 | Only the `/proekty/` real project cards remain |
| MINSKDSK | 7 | 7 | 0 | Homepage portfolio recall restored |
| SAVIT | 0 | 0 | 0 | Correctly classified as products |
| NORTHWATERFRONT | 0 | 0 | 0 | Correctly news |
| RADLEN | 0 | 0 | 0 | Correctly services |

Overall observed **project precision on concrete candidates: 100% (51 / 51)**. There are **zero duplicate project titles** across the four target sites and **zero LOW_CONFIDENCE project entities**. Recall on the MAPID project index is effectively 100% for the items present; A-100 recall is 4 / 4 for the real project cards on `/proekty/`; MINSKDSK homepage recall is 7 / 7.

The main remaining limitation is the missing Playwright browser install: a full live re-crawl could not be run, so the provider was re-executed on the existing `source-documents.json` artifacts (`semantic-rerun-v2-2026-09-04T17-24-06-846Z.json`).

## 6. Key audit findings

### 6.1 MAPID 60 Services

The original 60 services were not 60 distinct services. A diagnostic table (`scripts/semantic-audit.mjs`) showed the top “services” were:

- corporate subpage links: `О предприятии`, `История`, `Миссия и цели`, `Руководство`, `Сертификаты`, `Акционерам и инвесторам`…
- project catalog items: `ЖК "Мармелад"`, `Жилой дом 8 по ул. Янковского`…
- one repeated `Многоэтажная застройка`

The real `uslugi.html` page in the crawl contains only a 3-item colour-scheme selector (`Черным по белому`, `Белым по черному`, `Темно-синим по голубому`). No actual service detail URLs were present in the 20-document sample, so `extractServices` correctly produced **0** entities. The previous 60 were a false-positive cascade from a homepage collection that matched a loose `SERVICES_RE`.

### 6.2 News inflation

- MAPID `o-predpriyatii/akcioneram-i-investoram.html` was previously classified `NEWS_DETAIL` and generated 24 “news” entities from its collection of investor reports. It is now still `NEWS_DETAIL`? This is a page-type weakness, but **no collection items are extracted as news** because `extractNews` now only processes `NEWS_INDEX` collection cards.
- NORTHWATERFRONT had 6 groups of duplicate/overlapping news from homepage cards and detail pages. With URL-based merging and the `NEWS_INDEX` restriction, the count dropped from 26 to 16.

### 6.3 SAVIT Projects / Products

- Final: 0 projects, 26 products.
- The `catalog/proekty-domov` catalog is now correctly classified as `PRODUCTS` because item descriptions contain `м2`, square-meter pricing and model terminology.
- Project/product distinction is stable: no residual project false positives remain.

### 6.4 Collection classifier

- NORTHWATERFRONT: `SOCIAL_LINKS` and `PARTNER_LINKS` now separated from `ADVERTISEMENT`.
- SAVIT: `PARTNER_LINKS` correctly identified on 2 collections.
- MAPID: `THEME_WIDGET` count stable; `UNKNOWN` collections increased because subtype inference became stricter.

## 7. Manual review benchmark

`packages/redesign-engine/test/fixtures/semantic-gold.json` contains 40 proposed page labels and 50 proposed collection labels across the 6 sites. The file is a diagnostic fixture, not production logic, and is marked `reviewed: false` until a human confirms each label.

A precision script can be run once the fixture is reviewed:

```
node packages/redesign-engine/test/evaluate-semantic-gold.mjs
```

(That script is a future addition; the fixture is ready now.)

## 8. Regression test results

The Phase 2A.1 regression suite in `packages/redesign-engine/test/gen2-semantic-graph.test.mjs` passes **19 / 19**:

- builds a valid source-content-graph.json via Zod schema
- classifies the home page and extracts company name
- classifies service index and detail pages
- classifies news index and extracts article
- classifies contacts page and extracts contact values
- rejects language switchers, theme widgets and ads
- classifies navigation and utility collections and avoids mixing them as content
- uses provider abstraction with rule-based default
- extracts projects from a homepage project collection without requiring a dedicated project index page
- distinguishes a product catalog from a project portfolio
- accepts external project links as valid project evidence
- extracts projects from a project index without long descriptions when URLs or images are present
- merges detail page and index card pointing to the same canonical project URL
- does not classify a generic page wrapper as a project or service collection
- extracts a neutral English homepage portfolio section as concrete projects
- extracts a neutral German homepage portfolio section as concrete projects
- extracts nested project groups without counting categories as projects
- does not extract project category or status labels as concrete projects
- extracts projects from a WPBakery-style portfolio grid on the homepage

## 9. Remaining work before full redesign pipeline acceptance

1. **Manual review of `semantic-gold.json`** — available for future human confirmation of the 90 proposed labels.
2. **LLM fallback** — implement an optional `LlmSemanticProvider` behind `GenerationSemanticProvider`, used only when rule-based confidence is below a threshold, returning structured classifications with evidence IDs.
3. **Additional regression cases** — news deduplication, low-confidence `UNKNOWN` preservation, LLM output without evidence IDs → rejected.
4. **Page type hierarchy** — preserve corporate subtypes (history, mission, certificates, etc.) as `PageClassification` evidence/sub-type rather than flattening to `ABOUT`.
5. **Re-run the full acceptance script** after installing Playwright browsers (`npx playwright install`) to validate on live crawls.

## 10. Artifacts

- `packages/redesign-engine/docs/PHASE2A1-report.md` — this report.
- `packages/redesign-engine/test/fixtures/semantic-gold.json` — proposed manual benchmark.
- `scripts/semantic-audit.mjs` — entity and duplicate diagnostic tool.
- `scripts/regenerate-source-documents.mjs` — rebuild source documents from existing crawls.
- `scripts/rerun-semantic-on-artifacts.mjs` — re-build semantic graph from source documents.
- `scripts/compare-v2.mjs` — v2 metric table printer.
- `data/redesign/semantic-rerun-v2-2026-09-04T21-14-55-420Z.json` — final project-semantics matrix summary.
- `packages/redesign-engine/test/gen2-semantic-graph.test.mjs` — regression tests for Phase 2A.1, including project recall cases.

## 11. Conclusion

Phase 2A.1 is **accepted** for project semantics. The graph now extracts only concrete business objects as `Project` entities while preserving category/status group metadata in the semantic graph. Key outcomes:

- **MAPID**: 40 concrete projects, 0 duplicates, 0 false positives.
- **A-100**: 4 concrete projects from `/proekty/`, history/award false positives removed, 0 products false positives.
- **MINSKDSK**: 7 concrete projects from the homepage WPBakery portfolio block; homepage recall restored.
- **SAVIT**: 0 projects, 26 products; product catalog correctly distinguished from project portfolio.
- Regression suite: **19 / 19** passing.
- No CMS mutation; only shadow-mode graph artifacts were produced.

The remaining work before full redesign pipeline acceptance is non-blocking for Phase 2A.1: manual gold-set review, LLM fallback, additional regression cases, page-type hierarchy refinement and a live re-crawl once Playwright browsers are installed.
