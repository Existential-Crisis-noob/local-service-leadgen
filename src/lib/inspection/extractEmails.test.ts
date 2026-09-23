import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { extractEmailsFromPage } from "./extractEmails";

describe("extractEmailsFromPage", () => {
  it("finds a mailto link", () => {
    const $ = load('<a href="mailto:info@acmeroofing.biz">Email us</a>');
    const found = extractEmailsFromPage($, "https://acmeroofing.biz/contact");
    expect(found).toEqual([{ email: "info@acmeroofing.biz", sourcePageUrl: "https://acmeroofing.biz/contact" }]);
  });

  it("finds a plain-text email in body copy", () => {
    const $ = load("<body>Reach us at sales@acmeroofing.biz any time.</body>");
    const found = extractEmailsFromPage($, "https://acmeroofing.biz/");
    expect(found.map((f) => f.email)).toEqual(["sales@acmeroofing.biz"]);
  });

  it("strips a mailto query string like ?subject=", () => {
    const $ = load('<a href="mailto:info@acmeroofing.biz?subject=Quote">Email us</a>');
    const found = extractEmailsFromPage($, "https://acmeroofing.biz/");
    expect(found[0].email).toBe("info@acmeroofing.biz");
  });

  it("excludes placeholder/tracking domains", () => {
    const $ = load("<body>test@example.com and noreply@sentry.io</body>");
    const found = extractEmailsFromPage($, "https://acme.biz/");
    expect(found).toHaveLength(0);
  });

  it("excludes image-filename false positives like logo@2x.png", () => {
    const $ = load('<img src="logo@2x.png" alt="">');
    const found = extractEmailsFromPage($, "https://acme.biz/");
    expect(found).toHaveLength(0);
  });

  it("deduplicates the same address found via mailto and body text", () => {
    const $ = load('<a href="mailto:info@acmeroofing.biz">Email</a><p>info@acmeroofing.biz</p>');
    const found = extractEmailsFromPage($, "https://acmeroofing.biz/");
    expect(found).toHaveLength(1);
  });
});
