import { prisma } from "@/lib/prisma";

/** The workspace's connected mailbox — for the MVP, one active Gmail
 * connection per workspace, owned by the workspace's OWNER member. */
export async function getActiveMailboxForWorkspace(workspaceId: string) {
  const owner = await prisma.workspaceMember.findFirst({
    where: { workspaceId, role: "OWNER" },
    orderBy: { createdAt: "asc" },
  });
  if (!owner) return null;

  return prisma.mailboxConnection.findFirst({
    where: { userId: owner.userId, provider: "GMAIL", disconnectedAt: null },
  });
}
