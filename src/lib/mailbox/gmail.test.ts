import { describe, expect, it } from "vitest";
import { buildRawMessage } from "./gmail";

function decodeRaw(raw: string): string {
  const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

describe("buildRawMessage", () => {
  it("includes To/From/Subject headers and the body", () => {
    const raw = buildRawMessage({
      to: "prospect@acmeroofing.biz",
      subject: "Quick note about Acme Roofing's website",
      body: "Hi there,\n\nThanks for reading.",
      fromName: "Jane at Lead Gen",
      fromEmail: "jane@leadgen.example",
    });

    const decoded = decodeRaw(raw);
    expect(decoded).toContain("To: prospect@acmeroofing.biz");
    expect(decoded).toContain("From: Jane at Lead Gen <jane@leadgen.example>");
    expect(decoded).toContain("Subject: Quick note about Acme Roofing's website");
    expect(decoded).toContain("Thanks for reading.");
  });

  it("produces base64url output with no +, / or padding", () => {
    const raw = buildRawMessage({
      to: "a@b.com",
      subject: "Subject",
      body: "Body",
      fromName: "Sender",
      fromEmail: "sender@example.com",
    });

    expect(raw).not.toMatch(/[+/=]/);
  });

  it("RFC-2047 encodes a non-ASCII subject", () => {
    const raw = buildRawMessage({
      to: "a@b.com",
      subject: "Café update",
      body: "Body",
      fromName: "Sender",
      fromEmail: "sender@example.com",
    });

    const decoded = decodeRaw(raw);
    expect(decoded).toMatch(/Subject: =\?UTF-8\?B\?/);
  });
});
