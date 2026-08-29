# Minsk Website Lead Agent (MVP)

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

- `http://localhost:3000/leads` — Leads
- `http://localhost:3000/sites` — Generated Sites
- `http://localhost:3000/cms?site=<siteId>` — CMS

### Available flags

Run `npm run dev:help` (or `npm run dev -- --help`) to see all options.

| Command | What it starts |
| --- | --- |
| `npm run dev` | Everything: PostgreSQL (if not running), Platform API, CMS, Renderer, Platform Web, and the Gateway on `http://localhost:3000` |
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

- Platform API: `3333`
- CMS: `3335`
- Renderer: `3336`
- Platform web: `3004`
- Gateway: `3000`

## Collect leads (2GIS)

```bash
npm run leads -- --city="Минск" --query="ремонт квартир" --limit=50
```

Outputs:

- `output/leads.json`
- `output/leads.csv`
