import type { CheerioAPI } from "cheerio";

export function hasViewportMeta($: CheerioAPI): boolean {
  return $('meta[name="viewport"]').length > 0;
}

/**
 * Cheerio's `.text()` concatenates adjacent elements with no separator
 * (e.g. `<a>Email</a><p>x@y.com</p>` → "Emailx@y.com"), which can merge two
 * unrelated tokens into one bogus match. This joins each text node with a
 * space instead, so word/email/phone boundaries are preserved.
 */
export function getVisibleText($: CheerioAPI, root: string = "body"): string {
  return $(root)
    .find("*")
    .addBack()
    .contents()
    .filter((_, node) => node.type === "text")
    .map((_, node) => $(node).text())
    .get()
    .join(" ");
}

const PHONE_PATTERN = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

export function hasContactInfo($: CheerioAPI): boolean {
  if ($('a[href^="mailto:"]').length > 0) return true;
  if ($('a[href^="tel:"]').length > 0) return true;
  if (/\bcontact\b/i.test(getVisibleText($, "a"))) return true;
  return PHONE_PATTERN.test(getVisibleText($));
}

const QUOTE_CTA_PATTERN =
  /(get a|request a?|free)\s*(quote|estimate)|request service|schedule (a )?(consultation|appointment)|book now|contact us for a quote/i;

export function hasQuoteButton($: CheerioAPI): boolean {
  return QUOTE_CTA_PATTERN.test(getVisibleText($, "a, button"));
}

export function extractCopyrightYear($: CheerioAPI): number | null {
  // Matches "© 2021", "Copyright 2018", and ranges like "© 2018-2024".
  const pattern = /(?:©|copyright)\s*(\d{4})(?:\s*[-–—]\s*(\d{4}))?/gi;
  const footerText = getVisibleText($, "footer");
  const text = footerText || getVisibleText($);

  let match: RegExpExecArray | null;
  let latest: number | null = null;
  while ((match = pattern.exec(text))) {
    for (const group of [match[1], match[2]]) {
      if (!group) continue;
      const year = parseInt(group, 10);
      if (latest === null || year > latest) latest = year;
    }
  }
  return latest;
}

const MIN_SERVICE_WORD_COUNT = 120;

export function isWeakServiceInfo($: CheerioAPI): boolean {
  const text = getVisibleText($).replace(/\s+/g, " ").trim();
  const wordCount = text.length === 0 ? 0 : text.split(" ").length;
  return wordCount < MIN_SERVICE_WORD_COUNT;
}

/** Same-hostname links found on the page, resolved to absolute URLs. */
export function extractInternalLinks($: CheerioAPI, baseUrl: string, limit: number): string[] {
  const base = new URL(baseUrl);
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    if (links.size >= limit) return;
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, base);
      if (resolved.hostname === base.hostname && resolved.href !== base.href) {
        links.add(resolved.href);
      }
    } catch {
      // ignore unparseable hrefs (mailto:, javascript:, etc.)
    }
  });

  return Array.from(links).slice(0, limit);
}
