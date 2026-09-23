import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function logActivity(params: {
  workspaceId: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  return prisma.activityLog.create({
    data: {
      workspaceId: params.workspaceId,
      actorUserId: params.actorUserId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}
