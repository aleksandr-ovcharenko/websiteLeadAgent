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

One command starts the whole product on `http://localhost:3000`:

```bash
npm install
cp .env.example .env   # fill DGIS_API_KEY etc. as needed
npm run dev
```

Then open:

- `http://localhost:3000/leads` — Leads
- `http://localhost:3000/sites` — Generated Sites
- `http://localhost:3000/cms?site=<siteId>` — CMS

Internal ports:

- Platform API: `3333`
- CMS: `3335`
- Renderer: `3336`
- Platform web: `3004`
- Gateway: `3000`

Other commands:

```bash
npm run dev -- --only=platform
npm run dev -- --only=cms
npm run dev -- --only=renderer
npm run dev -- --skip=cms
npm run infra:up
npm run infra:down
npm run infra:reset   # wipes local data
```

## Collect leads (2GIS)

```bash
npm run leads -- --city="Минск" --query="ремонт квартир" --limit=50
```

Outputs:

- `output/leads.json`
- `output/leads.csv`
