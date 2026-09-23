import { prisma } from "@/lib/prisma";
import { OsmConnector } from "@/lib/sources/osm";
import type { DiscoverParams } from "@/lib/sources/types";
import { persistCandidates } from "@/lib/discovery/persist";
import {
  startConnectorRun,
  finishConnectorRun,
  updateConnectorRun,
} from "@/lib/discovery/connectorRun";
import { enqueueInspectionForCampaign } from "@/lib/discovery/enqueueInspection";

export interface DiscoverBusinessesPayload {
  campaignId: string;
  runId?: string;
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

  const run = payload.runId
    ? await prisma.sourceConnectorRun.findFirst({
        where: { id: payload.runId, campaignId: campaign.id, finishedAt: null },
      })
    : await startConnectorRun(campaign.id, campaign.connectorType, { ...params });
  if (!run) return;

  try {
    if (campaign.connectorType !== "OSM") {
      throw new Error(`Automated discovery isn't implemented for ${campaign.connectorType} yet.`);
    }

    await updateConnectorRun(run.id, {
      stage: "starting",
      progress: 5,
      statusMessage: "Preparing approved source connector",
    });

    const connector = new OsmConnector();
    const candidates = await connector.discover(params, async (update) => {
      await updateConnectorRun(run.id, {
        stage: update.stage,
        progress: update.progress,
        statusMessage: update.message,
      });
    });

    await updateConnectorRun(run.id, {
      stage: "saving",
      progress: 72,
      statusMessage: `Deduplicating and saving ${candidates.length} candidates`,
    });
    const { created, duplicates } = await persistCandidates(
      campaign.workspaceId,
      campaign.id,
      campaign.connectorType,
      candidates
    );

    await updateConnectorRun(run.id, {
      stage: "inspecting",
      progress: 88,
      statusMessage: "Queueing public business websites for inspection",
    });
    const inspectionsQueued = await enqueueInspectionForCampaign(campaign.id);
    await finishConnectorRun(run.id, { candidateCount: created });
    await prisma.sourceConnectorRun.update({
      where: { id: run.id },
      data: {
        statusMessage: `${created} saved, ${duplicates} duplicates skipped, ${inspectionsQueued} inspections queued`,
      },
    });

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
