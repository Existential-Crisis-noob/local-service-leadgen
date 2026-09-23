import { classifyUrl } from "./classify";
import type { CandidateBusiness } from "./types";

export interface UrlImportResult {
  candidates: CandidateBusiness[];
  rejected: { url: string; reason: string }[];
}

/** Turns user-pasted URLs into candidate businesses, gated through
 * classifyUrl. The hostname is stored as the initial observed identity;
 * website inspection replaces it with the published site name when present. */
export function buildCandidatesFromUrls(rawUrls: string[]): UrlImportResult {
  const candidates: CandidateBusiness[] = [];
  const rejected: { url: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const rawUrl of rawUrls) {
    const trimmed = rawUrl.trim();
    if (!trimmed) continue;

    const classification = classifyUrl(trimmed);
    if (classification.kind === "rejected") {
      rejected.push({ url: trimmed, reason: classification.reason });
      continue;
    }

    if (seen.has(classification.hostname)) continue;
    seen.add(classification.hostname);

    candidates.push({
      name: classification.hostname,
      websiteUrl: classification.url,
      sourceUrl: classification.url,
    });
  }

  return { candidates, rejected };
}
