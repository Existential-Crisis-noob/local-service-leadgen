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
    include: { business: { include: { contacts: true } } },
  });
  if (!website) return;

  const result = await assessWebsite(website.url);

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

  const { category, score, reasons } = scoreBusiness({
    hasWebsite: true,
    hasPublicEmail,
    assessment: result,
  });

  await prisma.prospectScore.upsert({
    where: { businessId: website.businessId },
    create: { businessId: website.businessId, category, score, reasons },
    update: { category, score, reasons, scoredAt: new Date() },
  });

  if (hasPublicEmail) {
    await generateDraftForBusiness(website.businessId);
  }
}
