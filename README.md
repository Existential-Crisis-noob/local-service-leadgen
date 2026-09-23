# Local-Service Lead-Gen

A multi-user SaaS app for discovering, qualifying and contacting local-service
businesses (roofing, masonry, paving, HVAC, ...). See
[`docs/PRODUCT-BRIEF.md`](docs/PRODUCT-BRIEF.md) for the full product spec and
[`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md) for the phased implementation plan
this repo is following.

## Stack

- Next.js 16 (App Router) + TypeScript, single codebase for UI, API routes and worker
- Postgres via Prisma
- `pg-boss` for background jobs (discovery, website inspection, sending,
  follow-ups, reply polling) — runs entirely on Postgres, no Redis
- NextAuth (Auth.js) for app login (email/password + Google)
- Gmail API (separate OAuth scope from app login) for sending mail

## Local setup

1. Copy `.env.example` to `.env` and fill in the values (generate
   `AUTH_SECRET` with `npx auth secret`; generate `TOKEN_ENCRYPTION_KEY` with
   `openssl rand -base64 32`).
2. Start Postgres: `npm run db:up`
3. Apply the schema: `npm run db:migrate`
4. Start the app: `npm run dev`
5. In a second terminal, start the background worker: `npm run worker`

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run worker` | Background job worker (pg-boss) |
| `npm run db:up` / `db:down` | Local Postgres via docker-compose |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:studio` | Prisma Studio (browse the DB) |
| `npm run test` | Unit tests (Vitest) |
| `npm run build` | Production build |

## Project layout

```
prisma/schema.prisma       Data model (see docs/BUILD-PLAN.md for the full list)
src/app/(dashboard)/*      The 8 dashboards (Campaigns, All Prospects, ...)
src/lib/sources/*          Source connectors (OSM, CSV import, URL import, ...)
src/lib/inspection/*        Website inspection heuristics
src/lib/scoring/*          Prospect scoring
src/lib/email/*            Template-based email drafting (+ pluggable AI interface)
src/lib/mailbox/*          Gmail OAuth connect + send + reply polling
src/lib/queue/*            pg-boss setup and queue names
src/worker/index.ts        Background worker process entrypoint
```

## Source rules

Every pasted/imported URL is classified before anything is fetched
(`src/lib/sources/classify.ts`):

- **Business-owned public website** → allowed, goes through website inspection
- **Approved directory/API** → must use its own connector, not URL scraping
- **Unsupported marketplace/social network/map result** → rejected with an explanation
- **Login-protected or private page** → never scraped

This repo intentionally does not build a generic scraper that accepts
arbitrary platform URLs.
