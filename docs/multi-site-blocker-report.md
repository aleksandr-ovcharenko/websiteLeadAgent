# Multi-Site Navigation & Showcase — Blocker Resolution Report

## 1. Executive Summary

This session fixed the critical multi-site navigation and Showcase rendering blockers in the WebsiteLeadAgent product. All links now resolve the canonical `Site` for a `Lead` using real database identities. The Studio header site switcher loads real accessible sites. Showcase now renders correctly for two real demo sites with no Garant-specific fallback or logo leakage. Multi-site Studio → Showcase edit roundtrips were verified with Playwright screenshots.

| Demo site | Site id | Lead id | Preview token | Slug / domain | Template |
|---|---|---|---|---|---|
| **Гарант Качества** | `cmtdkqiu50004crwd529otns8` | `cmtdkotrm0000zkq4vfiv2p2q` | `8e25ix7c` | `garant-kachestva` / `garantk.by` | `construction-modern-v1` |
| **Test Builder Local** | `cmtecurjw00034ikcns2j61e4` | `cmtecutk4000034ikciib1dug` | `ze6f3z0v` | `test-builder-local` / `localhost:9000` | `construction-modern-v1` |

## 2. Identifiers & Inventory

Database counts at the time of verification:

- **Leads:** 3
- **Sites:** 3 (Garant Kachestva, Test Builder Local, Demo Site fixture)
- **Real generated demo Sites with linked Leads:** 2 (Garant + Test Builder)
- **Super admin:** `admin@minsk.local`

The second real generated demo is **Test Builder Local** (`cmtecurjw00034ikcns2j61e4`, `ze6f3z0v`). Its identity was confirmed by the linked `Lead` and `SiteBuild` records produced by the redesign pipeline.

## 3. Fixes Applied

### 3.1 Showcase — removed Garant-specific fallback & hardcoded logos

- `packages/templates/src/construction-modern-v1/index.ts` now injects the CMS payload with generic uppercase keys (`COMPANY`, `NAV_ITEMS`, `SERVICES`, `PROJECTS`, `PROCESS_STEPS`, `NEWS_ITEMS`) and explicitly sets `PROCESS_STEPS: []` / `NEWS_ITEMS` from real data.
- `packages/templates/src/construction-modern-v1/App.tsx`
  - Removed all hardcoded `gkLogo*.png` imports and `GKMark` variants.
  - Replaced with a generic `BrandMark` component that renders the company initial.
  - Replaced `DEFAULT_CMS` Garant data with generic placeholders.
  - Added `if (PROJECTS.length === 0) return null` guard so sites without projects do not crash.

### 3.2 Forge → Studio / Preview

- `apps/platform/src/App.tsx`
  - `openCMS(site)` uses `/studio/${site.id}`.
  - `openPreview(site)` uses `/showcase/${site.previewToken}`.
  - Table, visual grid, detail panel, and thumbnail overlay actions are now wired to the real handlers.

### 3.3 Studio site switcher

- `apps/platform/src/cms/TopBar.tsx`
  - Loads the full list of accessible sites from `/api/cms/sites`.
  - Dropdown lists real sites per the authenticated user.
  - Each entry navigates to the canonical `/studio/${site.id}` URL.

### 3.4 Site-renderer asset serving

- `apps/site-renderer/src/server.ts`
  - Fixed `REPO_ROOT` to use `process.cwd()` so `template-assets` resolve against the actual repository root. This resolved the `404` for hashed JS/CSS on non-Garant sites.

## 4. Visual Evidence

All screenshots were captured by Playwright (`scripts/screenshot-qa.ts`, `scripts/edit-roundtrip.ts`) running against `http://localhost:3000`.

| Screenshot | Evidence |
|---|---|
| `docs/screenshots/03-forge-all-real-sites.png` | Forge lists the real sites, status, content counts, and correct actions (Open CMS, Preview). |
| `docs/screenshots/06-studio-garant-site-switcher.png` | Studio header switcher lists **Demo Site**, **Test Builder Local**, and **Гарант Качества** and links to `/studio/:siteId`. |
| `docs/screenshots/07-studio-second-demo-dashboard.png` | Test Builder Local Studio dashboard opens the correct site and displays its own content. |
| `docs/screenshots/09-showcase-garant-desktop.png` | Garant Kachestva Showcase renders with the correct company name, services, projects, and news. |
| `docs/screenshots/10-showcase-second-demo-desktop.png` | Test Builder Local Showcase renders with its own identity and generic logo; no Garant content leakage. |
| `docs/screenshots/11-showcase-garant-mobile.png` | Garant mobile render is intact. |
| `docs/screenshots/12-showcase-second-demo-mobile.png` | Test Builder Local mobile render is intact. |

Roundtrip evidence (`docs/screenshots/roundtrip/`):

- `8e25ix7c-before.png` / `8e25ix7c-after-edit.png` / `8e25ix7c-after-restore.png`
- `ze6f3z0v-before.png` / `ze6f3z0v-after-edit.png` / `ze6f3z0v-after-restore.png`

The JSON result `docs/screenshots/roundtrip/roundtrip-results.json` confirms that editing `SiteSettings.companyName` for each site is immediately reflected in the Showcase title and header.

## 5. Verification Results

- **No cross-site data leakage:** Test Builder Local renders generic placeholders / its own CMS data; no Garant phone, address, services, or news appear.
- **Correct logo per site:** `BrandMark` renders the initial of the current company name; no hardcoded Garant logo is used.
- **Multi-site switcher works:** SUPER_ADMIN can switch between all accessible sites in the Studio header.
- **Forge preview/CMS actions:** all target the correct `Site` using `site.id` and `site.previewToken`.
- **Showcase static assets:** JS/CSS served correctly for both sites.
- **Console errors during capture:** only `401 /api/auth/me` on public Showcase pages (expected for unauthenticated `me` checks). No CSS/JS 404s or runtime `pageerror` events.

## 6. Remaining Gaps / Follow-up

- The **Demo Site** fixture (`demo.local`) is still present in the database. It appears in the Forge list and site switcher. This is real data in the DB, not a hardcoded mock, but could be archived if it is no longer required.
- The `Projects` bottom CTA text and some section labels in the `construction-modern-v1` template are still in Russian and generic. They are not customer-specific, but they should eventually be pulled from the CMS payload rather than the template.
- `Radar → Forge` and `Radar → Factory` links were not exhaustively re-tested in this pass; the next step should add explicit `Open in Forge` / `View run` actions to the Radar side panel.
- The `Test Builder Local` Showcase has fewer services/projects because the source site had less extractable content. No content was invented or backfilled.

## 7. How to Reproduce

```bash
# 1. Start the product stack
npx tsx scripts/dev.ts --no-infra

# 2. Capture full multi-site QA screenshots
npx tsx scripts/screenshot-qa.ts

# 3. Run edit roundtrips
npx tsx scripts/edit-roundtrip.ts
```

All captured assets are in `docs/screenshots/` and `docs/screenshots/roundtrip/`.
