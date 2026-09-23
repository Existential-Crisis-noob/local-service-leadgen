# Local-Service Lead-Gen SaaS — MVP Build Plan

## Context

The user wants a multi-user SaaS app that finds local-service businesses (roofing, masonry, paving, HVAC, etc.), evaluates their online presence, drafts personalized outreach emails, sends them through the user's own mailbox after human approval, tracks follow-ups, and routes replies to a human review dashboard. This is a brand-new, unrelated product — it does not belong in the `momonp-site-claude` repo (a static Astro marketing site for a restaurant). It will be built as its own project at `/Users/aashishranabhat/Desktop/Work/local-service-leadgen`, with its own git repo.

Confirmed decisions:
- **Stack**: Next.js 15 (App Router) + TypeScript, single codebase for UI, API routes, and worker.
- **Database**: Postgres (via Prisma).
- **Job queue**: `pg-boss` (runs entirely on Postgres — no Redis needed for MVP).
- **Auth**: NextAuth (Auth.js) with email/password (credentials) + "Sign in with Google". The same Google OAuth app is reused later for Gmail mailbox connection (separate consent/scope).
- **Scope**: exactly the "FIRST MVP" list from the brief — no Facebook/Reddit/Kijiji/Google Maps scraping, no Outlook/SMTP yet, one follow-up max.

The plan below is staged into phases so the user can review/steer after each one rather than getting one giant drop of code.

## Source-rule design (important constraint)

No generic URL scraper. A `classifyUrl(url)` utility (`src/lib/sources/classify.ts`) is the single gate every pasted/imported URL passes through before any fetch:
- Matches a maintained **rejected-domain list** (facebook.com, instagram.com, reddit.com, kijiji.ca, craigslist.org, google.com/maps, yelp.com, angi.com, thumbtack.com, linkedin.com, etc.) → rejected with a specific reason ("Yelp is a licensed-API source; connect the Yelp connector when available — direct scraping isn't supported").
- Matches a known login-wall pattern (path contains `/login`, `/signin`, known auth domains) → rejected, "login-protected page — never scraped."
- Otherwise treated as a **candidate business website** → allowed through the website-inspection pipeline only (never treated as a directory to enumerate listings from).
- Directory/API connectors (OSM, gov/contractor directories) are separate typed connectors, not URL-classification results — a pasted directory URL does not auto-invoke them.

This same function backs CSV/URL import validation and any future connector's URL handling.

## Data model (Prisma schema, `prisma/schema.prisma`)

- `User`, `Workspace`, `WorkspaceMember` (role: owner/member)
- `Campaign` (workspace, industry keywords[], city/state/postal, radius, source connector type + config, desired prospect count, website-quality filters, email template ref, max email length, follow-up delay, max follow-ups, status)
- `SourceConnectorRun` (campaign, connector type, started/finished, raw params, result counts)
- `Business` (workspace, name, address, lat/lon, phone, category, source connector, source URL, collected-at, dedup key)
- `Website` (business, url, discovered-via)
- `WebsiteAssessment` (website, loads boolean, https boolean, mobile-responsive heuristic, has-contact-info, has-quote-button, broken-pages[], copyright-year, weak-service-info, raw evidence JSON, computed at)
- `ProspectScore` (business, category enum: no_website / broken / poor_outdated / weak_marketing / good / no_public_email, numeric score, reasons[] — text list tied to assessment evidence)
- `BusinessContact` (business, email, source page URL, found-at) — only emails found on the business's own public pages
- `EmailTemplate` (workspace, industry, subject/body template, max length)
- `DraftEmail` (business, campaign, template used, rendered subject/body, observed-issue references, status: pending/approved/rejected/edited)
- `MailboxConnection` (user, provider=gmail, encrypted refresh token, encrypted access token, daily limit, connected-at, disconnected-at)
- `SentMessage` (draft, mailbox connection, gmail thread id/message id, sent-at)
- `FollowupSchedule` (sent message, scheduled-at, sent boolean, canceled boolean, reason)
- `Reply` (sent message/thread, received-at, raw snippet, status: needs_review/handled)
- `Unsubscribe` (business contact/email, requested-at) — permanent suppression, checked before every send
- `ActivityLog` (workspace, actor, action, entity, metadata, at)

Store on every `Business`/`ProspectScore`: source URL, collection date, and the specific reasons behind qualification — satisfies the audit requirement directly in the schema rather than needing a separate lookup.

## Connectors (`src/lib/sources/*`)

1. **OpenStreetMap connector** — Nominatim to geocode city/state/postal → lat/lon; Overpass API query for tagged businesses (`shop`, `craft=roofer`, `craft=hvac`, etc.) within the radius. No API key required; respects Overpass usage policy (single request per campaign run, backoff on 429).
2. **CSV import connector** — user uploads CSV, column-mapping UI, rows validated (any URL columns go through `classifyUrl`).
3. **Business-URL import connector** — user pastes one or more URLs; each runs through `classifyUrl`; only accepted business-site URLs become `Business` + `Website` rows directly (skips discovery, goes straight to inspection).
4. **Government/contractor-directory connector** — stubbed interface + one real implementation if a directory with an open data feed is confirmed available (e.g., a provincial contractor license open-data CSV/API); otherwise ships as "coming soon" in the UI so the connector contract exists without a fabricated data source.
5. Yelp/Apple Maps/etc. — connector interface documented, not implemented in MVP (explicitly deferred by the brief).

All connectors implement one `SourceConnector` interface (`discover(params): Promise<CandidateBusiness[]>`) so campaign discovery code doesn't care which one ran.

## Website inspection (`src/lib/inspection/*`)

Fetch homepage (+ a couple of internal links found on it) with a short timeout and a descriptive User-Agent; parse with `cheerio`. Heuristics, each recorded with its evidence:
- Loads / HTTP status, HTTPS, response time
- Mobile responsiveness proxy: viewport meta tag + no fixed-width layout hints (documented as a heuristic, not a real rendered check — no headless browser in MVP)
- Contact info: phone/email/contact-page link detected
- Quote/request-service button: keyword+CTA heuristic ("get a quote", "request service", "free estimate", etc.)
- Broken pages: internal links returning 4xx/5xx
- Copyright year: regex for `© <year>`, flagged if stale
- Weak service info: word count / keyword coverage heuristic for the industry

## Scoring (`src/lib/scoring/score.ts`)

Pure function `scoreBusiness(assessment) -> { category, score, reasons }` implementing the brief's categories (no website / broken / poor-outdated / weak-marketing / good / no-public-email), each reason traceable to a specific assessment field. Unit-testable in isolation.

## Email drafting (`src/lib/email/*`)

- `EmailGenerator` interface with a `TemplateGenerator` default implementation (per-industry template + slot-fill from *only* observed evidence — never invents facts). This is the fully working MVP path, no AI dependency.
- An `AiProvider` interface is defined for future use (so the system stays "interchangeable" per the brief) but MVP does not wire a live paid call — this avoids assuming any ChatGPT/Claude subscription implies API access, matching the brief's explicit warning.
- Max length enforcement, unsubscribe footer, and sender identity are applied by a shared renderer, not per-template.

## Gmail integration (`src/lib/mailbox/gmail.ts`)

- OAuth connect flow (separate scope/consent from app login) storing only encrypted refresh+access tokens (AES-256-GCM, key from env secret) — never a password.
- Send via Gmail API; daily-limit counter per mailbox; disconnect flow revokes + deletes tokens.
- Reply polling job (pg-boss recurring): checks each open thread for a new inbound message; on reply, cancels pending `FollowupSchedule` rows and creates a `Reply` row. Bounce detection is heuristic (mailer-daemon sender / bounce headers) and treated as suppression-worthy, documented as best-effort for MVP.
- Follow-up send job: after the configured delay, if no reply/bounce/unsubscribe, sends the (single, MVP-capped) follow-up and updates the schedule.

## Dashboards (`src/app/(dashboard)/*`)

One route per: Campaigns, All Prospects, Qualified Prospects (with expandable evidence per score reason), Drafts Awaiting Approval (approve/edit/reject), Sent & Follow-ups, Replies Requiring Review (edit-and-send-manually only, never auto-send a reply), Unsubscribed/Suppressed, Source & Campaign Performance (aggregate counts by connector/campaign).

## Build phases (sequential, reviewable checkpoints)

1. Scaffold: Next.js/TS app, Prisma+Postgres, docker-compose for local Postgres, pg-boss wiring, base layout/nav, README.
2. Auth: NextAuth credentials + Google, Workspace/WorkspaceMember creation on signup.
3. Campaign creation UI + Campaigns dashboard (CRUD, all the config fields from the brief).
4. Source connectors: `classifyUrl`, OSM connector, CSV import, business-URL import.
5. Discovery job + dedup logic + Businesses table + All Prospects dashboard.
6. Website inspection job + scoring engine + Qualified Prospects dashboard with evidence view.
7. Public-email discovery from already-fetched pages + BusinessContact.
8. Template email generator (roofing/masonry/paving/HVAC templates) + Drafts dashboard with approve/edit.
9. Gmail OAuth connect + send flow with daily limits + Sent & Follow-ups dashboard.
10. Follow-up scheduler + reply polling job + Replies dashboard + thread-cancel logic.
11. Unsubscribe link/page + suppression enforcement on every send path + Unsubscribed dashboard.
12. Source/Campaign performance dashboard + ActivityLog wiring + seed script + basic tests (classifier, scoring, template renderer) + polish pass.

Each phase ends in a working, demoable slice; I'll pause for feedback at natural checkpoints (after phase 3, after phase 6, after phase 9) rather than only at the very end.

## Verification

- Unit tests (Vitest) for `classifyUrl`, `scoreBusiness`, and template rendering (length limits, no-invented-facts guard).
- Manual end-to-end pass after phase 9: create a campaign for "roofing within 30km of Calgary" using the OSM connector, confirm deduped/scored prospects appear with visible evidence, approve a draft, send via a connected test Gmail account, confirm it lands in Sent & Follow-ups.
- `npm run build` / `npx tsc --noEmit` kept green after each phase.
