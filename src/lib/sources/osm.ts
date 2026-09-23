import type { CandidateBusiness, DiscoverParams, SourceConnector } from "./types";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "local-service-leadgen/0.1 (contact: set SUPPORT_EMAIL env var)";

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

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
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

  for (const keyword of industryKeywords) {
    const tag = INDUSTRY_TAGS[keyword.toLowerCase()];
    if (tag) {
      clauses.push(
        `node["${tag.key}"="${tag.value}"](around:${radiusMeters},${center.lat},${center.lon});`,
        `way["${tag.key}"="${tag.value}"](around:${radiusMeters},${center.lat},${center.lon});`
      );
    } else {
      const escaped = keyword.replace(/["\\]/g, "");
      clauses.push(`node["name"~"${escaped}",i](around:${radiusMeters},${center.lat},${center.lon});`);
    }
  }

  return `[out:json][timeout:25];\n(\n  ${clauses.join("\n  ")}\n);\nout center tags;`;
}

interface OverpassElement {
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
      sourceUrl: "https://www.openstreetmap.org/",
    });
  }

  return candidates;
}

export class OsmConnector implements SourceConnector {
  async discover(params: DiscoverParams): Promise<CandidateBusiness[]> {
    const center = await geocodeLocation(params);
    const radiusMeters = Math.round(params.radiusKm * 1000);
    const query = buildOverpassQuery(center, radiusMeters, params.industryKeywords);

    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain", "User-Agent": USER_AGENT },
      body: query,
    });

    if (response.status === 429) {
      throw new Error("Overpass API rate limit hit — try again in a minute.");
    }
    if (!response.ok) {
      throw new Error(`Overpass query failed with status ${response.status}`);
    }

    const data = (await response.json()) as { elements: OverpassElement[] };
    const candidates = parseOverpassElements(data.elements);

    return candidates.slice(0, params.desiredCount);
  }
}
