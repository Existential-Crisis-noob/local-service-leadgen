import { geocodeLocation } from "./osm";
import { classifyUrl } from "./classify";
import type {
  CandidateBusiness,
  DiscoverParams,
  ProgressReporter,
  SourceConnector,
} from "./types";

const CANADA_ONE_ORIGIN = "https://www.canadaone.com";
const SEARCH_URL = `${CANADA_ONE_ORIGIN}/business/index.html/CanadaOne/directory/search`;
const RESULT_PATH_PREFIX = "/business/index.html/CanadaOne/directory/map/p/";
const USER_AGENT = "LocalSignal/1.0 (approved CanadaOne public-directory connector)";
const REQUEST_TIMEOUT_MS = 12_000;
const PAGE_DELAY_MS = 650;
const MAX_PAGES_PER_KEYWORD = 8;

const CANADIAN_PROVINCES = new Set([
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
]);

interface CanadaOneRecord {
  company_id?: string | number;
  company_name?: string;
  company_url?: string;
  description?: string;
  keywords?: string;
  telephone?: string;
  address?: string;
  "1_address_1"?: string;
  "1_address_2"?: string;
  city?: string;
  "1_city"?: string;
  province?: string;
  "1_province"?: string;
  postal_code?: string;
  "1_postal"?: string;
  latitude?: string | number;
  longitude?: string | number;
  lat?: string | number;
  lng?: string | number;
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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

function extractSessionCookie(response: Response): string {
  const header = response.headers.get("set-cookie") ?? "";
  const match = header.match(/(?:^|,\s*)(PHPSESSID=[^;]+)/i);
  if (!match) throw new Error("CanadaOne did not create a public directory search session.");
  return match[1];
}

function parseEmbeddedResults(html: string): CanadaOneRecord[] {
  const match = html.match(/\bvar\s+results\s*=\s*(\[[^\r\n]*\]);/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[1]) as unknown;
    return Array.isArray(parsed) ? (parsed as CanadaOneRecord[]) : [];
  } catch {
    throw new Error("CanadaOne returned an unreadable public directory response.");
  }
}

function normalizeText(value: string | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("en-CA").replace(/[^a-z0-9]+/g, " ");
}

function isRelevant(record: CanadaOneRecord, keyword: string) {
  const haystack = normalizeText(
    [record.company_name, record.description, record.keywords].filter(Boolean).join(" ")
  );
  const needle = normalizeText(keyword);
  if (!needle) return false;
  if (haystack.includes(needle)) return true;

  const compactNeedle = needle.replace(/\s+/g, "");
  const stem = compactNeedle.length >= 6 ? compactNeedle.slice(0, compactNeedle.length - 3) : compactNeedle;
  return stem.length >= 4 && haystack.replace(/\s+/g, "").includes(stem);
}

function toNumber(value: string | number | undefined): number | undefined {
  const parsed = typeof value === "number" ? value : Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) ? parsed : undefined;
}

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function businessWebsite(raw: string | undefined): string | undefined {
  const value = raw?.trim();
  if (!value || value === "http://" || value === "https://") return undefined;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const classification = classifyUrl(withProtocol);
  return classification.kind === "business_website" ? classification.url : undefined;
}

function resultPageUrl(page: number) {
  return `${CANADA_ONE_ORIGIN}${RESULT_PATH_PREFIX}${page}`;
}

async function startSearch(keyword: string, province: string) {
  const body = new URLSearchParams({
    "search[keywords]": keyword,
    "search[filter]": province,
  });
  const response = await fetchWithTimeout(SEARCH_URL, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (response.status !== 302 && response.status !== 303) {
    throw new Error(`CanadaOne search failed with status ${response.status}.`);
  }

  return extractSessionCookie(response);
}

async function fetchResultPage(cookie: string, page: number) {
  const response = await fetchWithTimeout(resultPageUrl(page), {
    headers: { Cookie: cookie, Accept: "text/html" },
  });
  if (!response.ok) {
    throw new Error(`CanadaOne results failed with status ${response.status}.`);
  }
  return parseEmbeddedResults(await response.text());
}

/**
 * Dedicated, bounded connector for CanadaOne's public Canadian Business Directory.
 * It uses the site's own search flow, requests at most eight result pages per keyword,
 * and never imports a directory-listed email as sendable contact evidence. Email
 * eligibility is established later only from the business-owned public website.
 */
export class CanadaOneConnector implements SourceConnector {
  async discover(params: DiscoverParams, onProgress?: ProgressReporter): Promise<CandidateBusiness[]> {
    if (params.countryCode.toUpperCase() !== "CA") {
      throw new Error("CanadaOne can only be used for Canadian campaigns.");
    }

    const province = params.region?.trim().toUpperCase() ?? "";
    if (!CANADIAN_PROVINCES.has(province)) {
      throw new Error("CanadaOne requires a two-letter Canadian province or territory code.");
    }

    await onProgress?.({ progress: 12, stage: "locating", message: "Locating the search centre" });
    const center = await geocodeLocation(params);
    const candidates = new Map<string, CandidateBusiness>();
    const keywords = params.industryKeywords.map((keyword) => keyword.trim()).filter(Boolean);

    for (let keywordIndex = 0; keywordIndex < keywords.length; keywordIndex += 1) {
      const keyword = keywords[keywordIndex];
      await onProgress?.({
        progress: 20 + Math.round((keywordIndex / Math.max(keywords.length, 1)) * 40),
        stage: "searching",
        message: `Searching CanadaOne for “${keyword}”`,
      });

      const cookie = await startSearch(keyword, province);
      for (let page = 1; page <= MAX_PAGES_PER_KEYWORD; page += 1) {
        if (candidates.size >= params.desiredCount) break;
        if (page > 1) await pause(PAGE_DELAY_MS);

        const records = await fetchResultPage(cookie, page);
        if (records.length === 0) break;
        let addedOnPage = 0;

        for (const record of records) {
          const name = record.company_name?.trim();
          if (!name || !isRelevant(record, keyword)) continue;
          const recordProvince = (record["1_province"] ?? record.province ?? "").trim().toUpperCase();
          const recordCity = record["1_city"] ?? record.city;
          if (recordProvince !== province) continue;

          const lat = toNumber(record.lat ?? record.latitude);
          const lon = toNumber(record.lng ?? record.longitude);
          const exactCity = normalizeText(recordCity) === normalizeText(params.city);
          const inRadius =
            lat !== undefined && lon !== undefined
              ? distanceKm(center, { lat, lon }) <= params.radiusKm
              : exactCity;
          if (!inRadius) continue;

          const websiteUrl = businessWebsite(record.company_url);
          let websiteHost = "";
          if (websiteUrl) {
            try {
              websiteHost = new URL(websiteUrl).hostname.replace(/^www\./, "").toLowerCase();
            } catch {
              websiteHost = "";
            }
          }
          const phoneDigits = record.telephone?.replace(/\D/g, "") ?? "";
          const key = websiteHost
            ? `website:${websiteHost}`
            : phoneDigits.length >= 7
              ? `phone:${phoneDigits}`
              : `${normalizeText(name)}:${normalizeText(recordCity)}`;
          if (candidates.has(key)) continue;

          candidates.set(key, {
            name,
            phone: record.telephone?.trim() || undefined,
            address:
              [record["1_address_1"], record["1_address_2"]]
                .map((part) => part?.trim())
                .filter(Boolean)
                .join(", ") || record.address?.trim() || undefined,
            city: recordCity?.trim() || undefined,
            region: province,
            postalCode: (record["1_postal"] ?? record.postal_code)?.trim() || undefined,
            lat,
            lon,
            category: keyword,
            websiteUrl,
            sourceUrl: resultPageUrl(page),
          });
          addedOnPage += 1;
          if (candidates.size >= params.desiredCount) break;
        }

        await onProgress?.({
          progress: Math.min(65, 25 + keywordIndex * 5 + page * 4),
          stage: "filtering",
          message: `${candidates.size} matching businesses found within ${params.radiusKm} km`,
        });

        if (records.length < 20 || addedOnPage === 0) break;
      }

      if (candidates.size >= params.desiredCount) break;
      if (keywordIndex < keywords.length - 1) await pause(PAGE_DELAY_MS);
    }

    return Array.from(candidates.values()).slice(0, params.desiredCount);
  }
}
