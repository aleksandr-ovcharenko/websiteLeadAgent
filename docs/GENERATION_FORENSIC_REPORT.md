# MAPID Website Generation — Forensic Report

## 1. MAPID Crawl Coverage — Why Only 5 Pages

The production MAPID crawl (`cmthnoa4f004dtnq3jt3hcleo/runs/cmtk5cvyn0001voqzd7kc9ddm/crawl.json`) contains 5 pages because the test runner hard-limited the crawl.

- `scripts/run-crawl-mapid.mjs` lines 10–11 set:
  ```js
  maxPages: 5,
  maxDepth: 2,
  ```
- `crawl.json` `meta` confirms this:
  ```json
  { "maxPages": 5, "maxDepth": 2, "crawledPages": 5 }
  ```

A diagnostic re-run with `maxPages: 100, maxDepth: 4` against `https://mapid.by/` showed the actual site has far more discoverable URLs:

| Funnel | Value |
|---|---|
| Internal URLs discovered | 293 |
| Successfully crawled | 100 (hard cap) |
| Skipped | 299 |
| Skipped reason | 100% `blocked_by_rules` |
| Navigation nodes extracted | 12 root nodes / 35 total |
| Duration | 302,799 ms |

The 100-page crawl was also unbalanced: it followed `О предприятии → Новости и статьи` first and spent most of its budget on news article detail pages before reaching `Услуги`, `Проекты`, `Продукция`, etc.

---

## 2. `crawl.json` Artifact Structure

Path: `data/redesign/cmthnoa4f004dtnq3jt3hcleo/runs/cmtk5cvyn0001voqzd7kc9ddm/crawl.json`

Top-level keys:

```json
{
  "meta":    { runId, leadId, startUrl, startedAt, maxPages, maxDepth, timeoutMs },
  "homepage":{ url, confidence, reason, pageIndex },
  "navigation": [ ...NavigationNode[]... ],
  "pages":   [ ...CrawledPage[]... ],
  "warnings":[],
  "skipped": [ { url, reason }... ]
}
```

Each `CrawledPage` is flattened:

```ts
{
  url, title, h1, metaDescription, canonicalUrl,
  path, depth,
  text:   document.body.innerText (clamped to 12 000 chars),
  html:   full outer HTML,
  links:  every <a href> with text,
  images: every <img> with src/alt/width/height/area/context/likelyLogo/likelyHero,
  headerNav:  top-level header labels,
  footerNav:  footer labels,
  logo, logoHref, favicon,
  heroImage, themeColors
}
```

No per-page sections, paragraph blocks, article boundaries, or content-element relationships are stored. `headings` is empty for all MAPID pages.

---

## 3. Generation Call Chain

```
Lead.website
  └── packages/redesign-engine/src/pipeline/index.ts  generateSite(options)
        ├── load lead + site
        ├── load existing crawl via crawlRunId OR runCrawl() -> packages/redesign-engine/src/crawl/crawlSite.ts
        │     └── writes data/redesign/{leadId}/runs/{runId}/crawl.json
        ├── packages/redesign-engine/src/extract/extractFromCrawl.ts
        │     └── ExtractedContent object
        │     └── writes data/redesign/{leadId}/runs/{runId}/content.json
        ├── packages/redesign-engine/src/import/importToCms.ts
        │     └── downloads media, upserts Site/SiteSettings/Page/Service/Project/NewsPost/Vacancy/Media/Menu/MenuItem
        ├── packages/redesign-engine/src/pipeline/validateSite.ts
        └── updates lead/redesignRun stages
```

Final rendering:

```
User -> apps/gateway or apps/site-renderer -> packages/templates/src/construction-modern-v1/index.ts
      -> builds __CMS__ JSON -> packages/templates/src/construction-modern-v1/App.tsx renders
```

---

## 4. Page Semantic Classification

`packages/redesign-engine/src/extract/extractFromCrawl.ts` `classifyPage()` (lines 144–163) uses only URL/title keyword regex:

```ts
function classifyPage(p: CrawledPage, baseUrl: string): PageCategory {
  const lowerUrl = p.url.toLowerCase();
  const lowerTitle = (p.title + ' ' + p.h1).toLowerCase();
  // 1. home by URL or path === 'index'
  // 2. about by URL/title keywords: about, o-kompanii, o-nas, o-predpriyatii, ...
  // 3. contacts by URL/title keywords: contact, kontakty, ...
  // 4. news by novost, news, blog, ...
  // 5. services by service, uslugi, услуг, ...
  // 6. projects by project, object, объект, proekt, ...
  // 7. vacancies by vacancy, vakansii, career, ...
  // 8. otherwise 'page'
}
```

No DOM structure, no heading hierarchy, no content semantics, no AI. MAPID examples:

- `/o-predpriyatii.html` → `about` (correct by keyword)
- `/o-predpriyatii/istoriya.html` → `page` (not matched)
- `/o-predpriyatii/missiya-i-celi.html` → `page` (not matched)

---

## 5. Entity Extraction Algorithms

### 5.1 Services

`extractFromCrawl.ts` lines 448–456:

```ts
if (cat === 'service' || cat === 'services') {
  services.push({
    title: p.h1 || p.title || companyName,
    slug: toSlug(title),
    shortDescription: p.metaDescription || firstSentences(p.text, 1, 220),
    blocks: [{ type: 'text', content: p.text.slice(0, 1500) }],
    sourceUrl: p.url,
    image: contentMediaFromImage(cover)
  });
}
```

- Classification triggered by keyword in URL/title.
- Short description is the first 220 characters of `document.body.innerText`.
- Body is the first 1500 characters of `document.body.innerText`.
- Cover image = largest non-logo image on the page.

MAPID generated service `"Строительство"` has `shortDescription` beginning:

> `г.Минск, ул.Р.Люксембург, 205 (Пн-Чт)08.30-17.30; ...`

This is the site header/phone/address, not a service description.

### 5.2 Projects

`extractFromCrawl.ts` lines 457–468:

```ts
} else if (cat === 'project' || cat === 'projects') {
  projects.push({
    title,
    slug: toSlug(title),
    excerpt: p.metaDescription || firstSentences(p.text, 1, 250),
    category: inferIndustry([], p.text).replace(' · Беларусь', ''),
    location: '',
    blocks: [{ type: 'text', content: p.text.slice(0, 1500) }],
    sourceUrl: p.url,
    coverImage: contentMediaFromImage(cover),
    gallery
  });
}
```

- `category` comes from `inferIndustry([], p.text)`.
- `location` is hardcoded empty.
- Same `p.text.slice(0,1500)` body issue.

MAPID project `"Строительство коттеджей"` has `category: "Интернет-провайдер"`.

### 5.3 News

`extractFromCrawl.ts` lines 469–480:

```ts
} else if (cat === 'news') {
  const yearMatch = p.url.match(/\/([12]\d{3})\//);
  const publishedAt = yearMatch ? `${yearMatch[1]}-01-01` : new Date().toISOString();
  news.push({
    title,
    slug: toSlug(title),
    excerpt: p.metaDescription || firstSentences(p.text, 1, 250),
    publishedAt,
    blocks: [{ type: 'text', content: p.text.slice(0, 1500) }],
    sourceUrl: p.url,
    coverImage: contentMediaFromImage(cover)
  });
}
```

- Date derived only from a 4-digit year in the URL path.
- If URL has no year, `publishedAt` becomes `new Date()`.
- For MAPID, most news URLs do not contain a year, so cards show today's date.

### 5.4 About

`extractFromCrawl.ts` lines 403–407, 515–519:

```ts
const contactsText = contactsPage?.text || '';
const aboutPage = pages.find(p => classifyPage(p, baseUrl) === 'about') || homepage;
const aboutText = aboutPage ? firstSentences(aboutPage.text, 4, 1200) : firstSentences(homepage?.text || '', 4, 1200);
const aboutHeading = aboutPage?.h1 || aboutPage?.title || 'О компании';
const aboutImage = contentMediaFromImage(pickCoverImage(aboutPage?.images || homepage?.images || []));
```

MAPID `about.content` starts with the office address and phone numbers because `aboutPage.text` is `document.body.innerText` of `/o-predpriyatii.html`.

### 5.5 Hero

`extractFromCrawl.ts` lines 297–343 (`makeHeroTitle`, `makeHeroSubtitle`, `pickHeroImage`) and `buildHero` (lines 355–370):

- Title falls back to `shortName || companyName` (`"МАПИД"`).
- Subtitle concatenates `name`, `inferIndustry(...).industry`, `location`, and first sentence of description.
- Image selection order:
  1. `homepage.heroImage`
  2. any image with `likelyHero`
  3. `projects[0].coverImage`
  4. `pickCoverImage(aboutPage.images || homepage.images)`
  5. `pickCoverImage(allImages)` — largest image across **all** crawled pages.

MAPID hero image = `https://mapid.by/assets/images/services/stroy/D81_6694.jpg` because no homepage hero was detected and the largest overall image came from a service page.

### 5.6 Contacts

`extractFromCrawl.ts` lines 392–403, 574–580:

```ts
for (const p of pages) {
  allPhones.push(...findPhones(p.text));
  allEmails.push(...findEmails(p.text));
  allSocial.push(...findSocialLinks(p.text, p.links));
}

contacts: {
  phone: uniquePhones[0],
  email: uniqueEmails[0],
  address,
  workingHours,
  socialLinks: uniqueSocial
}
```

- Phone and email are the **first** regex matches found in **any** page text.
- `address` is `contactsPage.text.split('\n').slice(0,4).join(' ').slice(0,300)`.
- `workingHours` is regex-extracted from contacts page text.

---

## 6. Media Provenance and Selection

`crawlSite.ts` extracts every `<img>` with context (`parent class/id` string) and two boolean flags:

- `likelyLogo` — if `alt` or `src` contains `logo`/`brand` or dimensions < 120 px.
- `likelyHero` — if `context` contains `hero`/`banner`/`header`/`intro`.

`extractFromCrawl.ts` `pageMedia()` picks cover + gallery by area:

```ts
function pickCoverImage(images: CrawledImage[]): CrawledImage | undefined {
  return images
    .filter(i => !i.src.startsWith('data:') && !i.likelyLogo && i.width > 120 && i.height > 120)
    .sort((a,b) => (b.area || 0) - (a.area || 0))[0];
}
```

There is **no** relationship between an image and the paragraph/section it belongs to. Media selection is purely size-based.

MAPID effect: many pages contain 16×16 Google Translate flag icons and the logo. Real photos are rare, so the largest photo from any page is reused as hero/about/service/project cover regardless of context.

---

## 7. AI Usage During Site Generation

**No AI is used during site generation.**

Search of `packages/redesign-engine/src`, `apps/site-renderer/src`, and `apps/dashboard/src` for `openai`, `anthropic`, `gpt`, `llm`, `completions`, `prompt` found only:

- `apps/dashboard/src/operations/registry.ts` — `OpenAiVisualAnalysisProvider` / `GeminiVisualAnalysisProvider` used for **Radar visual qualification**, not generation.
- `apps/dashboard/src/server.ts` — `model` / `promptVersion` columns on lead analysis.

`extractFromCrawl.ts`, `importToCms.ts`, `crawlSite.ts`, `pipeline/index.ts`, and `validateSite.ts` contain **zero** AI calls.

---

## 8. Take-First / Fallback Heuristics

| Location | Heuristic | Risk |
|---|---|---|
| `extractFromCrawl.ts` `extractFromCrawl` | `pages.find(classifyPage === 'home') \|\| pages[0]` | Uses first crawled page if no home detected |
| `extractFromCrawl.ts` | `title = p.h1 \|\| p.title \|\| companyName` | Ignores page semantics; can use HTML title with pipe |
| `extractFromCrawl.ts` `inferIndustry` | Keyword grep on `text.toLowerCase()` | False positives; MAPID becomes "Интернет-провайдер" |
| `extractFromCrawl.ts` `classifyPage` | URL/title keyword regex | `/istoriya.html` and `/missiya-i-celi.html` become generic `page` |
| `extractFromCrawl.ts` `pickCoverImage` | Largest non-logo image by area | Cover may be unrelated to page topic |
| `extractFromCrawl.ts` `pickHeroImage` | Fall back to `pickCoverImage(allImages)` | Hero image can come from any page |
| `extractFromCrawl.ts` `firstSentences` | Split on `/.!?/` and `slice(0, count)` | Captures header/phone/footer text |
| `extractFromCrawl.ts` services/projects/news | `p.text.slice(0, 1500)` | Body includes navigation labels and address |
| `extractFromCrawl.ts` news | `p.url.match(/\/([12]\d{3})\/)` or `new Date()` | Articles without year get today's date |
| `extractFromCrawl.ts` contacts | `uniquePhones[0]`, `uniqueEmails[0]` | First match across all pages, may be noise |
| `extractFromCrawl.ts` `findFounded` | `\d{4}` near "основан" or `\d{4}` + "год" | MAPID got 2026 from a news sentence |
| `crawlSite.ts` `shouldCrawlUrl` | Substring deny list (`admin`, `login`, `pdf`, etc.) | Blocks `/realizovannye-proekty/administrativnye-i-obshhestvennye-zdaniya.html` |
| `crawlSite.ts` `extractLinks` | All `<a href>` from body, no semantic filter | Header/footer/content links mixed |
| `importToCms.ts` | Upsert by `(siteId, slug)`; no delete of stale entities | Old run content remains and mixes with new crawl |
| `construction-modern-v1/index.ts` | `shortDescription \|\| textFrom(s).slice(0,240)` | Falls back to full noisy body text |

---

## 9. Intermediate Artifacts and Provenance Loss Points

| Artifact | Path | Producer | Consumer | Provenance preserved? |
|---|---|---|---|---|
| `crawl.json` | `data/redesign/{leadId}/runs/{runId}/crawl.json` | `crawlSite.ts` | `extractFromCrawl.ts` | URL, title, flat body text, flat images; **no sections/paragraphs** |
| `content.json` | `data/redesign/{leadId}/runs/{runId}/content.json` | `extractFromCrawl.ts` / `importToCms.ts` | `importToCms.ts` | `sourceUrl` per entity, but text already flattened |
| Downloaded media | `data/generated/sites/{siteId}/media/*` | `importToCms.ts` | `site-renderer` | File name is hash of `sourceUrl`; `media.sourceUrl` kept |
| Prisma DB | `Site`, `SiteSettings`, `Page`, `Service`, `Project`, `NewsPost`, `Vacancy`, `Media`, `MenuItem` | `importToCms.ts` | `site-renderer` | `sourceUrl` on most tables, but blocks are single `text` blobs |

**No artifacts exist for:**

- Section/paragraph structure
- Content-block provenance (which DOM element produced which block)
- Image-to-paragraph associations
- Entity disambiguation decisions
- Per-run CMS snapshots (DB is overwritten by upserts)

---

## 10. Source → Crawl → Content → CMS → Showcase (5 Fragments)

### Fragment 1: Hero industry label

| Stage | Value |
|---|---|
| Source | Construction/real-estate company |
| `crawl.json` text | "Строительство недвижимости", "Проектирование", "Реализация продукции" |
| `extractFromCrawl` `inferIndustry` | `"Интернет-провайдер · Беларусь"` (keyword false-positive) |
| `content.json` | `hero.industry: "Интернет-провайдер · Беларусь"` |
| CMS | `siteSettings`/`themeConfig.hero` stores same value |
| Showcase | **"МАПИД — ИНТЕРНЕТ-ПРОВАЙДЕР · БЕЛАРУСЬ"** |

### Fragment 2: Founded year

| Stage | Value |
|---|---|
| Source | Company founded 1976 ("50 лет" in 2026 article) |
| `crawl.json` text | "15 января 2026 года открытому акционерному обществу «МАПИД» исполняется 50 лет" |
| `extractFromCrawl` `findFounded` | `"2026"` (regex `\d{4}` + "года") |
| `content.json` | `company.founded: "2026"` |
| CMS | `siteSettings` stores `"2026"` |
| Showcase | **"© 2026–2025 «МАПИД»"** |

### Fragment 3: About content

| Stage | Value |
|---|---|
| Source | `/o-predpriyatii.html` company overview |
| `crawl.json` `text` | `document.body.innerText` starting with address/phone and nav labels |
| `extractFromCrawl` | `firstSentences(aboutPage.text, 4, 1200)` |
| `content.json` | `about.content` begins with office address/phone and nav labels |
| CMS | `themeConfig.about.content` same text |
| Showcase | **"О компании: г.Минск, ул.Р.Люксембург, 205 … +375(17)209 87 00 …"** |

### Fragment 4: Service "Строительство" short description

| Stage | Value |
|---|---|
| Source | `/uslugi/stroitelstvo.html` construction service description |
| `crawl.json` `text` | Whole page body starting with header/address/phone |
| `extractFromCrawl` | `firstSentences(p.text, 1, 220)` |
| `content.json` | `services[?].shortDescription` = address/phone string |
| CMS | `Service.shortDescription` same |
| Showcase | Service card shows the address/phone string |

### Fragment 5: News published date

| Stage | Value |
|---|---|
| Source | Article, e.g. 2017 or 2018 |
| `crawl.json` URL | `/o-predpriyatii/novosti/testovaya-novost-1.html` (no year) |
| `extractFromCrawl` | `yearMatch` fails; fallback `new Date()` |
| `content.json` | `news[].publishedAt: "2026-09-01T..."` |
| CMS | `NewsPost.publishedAt` same |
| Showcase | **"1 СЕНТ. 2026 Г."** on every card |

---

## 11. Bad Generated Mappings in the MAPID Showcase

Verified by rendering `http://localhost:3336/showcase/hgxpszhj` and inspecting the DB CMS dump.

1. **Wrong industry label**
   - Visible: `"МАПИД — ИНТЕРНЕТ-ПРОВАЙДЕР · БЕЛАРУСЬ"`
   - Source: construction company
   - Cause: `inferIndustry()` keyword grep false-positive.

2. **About section contains phone/address and navigation labels**
   - Visible: About copy begins with `"г.Минск, ул.Р.Люксембург, 205 … +375(17)209 87 00 …"` and includes `"О предприятии Реализованные проекты Услуги …"`
   - Cause: `firstSentences(aboutPage.text, 4, 1200)` over `document.body.innerText`.

3. **Founded year 2026**
   - Visible: Footer `"© 2026–2025 «МАПИД»"`
   - Source: a news article sentence about the 50-year anniversary in 2026.
   - Cause: `findFounded()` regex `\d{4}` near "года".

4. **News cards all dated 1 September 2026**
   - Visible: `"1 СЕНТ. 2026 Г."` on every article card.
   - Cause: `news.publishedAt` falls back to `new Date()` when the URL has no year.

5. **Service detail page broken (`Услуга не найдена`)**
   - Visible: `/services/stroitelstvo` renders `"Услуга не найдена"`.
   - Cause: `Service.slug` is Cyrillic `строительство` (from `toSlug()` preserving Cyrillic), while the template route expects a Latin slug.

6. **Project category "Интернет-провайдер"**
   - DB `Project.category` for `"Строительство коттеджей"` = `"Интернет-провайдер"`.
   - Cause: `inferIndustry([], p.text)`.

7. **Hero image from a service page**
   - Hero image URL: `https://mapid.by/assets/images/services/stroy/D81_6694.jpg`.
   - Cause: `pickHeroImage` final fallback is `pickCoverImage(allImages)` (largest image anywhere).

8. **Duplicate menu items**
   - Menu contains `"Реализация квартир"`, `"Аренда помещений"`, `"Вакансии"`, `"Новости и статьи"` twice.
   - Cause: `mergeHeaderAndFooter` only deduplicates top-level header URLs, not header children, so footer links that duplicate header children are re-added.

---

## 12. Demo Validation — What It Actually Checks

`packages/redesign-engine/src/pipeline/validateSite.ts`:

- Site record exists and is `ACTIVE`
- `companyName` non-empty
- At least one contact method
- Theme has `primaryColor`, `textColor`, `backgroundColor`
- Logo image exists in media
- Hero has title, subtitle, image, valid `buttonUrl`, image mapped to site media
- About section has content
- Contact/CTA section has content
- Homepage sections configured
- Main navigation has items
- At least one published page
- At least one service or project

It **does NOT** check:

- Whether About text is coherent
- Whether industry label matches business
- Whether service descriptions describe the service
- Whether images belong to the entity
- Whether news dates are real
- Whether pages are reachable (slug mismatch)

So `validateGeneratedSite` returns `ok: true` for MAPID because all required fields are non-empty, even though the content is semantically incoherent.

---

## 13. Forge / Pipeline Run Visibility

`apps/platform/src/Factory.tsx` displays a list of pipeline runs with:

- Run number
- Company / domain
- Status badge
- Current stage / progress bar
- Duration
- Retry button (`api.startOperation({ operation: 'GENERATE_SITE', input: { leadId, force: true }, entityId: run.id })`)

It **does NOT** expose:

- `crawl.json` path/content
- `content.json`
- Per-run extracted content
- Source provenance
- Media staging
- `crawlRunId` relationship
- `RedesignRun` stage details beyond `currentStage` string

Required data fields already exist on `RedesignRun` (`crawlJsonPath`, `contentJsonPath`, `siteId`, `stage`), but the Forge UI does not render them.

---

## 14. Run Provenance and Retry Behavior

- `crawl.json` and `content.json` are written per `RedesignRun` under `data/redesign/{leadId}/runs/{runId}/`.
- `generateSite` can accept `crawlRunId` to reuse an existing crawl artifact.
- `importToCms` uses Prisma `upsert` on `(siteId, slug)` for `Page`, `Service`, `Project`, `NewsPost`.
- It does **not** delete stale entities before upserting. Therefore:
  - Content from earlier crawls persists in the CMS.
  - The showcase mixes entities from multiple runs.
  - There is no snapshot/rollback per run.

---

## 15. Root Cause Conclusion

The generated MAPID site is semantically incoherent because the generation pipeline flattens source pages into unstructured text and then assigns that text to CMS entities using keyword and size heuristics, without any semantic understanding or structural extraction.

Exact failure points:

1. **`crawl.json` has no structure.** It stores `document.body.innerText` and flat image/link arrays, losing paragraphs, sections, article boundaries, and image context.

2. **`extractFromCrawl` creates one `text` block per page from `p.text.slice(0,1500)` / `firstSentences(...)`.** This captures header, footer, address, phone, and navigation labels as part of the entity body.

3. **`classifyPage` and `inferIndustry` are keyword regex over URL/title/body.** They produce false positives (`Интернет-провайдер` for a construction company, `/istoriya.html` classified as generic `page`).

4. **Media selection is purely size-based.** Cover images, hero images, and gallery images are chosen by pixel area, not by relevance to the entity, so a service-page image becomes the homepage hero.

5. **No AI is used during generation.** There is no summarization, no content block detection, no entity relationship extraction, no image captioning, no semantic validation.

6. **CMS import is additive and not run-scoped.** Upserts by `(siteId, slug)` do not delete stale content, so the showcase mixes old and new run data.

7. **`validateGeneratedSite` is structural only.** It confirms all required fields are non-empty; it cannot detect that the About text is an address string or that the industry label is wrong.

**In short:** the system treats every website as a bag of URLs, a bag of images, and a bag of strings, then guesses which string goes where. It never extracts the actual information architecture of the source site, so the generated content is frequently unrelated to the source page it claims to represent.
