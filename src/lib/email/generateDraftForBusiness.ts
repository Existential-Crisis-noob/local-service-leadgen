import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { getWorkspaceOwnerName } from "@/lib/workspace";
import { getDraftGenerationProvider } from "@/lib/ai/provider";

/**
 * Prepares a draft outreach email for a business, gated strictly on having
 * a discovered public email (brief: "No public business email: do not
 * guess or automatically send"). Safe to call more than once — it's a
 * no-op if a draft already exists for this business/campaign.
 */
export async function generateDraftForBusiness(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { score: true, contacts: true, websites: true, campaign: true },
  });

  if (!business || !business.campaign || !business.score?.qualified) return null;

  const contact = business.contacts[0];
  if (!contact) return null;

  const suppressed = await prisma.unsubscribe.findUnique({ where: { email: contact.email } });
  if (suppressed) return null;

  const existing = await prisma.draftEmail.findFirst({
    where: { businessId, campaignId: business.campaign.id },
  });
  if (existing) return existing;

  const industry = business.campaign.industryKeywords[0] ?? business.category ?? "local service";
  const senderName = await getWorkspaceOwnerName(business.workspaceId);
  const unsubscribeUrl = `${env.AUTH_URL}/unsubscribe/${contact.id}`;

  const generated = await getDraftGenerationProvider().generate({
    businessName: business.name,
    industry,
    category: business.score.category,
    maxLength: business.campaign.maxEmailLength,
    senderName,
    unsubscribeUrl,
  });

  return prisma.draftEmail.create({
    data: {
      businessId,
      campaignId: business.campaign.id,
      toEmail: contact.email,
      subject: generated.subject,
      body: generated.body,
      observedIssues: business.score.reasons,
    },
  });
}
