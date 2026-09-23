import type { ProspectCategory } from "@prisma/client";
import { renderEmail } from "./render";

export interface EmailGenerationInput {
  businessName: string;
  industry: string;
  category: ProspectCategory;
  maxLength: number;
  senderName: string;
  unsubscribeUrl: string;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

// One phrase per category, each grounded in exactly what scoreBusiness
// observed — never a specific claim beyond what was actually checked.
const CATEGORY_ISSUE_TEXT: Partial<Record<ProspectCategory, string>> = {
  BROKEN:
    "I noticed your website isn't loading correctly right now, so potential customers may be landing on a broken page.",
  POOR_OUTDATED:
    "I noticed a few things on your website that look outdated, which can make it harder for new customers to trust they're reaching an active business.",
  WEAK_MARKETING:
    "Your website is up and running, but it's light on the kind of service details and calls-to-action that turn visitors into booked jobs.",
  GOOD: "Your website already looks solid.",
  NO_WEBSITE:
    "I couldn't find a website for your business, which means you may be missing customers who search online first.",
};
const DEFAULT_ISSUE_TEXT = "I came across your business while researching local providers.";

const INDUSTRY_COPY: Record<string, { plural: string; jobs: string }> = {
  roofing: { plural: "roofing companies", jobs: "roofing jobs" },
  masonry: { plural: "masonry contractors", jobs: "masonry jobs" },
  paving: { plural: "paving contractors", jobs: "paving jobs" },
  hvac: { plural: "HVAC companies", jobs: "HVAC service calls" },
};
const DEFAULT_INDUSTRY_COPY = { plural: "local service businesses", jobs: "jobs" };

/** The template-only (no AI) email generator — the MVP's default and
 * always-available path per the brief ("must also work without paid AI"). */
export function generateTemplateEmail(input: EmailGenerationInput): GeneratedEmail {
  const industryCopy = INDUSTRY_COPY[input.industry.toLowerCase()] ?? DEFAULT_INDUSTRY_COPY;
  const issueText = CATEGORY_ISSUE_TEXT[input.category] ?? DEFAULT_ISSUE_TEXT;

  const subject = `Quick note about ${input.businessName}'s website`;

  const greeting = `Hi ${input.businessName} team,`;
  const issue = `I came across ${input.businessName} while looking at ${industryCopy.plural} in the area. ${issueText}`;
  const valueProp = `We help ${industryCopy.plural} turn website visitors into booked ${industryCopy.jobs} — happy to share a couple of quick, no-obligation ideas if that's useful.`;
  const signature = input.senderName;
  const footer = `You're receiving this because ${input.businessName} appeared in a public business search. Reply "unsubscribe" at any time, or use this link: ${input.unsubscribeUrl}`;

  const body = renderEmail({ greeting, issue, valueProp, signature, footer }, input.maxLength);

  return { subject, body };
}
