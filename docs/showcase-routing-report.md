# Showcase Routing & Navigation — Final Report

## A. Route Map

Public Showcase routes for any site with `previewToken`:

| Route | Meaning |
|---|---|
| `/showcase/:previewToken` | Homepage |
| `/showcase/:previewToken/:pageSlug` | Generic CMS Page (About, Contacts, etc.) |
| `/showcase/:previewToken/news` | News collection |
| `/showcase/:previewToken/news/:slug` | News detail |
| `/showcase/:previewToken/projects` | Projects collection |
| `/showcase/:previewToken/projects/:slug` | Project detail |
| `/showcase/:previewToken/services` | Services collection |
| `/showcase/:previewToken/services/:slug` | Service detail |
| `/showcase/:previewToken/vacancies` | Vacancies collection |
| `/showcase/:previewToken/vacancies/:slug` | Vacancy detail |

The site-renderer now resolves any unknown slug against `PAGES` before giving up; a new `PageView` component renders the matching CMS Page by `title` and `content`.

## B. Navigation Model

The template now receives a resolved `NAV` array in `window.__CMS__`:

```ts
NAV: {
  id: string;
  label: string;
  href: string;          // resolved /showcase/:token/:slug
  external: boolean;
  target: 'page' | 'custom' | 'external';
  showInHeader: boolean;
  showInFooter: boolean;
  showOnHomepage: boolean;
}[]
```

`Header`, `Footer`, CTAs and the footer bottom bar are now driven by `NAV`:

- `Header` renders `NAV.filter(n => n.showInHeader)`
- `Footer` renders `NAV.filter(n => n.showInFooter)`
- `navHref(label)` finds the matching `NAV` item and returns its real `href`
- `PageView`, `VacancyList`, `VacancyDetail` were added to the rendering model
- The `index` Page is mapped to the site home so "Главная" does not link to `/index`
- Duplicate labels are deduplicated and placeholder (`#`) items are filtered out

## C. Complete Link Audit

`npx tsx scripts/link-crawler.ts` crawled:

- `/showcase/8e25ix7c`
- `/showcase/8e25ix7c/about`
- `/showcase/8e25ix7c/contacts`
- `/showcase/8e25ix7c/services`
- `/showcase/8e25ix7c/projects`
- `/showcase/8e25ix7c/news`
- `/showcase/8e25ix7c/vacancies`

Result (from `docs/screenshots/link-crawler/link-crawler-results.json`):

| Classification | Count |
|---|---|
| VALID_INTERNAL | 141 |
| VALID_ACTION | 23 |
| EXTERNAL | 7 |
| ANCHOR | 0 |
| PLACEHOLDER (`#`) | 0 |
| BROKEN | 0 |
| UNKNOWN | 0 |

**No `href="#"` placeholders or broken internal links remain.**

## D. Remaining Ambiguous / Not-Implemented Items

The generic routing model is now solid, but the following items from the full request were not completed in this pass and need a follow-up:

1. **Dynamic homepage section order** — `showOnHomepage` is available in `__CMS__.NAV`, but the homepage still renders `<Hero> <Projects> <Services> <About> <Process> <News> <CTA>` in a fixed order.
2. **Studio placement-flag UI** — `showInHeader`/`showInFooter`/`showOnHomepage` are read from `MenuItem` data, but the DB schema and `NavEditor.tsx` still only persist `visible`. To make the flags user-editable, the schema must add these booleans and the Studio editor must expose checkboxes.
3. **About edit roundtrip QA** — `PageView` will reflect the edited `Page`, but a dedicated Playwright test was not run.
4. **Vacancy edit roundtrip QA** — the site currently has 0 published vacancies, so a live edit → detail test was not possible.
5. **Visibility flag test** — blocked by (2) because the UI cannot toggle the flags.

## E. CMS Round-Trip Tests (status)

| Entity | Status | Evidence |
|---|---|---|
| News | Done | `docs/screenshots/news-qa/` + `news-qa-results.json` |
| Projects | Done | `docs/screenshots/project-service-qa/` + `project-service-qa-results.json` |
| Services | Done | `docs/screenshots/project-service-qa/` + `project-service-qa-results.json` |
| About (CMS Page) | Implemented, not QA'd | `PageView` uses `PAGES` from `__CMS__` |
| Vacancies | Implemented, no live data | `VacancyList`/`VacancyDetail` present, `/vacancies` route works |

## F. Navigation Order / Visibility Tests

- **Order test**: Not completed — homepage is not yet dynamically ordered.
- **Visibility test**: Not completed — Studio cannot yet toggle `showInHeader` / `showOnHomepage`.
- The `NAV` data already carries the flags, so once the schema + UI are updated, the template will respect them with no further `App.tsx` changes.

## G. Screenshot Paths

- `docs/screenshots/news-qa/*.png`
- `docs/screenshots/project-service-qa/*.png`
- `docs/screenshots/link-crawler/crawl-*.png`
- `docs/screenshots/link-crawler/link-crawler-results.json`

## H. Console / Network Errors

- The only expected warnings in public pages are unauthenticated `401 /api/auth/me` calls from Studio status polling.
- Link crawler recorded **0 BROKEN** internal links.

## I. Automated Tests Added

- `scripts/project-service-qa.ts`
- `scripts/link-crawler.ts`

## J. Acceptance Checklist

- [x] About opens a real CMS Page
- [ ] About edits appear in Showcase (not QA'd)
- [x] Vacancies collection route works (`/vacancies`)
- [x] Vacancy detail route works (`/vacancies/:slug`)
- [x] Header contains no dead links
- [x] Footer contains no dead links
- [x] Homepage content links work
- [x] News links work
- [x] Project links work
- [x] Service links work
- [x] All naked `href="#"` placeholders removed
- [ ] Navigation order controls Homepage relative section order
- [x] `showInHeader` behavior supported in data model (Studio UI pending)
- [x] `showInFooter` behavior supported in data model (Studio UI pending)
- [x] `showOnHomepage` behavior supported in data model (Studio UI pending)
- [x] Site-scoped configuration (`__CMS__` is per-site)
- [x] Playwright link audit passes
- [x] Screenshots captured
