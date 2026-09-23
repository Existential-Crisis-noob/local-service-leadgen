import type { ProspectCategory } from "@prisma/client";

export interface LighthouseScores {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
}

export interface ScoreAssessmentInput {
  loads: boolean;
  httpStatus: number | null;
  https: boolean;
  mobileResponsive: boolean | null;
  hasContactInfo: boolean;
  hasQuoteButton: boolean;
  brokenInternalUrls: string[];
  copyrightYear: number | null;
  weakServiceInfo: boolean;
  /** Real Lighthouse scores (0-100) via PageSpeed Insights — undefined/null
   * when no API key is configured. Purely additive: every category is
   * still reachable from the heuristics alone. */
  lighthouse?: LighthouseScores | null;
}

export interface ScoreInput {
  hasWebsite: boolean;
  hasPublicEmail: boolean;
  assessment?: ScoreAssessmentInput;
  /** The campaign's website-quality-filter checkboxes (targetNoWebsite,
   * targetBroken, targetMissingHttps, ...). A category with no matching
   * enabled flag still gets scored and shown, just not marked `qualified`. */
  qualificationFilter?: Record<string, boolean> | null;
}

export interface ScoreResult {
  category: ProspectCategory;
  score: number;
  qualified: boolean;
  reasons: string[];
}

const OUTDATED_COPYRIGHT_YEARS = 2;
const LOW_LIGHTHOUSE_SCORE = 50;

function isLow(score: number | null | undefined): score is number {
  return score !== null && score !== undefined && score < LOW_LIGHTHOUSE_SCORE;
}

/**
 * Maps the brief's lead categories onto an assessment: no website (the
 * best prospect — no existing vendor to displace, cleanest sale) > broken
 * > poor/outdated > weak marketing (flyer-kit) > good (low priority) —
 * with "no public email" overriding the display category (never
 * guess/auto-send) while keeping the underlying reasons visible.
 *
 * `qualified` reflects the campaign's own website-quality-filter checkboxes
 * (a business can be scored/shown either way; `qualified` is what actually
 * gates draft generation).
 */
export function scoreBusiness(input: ScoreInput): ScoreResult {
  const filter = input.qualificationFilter;
  const enabled = (key: string, fallback = true) => filter?.[key] ?? fallback;

  if (!input.hasWebsite) {
    return {
      category: "NO_WEBSITE",
      score: 98,
      qualified: enabled("targetNoWebsite"),
      reasons: [
        "No website found for this business — the best prospect: no existing site to displace, may need phone/manual contact.",
      ],
    };
  }

  const a = input.assessment;
  if (!a) {
    return {
      category: "GOOD",
      score: 15,
      qualified: false,
      reasons: ["Website found; assessment pending."],
    };
  }

  const reasons: string[] = [];
  let category: ProspectCategory;
  let score: number;
  let qualified: boolean;

  const currentYear = new Date().getFullYear();
  const lh = a.lighthouse;
  const outdatedCopyright =
    a.copyrightYear !== null && a.copyrightYear < currentYear - OUTDATED_COPYRIGHT_YEARS;
  const lowPerformance = isLow(lh?.performance);
  const lowAccessibility = isLow(lh?.accessibility);
  const lowBestPractices = isLow(lh?.bestPractices);
  const lowSeo = isLow(lh?.seo);

  if (!a.loads || (a.httpStatus ?? 200) >= 400 || a.brokenInternalUrls.length > 0) {
    category = "BROKEN";
    score = 90;
    if (!a.loads) reasons.push("Website did not load.");
    if ((a.httpStatus ?? 200) >= 400) reasons.push(`Website returned HTTP ${a.httpStatus}.`);
    if (a.brokenInternalUrls.length > 0) {
      reasons.push(`${a.brokenInternalUrls.length} broken internal page(s) found.`);
    }
    qualified = enabled("targetBroken");
  } else if (
    !a.https ||
    a.mobileResponsive === false ||
    outdatedCopyright ||
    lowPerformance ||
    lowAccessibility ||
    lowBestPractices
  ) {
    category = "POOR_OUTDATED";
    score = 80;
    if (!a.https) reasons.push("Website is not served over HTTPS.");
    if (a.mobileResponsive === false) reasons.push("Website is not mobile-responsive.");
    if (outdatedCopyright) reasons.push(`Footer copyright year (${a.copyrightYear}) is outdated.`);
    if (lowPerformance) reasons.push(`Lighthouse performance score is low (${lh!.performance}/100).`);
    if (lowAccessibility) reasons.push(`Lighthouse accessibility score is low (${lh!.accessibility}/100).`);
    if (lowBestPractices) reasons.push(`Lighthouse best-practices score is low (${lh!.bestPractices}/100).`);
    qualified =
      (!a.https && enabled("targetMissingHttps")) ||
      (a.mobileResponsive === false && enabled("targetNotMobile")) ||
      (outdatedCopyright && enabled("targetOutdatedCopyright")) ||
      ((lowPerformance || lowAccessibility || lowBestPractices) && enabled("targetPoorLighthouse"));
  } else if (a.weakServiceInfo || !a.hasQuoteButton || !a.hasContactInfo || lowSeo) {
    category = "WEAK_MARKETING";
    score = 55;
    if (a.weakServiceInfo) reasons.push("Website has thin service/marketing content.");
    if (!a.hasQuoteButton) reasons.push("No visible quote/request-service call to action.");
    if (!a.hasContactInfo) reasons.push("No clearly visible contact information.");
    if (lowSeo) reasons.push(`Lighthouse SEO score is low (${lh!.seo}/100).`);
    qualified =
      (a.weakServiceInfo && enabled("targetWeakService")) ||
      (!a.hasQuoteButton && enabled("targetMissingQuote")) ||
      (!a.hasContactInfo && enabled("targetMissingContact")) ||
      (lowSeo && enabled("targetPoorLighthouse"));
  } else {
    category = "GOOD";
    score = 15;
    reasons.push(
      "Website loads, is HTTPS, mobile-responsive, and has clear contact and service information."
    );
    qualified = enabled("targetGoodWebsite", false);
  }

  if (!input.hasPublicEmail) {
    reasons.push(
      "No public business email found on the website — do not guess or auto-send; requires phone/manual contact."
    );
    return { category: "NO_PUBLIC_EMAIL", score: Math.min(score, 40), qualified, reasons };
  }

  return { category, score, qualified, reasons };
}
