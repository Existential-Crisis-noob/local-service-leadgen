import type { ProspectCategory } from "@prisma/client";

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
}

export interface ScoreInput {
  hasWebsite: boolean;
  hasPublicEmail: boolean;
  assessment?: ScoreAssessmentInput;
}

export interface ScoreResult {
  category: ProspectCategory;
  score: number;
  reasons: string[];
}

const OUTDATED_COPYRIGHT_YEARS = 2;

/**
 * Maps the brief's lead categories onto an assessment: no website (strong
 * prospect) > broken > poor/outdated > weak marketing (flyer-kit) > good
 * (low priority) — with "no public email" overriding the display category
 * (never guess/auto-send) while keeping the underlying reasons visible.
 */
export function scoreBusiness(input: ScoreInput): ScoreResult {
  if (!input.hasWebsite) {
    return {
      category: "NO_WEBSITE",
      score: 75,
      reasons: [
        "No website found for this business — strong sales prospect, may need phone/manual contact.",
      ],
    };
  }

  const a = input.assessment;
  if (!a) {
    return { category: "GOOD", score: 15, reasons: ["Website found; assessment pending."] };
  }

  const reasons: string[] = [];
  let category: ProspectCategory;
  let score: number;

  const currentYear = new Date().getFullYear();

  if (!a.loads || (a.httpStatus ?? 200) >= 400 || a.brokenInternalUrls.length > 0) {
    category = "BROKEN";
    score = 95;
    if (!a.loads) reasons.push("Website did not load.");
    if ((a.httpStatus ?? 200) >= 400) reasons.push(`Website returned HTTP ${a.httpStatus}.`);
    if (a.brokenInternalUrls.length > 0) {
      reasons.push(`${a.brokenInternalUrls.length} broken internal page(s) found.`);
    }
  } else if (
    !a.https ||
    a.mobileResponsive === false ||
    (a.copyrightYear !== null && a.copyrightYear < currentYear - OUTDATED_COPYRIGHT_YEARS)
  ) {
    category = "POOR_OUTDATED";
    score = 85;
    if (!a.https) reasons.push("Website is not served over HTTPS.");
    if (a.mobileResponsive === false) reasons.push("Website is not mobile-responsive.");
    if (a.copyrightYear !== null && a.copyrightYear < currentYear - OUTDATED_COPYRIGHT_YEARS) {
      reasons.push(`Footer copyright year (${a.copyrightYear}) is outdated.`);
    }
  } else if (a.weakServiceInfo || !a.hasQuoteButton || !a.hasContactInfo) {
    category = "WEAK_MARKETING";
    score = 55;
    if (a.weakServiceInfo) reasons.push("Website has thin service/marketing content.");
    if (!a.hasQuoteButton) reasons.push("No visible quote/request-service call to action.");
    if (!a.hasContactInfo) reasons.push("No clearly visible contact information.");
  } else {
    category = "GOOD";
    score = 15;
    reasons.push(
      "Website loads, is HTTPS, mobile-responsive, and has clear contact and service information."
    );
  }

  if (!input.hasPublicEmail) {
    reasons.push(
      "No public business email found on the website — do not guess or auto-send; requires phone/manual contact."
    );
    return { category: "NO_PUBLIC_EMAIL", score: Math.min(score, 40), reasons };
  }

  return { category, score, reasons };
}
