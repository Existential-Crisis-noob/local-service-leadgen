import type { CheerioAPI } from "cheerio";
import { getVisibleText } from "./heuristics";

export interface FoundEmail {
  email: string;
  sourcePageUrl: string;
}

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Placeholder/tracking addresses that commonly show up in page source but
// aren't a real published business email.
const EXCLUDED_DOMAINS = [
  "example.com",
  "example.org",
  "sentry.io",
  "wixpress.com",
  "godaddy.com",
  "yourdomain.com",
  "domain.com",
  "wordpress.com",
  "gravatar.com",
];

// Guards against the email regex matching an image/asset filename like
// "logo@2x.png" as user@2x.png.
const NON_EMAIL_TLDS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "css", "js"]);

function isPlausibleEmail(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  if (EXCLUDED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return false;
  const tld = domain.split(".").pop() ?? "";
  return !NON_EMAIL_TLDS.has(tld);
}

/**
 * Finds published business emails on a single already-fetched page — a
 * mailto: link, or an email-shaped string in the visible text. Never
 * guesses or fabricates an address; only reports what's actually on the
 * page.
 */
export function extractEmailsFromPage($: CheerioAPI, pageUrl: string): FoundEmail[] {
  const found = new Set<string>();

  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const email = href.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase();
    if (email) found.add(email);
  });

  const bodyText = getVisibleText($);
  for (const match of bodyText.match(EMAIL_PATTERN) ?? []) {
    found.add(match.toLowerCase());
  }

  return Array.from(found)
    .filter(isPlausibleEmail)
    .map((email) => ({ email, sourcePageUrl: pageUrl }));
}
