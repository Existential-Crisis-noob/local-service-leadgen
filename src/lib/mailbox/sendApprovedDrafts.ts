import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { sendGmailMessage } from "./gmail";
import { getActiveMailboxForWorkspace } from "./getWorkspaceMailbox";

export interface SendSummary {
  sent: number;
  skippedNoMailbox: boolean;
  limitReached: boolean;
  errors: string[];
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Sends every APPROVED draft for a workspace through its connected
 * mailbox, up to the mailbox's daily send limit. Stops immediately after
 * a reply/bounce/unsubscribe check would apply (added in later phases);
 * for now, APPROVED status is the only gate. Follow-up scheduling is
 * added once the follow-up scheduler lands.
 */
export async function sendApprovedDraftsForWorkspace(workspaceId: string): Promise<SendSummary> {
  const mailbox = await getActiveMailboxForWorkspace(workspaceId);
  if (!mailbox) {
    return { sent: 0, skippedNoMailbox: true, limitReached: false, errors: [] };
  }

  const sentToday = await prisma.sentMessage.count({
    where: { mailboxConnectionId: mailbox.id, sentAt: { gte: startOfToday() } },
  });

  let remaining = mailbox.dailySendLimit - sentToday;
  if (remaining <= 0) {
    return { sent: 0, skippedNoMailbox: false, limitReached: true, errors: [] };
  }

  const drafts = await prisma.draftEmail.findMany({
    where: { status: "APPROVED", business: { workspaceId } },
    include: { business: true },
    orderBy: { createdAt: "asc" },
    take: remaining,
  });

  const accessToken = decryptToken(mailbox.encryptedAccessToken);
  const refreshToken = decryptToken(mailbox.encryptedRefreshToken);

  const errors: string[] = [];
  let sent = 0;

  for (const draft of drafts) {
    if (remaining <= 0) break;

    try {
      const result = await sendGmailMessage(
        { accessToken, refreshToken },
        {
          to: draft.toEmail,
          subject: draft.subject,
          body: draft.body,
          fromName: mailbox.emailAddress,
          fromEmail: mailbox.emailAddress,
        }
      );

      await prisma.$transaction([
        prisma.sentMessage.create({
          data: {
            draftId: draft.id,
            mailboxConnectionId: mailbox.id,
            gmailThreadId: result.gmailThreadId,
            gmailMessageId: result.gmailMessageId,
          },
        }),
        prisma.draftEmail.update({ where: { id: draft.id }, data: { status: "SENT" } }),
      ]);

      sent += 1;
      remaining -= 1;
    } catch (error) {
      errors.push(`${draft.business.name}: ${error instanceof Error ? error.message : "send failed"}`);
    }
  }

  return { sent, skippedNoMailbox: false, limitReached: remaining <= 0, errors };
}
