import type { CandidateBusiness } from "@/lib/sources/types";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * A stable per-workspace key for deduplicating businesses collected from
 * different connectors/runs. Prefers the website hostname (most reliable),
 * then phone number, then a normalized name (+ city if we have one).
 */
export function computeDedupeKey(candidate: CandidateBusiness): string {
  if (candidate.websiteUrl) {
    try {
      const hostname = new URL(candidate.websiteUrl).hostname.replace(/^www\./, "").toLowerCase();
      return `website:${hostname}`;
    } catch {
      // fall through
    }
  }

  if (candidate.phone) {
    const digits = normalizePhone(candidate.phone);
    if (digits.length >= 7) return `phone:${digits}`;
  }

  const namePart = normalize(candidate.name);
  const cityPart = candidate.city ? normalize(candidate.city) : "";
  return `name:${namePart}|${cityPart}`;
}
