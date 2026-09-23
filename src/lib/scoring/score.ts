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
  qualificationFilter?: Record<string, boolean> | null;
}

export interface ScoreResult {
  category: ProspectCategory;
  score: number;
  qualified: boolean;
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
  const filter = input.qualificationFilter;
  const enabled = (key: string, fallback = true) => filter?.[key] ?? fallback;

  if (!input.hasWebsite) {
    return {
      category: "NO_WEBSITE",
      score: 75,
      qualified: enabled("targetNoWebsite"),
      reasons: [
        "No website found for this business — strong sales prospect, may need phone/manual contact.",
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
  let qualified = false;

  const currentYear = new Date().getFullYear();

  if (!a.loads || (a.httpStatus ?? 200) >= 400 || a.brokenInternalUrls.length > 0) {
    category = "BROKEN";
    score = 95;
    if (!a.loads) reasons.push("Website did not load.");
    if ((a.httpStatus ?? 200) >= 400) reasons.push(`Website returned HTTP ${a.httpStatus}.`);
    if (a.brokenInternalUrls.length > 0) {
      reasons.push(`${a.brokenInternalUrls.length} broken internal page(s) found.`);
    }
    qualified = enabled("targetBroken");
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
    qualified =
      (!a.https && enabled("targetMissingHttps")) ||
      (a.mobileResponsive === false && enabled("targetNotMobile")) ||
      (a.copyrightYear !== null &&
        a.copyrightYear < currentYear - OUTDATED_COPYRIGHT_YEARS &&
        enabled("targetOutdatedCopyright"));
  } else if (a.weakServiceInfo || !a.hasQuoteButton || !a.hasContactInfo) {
    category = "WEAK_MARKETING";
    score = 55;
    if (a.weakServiceInfo) reasons.push("Website has thin service/marketing content.");
    if (!a.hasQuoteButton) reasons.push("No visible quote/request-service call to action.");
    if (!a.hasContactInfo) reasons.push("No clearly visible contact information.");
    qualified =
      (a.weakServiceInfo && enabled("targetWeakService")) ||
      (!a.hasQuoteButton && enabled("targetMissingQuote")) ||
      (!a.hasContactInfo && enabled("targetMissingContact"));
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
