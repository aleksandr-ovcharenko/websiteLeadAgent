# Garant Kachestva Showcase ↔ Studio diagnosis

## A. Why Forge was opening the wrong/mock Site

The Forge UI lists sites from `/api/platform/sites`, which returns real DB records.
There are two `Site` rows today:

| id | name | slug | previewToken | templateId | leadId |
|---|---|---|---|---|---|
| `cmtdkqiu50004crwd529otns8` | **Site B** | `site-b-iv2p2q` | `8e25ix7c` | `construction-modern-v1` | `cmtdkotrm0000zkq4vfiv2p2q` |
| `site_test_001` | **Demo Site** | `test-garant` | `testtoken` | `construction-modern-v1` | (none) |

- The real generated site is `cmtdkqiu50004crwd529otns8` (lead `cmtdkotrm0000zkq4vfiv2p2q`, website `https://garantk.by/`).
- It was imported with the lead name **"Site B"** instead of the real company name, and `SiteSettings.companyName` is also **"Site B"**, so it looks like a mock/demo.
- `site_test_001` is an old manual test fixture with a confusing slug (`test-garant`) that adds to the confusion.
- `App.tsx` correctly opens `/studio/<site.id>` for the selected row, so the **routing is not wrong** — the displayed site metadata is wrong and the CMS content itself is mis-imported.

## B. How the current Showcase gets its content today

1. `/showcase/8e25ix7c` is handled by `apps/site-renderer/src/server.ts`.
2. It looks up the `Site` by `previewToken` and calls `templates[site.templateId]`, i.e. `constructionModernV1` from `packages/templates/dist/construction-modern-v1/index.js`.
3. That `index.ts` reads `public/index.html` (a Vite-built React app shell) and does only these runtime string replacements:
   - `companyName`, `phone`, `email`, `domain`, `address` in the `<title>` and a few legacy literal strings.
4. The shell loads `/template-assets/construction-modern-v1/assets/index-DUTWs-bI.js`, a **React bundle built from `packages/templates/src/construction-modern-v1/App.tsx`**.
5. `App.tsx` contains hardcoded arrays/constants for the real content:
   - `NAV_ITEMS`
   - `SERVICES` (8 services)
   - `PROJECTS` (4 projects)
   - `PROCESS_STEPS`
   - `NEWS_ITEMS`
   - `COMPANY` placeholders and `IMG` Unsplash URLs.
6. The Showcase therefore renders the company name/phone/address from `SiteSettings`, **but every service, project, news item, process step, navigation label, and image is baked into the bundle at build time**.
7. `pages`, `services`, `projects`, `news`, `menu`, and `mediaMap` are all fetched by the renderer and passed in `ctx`, but the v1 template **ignores them**.

Result: the Showcase is a build-time static artifact, not a runtime CMS render.

## C. Which Showcase content is outside CMS today

Everything that is actually visible in the v1 Showcase is outside the CMS:

| Showcase section | CMS entity today | Status |
|---|---|---|
| Company name / phone / address | `SiteSettings` | Partial (`companyName` = "Site B", `address` malformed, `email` missing) |
| Hero headline/body | `Page` (`index` block) | Imported as a single giant `text` block, but the bundle uses its own hero copy |
| Navigation labels | `MenuItem` | 3 items (`Главная`, `Услуги`, `Объекты`) but bundle uses `NAV_ITEMS` |
| Services grid (8 cards) | `Service` | 14 records imported, but most are duplicates/full-page dumps; bundle uses `SERVICES` array |
| Projects grid (4 cards) | `Project` | 14 records imported, mostly duplicates; bundle uses `PROJECTS` array |
| Process steps | — | Hardcoded `PROCESS_STEPS` |
| News list | `NewsPost` | 0 records; bundle uses `NEWS_ITEMS` |
| About section | `Page` (`about-company`) | Imported as giant `text` block; bundle uses its own About copy |
| CTA / Footer | `SiteSettings` / `Page` | Bundle uses its own static copy |
| All images | `Media` | 59 files imported, but bundle uses Unsplash `IMG` URLs; no `Media` picker wiring |
| Contacts page | `Page` (`contacts`) | Imported as raw text; bundle uses placeholders |
| Vacancies | `Vacancy` | 0 records; there is a `vacancies` page but no structured entities |

## D. Which CMS data exists for the real Site

**Lead** (`cmtdkotrm0000zkq4vfiv2p2q`)
- `companyName`: `Site B`
- `website`: `https://garantk.by/`

**Site** (`cmtdkqiu50004crwd529otns8`)
- `name`: `Site B`
- `slug`: `site-b-iv2p2q`
- `previewToken`: `8e25ix7c`
- `templateId`: `construction-modern-v1`
- `status`: `DRAFT`
- `domain`: not set (will default to `garantk.by`)

**SiteSettings**
- `companyName`: `Site B`
- `phone`: `+ 375 17 374-15-28`
- `email`: empty
- `address`: `Skip to content Заказчикам: + 375 17 374-15-28` (crawl noise)

**Pages** (17)
- `index` / `index-1` (home), `about-company`, `services`, `objects`, `projects`, `articles`, `news`, `contacts`, `certificates`, `rewiews`, `partners/astron`, `partners/aprioriproekt`, `objects/...`, `articles/...`, `vacancies`.
- Most consist of one `text` block containing the entire crawled page text (header/footer noise included).

**Services** (14)
- Titles like `Строительная компания ГАРАНТ КАЧЕСТВА …`, `Услуги`, `О компании`, `Контакты`, etc.
- `shortDescription` is the full homepage text.
- No meaningful per-service content.

**Projects** (14)
- Similar duplication; titles include full company name.
- No `category`/`location` set.

**NewsPosts** (0)

**Vacancies** (0)

**Media** (59)
- Downloaded to `data/generated/sites/cmtdkqiu50004crwd529otns8/media/`
- Filenames preserve original names (`logo-1.png`, `5-3.jpg`, `atestat11-1-212x300.png`, etc.)
- `sourceUrl` points to `http://garantk.by/...`

**MenuItems** (3)
- `Главная` → home page
- `Услуги` → services page
- `Объекты` → projects page

**RedesignRun**
- Last run stage: `CMS_IMPORTED`
- Lead `redesignStage`: `CMS_IMPORTED`
- No `SITE_RENDERED`, `SHOWCASE_READY`, `AUDITING`, or `DEMO_READY` stage.

## Root causes

1. **Runtime template is static**: `construction-modern-v1` ignores the CMS data passed by `site-renderer`.
2. **Extraction is noisy**: `extractFromCrawl` in `packages/redesign-engine` puts whole-page raw text into `Page`/`Service`/`Project` blocks and fails to extract separate services/projects/news entities.
3. **Pipeline stops at `CMS_IMPORTED`**: no stage update to `SHOWCASE_READY`/`DEMO_READY` and no `SiteBuild` record.
4. **No idempotency**: rerunning redesign deletes/recreates the site rather than upserting.
5. **Static asset path in `site-renderer` is CWD-dependent**: `/template-assets/construction-modern-v1/...` fails when the renderer is launched from `apps/site-renderer` instead of the repo root.
