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

/** The sender identity shown in outreach emails — the workspace owner's
 * name (or email, as a fallback) so recipients see a real person. */
export async function getWorkspaceOwnerName(workspaceId: string): Promise<string> {
  const owner = await prisma.workspaceMember.findFirst({
    where: { workspaceId, role: "OWNER" },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  return owner?.user.name ?? owner?.user.email ?? "The team";
}
