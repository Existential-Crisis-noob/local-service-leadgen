import type { ConnectorType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CandidateBusiness } from "@/lib/sources/types";
import { scoreBusiness } from "@/lib/scoring/score";
import { generateDraftForBusiness } from "@/lib/email/generateDraftForBusiness";
import { computeDedupeKey } from "./dedupe";

export interface PersistResult {
  created: number;
  duplicates: number;
}

/**
 * Inserts candidate businesses for a campaign, deduplicated per workspace.
 * A duplicate (same dedupeKey already in the workspace) is skipped, not
 * merged — the first-seen record keeps its original source/collected-at.
 */
export async function persistCandidates(
  workspaceId: string,
  campaignId: string,
  connectorType: ConnectorType,
  candidates: CandidateBusiness[]
): Promise<PersistResult> {
  let created = 0;
  let duplicates = 0;

  for (const candidate of candidates) {
    const dedupeKey = computeDedupeKey(candidate);

    const existing = await prisma.business.findUnique({
      where: { workspaceId_dedupeKey: { workspaceId, dedupeKey } },
    });

    if (existing) {
      duplicates += 1;
      continue;
    }

    const hasWebsite = Boolean(candidate.websiteUrl);
    const hasEmail = Boolean(candidate.email);

    const business = await prisma.business.create({
      data: {
        workspaceId,
        campaignId,
        name: candidate.name,
        phone: candidate.phone,
        address: candidate.address,
        city: candidate.city,
        region: candidate.region,
        postalCode: candidate.postalCode,
        lat: candidate.lat,
        lon: candidate.lon,
        category: candidate.category,
        sourceConnector: connectorType,
        sourceUrl: candidate.sourceUrl,
        dedupeKey,
        websites: hasWebsite
          ? { create: { url: candidate.websiteUrl!, discoveredVia: connectorType } }
          : undefined,
        contacts: hasEmail
          ? { create: { email: candidate.email!, sourcePageUrl: candidate.sourceUrl ?? connectorType } }
          : undefined,
        // Businesses with no website can be scored immediately (brief:
        // "No website: strong sales prospect"); businesses with a website
        // are scored once inspection finishes (see inspectWebsite job).
        score: hasWebsite
          ? undefined
          : { create: scoreBusiness({ hasWebsite: false, hasPublicEmail: hasEmail }) },
      },
    });
    created += 1;

    if (!hasWebsite && hasEmail) {
      await generateDraftForBusiness(business.id);
    }
  }

  return { created, duplicates };
}
