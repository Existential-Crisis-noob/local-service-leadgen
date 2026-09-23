import { describe, expect, it } from "vitest";
import { renderEmail, type EmailParts } from "./render";

const PARTS: EmailParts = {
  greeting: "Hi Acme team,",
  issue: "I noticed your website isn't loading correctly right now.",
  valueProp: "We help businesses like yours turn website visitors into booked jobs.",
  signature: "Jane from Lead Gen",
  footer: 'Reply "unsubscribe" or use this link: https://app.example.com/unsubscribe/abc123',
};

describe("renderEmail", () => {
  it("includes every part when there's room", () => {
    const body = renderEmail(PARTS, 2000);
    expect(body).toContain(PARTS.valueProp);
    expect(body).toContain(PARTS.signature);
    expect(body).toContain(PARTS.footer);
  });

  it("drops the value-prop paragraph first when too long", () => {
    const withValueProp = [PARTS.greeting, PARTS.issue, PARTS.valueProp, PARTS.signature, PARTS.footer].join(
      "\n\n"
    );
    const budget = withValueProp.length - 10;

    const body = renderEmail(PARTS, budget);

    expect(body).not.toContain(PARTS.valueProp);
    expect(body).toContain(PARTS.signature);
    expect(body).toContain(PARTS.footer);
  });

  it("never drops the signature or unsubscribe footer even under a tiny budget", () => {
    const body = renderEmail(PARTS, 60);
    expect(body).toContain(PARTS.signature);
    expect(body).toContain(PARTS.footer);
  });
});
