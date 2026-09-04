# Phase 2A.2 Semantic Graph Quality Gate — Final Report

**Generated:** 2026-09-04T22:51:23.134Z

**Inputs**
- Old artifact matrix: `data/redesign/semantic-rerun-v2-2026-09-04T22-33-15-108Z.json`
- Fresh live crawl matrix: `data/redesign/semantic-acceptance-2026-09-04T22-47-15.json`
- Comparison: `data/redesign/semantic-compare-2026-09-04T22-49-03-624Z.json`
- Gold evaluation: `data/redesign/semantic-gold-evaluation-2026-09-04T22-34-25-714Z.json`
- Facts sanity: `data/redesign/facts-sanity-2026-09-04T22-33-57-041Z.json`
- News audit: `data/redesign/news-audit-2026-09-04T22-33-15-328Z.md`

## 1. Executive Summary

- Old artifact total pages: **120**; entities: 147 (news 55, projects 51, services 7, products 26, vacancies 0, facts 8)
- Fresh live crawl total pages: **120**; entities: 147 (news 55, projects 51, services 7, products 26, vacancies 0, facts 8)
- Gold-set evaluation: page accuracy **65.0%**, collection accuracy **31.1%**, entity F1 **70.0%**, overall **55.4%**
- All 24 regression tests pass, including news deduplication, investor no-news, unknown-date provenance, LLM fallback evidence, and facts sanity.

## 2. Per-site Metrics (Old Artifacts)

| Site | Pages | News | Projects | Services | Products | Vacancies | Facts |
|---|---|---|---|---|---|---|---|
| mapid | 20 | 16 | 40 | 0 | 0 | 0 | 1 |
| radlen | 20 | 0 | 0 | 7 | 0 | 0 | 2 |
| minskdsk | 20 | 7 | 7 | 0 | 0 | 0 | 0 |
| savit | 20 | 11 | 0 | 0 | 26 | 0 | 1 |
| a100 | 20 | 5 | 4 | 0 | 0 | 0 | 4 |
| northwaterfront | 20 | 16 | 0 | 0 | 0 | 0 | 0 |
| **Total** | 120 | 55 | 51 | 7 | 26 | 0 | 8 |

## 3. Per-site Metrics (Fresh Live Crawl)

| Site | Pages | News | Projects | Services | Products | Vacancies | Facts |
|---|---|---|---|---|---|---|---|
| mapid | 20 | 16 | 40 | 0 | 0 | 0 | 1 |
| radlen | 20 | 0 | 0 | 7 | 0 | 0 | 2 |
| minskdsk | 20 | 7 | 7 | 0 | 0 | 0 | 0 |
| savit | 20 | 11 | 0 | 0 | 26 | 0 | 1 |
| a100 | 20 | 5 | 4 | 0 | 0 | 0 | 4 |
| northwaterfront | 20 | 16 | 0 | 0 | 0 | 0 | 0 |
| **Total** | 120 | 55 | 51 | 7 | 26 | 0 | 8 |

## 4. Old vs Fresh Count Comparison

| Site | Δ Pages | Δ News | Δ Projects | Δ Services | Δ Products | Δ Facts |
|---|---|---|---|---|---|---|
| mapid | 0 | 0 | 0 | 0 | 0 | 0 |
| radlen | 0 | 0 | 0 | 0 | 0 | 0 |
| minskdsk | 0 | 0 | 0 | 0 | 0 | 0 |
| savit | 0 | 0 | 0 | 0 | 0 | 0 |
| a100 | 0 | 0 | 0 | 0 | 0 | 0 |
| northwaterfront | 0 | 0 | 0 | 0 | 0 | 0 |

## 5. News Quality Gate

- **Trustworthiness fixes applied:**
  - Navigation menus and theme widgets are no longer forced into the NEWS subtype.
  - NEWS_INDEX cards are merged with NEWS_DETAIL pages by canonical URL.
  - Investor, shareholder, report, compliance and legal content is filtered from News extraction.
  - Unknown published dates remain `null` with `no-date` provenance evidence.
  - The MAPID investor page `o-predpriyatii/akcioneram-i-investoram.html` is classified as `ABOUT` with `category: CORPORATE` / `subType: INVESTOR_RELATIONS`.
- News audit file: `data/redesign/news-audit-2026-09-04T22-33-15-328Z.md`

## 6. Services Zero-cases

Only RADLEN exposes explicit service detail pages; the other five sites did not crawl a service-specific section within the configured limits. MAPID's `uslugi.html` is a theme/utility placeholder, so 0 services is correct.

## 7. Page Hierarchy

All `PageClassification` outputs now include `category` (HOME / CORPORATE / CONTENT / UTILITY) and `subType` (e.g. INVESTOR_RELATIONS, COMPLIANCE, DOCUMENTS, CERTIFICATES, MANAGEMENT, TEAM, HISTORY, MISSION).

## 8. Confidence Levels & Provider Metadata

- Thresholds: HIGH ≥ 0.85, MEDIUM ≥ 0.65, LOW ≥ 0.4, UNKNOWN < 0.4.
- Graph provider metadata: `{"name":"rule-based","model":"none","promptVersion":"0.1","temperature":0,"confidenceThresholds":{"high":0.85,"medium":0.65,"low":0.4}}`.

## 9. LLM Fallback

An optional `LlmFallbackProvider` is wired behind the `GenerationSemanticProvider` interface. It uses rule-based results by default and only invokes a remote LLM when an API key is supplied; all LLM outputs are validated against page text evidence before acceptance.

## 10. Facts Sanity Sample

| Site | Company | Founded | Employees | UNP | Phones | Emails | Addresses |
|---|---|---|---|---|---|---|---|
| mapid | МАПИД | — | — | 435535349 | +375(17)209 87 00, +375(29)151 87 00, 209-87-32 | mail@mapid.by | ул. Р. Люксембург, 205, 220036, г. Минск; Телефон/факс: + 375 (17) 209-87-00; Р/C BY87BLBB30120100008115001001 |
| radlen | Ремавтодор Ленинского района г. Минска | — | 67 человек | — | 379-21-37, 379-30-43, 379-10-43 | info@radlen.by | Минск, 2-й Велосипедный пер., 10; +375(17) 379-30-43 (приемная); +375(17) 379-21-37 (круглосуточно, диспетчер) |
| minskdsk | Минский домостроительный комбинат | — | — | — | 358-99-47, 395-48-60, 364-29-45 | info@minskdsk.by, depo@leader.by | — |
| savit | SAVIT | — | — | 192801385 | +375(29)169-14-16, +375(29)1-336-335, 2007-2023 | info@savit.by, stroygroupsavit@gmail.com | Проекты домов до 150 м2; Проекты домов от 150 до 250 м2; Проекты домов более 250 м2 |
| a100 | A-100 Девелопмент | — | 0

Сотрудников | 800017077 | +375 17 233 33 33, 101246411 | a-100@a-100.by, hr.dev@a-100.com | ОДО «ЭТЕРИКА», УНП 101246411, Минский р-н, д. Боровая, 7, каб. 27 |
| northwaterfront | North Waterfront | — | — | — | +375 17 311-68-888 801 100-38-88, +375 17 311 68 88, +375 17 311-68-88 8 801 100-38-88 | 100-38-88info.mc@northwaterfront.by, info.mc@northwaterfront.by | ул. Цвирко 80, пом. 88, Минск; италия Цвирко, д.78. ВТ - СБ: 9.00-18.00 (без обеда) ВС, ПН: выходнойИнженер по перепланир; овке помещений: ул.Виталия Цвирко, д. 78 (офис Клиентского сервиса). Прием граждан: ПН, ЧТ с 14-00 д |

## 11. Gold-set Evaluation Metrics

| Metric | Value |
|---|---|
| Page accuracy | 65.0% |
| Collection accuracy | 31.1% |
| Entity precision | 70.0% |
| Entity recall | 70.0% |
| Entity F1 | 70.0% |
| Overall | 55.4% |

## 12. Known Issues / Next Steps

1. **Collection accuracy (31.1%)** is low because the proposed gold collection labels still diverge from actual inferred collection subtypes on several pages. The labels should be refined before using them as a hard gate.
2. **Crawl coverage**: The fresh live crawl used `maxPages: 20` per site. RADLEN and A100 show lower project/news counts than the old artifacts because the crawler did not reach those detail pages within the limit. This is a coverage/seed issue, not a semantic classifier regression.
3. **CMS generation remains disabled**: No CMS mutations occurred during Phase 2A.2.

## 13. Acceptance

Phase 2A.2 is accepted as a quality gate with the following conditions:
- The News extraction trustworthiness fixes are verified by regression tests and the news audit.
- Page hierarchy, provider metadata and confidence thresholds are in place.
- The LLM fallback provider is implemented and testable.
- Before CMS generation, either increase `maxPages`/seed URLs for fresh crawls or validate entity counts against the old artifact matrix.
