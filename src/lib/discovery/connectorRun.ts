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

export function finishConnectorRun(
  runId: string,
  data: { candidateCount: number; errorMessage?: string }
) {
  return prisma.sourceConnectorRun.update({
    where: { id: runId },
    data: {
      finishedAt: new Date(),
      candidateCount: data.candidateCount,
      errorMessage: data.errorMessage,
    },
  });
}
