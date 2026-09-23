import { prisma } from "@/lib/prisma";
import { assessWebsite } from "@/lib/inspection/assess";
import { scoreBusiness } from "@/lib/scoring/score";
import { generateDraftForBusiness } from "@/lib/email/generateDraftForBusiness";

export interface InspectWebsitePayload {
  websiteId: string;
}

export async function inspectWebsite(payload: InspectWebsitePayload) {
  const website = await prisma.website.findUnique({
    where: { id: payload.websiteId },
    include: { business: { include: { contacts: true, campaign: true } } },
  });
  if (!website) return;

  const result = await assessWebsite(website.url);

  if (result.siteName) {
    try {
      const currentNameIsHostname =
        website.business.name === new URL(website.url).hostname.replace(/^www\./, "");
      if (currentNameIsHostname) {
        await prisma.business.update({
          where: { id: website.businessId },
          data: { name: result.siteName },
        });
      }
    } catch {
      // URL validity is enforced before persistence; leave the collected name unchanged if parsing fails.
    }
  }

  const assessmentData = {
    loads: result.loads,
    httpStatus: result.httpStatus,
    https: result.https,
    mobileResponsive: result.mobileResponsive,
    hasContactInfo: result.hasContactInfo,
    hasQuoteButton: result.hasQuoteButton,
    brokenInternalUrls: result.brokenInternalUrls,
    copyrightYear: result.copyrightYear,
    weakServiceInfo: result.weakServiceInfo,
    lighthousePerformance: result.lighthouse?.performance ?? null,
    lighthouseAccessibility: result.lighthouse?.accessibility ?? null,
    lighthouseBestPractices: result.lighthouse?.bestPractices ?? null,
    lighthouseSeo: result.lighthouse?.seo ?? null,
    evidence: { ...result.evidence },
  };

  await prisma.websiteAssessment.upsert({
    where: { websiteId: website.id },
    create: { websiteId: website.id, ...assessmentData },
    update: { ...assessmentData, assessedAt: new Date() },
  });

  for (const found of result.foundEmails) {
    await prisma.businessContact.upsert({
      where: { businessId_email: { businessId: website.businessId, email: found.email } },
      create: {
        businessId: website.businessId,
        email: found.email,
        sourcePageUrl: found.sourcePageUrl,
      },
      update: {},
    });
  }

  const hasPublicEmail = website.business.contacts.length > 0 || result.foundEmails.length > 0;

  const scored = scoreBusiness({
    hasWebsite: true,
    hasPublicEmail,
    assessment: result,
    qualificationFilter: (website.business.campaign?.websiteQualityFilter ?? null) as Record<
      string,
      boolean
    > | null,
  });

  await prisma.prospectScore.upsert({
    where: { businessId: website.businessId },
    create: {
      businessId: website.businessId,
      category: scored.category,
      score: scored.score,
      qualified: scored.qualified,
      reasons: scored.reasons,
    },
    update: {
      category: scored.category,
      score: scored.score,
      qualified: scored.qualified,
      reasons: scored.reasons,
      scoredAt: new Date(),
    },
  });

  if (hasPublicEmail) {
    await generateDraftForBusiness(website.businessId);
  }
}
