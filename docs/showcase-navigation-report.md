# Showcase Navigation Semantics — Implementation Report

## Objective

Normalize the entire `construction-modern-v1` (Showcase) navigation so that:

- `About`, `Services`, `Projects`, `News`, `Vacancies`, `Contacts` are homepage sections with stable anchors (`#about`, `#services`, `#projects`, `#news`, `#vacancies`, `#contacts`).
- Service, project, news, and vacancy detail pages use real routes (`/showcase/:token/:collection/:slug`).
- All header/footer navigation and detail "Back to..." links return to the correct homepage anchor.
- The CMS drives navigation through a semantic domain model (`targetType`/`target`) instead of arbitrary URL strings.
- No hardcoded preview tokens, no customer-specific Garant hacks, and no separate header/footer routing arrays.

## Root cause (short)

`MenuItem` only persisted `pageId` and a raw `url`. The renderer's `resolveNavHref` treated every non-external item as a real path, producing invented collection routes (`/showcase/:token/services`) instead of homepage anchors. The client `navHref` simply returned whatever the server sent, so header, footer, CTAs, and back-links all pointed to invented pages. `NavEditor.tsx` already showed a `type` dropdown, but the CMS server did not persist it, so the semantic model could not reach the renderer.

Full root-cause analysis: `docs/navigation-root-cause.md`.

## Files changed

| File | What changed |
| --- | --- |
| `prisma/schema.prisma` | Added `MenuItem.targetType` and `MenuItem.target` columns. |
| `apps/cms/src/server.ts` | Persist `targetType`/`target`/`pageId` on menu save. |
| `apps/platform/src/cms/NavEditor.tsx` | Semantic editor: `HOME`, `HOME_SECTION`, `PAGE`, `CONTENT_DETAIL`, `CUSTOM_URL`, `EXTERNAL_URL` with section/page pickers. |
| `packages/templates/src/construction-modern-v1/index.ts` | `resolveNavHref` now resolves `targetType` to `/showcase/:token/#section`, detail URLs, page URLs, custom/external URLs, and a legacy fallback. |
| `packages/templates/src/construction-modern-v1/App.tsx` | New `sectionHref(key)` helper; `DEFAULT_CMS.NAV` semantic; `id="contact"` renamed to `id="contacts"`; `App` main routing treats section slugs as home sections; detail back links use `sectionHref`; removed hardcoded footer `Вакансии` link. |
| `scripts/link-crawler.ts` | Classifies `/#section` as `VALID_HOME_ANCHOR`, detects `href="#"`, `javascript:`, and empty/unknown protocols. |
| `scripts/navigation-qa.ts` | Playwright click-through regression for header, footer, detail back and cross links. |
| `scripts/backfill-menu-targets.ts` | Backfill existing `MenuItem` rows to `targetType`/`target` (one-time). |
| `scripts/seed-vacancies-menu.ts` | Seed `Вакансии` homepage-section menu item for the generated test site (data setup, not code). |
| `docs/navigation-root-cause.md` | Root-cause and before/after routing model. |
| `docs/showcase-navigation-report.md` | This report. |

## Navigation model

| `targetType` | URL produced by `resolveNavHref` | Example |
| --- | --- | --- |
| `HOME` | `/showcase/:token/` | Главная |
| `HOME_SECTION` | `/showcase/:token/#<target>` | `/#services`, `/#contacts` |
| `PAGE` | `/showcase/:token/<pageSlug>` | Privacy page, etc. |
| `CONTENT_DETAIL` | `/showcase/:token/<type>/<slug>` | `news:my-article` → `/news/my-article` |
| `CUSTOM_URL` | `/showcase/:token/<url>` or the literal URL | custom relative path |
| `EXTERNAL_URL` | `https://...` | external site |

## CMS data changes

- `targetType`/`target` backfilled for all existing `MenuItem` rows.
- Generated `__CMS__.NAV` for `8e25ix7c`:

```
Главная     -> /showcase/8e25ix7c/          targetType=HOME
О компании  -> /showcase/8e25ix7c/#about    targetType=HOME_SECTION target=ABOUT
Услуги      -> /showcase/8e25ix7c/#services targetType=HOME_SECTION target=SERVICES
Объекты     -> /showcase/8e25ix7c/#projects targetType=HOME_SECTION target=PROJECTS
Новости     -> /showcase/8e25ix7c/#news     targetType=HOME_SECTION target=NEWS
Вакансии    -> /showcase/8e25ix7c/#vacancies targetType=HOME_SECTION target=VACANCIES
Контакты    -> /showcase/8e25ix7c/#contacts targetType=HOME_SECTION target=CONTACTS
```

## Test results

### Link crawler (`npx tsx scripts/link-crawler.ts`)

```
VALID_INTERNAL: 192
VALID_HOME_ANCHOR: 108
ANCHOR: 0
VALID_ACTION: 44
EXTERNAL: 10
EMPTY: 0
PLACEHOLDER: 0
BAD_PROTOCOL: 0
BROKEN: 0
UNKNOWN: 0
```

- 0 broken, 0 placeholder, 0 bad-protocol links.
- `BROKEN`/`PLACEHOLDER` used as the failure gate; `ok: true`.
- Report: `docs/screenshots/link-crawler/link-crawler-results.json`
- Screenshots: `docs/screenshots/link-crawler/crawl-*.png`

### Navigation QA (`npx tsx scripts/navigation-qa.ts`)

All 10 click-through scenarios passed:

- `header-О компании` → `#about`
- `header-Услуги` → `#services`
- `header-Объекты` → `#projects`
- `header-Новости` → `#news`
- `header-Контакты` → `#contacts`
- `footer-Вакансии` → `#vacancies`
- `service-back-to-services` (detail → `#services`)
- `service-detail-to-projects` (detail → `#projects`)
- `news-back-to-news` (detail → `#news`)
- `project-back-to-projects` (detail → `#projects`)

- 0 console errors.
- 0 failed HTTP requests.
- Report: `docs/screenshots/navigation-qa/navigation-qa-results.json`
- Screenshots: `docs/screenshots/navigation-qa/01-home.png`, `02-service-detail.png`, `03-news-detail.png`, `04-project-detail.png`, and `*.png` per test.

## Commands

```bash
# Run link audit
npx tsx scripts/link-crawler.ts

# Run click-through regression
npx tsx scripts/navigation-qa.ts

# Build the template after changes
npm run build -w packages/templates
```

## Conclusion

The Showcase template now uses a CMS-driven semantic navigation model. Header, footer, CTAs, and detail back-links all resolve to stable homepage section anchors (`/#<section>`) while detail pages keep real collection routes. No arbitrary URL strings are needed in the CMS for the standard sections. The link crawler and Playwright regression tests verify the behavior end-to-end.
