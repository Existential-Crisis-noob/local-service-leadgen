import { load, type CheerioAPI } from "cheerio";
import {
  extractCopyrightYear,
  extractInternalLinks,
  hasContactInfo,
  hasQuoteButton,
  hasViewportMeta,
  isWeakServiceInfo,
} from "./heuristics";
import { extractEmailsFromPage, type FoundEmail } from "./extractEmails";
import { runPageSpeedAudit, type PageSpeedResult } from "./pagespeed";
import { fetchPublicWebsite } from "./publicFetch";

const USER_AGENT = "local-service-leadgen/0.1 (website quality check)";
const FETCH_TIMEOUT_MS = 8000;
const MAX_INTERNAL_LINKS_CHECKED = 5;

export type JsonEvidenceValue = string | number | boolean | null | string[];

export interface WebsiteAssessmentResult {
  siteName: string | null;
  loads: boolean;
  httpStatus: number | null;
  https: boolean;
  mobileResponsive: boolean | null;
  hasContactInfo: boolean;
  hasQuoteButton: boolean;
  brokenInternalUrls: string[];
  copyrightYear: number | null;
  weakServiceInfo: boolean;
  evidence: Record<string, JsonEvidenceValue>;
  /** Published emails found on the homepage or an obvious contact page —
   * never guessed, only what's actually published on the business's own
   * site. */
  foundEmails: FoundEmail[];
  /** Real Lighthouse scores via PageSpeed Insights — null when
   * PAGESPEED_API_KEY isn't configured, or the audit failed/timed out. */
  lighthouse: PageSpeedResult | null;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetchPublicWebsite(
    url,
    { ...init, headers: { "User-Agent": USER_AGENT, ...init?.headers } },
    FETCH_TIMEOUT_MS
  );
}

function mergeUniqueByEmail(lists: FoundEmail[][]): FoundEmail[] {
  const map = new Map<string, FoundEmail>();
  for (const list of lists) {
    for (const found of list) {
      if (!map.has(found.email)) map.set(found.email, found);
    }
  }
  return Array.from(map.values());
}

/**
 * Fetches a business's homepage and runs the brief's website-quality checks
 * against it (loads, HTTPS, mobile-responsive proxy, contact info, quote
 * CTA, broken internal pages, copyright year, thin service content), plus
 * scanning the homepage (and an obvious contact page, if linked) for a
 * published email address. Heuristic, not a rendered check — no headless
 * browser in the MVP.
 */
export async function assessWebsite(url: string): Promise<WebsiteAssessmentResult> {
  let response: Response;
  try {
    response = await fetchWithTimeout(url);
  } catch (error) {
    return {
      siteName: null,
      loads: false,
      httpStatus: null,
      https: url.startsWith("https://"),
      mobileResponsive: null,
      hasContactInfo: false,
      hasQuoteButton: false,
      brokenInternalUrls: [],
      copyrightYear: null,
      weakServiceInfo: true,
      evidence: { fetchError: error instanceof Error ? error.message : "Unknown fetch error" },
      foundEmails: [],
      lighthouse: null,
    };
  }

  const html = await response.text();
  const $ = load(html);
  const finalUrl = response.url || url;

  const internalLinks = extractInternalLinks($, finalUrl, MAX_INTERNAL_LINKS_CHECKED);
  const brokenInternalUrls: string[] = [];

  for (const link of internalLinks) {
    try {
      // Some servers reject HEAD; a non-2xx/3xx here is still a reasonable
      // signal for a broken page at MVP fidelity.
      const linkResponse = await fetchWithTimeout(link, { method: "HEAD" });
      if (!linkResponse.ok) brokenInternalUrls.push(link);
    } catch {
      brokenInternalUrls.push(link);
    }
  }

  const homepageEmails = extractEmailsFromPage($, finalUrl);

  const contactLink = internalLinks.find((link) => /contact/i.test(link));
  let contactPageEmails: FoundEmail[] = [];
  if (contactLink) {
    try {
      const contactResponse = await fetchWithTimeout(contactLink);
      if (contactResponse.ok) {
        const contact$ = load(await contactResponse.text());
        contactPageEmails = extractEmailsFromPage(contact$, contactLink);
      }
    } catch {
      // Best-effort only — the contact page just won't contribute an email.
    }
  }

  const siteName = extractSiteName($);

  // Only spend a PageSpeed audit (and its API quota) on a page that our own
  // fetch could already reach — a dead URL doesn't need a second opinion.
  const lighthouse = response.ok ? await runPageSpeedAudit(finalUrl) : null;

  return {
    siteName,
    loads: response.ok,
    httpStatus: response.status,
    https: finalUrl.startsWith("https://"),
    mobileResponsive: hasViewportMeta($),
    hasContactInfo: hasContactInfo($),
    hasQuoteButton: hasQuoteButton($),
    brokenInternalUrls,
    copyrightYear: extractCopyrightYear($),
    weakServiceInfo: isWeakServiceInfo($),
    evidence: {
      finalUrl,
      siteName,
      checkedInternalLinks: internalLinks,
    },
    foundEmails: mergeUniqueByEmail([homepageEmails, contactPageEmails]),
    lighthouse,
  };
}

function extractSiteName($: CheerioAPI): string | null {
  const candidates = [
    $('meta[property="og:site_name"]').attr("content"),
    $('meta[name="application-name"]').attr("content"),
    $("h1").first().text(),
    $("title").text().split(/\s+[|–—-]\s+/)[0],
  ];

  for (const candidate of candidates) {
    const value = candidate?.replace(/\s+/g, " ").trim();
    if (value && value.length >= 2 && value.length <= 120 && !/^(home|welcome)$/i.test(value)) {
      return value;
    }
  }
  return null;
}
