import { prisma } from "@/lib/prisma";

export async function ensureWorkspaceForUser(userId: string, ownerName: string) {
  const existing = await prisma.workspaceMember.findFirst({ where: { userId } });
  if (existing) return existing.workspaceId;

  const workspace = await prisma.workspace.create({
    data: {
      name: `${ownerName}'s Workspace`,
      members: { create: { userId, role: "OWNER" } },
    },
  });
  return workspace.id;
}

export async function getCurrentWorkspaceId(userId: string) {
  const member = await prisma.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (member) return member.workspaceId;
  return ensureWorkspaceForUser(userId, "My");
}
