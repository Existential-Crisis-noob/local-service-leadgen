import { describe, expect, it } from "vitest";
import { generateTemplateEmail } from "./templateGenerator";

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
