import type { ConnectorType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function startConnectorRun(
  campaignId: string,
  connectorType: ConnectorType,
  params: Prisma.InputJsonValue
) {
  return prisma.sourceConnectorRun.create({
    data: { campaignId, connectorType, params },
  });
}

export function updateConnectorRun(
  runId: string,
  data: { stage: string; progress: number; statusMessage: string }
) {
  return prisma.sourceConnectorRun.update({
    where: { id: runId },
    data: {
      stage: data.stage,
      progress: Math.max(0, Math.min(100, Math.round(data.progress))),
      statusMessage: data.statusMessage,
    },
  });
}

export function finishConnectorRun(
  runId: string,
  data: { candidateCount: number; errorMessage?: string }
) {
  return prisma.sourceConnectorRun.update({
    where: { id: runId },
    data: {
      finishedAt: new Date(),
      stage: data.errorMessage ? "failed" : "completed",
      progress: 100,
      statusMessage: data.errorMessage ? "Discovery failed" : "Discovery complete",
      candidateCount: data.candidateCount,
      errorMessage: data.errorMessage,
    },
  });
}
