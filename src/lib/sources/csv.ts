import Papa from "papaparse";
import { classifyUrl } from "./classify";
import type { CandidateBusiness } from "./types";

export interface CsvImportResult {
  candidates: CandidateBusiness[];
  errors: string[];
}

const COLUMN_ALIASES: Record<string, keyof CandidateBusiness> = {
  name: "name",
  business: "name",
  businessname: "name",
  phone: "phone",
  phonenumber: "phone",
  address: "address",
  street: "address",
  city: "city",
  region: "region",
  state: "region",
  province: "region",
  postalcode: "postalCode",
  zip: "postalCode",
  zipcode: "postalCode",
  lat: "lat",
  latitude: "lat",
  lon: "lon",
  lng: "lon",
  longitude: "lon",
  category: "category",
  industry: "category",
  website: "websiteUrl",
  websiteurl: "websiteUrl",
  url: "websiteUrl",
  email: "email",
  emailaddress: "email",
};

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Parses a user-uploaded CSV of businesses. Every website/URL column value
 * is run through classifyUrl — rejected URLs are dropped with a per-row
 * error, never silently scraped. */
export function parseCsvBusinesses(csvText: string): CsvImportResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const candidates: CandidateBusiness[] = [];
  const errors: string[] = [...parsed.errors.map((e) => `Row ${e.row ?? "?"}: ${e.message}`)];

  const headerMap = new Map<string, keyof CandidateBusiness>();
  for (const rawHeader of parsed.meta.fields ?? []) {
    const mapped = COLUMN_ALIASES[normalizeHeader(rawHeader)];
    if (mapped) headerMap.set(rawHeader, mapped);
  }

  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for header row, +1 for 1-indexing
    const candidate: Partial<CandidateBusiness> = {};

    for (const [rawHeader, field] of headerMap) {
      const value = row[rawHeader]?.trim();
      if (!value) continue;

      if (field === "websiteUrl") {
        const classification = classifyUrl(value);
        if (classification.kind === "rejected") {
          errors.push(`Row ${rowNumber}: website "${value}" skipped — ${classification.reason}`);
          continue;
        }
        candidate.websiteUrl = classification.url;
      } else if (field === "email") {
        if (!SIMPLE_EMAIL_PATTERN.test(value)) {
          errors.push(`Row ${rowNumber}: email "${value}" doesn't look valid — skipped.`);
          continue;
        }
        candidate.email = value.toLowerCase();
      } else if (field === "lat" || field === "lon") {
        const num = parseFloat(value);
        if (!Number.isNaN(num)) candidate[field] = num;
      } else {
        candidate[field] = value;
      }
    }

    if (!candidate.name) {
      errors.push(`Row ${rowNumber}: skipped — missing a business name.`);
      return;
    }

    candidates.push({ ...candidate, name: candidate.name, sourceUrl: "csv-import" });
  });

  return { candidates, errors };
}
