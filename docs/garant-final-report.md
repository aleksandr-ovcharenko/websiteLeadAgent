# Garant Kachestva Showcase ↔ Studio CMS — Final Report

## 1. Diagnosis (A → D)

**A. Why Forge/Studio opened the wrong site**
- The real site is `cmtdkqiu50004crwd529otns8` (lead `cmtdkotrm0000zkq4vfiv2p2q`, preview `8e25ix7c`), but `Site.name` and `SiteSettings.companyName` were imported as **"Site B"** from the lead.
- `site_test_001` / "Demo Site" existed as a manual test fixture and added confusion.
- The Forge UI was actually redirecting to the *selected* `site.id` correctly; the perceived wrong-site bug was bad `Site.name` metadata.

**B. How the Showcase got its content**
- `/showcase/8e25ix7c` is served by `apps/site-renderer` using template `construction-modern-v1`.
- The v1 template was a **Vite-built React bundle** (`packages/templates/src/construction-modern-v1/App.tsx`) with hardcoded services, projects, news, process steps, company text, and Unsplash images.
- `index.ts` only replaced the `<title>` and a few placeholder strings in the HTML shell; the actual visible content lived in the compiled JS bundle.

**C. What was outside the CMS**
- Everything visible: navigation labels, services (8), projects (4), process steps, news (3), hero/about/footer copy, all images.
- CMS only had noisy, full-page text dumps in `Page`/`Service`/`Project` records; `NewsPost` and `Vacancy` were empty.

**D. Existing CMS data**
- 17 `Page` rows (most single `text` blocks with full page text).
- 14 `Service` / 14 `Project` rows (largely duplicates).
- 0 `NewsPost`, 0 `Vacancy`.
- 59 `Media` files downloaded.
- 3 `MenuItem` rows.
- `RedesignRun.stage` stuck at `CMS_IMPORTED`.

See `docs/garant-diagnosis.md` for the full diagnosis.

## 2. Real Garant identifiers

| Entity | ID / Token |
|---|---|
| Lead | `cmtdkotrm0000zkq4vfiv2p2q` |
| Site | `cmtdkqiu50004crwd529otns8` |
| Preview token | `8e25ix7c` |
| Template | `construction-modern-v1` |
| New slug / domain | `garant-kachestva` / `garantk.by` |

## 3. What was changed

### 3.1 Template: `construction-modern-v1` now renders from CMS
- `packages/templates/src/construction-modern-v1/index.ts`
  - Reads `RenderContext` (`site`, `settings`, `pages`, `services`, `projects`, `news`, `menu`, `mediaMap`).
  - Builds `company`, `navItems`, `services`, `projects`, `news` payloads matching the React app.
  - Injects `<script>window.__CMS__=...;window.__CMS_ROUTE__=...</script>` into the HTML head.
- `packages/templates/src/construction-modern-v1/App.tsx`
  - Replaced hardcoded `COMPANY`, `NAV_ITEMS`, `SERVICES`, `PROJECTS`, `NEWS_ITEMS` with `DEFAULT_CMS` + `getCmsData()` reading `window.__CMS__`.
  - Replaced every literal `Гарант Качества`, phone, and `garantk.by` reference with `{COMPANY.name}`, `{COMPANY.phone}`, `{COMPANY.domain}`, etc.
  - Address blocks now prefer `COMPANY.address.formatted`.

### 3.2 Renderer: `apps/site-renderer/src/server.ts`
- Added `__dirname` and `REPO_ROOT` resolution so static asset/media paths are CWD-independent.
- Rewrote `/template-assets/:templateId` handler to correctly route each template's `dist/<template>/public` build output.
- Made `/site-media/:siteId/*` resolve from repo root.

### 3.3 Pipeline: `packages/redesign-engine/src/pipeline/index.ts`
- After `importToCms`, now updates `Site.status` to `ACTIVE`, sets `previewUrl`, and persists richer `SiteSettings` from the lead/extracted content.
- Moves `RedesignRun.stage` → `SITE_RENDERED` and `Lead.redesignStage` → `DEMO_GENERATED`.
- Creates a `SiteBuild` record with `SUCCESS` and `outputPath`.
- Rebuilt `packages/redesign-engine` and restarted all services.

### 3.4 Data backfill: `scripts/backfill-garant.ts` (one-time)
- Updated `Lead` name/phone/address/domain and `Site` name/slug/domain/status.
- Upserted `SiteSettings` with correct companyName, phone, email, address, workingHours, contacts, language, timezone, previewUrl.
- Created clean `Page` records (home, services, objects, news, contacts, about, certificates, reviews, vacancies).
- Created 8 `Service`, 4 `Project`, 3 `NewsPost` records from the v1 Showcase content.
- Created the main `Menu` with 6 items linked to the new pages.
- Updated `RedesignRun.stage` → `SITE_RENDERED` and created a `SiteBuild` record.

### 3.5 Diagnostic artifact
- `docs/garant-diagnosis.md` — full A-D diagnosis.
- This file — `docs/garant-final-report.md`.

## 4. CMS completeness matrix (after fix)

| Section | CMS entity | Records | Editable from Studio | Reflected in Showcase |
|---|---|---|---|---|
| Site name / domain | `Site` | 1 | Yes | Yes (title, domain link) |
| Company contacts | `SiteSettings` | 1 | Yes | Yes (phone, address, email) |
| Navigation | `Menu` / `MenuItem` | 1 / 6 | Yes | Yes (header + footer) |
| Hero / Home | `Page` (isHomepage) | 1 | Yes | Yes (company name/phone) |
| Services grid | `Service` | 8 | Yes | Yes |
| Projects grid | `Project` | 4 | Yes | Yes |
| News list | `NewsPost` | 3 | Yes | Yes |
| Process steps | `Page` (`process` block) | — | No (static fallback) | Static fallback |
| About | `Page` (`about`) | 1 | Yes | Partial (uses page text) |
| Vacancies | `Vacancy` | 0 | Yes | No listing yet |
| Media | `Media` | 59 | Yes | Used for project covers if `coverImageId` set; otherwise Unsplash fallback |

## 5. Acceptance test results

### 5.1 Garant Showcase ↔ Studio
- Started full stack via `npx tsx scripts/dev.ts --no-infra`.
- Logged in as `admin@minsk.local` through gateway `/api/auth/login`.
- Fetched `/api/cms/sites/cmtdkqiu50004crwd529otns8` — returned correct `companyName: "Гарант Качества"`, 8 services, 4 projects, 3 news.
- `GET /showcase/8e25ix7c` returned `__CMS__` payload with those entities.
- **Service edit test**: `PUT /api/cms/sites/.../services/...` changed title to `TEST LANDSCAPING UPDATED`; reloaded Showcase and the new title appeared immediately.
- **News edit test**: changed news title to `TEST NEWS UPDATED`; Showcase reflected it.
- **Project edit test**: changed project title to `TEST PROJECT UPDATED` and category; Showcase reflected it.
- Reverted all three test changes to the original values.

### 5.2 Second-site Radar → Factory → CMS → Showcase
- Created a second lead (`Test Builder Local`, website `http://localhost:9000`).
- Started a local static test site on port 9000.
- Called `POST /api/leads/{id}/generate` with template `construction-modern-v1`.
- Pipeline returned HTTP 200 with new `siteId` and `previewSlug` `ze6f3z0v`.
- `GET /showcase/ze6f3z0v` returned the second site's `companyName: "Test Builder Local"`, phone, and domain correctly.
- **Gap identified**: `extractFromCrawl` did not yet produce structured `services`/`projects`/`news` for the simple local site; those arrays were empty, so the Showcase fell back to static placeholders. The CMS import step itself is now working end-to-end.

## 6. Remaining gaps and next steps

1. **Extraction quality**: `packages/redesign-engine/src/extract/extractFromCrawl.ts` still produces noisy/empty structured content. It needs to be rewritten to detect service/project/news lists and split full-page text into per-entity records.
2. **Media wiring**: `Service.imageId` and `Project.coverImageId` are not yet populated from the backfill; the v1 template uses Unsplash fallbacks. A media-association step should map downloaded images to records.
3. **Process steps**: still static in the v1 template. Should become a `Page` with slug `process` and `blocks` rendered by `App.tsx`.
4. **Detail pages**: the v1 template remains a single-page React app. Full `/services/:slug`, `/projects/:slug`, `/news/:slug` routes are not implemented yet.
5. **Vacancies**: no `Vacancy` records created for Garant and no listing in the v1 template.
6. **Image assets**: v1 template logo PNGs are bundled template assets, not CMS media. Need a clear separation: template assets in `packages/templates`, site media in `data/generated/sites/{siteId}/media`.
7. **Idempotency**: the pipeline still deletes and recreates the `Site` on `force=true`. True idempotency should upsert `Site`/`SiteSettings` and diff-update entities.

## 7. How to verify

All services are running:
- Gateway: `http://localhost:3000`
- Forge: `http://localhost:3000/forge`
- Studio: `http://localhost:3000/studio/cmtdkqiu50004crwd529otns8`
- Garant Showcase: `http://localhost:3000/showcase/8e25ix7c`
- Second-site Showcase: `http://localhost:3000/showcase/ze6f3z0v`

Commands used:
```bash
# full stack
cd /home/aleks/dev/websiteLeadAgent
nvm use v22
npx tsx scripts/dev.ts --no-infra

# build v1 template
cd packages/templates && npm run build

# backfill
cd /home/aleks/dev/websiteLeadAgent
npx tsx scripts/backfill-garant.ts
```
