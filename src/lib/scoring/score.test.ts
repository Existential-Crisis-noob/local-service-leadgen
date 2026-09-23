import { describe, expect, it } from "vitest";
import { scoreBusiness, type ScoreAssessmentInput } from "./score";

const GOOD_ASSESSMENT: ScoreAssessmentInput = {
  loads: true,
  httpStatus: 200,
  https: true,
  mobileResponsive: true,
  hasContactInfo: true,
  hasQuoteButton: true,
  brokenInternalUrls: [],
  copyrightYear: new Date().getFullYear(),
  weakServiceInfo: false,
};

describe("scoreBusiness", () => {
  it("categorizes a business with no website as NO_WEBSITE", () => {
    const result = scoreBusiness({ hasWebsite: false, hasPublicEmail: false });
    expect(result.category).toBe("NO_WEBSITE");
  });

  it("categorizes a non-loading website as BROKEN", () => {
    const result = scoreBusiness({
      hasWebsite: true,
      hasPublicEmail: true,
      assessment: { ...GOOD_ASSESSMENT, loads: false, httpStatus: null },
    });
    expect(result.category).toBe("BROKEN");
    expect(result.reasons.some((r) => /did not load/.test(r))).toBe(true);
  });

  it("categorizes broken internal pages as BROKEN even if the homepage loads", () => {
    const result = scoreBusiness({
      hasWebsite: true,
      hasPublicEmail: true,
      assessment: { ...GOOD_ASSESSMENT, brokenInternalUrls: ["https://acme.example.com/services"] },
    });
    expect(result.category).toBe("BROKEN");
  });

  it("categorizes a non-HTTPS site as POOR_OUTDATED", () => {
    const result = scoreBusiness({
      hasWebsite: true,
      hasPublicEmail: true,
      assessment: { ...GOOD_ASSESSMENT, https: false },
    });
    expect(result.category).toBe("POOR_OUTDATED");
  });

  it("categorizes a stale copyright year as POOR_OUTDATED", () => {
    const result = scoreBusiness({
      hasWebsite: true,
      hasPublicEmail: true,
      assessment: { ...GOOD_ASSESSMENT, copyrightYear: 2015 },
    });
    expect(result.category).toBe("POOR_OUTDATED");
  });

  it("categorizes thin content as WEAK_MARKETING", () => {
    const result = scoreBusiness({
      hasWebsite: true,
      hasPublicEmail: true,
      assessment: { ...GOOD_ASSESSMENT, weakServiceInfo: true },
    });
    expect(result.category).toBe("WEAK_MARKETING");
  });

  it("categorizes a strong website as GOOD", () => {
    const result = scoreBusiness({ hasWebsite: true, hasPublicEmail: true, assessment: GOOD_ASSESSMENT });
    expect(result.category).toBe("GOOD");
  });

  it("overrides the category to NO_PUBLIC_EMAIL when no email was found, keeping the underlying reason", () => {
    const result = scoreBusiness({
      hasWebsite: true,
      hasPublicEmail: false,
      assessment: { ...GOOD_ASSESSMENT, https: false },
    });
    expect(result.category).toBe("NO_PUBLIC_EMAIL");
    expect(result.reasons.some((r) => /HTTPS/.test(r))).toBe(true);
    expect(result.reasons.some((r) => /no public business email/i.test(r))).toBe(true);
  });

  it("never invents a reason that isn't backed by an assessment field", () => {
    const result = scoreBusiness({ hasWebsite: true, hasPublicEmail: true, assessment: GOOD_ASSESSMENT });
    // The only reason for a GOOD site should be the generic all-clear statement.
    expect(result.reasons).toHaveLength(1);
  });

  it("categorizes a low Lighthouse performance score as POOR_OUTDATED even when heuristics look fine", () => {
    const result = scoreBusiness({
      hasWebsite: true,
      hasPublicEmail: true,
      assessment: {
        ...GOOD_ASSESSMENT,
        lighthouse: { performance: 22, accessibility: 90, bestPractices: 90, seo: 90 },
      },
    });
    expect(result.category).toBe("POOR_OUTDATED");
    expect(result.reasons.some((r) => /Lighthouse performance score is low \(22\/100\)/.test(r))).toBe(true);
  });

  it("categorizes a low Lighthouse SEO score as WEAK_MARKETING when everything else is fine", () => {
    const result = scoreBusiness({
      hasWebsite: true,
      hasPublicEmail: true,
      assessment: {
        ...GOOD_ASSESSMENT,
        lighthouse: { performance: 90, accessibility: 90, bestPractices: 90, seo: 30 },
      },
    });
    expect(result.category).toBe("WEAK_MARKETING");
    expect(result.reasons.some((r) => /Lighthouse SEO score is low \(30\/100\)/.test(r))).toBe(true);
  });

  it("stays GOOD when Lighthouse scores are all high, or when Lighthouse didn't run at all", () => {
    const withHighScores = scoreBusiness({
      hasWebsite: true,
      hasPublicEmail: true,
      assessment: {
        ...GOOD_ASSESSMENT,
        lighthouse: { performance: 95, accessibility: 95, bestPractices: 95, seo: 95 },
      },
    });
    expect(withHighScores.category).toBe("GOOD");

    const withoutLighthouse = scoreBusiness({
      hasWebsite: true,
      hasPublicEmail: true,
      assessment: { ...GOOD_ASSESSMENT, lighthouse: null },
    });
    expect(withoutLighthouse.category).toBe("GOOD");
  });
});
