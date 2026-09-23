import type {
  CandidateBusiness,
  DiscoverParams,
  ProgressReporter,
  SourceConnector,
} from "./types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
] as const;
const USER_AGENT = "local-service-leadgen/0.1 (contact: set SUPPORT_EMAIL env var)";
const FETCH_TIMEOUT_MS = 25_000;

// Best-effort mapping from our industry keywords to OSM tags. Keywords with
// no mapping fall back to a case-insensitive name search so nothing silently
// returns zero results.
const INDUSTRY_TAGS: Record<string, { key: string; value: string }> = {
  roofing: { key: "craft", value: "roofer" },
  masonry: { key: "craft", value: "mason" },
  paving: { key: "craft", value: "paving" },
  hvac: { key: "craft", value: "hvac" },
};

export interface GeocodeResult {
  lat: number;
  lon: number;
}

export async function geocodeLocation(params: {
  city: string;
  region?: string | null;
  postalCode?: string | null;
  countryCode: string;
}): Promise<GeocodeResult> {
  const query = [params.city, params.region, params.postalCode, params.countryCode]
    .filter(Boolean)
    .join(", ");

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const response = await fetchWithTimeout(url, { headers: { "User-Agent": USER_AGENT } }, 12_000);
  if (!response.ok) {
    throw new Error(`Nominatim geocoding failed with status ${response.status}`);
  }

  const results = (await response.json()) as Array<{ lat: string; lon: string }>;
  if (results.length === 0) {
    throw new Error(`Could not geocode "${query}"`);
  }

  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
}

export function buildOverpassQuery(
  center: GeocodeResult,
  radiusMeters: number,
  industryKeywords: string[]
): string {
  const clauses: string[] = [];
  const radiusKm = radiusMeters / 1000;
  const latDelta = radiusKm / 111.32;
  const lonDelta = radiusKm / (111.32 * Math.max(Math.cos((center.lat * Math.PI) / 180), 0.1));
  const bbox = [
    center.lat - latDelta,
    center.lon - lonDelta,
    center.lat + latDelta,
    center.lon + lonDelta,
  ]
    .map((value) => value.toFixed(6))
    .join(",");

  for (const keyword of industryKeywords) {
    const tag = INDUSTRY_TAGS[keyword.toLowerCase()];
    if (tag) {
      clauses.push(
        `node["${tag.key}"="${tag.value}"](${bbox});`,
        `way["${tag.key}"="${tag.value}"](${bbox});`
      );
    } else {
      const escaped = keyword.replace(/["\\]/g, "");
      clauses.push(`node["name"~"${escaped}",i](${bbox});`);
    }
  }

  return `[out:json][timeout:45];\n(\n  ${clauses.join("\n  ")}\n);\nout center tags;`;
}

interface OverpassElement {
  id?: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function parseOverpassElements(elements: OverpassElement[]): CandidateBusiness[] {
  const candidates: CandidateBusiness[] = [];

  for (const el of elements) {
    const tags = el.tags ?? {};
    const name = tags.name;
    if (!name) continue;

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;

    const addressParts = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean);

    candidates.push({
      name,
      phone: tags.phone ?? tags["contact:phone"],
      address: addressParts.length ? addressParts.join(" ") : undefined,
      city: tags["addr:city"],
      region: tags["addr:state"] ?? tags["addr:province"],
      postalCode: tags["addr:postcode"],
      lat,
      lon,
      category: tags.craft ?? tags.shop,
      websiteUrl: tags.website ?? tags["contact:website"],
      sourceUrl: el.id
        ? `https://www.openstreetmap.org/${el.type}/${el.id}`
        : "https://www.openstreetmap.org/",
    });
  }

  return candidates;
}

export class OsmConnector implements SourceConnector {
  async discover(params: DiscoverParams, onProgress?: ProgressReporter): Promise<CandidateBusiness[]> {
    await onProgress?.({ progress: 12, stage: "locating", message: "Locating the search centre" });
    const center = await geocodeLocation(params);
    const radiusMeters = Math.round(params.radiusKm * 1000);
    const query = buildOverpassQuery(center, radiusMeters, params.industryKeywords);

    let data: { elements: OverpassElement[] } | undefined;
    const failures: string[] = [];
    for (let index = 0; index < OVERPASS_URLS.length; index += 1) {
      const endpoint = OVERPASS_URLS[index];
      await onProgress?.({
        progress: 25 + index * 10,
        stage: "searching",
        message: index === 0 ? "Searching OpenStreetMap" : `Retrying on mirror ${index + 1}`,
      });

      try {
        const response = await fetchWithTimeout(endpoint, {
          method: "POST",
          headers: { "Content-Type": "text/plain", "User-Agent": USER_AGENT },
          body: query,
        });

        if (!response.ok) {
          failures.push(`${new URL(endpoint).hostname}: HTTP ${response.status}`);
          if (response.status < 500 && response.status !== 429) break;
          continue;
        }

        data = (await response.json()) as { elements: OverpassElement[] };
        break;
      } catch (error) {
        failures.push(
          `${new URL(endpoint).hostname}: ${error instanceof Error ? error.message : "request failed"}`
        );
      }
    }

    if (!data) {
      throw new Error(`OpenStreetMap discovery could not reach an Overpass server. ${failures.join("; ")}`);
    }

    const candidates = parseOverpassElements(data.elements);
    const withinRadius = candidates.filter(
      (candidate) =>
        candidate.lat === undefined ||
        candidate.lon === undefined ||
        haversineKm(center, { lat: candidate.lat, lon: candidate.lon }) <= params.radiusKm
    );

    await onProgress?.({
      progress: 65,
      stage: "filtering",
      message: `${Math.min(withinRadius.length, params.desiredCount)} candidate businesses found`,
    });

    return withinRadius.slice(0, params.desiredCount);
  }
}

function haversineKm(a: GeocodeResult, b: GeocodeResult) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function fetchWithTimeout(url: string | URL, init: RequestInit, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
