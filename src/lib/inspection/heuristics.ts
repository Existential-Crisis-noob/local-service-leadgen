import type { CheerioAPI } from "cheerio";

export function hasViewportMeta($: CheerioAPI): boolean {
  return $('meta[name="viewport"]').length > 0;
}

const PHONE_PATTERN = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

export function hasContactInfo($: CheerioAPI): boolean {
  if ($('a[href^="mailto:"]').length > 0) return true;
  if ($('a[href^="tel:"]').length > 0) return true;
  if (/\bcontact\b/i.test($("a").text())) return true;
  return PHONE_PATTERN.test($("body").text());
}

const QUOTE_CTA_PATTERN =
  /(get a|request a?|free)\s*(quote|estimate)|request service|schedule (a )?(consultation|appointment)|book now|contact us for a quote/i;

export function hasQuoteButton($: CheerioAPI): boolean {
  return QUOTE_CTA_PATTERN.test($("a, button").text());
}

export function extractCopyrightYear($: CheerioAPI): number | null {
  // Matches "© 2021", "Copyright 2018", and ranges like "© 2018-2024".
  const pattern = /(?:©|copyright)\s*(\d{4})(?:\s*[-–—]\s*(\d{4}))?/gi;
  const text = $("footer").text() || $("body").text();

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
  const text = $("body").text().replace(/\s+/g, " ").trim();
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
