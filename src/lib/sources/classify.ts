export type UrlClassification =
  | { kind: "business_website"; url: string; hostname: string }
  | { kind: "rejected"; url: string; reason: string };

// Domains that require their own licensed/approved connector, or are
// marketplaces, social networks, or map-result pages we do not scrape
// directly (brief: "Unsupported marketplace, social network or map-result
// page: reject it with an explanation").
const REJECTED_DOMAINS: Record<string, string> = {
  "facebook.com": "Facebook is a social network, not a business website — not supported as a direct source.",
  "instagram.com": "Instagram is a social network, not a business website — not supported as a direct source.",
  "twitter.com": "Twitter/X is a social network, not a business website — not supported as a direct source.",
  "x.com": "Twitter/X is a social network, not a business website — not supported as a direct source.",
  "tiktok.com": "TikTok is a social network, not a business website — not supported as a direct source.",
  "pinterest.com": "Pinterest is a social network, not a business website — not supported as a direct source.",
  "linkedin.com": "LinkedIn is a social network, not a business website — not supported as a direct source.",
  "nextdoor.com": "Nextdoor is a social network, not a business website — not supported as a direct source.",
  "reddit.com": "Reddit is a social network — not supported as a lead source.",
  "kijiji.ca": "Kijiji is an unsupported classifieds marketplace.",
  "craigslist.org": "Craigslist is an unsupported classifieds marketplace.",
  "google.com": "Google Maps/Search result pages aren't a direct business source — use the OpenStreetMap connector instead.",
  "maps.google.com": "Google Maps result pages aren't a direct business source — use the OpenStreetMap connector instead.",
  "goo.gl": "Shortened Google Maps links aren't a direct business source — use the OpenStreetMap connector instead.",
  "yelp.com": "Yelp is a licensed-API source; connect the Yelp connector when it's available — direct scraping isn't supported.",
  "angi.com": "Angi is a directory that requires its own approved connector — not supported for direct scraping.",
  "homeadvisor.com": "HomeAdvisor is a directory that requires its own approved connector — not supported for direct scraping.",
  "thumbtack.com": "Thumbtack is a directory that requires its own approved connector — not supported for direct scraping.",
  "houzz.com": "Houzz is a directory that requires its own approved connector — not supported for direct scraping.",
  "yellowpages.com": "Yellow Pages is a directory that requires its own approved connector — not supported for direct scraping.",
  "yellowpages.ca": "Yellow Pages is a directory that requires its own approved connector — not supported for direct scraping.",
  "foursquare.com": "Foursquare is a directory that requires its own approved connector — not supported for direct scraping.",
  "bbb.org": "BBB is a directory that requires its own approved connector — not supported for direct scraping.",
  "apple.com": "Apple Maps is a licensed-API source; connect the Apple Maps connector when it's available.",
  "maps.apple.com": "Apple Maps is a licensed-API source; connect the Apple Maps connector when it's available.",
};

const LOGIN_WALL_DOMAINS = new Set([
  "accounts.google.com",
  "login.microsoftonline.com",
  "login.live.com",
  "appleid.apple.com",
]);

const LOGIN_PATH_PATTERN = /\/(login|signin|sign-in|log-in|account\/login|wp-login\.php)(\/|$)/i;

function stripWww(hostname: string): string {
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

/**
 * Gate every pasted/imported URL through here before it is ever fetched.
 * Rejects known marketplaces/social networks/directories (which need their
 * own approved connector, not scraping) and login-walled pages; anything
 * else is treated as a candidate business website.
 */
export function classifyUrl(rawUrl: string): UrlClassification {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { kind: "rejected", url: rawUrl, reason: "Not a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { kind: "rejected", url: rawUrl, reason: "Only http/https URLs are supported." };
  }

  const hostname = stripWww(parsed.hostname.toLowerCase());

  if (LOGIN_WALL_DOMAINS.has(hostname) || LOGIN_PATH_PATTERN.test(parsed.pathname)) {
    return { kind: "rejected", url: rawUrl, reason: "Login-protected or private page — never scraped." };
  }

  const rejectedReason =
    REJECTED_DOMAINS[hostname] ??
    Object.entries(REJECTED_DOMAINS).find(([domain]) => hostname.endsWith(`.${domain}`))?.[1];

  if (rejectedReason) {
    return { kind: "rejected", url: rawUrl, reason: rejectedReason };
  }

  return { kind: "business_website", url: parsed.toString(), hostname };
}
