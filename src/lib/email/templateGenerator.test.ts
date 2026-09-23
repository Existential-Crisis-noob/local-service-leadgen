import { describe, expect, it } from "vitest";
import { generateFollowupEmail, generateTemplateEmail } from "./templateGenerator";

const BASE_INPUT = {
  businessName: "Acme Roofing",
  industry: "roofing",
  maxLength: 2000,
  senderName: "Jane from Lead Gen",
  unsubscribeUrl: "https://app.example.com/unsubscribe/abc123",
};

describe("generateTemplateEmail", () => {
  it("mentions the business name, industry, and includes the unsubscribe link", () => {
    const email = generateTemplateEmail({ ...BASE_INPUT, category: "BROKEN" });
    expect(email.subject).toContain("Acme Roofing");
    expect(email.body).toContain("Acme Roofing");
    expect(email.body).toContain("roofing companies");
    expect(email.body).toContain(BASE_INPUT.unsubscribeUrl);
    expect(email.body).toContain(BASE_INPUT.senderName);
  });

  it("mentions the observed issue for a broken website", () => {
    const email = generateTemplateEmail({ ...BASE_INPUT, category: "BROKEN" });
    expect(email.body).toMatch(/isn't loading correctly/);
  });

  it("mentions no-website phrasing for the NO_WEBSITE category", () => {
    const email = generateTemplateEmail({ ...BASE_INPUT, category: "NO_WEBSITE" });
    expect(email.body).toMatch(/couldn't find a website/);
  });

  it("falls back to generic industry copy for an unmapped industry", () => {
    const email = generateTemplateEmail({ ...BASE_INPUT, industry: "landscaping", category: "GOOD" });
    expect(email.body).toContain("local service businesses");
  });

  it("drops the value-prop paragraph to fit a shorter max length, but keeps sender identity and the unsubscribe link", () => {
    const full = generateTemplateEmail({ ...BASE_INPUT, category: "WEAK_MARKETING" });
    const shortened = generateTemplateEmail({ ...BASE_INPUT, category: "WEAK_MARKETING", maxLength: 400 });

    expect(shortened.body.length).toBeLessThan(full.body.length);
    expect(shortened.body.length).toBeLessThanOrEqual(400);
    expect(shortened.body).toContain(BASE_INPUT.unsubscribeUrl);
    expect(shortened.body).toContain(BASE_INPUT.senderName);
  });
});

describe("generateFollowupEmail", () => {
  const original = { subject: "Quick note about Acme Roofing's website", body: "original body" };
  const senderName = "Jane from Lead Gen";
  const unsubscribeUrl = "https://app.example.com/unsubscribe/abc123";

  it("prefixes the subject with Re: and includes sender identity and unsubscribe link", () => {
    const followup = generateFollowupEmail(original, senderName, unsubscribeUrl);
    expect(followup.subject).toBe("Re: Quick note about Acme Roofing's website");
    expect(followup.body).toContain(senderName);
    expect(followup.body).toContain(unsubscribeUrl);
  });

  it("doesn't double-prefix a subject that already starts with Re:", () => {
    const followup = generateFollowupEmail({ ...original, subject: "Re: already replied" }, senderName, unsubscribeUrl);
    expect(followup.subject).toBe("Re: already replied");
  });

  it("never invents a new claim about the business", () => {
    const followup = generateFollowupEmail(original, senderName, unsubscribeUrl);
    expect(followup.body).not.toContain("website");
  });
});
