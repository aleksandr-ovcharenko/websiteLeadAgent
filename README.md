# WebsiteLeadAgent

> A TypeScript monorepo for automated lead discovery, qualification, AI website redesign, and CMS-powered customer preview sites.

## Features overview

| # | Feature | Description |
| --- | --- | --- |
| 1 | **2GIS Lead Collection** | Scrape local businesses by city and query, then export leads to JSON/CSV. |
| 2 | **Multi-Provider Discovery** | Plug in 2GIS, Yandex, DuckDuckGo, OSM, or manual input providers. |
| 3 | **Lead Qualification (Radar)** | Website detection, Lighthouse audit, visual analysis, AI scoring, and manual review. |
| 4 | **AI Redesign Engine** | Generate a design brief, wireframes, content, and a full React showcase site. |
| 5 | **Customer CMS (Studio)** | Manage sites, pages, news, projects, services, vacancies, media, menus, and contacts. |
| 6 | **Showcase Previews** | SSR preview sites with a `previewToken`, rendered by the site-renderer. |
| 7 | **Platform Dashboard** | React app with Hub, Radar, Forge, Factory, and Studio. |
| 8 | **Dark / Light / System Theme** | Semantic CSS tokens, persisted preference, FOUC-free theme switching. |
| 9 | **Auth & RBAC** | Cookie-session auth with `SUPER_ADMIN`, `SITE_ADMIN`, and `EDITOR` roles. |
| 10 | **QA Automation** | Playwright and Vitest scripts for discovery, link crawling, edit round-trips, and visual smoke tests. |

## Product terminology

| Product area | What it is | Canonical URL | Legacy aliases |
| --- | --- | --- | --- |
| **Hub** | Product entry point for SUPER_ADMIN | `http://localhost:3000` | — |
| **Radar** | Lead qualification and Factory start | `/radar` | `/leads` |
| **Factory** | Redesign pipeline (runs inside CORE) | — | — |
| **Forge** | Generated sites dashboard | `/forge` | `/sites` |
| **Studio** | Site CMS editor | `/studio/:siteId` | `/cms?site=:siteId` |
| **Showcase** | Customer preview site | `/showcase/:previewToken` | `/preview/:previewToken` |
| **Gate** | Single-port reverse proxy | `http://localhost:3000` | — |
| **CORE** | Platform API | `http://localhost:3333` | — |
| **STUDIO** | CMS service | `http://localhost:3335` | — |
| **ENGINE** | Site renderer | `http://localhost:3336` | — |
| **POSTGRES** | Database | `localhost:5433` | — |

## Tech stack

| Layer | Technology |
| --- | --- |
| Language | TypeScript 5.6+ |
| Runtime | Node.js 22+ |
| Bundler | Vite 8 (platform), Vite (templates) |
| Styling | Tailwind CSS 4 with semantic CSS tokens |
| UI | React 19 |
| API | Express 4 |
| ORM | Prisma 5 |
| Database | PostgreSQL |
| QA | Vitest + Playwright |

## Platform UI gallery

### Hub

| Light | Dark |
| --- | --- |
| ![Hub light](apps/platform/screenshots/light-hub.png) | ![Hub dark](apps/platform/screenshots/dark-hub.png) |

### Radar

| Light | Dark |
| --- | --- |
| ![Radar light](apps/platform/screenshots/light-radar.png) | ![Radar dark](apps/platform/screenshots/dark-radar.png) |

### Forge

| Light | Dark |
| --- | --- |
| ![Forge light](apps/platform/screenshots/light-forge.png) | ![Forge dark](apps/platform/screenshots/dark-forge.png) |

### Studio

| Light | Dark |
| --- | --- |
| ![Studio light](apps/platform/screenshots/light-studio.png) | ![Studio dark](apps/platform/screenshots/dark-studio.png) |

### Theme switcher

![Theme dropdown in dark mode](apps/platform/screenshots/dark-theme-dropdown.png)

## Lead lifecycle

```mermaid
graph LR
    A[2GIS / Provider] -->|collect| B[apps/collector]
    B -->|save| C[(PostgreSQL)]
    C -->|pick lead| D[apps/dashboard CORE]
    D -->|audit + score| E[apps/auditor]
    E -->|qualified lead| F[Factory / Redesign]
    F -->|generate| G[Site in Forge]
    G -->|preview| H[Showcase]
```

## Architecture overview

```mermaid
graph LR
    Browser -->|http://localhost:3000| GATE[apps/gateway]
    GATE -->|/api/*| CMS[apps/cms]
    GATE -->|/showcase/*<br/>/template-assets/*<br/>/site-media/*| ENGINE[apps/site-renderer]
    GATE -->|/| PLATFORM[apps/platform]
    CMS -->|Prisma| POSTGRES[(PostgreSQL)]
    ENGINE -->|Prisma| POSTGRES
    PLATFORM -->|fetch /api| CMS
    COLLECTOR[apps/collector] -->|2GIS API| LEADS[(raw leads)]
    COLLECTOR -->|save| POSTGRES
    AUDITOR[apps/auditor] -->|analyze| LEADS
    REDESIGN[apps/redesign] -->|pipeline| REDESIGN_ENGINE[packages/redesign-engine]
    REDESIGN_ENGINE -->|media/uploads| S3
    TEMPLATES[packages/templates] -->|build| ENGINE
```

## Theme resolution flow

```mermaid
graph LR
    A[User selects theme] --> B[ThemeToggle]
    B --> C[ThemeProvider]
    C --> D[localStorage wla-theme]
    C --> E[data-theme attribute]
    E --> F[CSS custom properties]
    F --> G[Light / Dark UI]
```

## Monorepo layout

```
websiteLeadAgent/
├── apps/                 # runnable services
│   ├── auditor/          # lead scoring, lighthouse, visual audit
│   ├── cms/              # headless CMS API (Express + Prisma)
│   ├── collector/        # 2GIS lead scraper CLI
│   ├── dashboard/        # minimal admin status server
│   ├── gateway/          # reverse proxy for local dev
│   ├── platform/         # React platform UI (Radar, Forge, Studio)
│   ├── redesign/         # redesign pipeline CLI
│   └── site-renderer/    # SSR site renderer for Showcase previews
├── packages/             # shared libraries
│   ├── content-schema/   # CMS content type definitions
│   ├── design-brief/     # design brief generation
│   ├── media-storage/    # S3 / local media helpers
│   ├── redesign-engine/  # AI redesign pipeline
│   ├── screenshot/       # screenshot capture helpers
│   └── templates/        # React-based site themes
│       └── src/construction-modern-v1/
│           ├── index.ts  # SSR entry: loads __CMS__ and serves HTML
│           ├── main.tsx  # client entry: hydrate React
│           ├── App.tsx   # page components and router
│           └── index.css # Tailwind base styles
├── prisma/               # Prisma schema and migrations
│   ├── schema.prisma     # source of truth for Site, Page, NewsPost, etc.
│   └── migrations/
├── scripts/              # development and QA automation
├── docs/                 # reports and screenshots
├── tests/                # Vitest specs
├── output/               # CLI output (leads.json, generated HTML)
└── docker-compose.yml    # PostgreSQL only
```

## Applications

| App | Runtime | Responsibility |
| --- | --- | --- |
| `apps/gateway` | Express | Single-port reverse proxy. Routes `/api/*`, `/showcase/*`, `/template-assets/*`, `/site-media/*` and the SPA to the right backend. |
| `apps/cms` | Express | Headless CMS API. Auth, CRUD for `Site`, `Page`, `NewsPost`, `Project`, `Service`, `Vacancy`, `MenuItem`, `Media`, `User`. |
| `apps/platform` | Vite/React | Customer-facing platform: `Login`, `Radar` (leads, providers, presets, history), `Forge`, `Studio`. |
| `apps/site-renderer` | Express | Fetches a site, CMS entities and the correct template, then renders `window.__CMS__` into `packages/templates/.../index.html`. |
| `apps/collector` | Node CLI | Scrapes 2GIS for leads. Outputs `output/leads.json` and `output/leads.csv`. |
| `apps/auditor` | Node CLI | Audits/scores sites and leads (`lighthouse`, `score`, `visual-analyze`). |
| `apps/redesign` | Node CLI | CLI wrapper around `packages/redesign-engine`. |
| `apps/dashboard` | Express | Platform API / CORE. Auth, discovery provider/preset management, discovery runs, webhooks and platform health. |

## Packages

| Package | Responsibility |
| --- | --- |
| `packages/templates` | Vite-built React themes. `construction-modern-v1` is the current template. `index.ts` is the SSR entry; `App.tsx` is the client router. |
| `packages/redesign-engine` | AI-driven redesign pipeline that generates a `Design` and can backfill CMS content. |
| `packages/content-schema` | Zod/JSON schemas for CMS entities. |
| `packages/design-brief` | Brief generation from lead/site context. |
| `packages/media-storage` | S3-compatible upload/presign helpers. |
| `packages/screenshot` | Playwright screenshot capture utilities used by QA scripts. |

## Database & content model

- **DB**: PostgreSQL (`localhost:5433` default).
- **ORM**: Prisma (`prisma/schema.prisma`).
- **Key models**:
  - `Site` — the generated customer site.
  - `SiteSettings` — company data, contacts, domain.
  - `Page` — generic CMS pages (`about`, `contacts`, `objects`, `services`, `news`, `vacancies`, `index`).
  - `NewsPost`, `Project`, `Service`, `Vacancy` — structured collections.
  - `Media` — uploaded images.
  - `MenuItem` — navigation tree (label, url, pageId, sortOrder, visible).
  - `Lead`, `SiteUser`, `User` — auth and lead management.
  - `DiscoveryProviderConfig`, `DiscoveryPreset`, `DiscoveryRun`, `DiscoverySetting` — discovery sources, presets, runs and defaults.

## Example request flow — opening `/showcase/8e25ix7c/about`

1. Browser → `apps/gateway` on `3000`.
2. `gateway` recognizes `/showcase/*` and proxies to `apps/site-renderer` on `3336`.
3. `site-renderer` finds the site by `previewToken`, extracts `route = about` and `subRoute = undefined`.
4. Prisma loads the published `Page` with `slug = about` plus all other CMS entities.
5. `packages/templates/.../index.ts` builds `__CMS__` and sets `route: 'about'`.
6. `App.tsx` renders `PageView` because `route` is not a known collection and `PAGES` contains the `about` page.

## Requirements

- Node.js 22+
- Docker + Docker Compose

## Setup

1. Install dependencies

```bash
npm install
```

2. Create `.env`

```bash
cp .env.example .env
```

Set:

- `DGIS_API_KEY`
- `DATABASE_URL`

3. Start PostgreSQL

```bash
docker compose up -d
```

4. Migrate database

```bash
npm run db:migrate
```

## Local development

### Quick start (full product)

No flags are required — `npm run dev` starts the entire product on `http://localhost:3000`:

```bash
npm install
cp .env.example .env   # fill DGIS_API_KEY etc. as needed
npm run dev
```

Then open:

- `http://localhost:3000/radar` — Radar (lead qualification)
- `http://localhost:3000/forge` — Forge (generated sites)
- `http://localhost:3000/studio/<siteId>` — Studio (CMS)
- `http://localhost:3000/showcase/<previewToken>` — Showcase (customer preview)

### Available flags

| Command | What it starts |
| --- | --- |
| `npm run dev` | Everything: PostgreSQL (if not running), CORE, STUDIO, ENGINE, HUB, and GATE on `http://localhost:3000` |
| `npm run dev -- --only=platform` | Platform API, Platform Web, and Gateway |
| `npm run dev -- --only=cms` | CMS, auth, and Gateway |
| `npm run dev -- --only=renderer` | Renderer and Gateway |
| `npm run dev -- --skip=cms` | Full product except the CMS |
| `npm run dev -- --no-infra` | Use this when PostgreSQL is already running (e.g. after `npm run infra:up`) |

### Infrastructure commands

```bash
npm run infra:up    # start PostgreSQL only
npm run infra:down  # stop PostgreSQL
npm run infra:reset # wipe local data and recreate
```

### Internal ports

| Service | Port |
| --- | --- |
| CORE (Platform API) | `3333` |
| STUDIO (CMS) | `3335` |
| ENGINE (Renderer) | `3336` |
| HUB (Platform web) | `3004` |
| GATE (Gateway) | `3000` |

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run leads` | Collect leads from 2GIS |
| `npm run audit` | Audit a lead/site |
| `npm run lighthouse` | Run a Lighthouse report |
| `npm run score` | Score a lead |
| `npm run visual-analyze` | Run visual analysis |
| `npm run redesign` | Run the redesign pipeline |
| `npm run test` | Run all Vitest suites |

## QA & automation

| Script | Purpose |
| --- | --- |
| `scripts/link-crawler.ts` | Crawls 7 public Showcase routes and classifies every `<a>` (`VALID_INTERNAL`, `EXTERNAL`, `PLACEHOLDER`, `BROKEN`, …). |
| `scripts/news-qa.ts` | Studio → Showcase round-trip for News. |
| `scripts/project-service-qa.ts` | Round-trip for Projects and Services. |
| `scripts/edit-roundtrip.ts` | Basic multi-site edit verification. |
| `scripts/screenshot-qa.ts` | Captures visual smoke tests. |
| `scripts/discovery-qa.ts` | End-to-end test for New Discovery, presets and discovery history. |
| `scripts/providers-qa.ts` | Verifies provider cards, configuration, test flow, presets CRUD and unconfigured CTA. |
| `scripts/capture-theme-screenshots.mjs` | Playwright screenshots of the platform in light, dark, and system themes. |
| `apps/platform/src/theme/theme.test.ts` | Unit tests for theme resolution utilities. |

## Discovery & provider configuration flow

```mermaid
graph LR
    A[Radar UI] -->|/radar/providers| B[CORE]
    B --> C[DiscoveryService]
    C --> D[Prisma: ProviderConfig]
    C --> E[BusinessDiscoveryProvider]
    E --> F[2GIS / Yandex / DDG / OSM]
```

Discovery is driven by **BusinessDiscoveryProvider** implementations registered in `apps/dashboard/src/discovery/registry.ts`. Each provider exposes `meta` (capabilities, credentials), `isConfigured(env)` and `search(request, context)`.

- **Status & configuration**: `DiscoveryService.listProviders()` computes `READY`, `NOT_CONFIGURED`, `DISABLED`, `ERROR` or `UNAVAILABLE` by checking the persisted `DiscoveryProviderConfig`, the provider's `isConfigured(env)` result and recent test results.
- **Testing**: `POST /api/discovery/providers/:id/test` runs a safe search on the server, records `lastTestStatus`/`lastTestMessage` and never returns secrets to the browser.
- **Presets**: `DiscoveryPreset` rows replace hard-coded topic presets; the UI at `/radar/presets` supports create, edit, delete, enable/disable and default provider/location/limit.
- **New Discovery**: `/radar/providers` and the `NewDiscovery` modal pre-select the chosen provider. If it is not configured, the UI shows a **Configure provider** CTA.

## Qualification pipeline

| Stage | Source | Possible statuses |
| --- | --- | --- |
| Website detection | `websiteStatus` | `FOUND`, `NOT_FOUND`, `FAILED` |
| Audit | `auditStatus` | `SUCCESS`, `PENDING`, `FAILED` |
| Screenshots | Derived from audit | `SUCCESS`, `PENDING`, `WAITING`, `FAILED` |
| Lighthouse | `lighthouseReport` | `SUCCESS`, `PENDING`, `WAITING` |
| AI analysis | `visualAnalysis.status` | `SUCCESS`, `PENDING`, `FAILED` |
| Scoring | `scoreStatus` | `SUCCESS`, `PENDING`, `FAILED` |
| Manual review | `manualReviewStatus` | `UNREVIEWED`, `APPROVED`, `REJECTED` |

## Security notes

- Provider credentials are stored only in `process.env` on CORE.
- The `DiscoveryProviderConfig` model persists `enabled`, `defaults` and test metadata, but never the secret itself.
- Auth and super-admin checks on `/api/discovery/*` live in `apps/dashboard/src/server.ts` middleware.

## Collect leads (2GIS)

```bash
npm run leads -- --city="Минск" --query="ремонт квартир" --limit=50
```

Outputs:

- `output/leads.json`
- `output/leads.csv`
