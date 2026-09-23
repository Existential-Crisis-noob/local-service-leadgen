import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import {
  extractCopyrightYear,
  extractInternalLinks,
  hasContactInfo,
  hasQuoteButton,
  hasViewportMeta,
  isWeakServiceInfo,
} from "./heuristics";

describe("hasViewportMeta", () => {
  it("detects a responsive viewport tag", () => {
    const $ = load('<html><head><meta name="viewport" content="width=device-width"></head></html>');
    expect(hasViewportMeta($)).toBe(true);
  });

  it("returns false when there's no viewport tag", () => {
    const $ = load("<html><head></head></html>");
    expect(hasViewportMeta($)).toBe(false);
  });
});

describe("hasContactInfo", () => {
  it("detects a mailto link", () => {
    const $ = load('<a href="mailto:hi@acme.com">Email us</a>');
    expect(hasContactInfo($)).toBe(true);
  });

  it("detects a phone number in body text", () => {
    const $ = load("<body>Call us at (403) 555-0100</body>");
    expect(hasContactInfo($)).toBe(true);
  });

  it("returns false with no contact signals", () => {
    const $ = load("<body>Welcome to our site</body>");
    expect(hasContactInfo($)).toBe(false);
  });
});

describe("hasQuoteButton", () => {
  it("detects a get-a-quote CTA", () => {
    const $ = load("<button>Get a Free Quote</button>");
    expect(hasQuoteButton($)).toBe(true);
  });

  it("returns false with no CTA", () => {
    const $ = load("<button>Learn more</button>");
    expect(hasQuoteButton($)).toBe(false);
  });
});

describe("extractCopyrightYear", () => {
  it("extracts the year from a footer copyright notice", () => {
    const $ = load("<footer>© 2019 Acme Roofing</footer>");
    expect(extractCopyrightYear($)).toBe(2019);
  });

  it("returns the end year of a copyright range", () => {
    const $ = load("<footer>© 2018-2021 Acme Roofing</footer>");
    expect(extractCopyrightYear($)).toBe(2021);
  });

  it("returns the latest year across multiple copyright mentions", () => {
    const $ = load("<footer>© 2018 Acme Roofing. Copyright 2021 Acme Roofing Inc.</footer>");
    expect(extractCopyrightYear($)).toBe(2021);
  });

  it("returns null when there's no copyright notice", () => {
    const $ = load("<footer>Acme Roofing</footer>");
    expect(extractCopyrightYear($)).toBeNull();
  });
});

describe("isWeakServiceInfo", () => {
  it("flags a page with very little text", () => {
    const $ = load("<body>Acme Roofing. Call us.</body>");
    expect(isWeakServiceInfo($)).toBe(true);
  });

  it("does not flag a page with substantial service content", () => {
    const words = Array.from({ length: 150 }, () => "roofing").join(" ");
    const $ = load(`<body>${words}</body>`);
    expect(isWeakServiceInfo($)).toBe(false);
  });
});

describe("extractInternalLinks", () => {
  it("resolves and dedupes same-hostname links, skipping external ones", () => {
    const $ = load(
      `<a href="/contact">Contact</a>
       <a href="https://acme.example.com/services">Services</a>
       <a href="https://other.example.com">Other</a>
       <a href="/contact">Contact again</a>`
    );
    const links = extractInternalLinks($, "https://acme.example.com/", 5);
    expect(links).toEqual([
      "https://acme.example.com/contact",
      "https://acme.example.com/services",
    ]);
  });

  it("respects the limit", () => {
    const $ = load('<a href="/a">a</a><a href="/b">b</a><a href="/c">c</a>');
    const links = extractInternalLinks($, "https://acme.example.com/", 2);
    expect(links).toHaveLength(2);
  });
});
