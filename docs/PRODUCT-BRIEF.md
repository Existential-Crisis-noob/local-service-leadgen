# Product brief

Original request, kept verbatim for reference.

## Product objective

Build a multi-user SaaS application for discovering, qualifying and
contacting local-service businesses. Users enter:

- Industry keywords: roofing, masonry, paving, HVAC
- City, state/province or postal code
- Search radius
- Approved lead source
- Desired number of prospects
- Website-quality filters
- Email template and maximum length
- Follow-up delay and maximum follow-ups

The application discovers prospective businesses, evaluates their online
presence, saves qualified leads, prepares personalized emails, sends approved
emails and separates replies for human review.

## Source rules

Do not build an unrestricted scraper that accepts any platform URL. Create
individual source connectors with permission rules:

1. OpenStreetMap/open-business-data connector
2. Government and contractor-directory connector
3. User CSV import
4. User-supplied business website URLs
5. Official Yelp, Apple Maps or other licensed API connectors added later

A pasted URL must be classified before processing:

- Business-owned public website: allowed to inspect
- Approved directory/API: use its connector
- Unsupported marketplace, social network or map-result page: reject it with an explanation
- Login-protected or private page: never scrape

## Core workflow

1. User creates a campaign.
2. User selects industry, location, radius and source.
3. System collects candidate businesses.
4. System removes duplicates.
5. System finds the company's official website when available.
6. System checks: website exists/loads, mobile responsiveness, HTTPS, clear
   contact information, quote/request-service button, obvious broken pages,
   outdated copyright year, missing or weak service information.
7. System assigns a prospect score and records the reasons.
8. System searches only public business pages for a published business email.
9. System creates an email draft using the business type and observed website issue.
10. User reviews and approves the email.
11. System sends through the connected mailbox.
12. If no reply is received after the configured delay, system prepares or sends an approved follow-up.
13. If a reply arrives, cancel all future follow-ups and place the conversation in the Replies dashboard.
14. User reviews the reply, edits the suggested response and sends it manually.
15. Unsubscribe requests are processed immediately and permanently suppressed.

## Lead categories

- No website: strong sales prospect, but may require phone/manual contact if no public email exists
- Broken website: high-priority prospect
- Poor or outdated website: high-priority prospect
- Good website but weak marketing materials: flyer-kit prospect
- Good website and marketing: low-priority prospect
- No public business email: do not guess or automatically send

## Dashboards

1. Campaigns
2. All Prospects
3. Qualified Prospects
4. Drafts Awaiting Approval
5. Sent and Follow-ups
6. Replies Requiring Review
7. Unsubscribed/Suppressed
8. Source and campaign performance

## Database

Records for: Users and workspaces, Campaigns, Source connectors, Businesses,
Websites and website assessments, Public business contacts, Draft emails,
Sent messages, Follow-up schedules, Replies, Unsubscribes and suppressions,
Activity/audit logs.

Store the source URL, collection date and reason every prospect was qualified.

## Email connection

First version: Gmail through OAuth, Microsoft/Outlook through OAuth. Add
generic SMTP/IMAP later. Never store mailbox passwords. Encrypt access
tokens. Users must be able to disconnect their mailbox.

## Email rules

- Use business-specific templates for roofing, masonry, paving and HVAC.
- Mention only information actually found on the business website.
- Never invent facts, names or website problems.
- Include sender identity and unsubscribe instructions.
- Set daily sending limits per mailbox.
- Stop sending immediately after a reply, bounce or unsubscribe.
- Keep interested replies under human control.

## AI design

Keep AI interchangeable through one provider interface. The system must also
work without paid AI by using templates and rule-based personalization.
Later it can support: a local AI model, a user-provided API key, AI usage
included in a paid SaaS plan. Do not assume a ChatGPT subscription provides
application API access.

## First MVP

Build only: user accounts, campaign creation, OpenStreetMap/open-data
discovery, CSV and business-URL import, website inspection, prospect
scoring, lead database, email draft generation, human approval, Gmail
connection, one follow-up, reply dashboard, unsubscribe suppression.

Do not build Facebook, Reddit, Kijiji or Google Maps scraping.

## Success criteria

A user can enter "roofing businesses within 30 km of Calgary," receive a
deduplicated and scored prospect list, review the evidence behind every
score, approve personalized emails and see all replies in a separate
dashboard.
