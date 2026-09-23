import { load } from "cheerio";
import {
  extractCopyrightYear,
  extractInternalLinks,
  hasContactInfo,
  hasQuoteButton,
  hasViewportMeta,
  isWeakServiceInfo,
} from "./heuristics";

const USER_AGENT = "local-service-leadgen/0.1 (website quality check)";
const FETCH_TIMEOUT_MS = 8000;
const MAX_INTERNAL_LINKS_CHECKED = 5;

export type JsonEvidenceValue = string | number | boolean | null | string[];

export interface WebsiteAssessmentResult {
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
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, ...init?.headers },
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches a business's homepage and runs the brief's website-quality checks
 * against it (loads, HTTPS, mobile-responsive proxy, contact info, quote
 * CTA, broken internal pages, copyright year, thin service content).
 * Heuristic, not a rendered check — no headless browser in the MVP.
 */
export async function assessWebsite(url: string): Promise<WebsiteAssessmentResult> {
  let response: Response;
  try {
    response = await fetchWithTimeout(url);
  } catch (error) {
    return {
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

  return {
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
      checkedInternalLinks: internalLinks,
    },
  };
}
