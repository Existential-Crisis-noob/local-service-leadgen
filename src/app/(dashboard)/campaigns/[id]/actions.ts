"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { startBoss, QUEUES } from "@/lib/queue/boss";
import { parseCsvBusinesses } from "@/lib/sources/csv";
import { buildCandidatesFromUrls } from "@/lib/sources/urlImport";
import { persistCandidates } from "@/lib/discovery/persist";
import { startConnectorRun, finishConnectorRun } from "@/lib/discovery/connectorRun";
import { enqueueInspectionForCampaign } from "@/lib/discovery/enqueueInspection";

async function requireCampaign(campaignId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const workspaceId = await getCurrentWorkspaceId(session.user.id);
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, workspaceId } });
  if (!campaign) redirect("/campaigns");

  return campaign;
}

function summarizeErrors(errors: string[]): string | undefined {
  if (errors.length === 0) return undefined;
  const shown = errors.slice(0, 5).join(" | ");
  return errors.length > 5 ? `${shown} | …and ${errors.length - 5} more` : shown;
}

export async function runOsmDiscoveryAction(campaignId: string) {
  const campaign = await requireCampaign(campaignId);
  if (campaign.connectorType !== "OSM") {
    redirect(
      `/campaigns/${campaignId}?error=${encodeURIComponent("This source is imported from the campaign page instead.")}`
    );
  }

  const activeRun = await prisma.sourceConnectorRun.findFirst({
    where: { campaignId, finishedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (activeRun) redirect(`/campaigns/${campaignId}?queued=already`);

  const run = await startConnectorRun(campaign.id, campaign.connectorType, {
    city: campaign.city,
    region: campaign.region,
    postalCode: campaign.postalCode,
    countryCode: campaign.countryCode,
    radiusKm: campaign.radiusKm,
    industryKeywords: campaign.industryKeywords,
    desiredCount: campaign.desiredProspectCount,
  });

  const boss = await startBoss();
  try {
    await boss.send(QUEUES.discoverBusinesses, { campaignId, runId: run.id });
  } catch (error) {
    await finishConnectorRun(run.id, {
      candidateCount: 0,
      errorMessage: error instanceof Error ? error.message : "Could not queue discovery",
    });
    redirect(
      `/campaigns/${campaignId}?error=${encodeURIComponent("Could not queue discovery. Check the worker and try again.")}`
    );
  }

  redirect(`/campaigns/${campaignId}?queued=1`);
}

export async function rerunInspectionAction(campaignId: string) {
  await requireCampaign(campaignId);
  const count = await enqueueInspectionForCampaign(campaignId);
  redirect(`/campaigns/${campaignId}?queued=${count}`);
}

export async function importCsvAction(formData: FormData) {
  const campaignId = String(formData.get("campaignId"));
  const campaign = await requireCampaign(campaignId);

  const file = formData.get("csvFile");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/campaigns/${campaignId}?error=${encodeURIComponent("Choose a CSV file to import.")}`);
  }

  const text = await file.text();
  const { candidates, errors } = parseCsvBusinesses(text);

  const run = await startConnectorRun(campaignId, "CSV_IMPORT", { fileName: file.name });
  const { created } = await persistCandidates(campaign.workspaceId, campaignId, "CSV_IMPORT", candidates);
  await finishConnectorRun(run.id, { candidateCount: created, errorMessage: summarizeErrors(errors) });
  await enqueueInspectionForCampaign(campaignId);

  redirect(`/campaigns/${campaignId}`);
}

export async function importUrlsAction(formData: FormData) {
  const campaignId = String(formData.get("campaignId"));
  const campaign = await requireCampaign(campaignId);

  const raw = String(formData.get("urls") ?? "");
  const urls = raw.split(/\r?\n/);

  const { candidates, rejected } = buildCandidatesFromUrls(urls);

  const run = await startConnectorRun(campaignId, "URL_IMPORT", { count: urls.length });
  const { created } = await persistCandidates(campaign.workspaceId, campaignId, "URL_IMPORT", candidates);
  await finishConnectorRun(run.id, {
    candidateCount: created,
    errorMessage: summarizeErrors(rejected.map((r) => `${r.url}: ${r.reason}`)),
  });
  await enqueueInspectionForCampaign(campaignId);

  redirect(`/campaigns/${campaignId}`);
}
