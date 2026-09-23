import { prisma } from "@/lib/prisma";
import { OsmConnector } from "@/lib/sources/osm";
import type { DiscoverParams } from "@/lib/sources/types";
import { persistCandidates } from "@/lib/discovery/persist";
import { startConnectorRun, finishConnectorRun } from "@/lib/discovery/connectorRun";
import { enqueueInspectionForCampaign } from "@/lib/discovery/enqueueInspection";

export interface DiscoverBusinessesPayload {
  campaignId: string;
}

export async function discoverBusinesses(payload: DiscoverBusinessesPayload) {
  const campaign = await prisma.campaign.findUnique({ where: { id: payload.campaignId } });
  if (!campaign) return;

  const params: DiscoverParams = {
    city: campaign.city,
    region: campaign.region,
    postalCode: campaign.postalCode,
    countryCode: campaign.countryCode,
    radiusKm: campaign.radiusKm,
    industryKeywords: campaign.industryKeywords,
    desiredCount: campaign.desiredProspectCount,
  };

  const run = await startConnectorRun(campaign.id, campaign.connectorType, { ...params });

  try {
    if (campaign.connectorType !== "OSM") {
      throw new Error(`Automated discovery isn't implemented for ${campaign.connectorType} yet.`);
    }

    const connector = new OsmConnector();
    const candidates = await connector.discover(params);
    const { created } = await persistCandidates(
      campaign.workspaceId,
      campaign.id,
      campaign.connectorType,
      candidates
    );

    await finishConnectorRun(run.id, { candidateCount: created });
    await enqueueInspectionForCampaign(campaign.id);

    if (campaign.status === "DRAFT") {
      await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "ACTIVE" } });
    }
  } catch (error) {
    await finishConnectorRun(run.id, {
      candidateCount: 0,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
