# Demo Generation — Root Cause Audit

## A. Which crawler artifacts are currently read by generation?

`packages/redesign-engine/src/pipeline/index.ts`:
- Calls `crawlSite(...)` and receives `pages` + `navigation`.
- Stores `currentCrawl` JSON and `content.json` on disk.
- Passes `content` (output of `extractFromCrawl`) to `importToCms`.

`importToCms` reads from `content`:
- `company`
- `branding`
- `navigation`
- `pages`
- `services`
- `projects`
- `news`
- `media`

It does **not** read any pre-existing `content.raw.json`, `sources.json`, `crawl.json`, or a local `media/` directory under `data/redesign/<leadId>/`.

## B. Which crawler artifacts are ignored?

- `data/redesign/<leadId>/content.raw.json` (not produced yet)
- `data/redesign/<leadId>/sources.json` (not produced yet)
- `data/redesign/<leadId>/crawl.json` (not produced yet)
- `data/redesign/<leadId>/media/` (no persistent media staging)
- Full `CrawledPage.html`, `links`, `images`, `alt` text, page `depth`, image context.
- Logo detection.
- Vacancy pages.

## C. Where does current homepage content come from?

`packages/templates/src/construction-modern-v1/App.tsx`:
- `Hero()` is almost entirely static:
  - Background image: hardcoded Unsplash URL.
  - Headline: `Строим / объекты, / которые / работают`.
  - Subtext: `Полный цикл — от проектирования до сдачи...`.
  - CTA: `Обсудить проект`.
  - Location: `Минск · Беларусь`.
  - Brand subtitle: `Строительная компания · Беларусь`.
- `About`, `CTA`, and section headings are also static strings in `App.tsx`.
- Only the **lists** (`Services`, `Projects`, `News`, `Vacancies`) come from CMS entities, and only if they are non-empty.

## D. Where does current navigation come from?

`importToCms` creates `Menu` + `MenuItem` rows either from:
1. `content.navigation` (extracted header/footer tree), or
2. A hardcoded fallback generic menu (`Главная`, `Услуги`, `Объекты`, `Новости`, `Контакты`).

`constructionModernV1` (`index.ts`) maps `ctx.menu` to `__CMS__.NAV`.
The current `crawlSite.ts` returns `navigation` only as a flat list of roots; nested `children` are empty, so hierarchy is lost before it reaches `importToCms`.

## E. Where do current colors come from?

`packages/templates/src/construction-modern-v1/index.css` hardcodes the entire palette:
```css
--bg: #F2F2F2;
--fg: #1C2B23;
--dark: #0F1F1C;
--brass: #13A34A;
--brass-light: #1DB85A;
--muted: #5C7268;
--border: #C8D5CE;
--card-bg: #E5EDEA;
```

`extractFromCrawl` sets `branding.primaryColor = '#2563EB'`, `secondaryColor = '#1E40AF'`, and `importToCms` writes those to `SiteSettings.primaryColor / secondaryColor`, but the template never reads them. Every generated site therefore looks green/brass.

## F. Which values are still inherited/hardcoded from Garant?

Directly in `App.tsx` / `index.ts`:
- Default fallback phone `+375 17 374-15-28` (`buildCompany` in `index.ts`).
- Hero copy (`Строим объекты, которые работают`).
- Hero subtext (`Полный цикл — от проектирования до сдачи...`).
- Location `Минск · Беларусь`.
- Industry label `Строительная компания · Беларусь`.
- CTA `Обсудить проект` and tender email wording.
- Section titles `Портфолио`, `Реализованные объекты`, `Специализация`, `Услуги`, etc.
- Default Unsplash images for hero, projects, news.
- Green construction color palette.

## G. Which template content is still static?

- Hero background, headline, subtext, CTA, location.
- About section text and image.
- CTA/Contacts section copy.
- All section labels.
- Color variables (CSS `:root`).
- `DEFAULT_CMS` fallback company identity.
- Fallback project/news images.
- Routing logic uses fixed Russian collection names.

## H. Which CMS entities are actually created during Factory generation?

`importToCms` creates:
- `Site`
- `SiteSettings`
- `Media` (from downloaded source images)
- `Page` (one per crawled page, all with a single `text` block)
- `Service` (only pages whose URL/text contains `service`/`услуг`)
- `Project` (only pages whose URL/text contains `project`/`object`/`объект`)
- `NewsPost` (only pages whose URL/text contains `news`/`novost`)
- `ProjectMedia` links
- `Menu` + `MenuItem`

It does **not** create:
- `Vacancy` records
- Homepage / collection block records
- Logo/favicon media references on `SiteSettings`
- `Site.themeConfig` JSON

## I. Which existing `content.json` fields never reach the DB?

- `reviews` is empty and not imported.
- `contacts.socialLinks` is read into `SiteSettings.socialLinks` but `contacts` is otherwise unused.
- `branding` values besides `companyName`/`primaryColor`/`secondaryColor`/`defaultSeo*` are ignored.
- No `logo`, `favicon`, `theme` (background, text, muted, border) fields exist in the schema.
- Page `blocks` are forced to a single `text` block; any `hero`, `cta`, `image`, `gallery` semantics are lost.
- `projects[].coverImage` and `services[].image` are set to empty objects in `extractFromCrawl`, so real source images are not linked to projects/services/news covers.

## J. Which current SiteSettings/theme values are defaults rather than Site-specific?

From `packages/redesign-engine/src/pipeline/index.ts`:
- `Site.themeConfig` is not written at all (defaults to `{}`).
- `SiteSettings.language` and `timezone` are hardcoded `ru` / `Europe/Minsk`.
- `SiteSettings.primaryColor` and `secondaryColor` are written from `content.branding`, but `extractFromCrawl` hardcodes them to blue (`#2563EB` / `#1E40AF`), not extracted from source.
- `SiteSettings.logoMediaId` and `faviconMediaId` are never set.
- `SiteSettings.previewUrl` is hardcoded to `http://localhost:3000/showcase/${previewSlug}`.
- `SiteSettings.contacts` JSON is left as the default `{}`.

## Summary of root causes

1. **Crawl output is under-used.** Rich page HTML, link context, images, and logo candidates are thrown away.
2. **Content extraction is too shallow.** `extractFromCrawl` creates only generic `text` blocks and guesses entity types from URL keywords.
3. **No Site-specific theme.** Colors, hero image, hero copy, and about/CTA copy are hardcoded in `App.tsx` / `index.css`.
4. **Homepage is not composed from CMS entities.** Lists render only if they exist, but the hero, about, and CTA are static.
5. **Navigation hierarchy is flattened.** `crawlSite` returns root nodes only; `importToCms` supports children but never receives them.
6. **Media is not classified.** Images are not tagged as logo/hero/project/service/news, so project/service/news covers are left empty.
7. **No generation plan / validation.** `importToCms` runs without a `SiteGenerationPlan` or completeness check, so empty placeholders pass silently.
8. **No real delete/regenerate flow.** Deleting a site only archives it; there is no cascading delete and no pre-generation configuration step.
