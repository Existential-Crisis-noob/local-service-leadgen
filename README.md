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
- A provider-neutral draft-generation boundary with a rule-based default (no paid AI required)

## Local setup

1. Copy `.env.example` to `.env` and fill in the values (generate
   `AUTH_SECRET` with `npx auth secret`; generate `TOKEN_ENCRYPTION_KEY` with
   `openssl rand -base64 32`).
2. Start Postgres: `npm run db:up`
3. Apply the schema: `npm run db:migrate`
4. Create an account in the app. To provision a local administrator from the
   command line instead, set `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, and
   `SEED_ADMIN_PASSWORD`, then run `npm run db:seed`. The seed never creates
   campaigns, businesses, contacts, or fabricated prospect data.
5. Start the app: `npm run dev`
6. In a second terminal, start the background worker: `npm run worker`

### Google OAuth (app login + Gmail sending)

One Google Cloud OAuth client covers both flows — register **both**
redirect URIs on it:

- `{AUTH_URL}/api/auth/callback/google` — app login (NextAuth)
- `{AUTH_URL}/api/mailbox/google/callback` — connecting a Gmail mailbox to
  send from (a separate consent screen, `gmail.send` scope only)

Without `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` set, "Sign in with
Google" and "Connect Gmail" are both hidden — email/password login and
CSV/URL-import campaigns still work.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run worker` | Background job worker (pg-boss) |
| `npm run db:up` / `db:down` | Local Postgres via docker-compose |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:studio` | Prisma Studio (browse the DB) |
| `npm run db:seed` | Optionally provision a real local administrator from environment values |
| `npm run test` | Unit tests (Vitest) |
| `npm run build` | Production build |

## Project layout

```
prisma/schema.prisma       Data model (see docs/BUILD-PLAN.md for the full list)
src/app/(dashboard)/*      The 8 dashboards (Campaigns, All Prospects, ...)
src/lib/sources/*          Source connectors (OSM, CSV and URL import)
src/lib/inspection/*        Website inspection heuristics
src/lib/scoring/*          Prospect scoring
src/lib/email/*            Template-based email drafting (+ pluggable AI interface)
src/lib/ai/*               Interchangeable draft-generation provider boundary
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

The automated discovery connectors currently exposed in campaign setup are:

- OpenStreetMap through public Overpass endpoints with mirror fallback and exact-radius filtering
- User CSV import
- User-supplied business-owned website URLs

Government/contractor-directory is planned but not yet implemented — every
directory we've evaluated for it either lacks contact info entirely or
explicitly prohibits automated collection in its own terms, so it stays a
"coming soon" option in campaign setup rather than a real connector until one
that actually permits this is found. Google Maps, Facebook, Reddit, Kijiji,
Yelp pages, and other unsupported marketplace/social/map-result pages are not
scraped. An email becomes sendable contact evidence only when it's published
on the business-owned public website (or explicitly provided by the user in a
CSV import) — never guessed, and never taken from a third-party directory
listing.
