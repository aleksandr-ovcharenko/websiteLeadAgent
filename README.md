# WebsiteLeadAgent (MVP)

## Product terminology

| Product area | What it is | Canonical URL | Legacy aliases |
| --- | --- | --- | --- |
| **Hub** | Product entry point for SUPER_ADMIN | `http://localhost:3000` | — |
| **Radar** | Lead qualification and Factory start | `/radar` | `/leads` |
| **Forge** | Generated sites dashboard | `/forge` | `/sites` |
| **Studio** | Site CMS editor | `/studio/:siteId` | `/cms?site=:siteId` |
| **Showcase** | Customer preview site | `/showcase/:previewToken` | `/preview/:previewToken` |
| **Factory** | Redesign pipeline (runs inside CORE) | — | — |
| **Gate** | Single-port reverse proxy | `http://localhost:3000` | — |
| **CORE** | Platform API | `http://localhost:3333` | — |
| **STUDIO** | CMS service | `http://localhost:3335` | — |
| **ENGINE** | Site renderer | `http://localhost:3336` | — |
| **POSTGRES** | Database | `localhost:5433` | — |

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

Run `npm run dev:help` (or `npm run dev -- --help`) to see all options.

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

- CORE (Platform API): `3333`
- STUDIO (CMS): `3335`
- ENGINE (Renderer): `3336`
- HUB (Platform web): `3004`
- GATE (Gateway): `3000`

## Collect leads (2GIS)

```bash
npm run leads -- --city="Минск" --query="ремонт квартир" --limit=50
```

Outputs:

- `output/leads.json`
- `output/leads.csv`
