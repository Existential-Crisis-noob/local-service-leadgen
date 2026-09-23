import { prisma } from "@/lib/prisma";
import { assessWebsite } from "@/lib/inspection/assess";
import { scoreBusiness } from "@/lib/scoring/score";

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

  const { category, score, reasons } = scoreBusiness({
    hasWebsite: true,
    hasPublicEmail: website.business.contacts.length > 0,
    assessment: result,
  });

  await prisma.prospectScore.upsert({
    where: { businessId: website.businessId },
    create: { businessId: website.businessId, category, score, reasons },
    update: { category, score, reasons, scoredAt: new Date() },
  });
}
