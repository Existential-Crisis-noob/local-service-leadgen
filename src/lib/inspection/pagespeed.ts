import { env } from "@/lib/env";

export interface PageSpeedResult {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
}

const PAGESPEED_TIMEOUT_MS = 30000;
const PAGESPEED_CATEGORIES = ["PERFORMANCE", "ACCESSIBILITY", "BEST_PRACTICES", "SEO"];

export function toScore100(score: number | null | undefined): number | null {
  if (score === null || score === undefined) return null;
  return Math.round(score * 100);
}

/**
 * Runs a real Lighthouse audit via Google's PageSpeed Insights API — the
 * same engine as `npx lighthouse`, hosted, so the worker never needs to
 * launch headless Chrome itself. Returns null (never throws) when no API
 * key is configured, or on any failure — this is always an enhancement on
 * top of the existing heuristics, never a hard dependency.
 */
export async function runPageSpeedAudit(url: string): Promise<PageSpeedResult | null> {
  if (!env.PAGESPEED_API_KEY) return null;

  const params = new URLSearchParams({ url, key: env.PAGESPEED_API_KEY, strategy: "mobile" });
  for (const category of PAGESPEED_CATEGORIES) params.append("category", category);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PAGESPEED_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      console.warn(`[pagespeed] audit failed for ${url} with status ${response.status}`);
      return null;
    }

    const data = await response.json();
    const categories = data?.lighthouseResult?.categories ?? {};

    return {
      performance: toScore100(categories.performance?.score),
      accessibility: toScore100(categories.accessibility?.score),
      bestPractices: toScore100(categories["best-practices"]?.score),
      seo: toScore100(categories.seo?.score),
    };
  } catch (error) {
    console.warn(`[pagespeed] audit errored for ${url}`, error instanceof Error ? error.message : error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
