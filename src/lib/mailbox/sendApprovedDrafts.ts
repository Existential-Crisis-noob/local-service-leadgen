import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { sendGmailMessage } from "./gmail";
import { getActiveMailboxForWorkspace } from "./getWorkspaceMailbox";
import { countSendsToday } from "./dailySendCount";

export interface SendSummary {
  sent: number;
  suppressed: number;
  skippedNoMailbox: boolean;
  limitReached: boolean;
  errors: string[];
}

/**
 * Sends every APPROVED draft for a workspace through its connected
 * mailbox, up to the mailbox's daily send limit. A recipient on the
 * suppression list is never sent to — the draft is rejected instead
 * (brief: "Stop sending immediately after a reply, bounce or
 * unsubscribe"). Schedules the campaign's single follow-up, if configured.
 */
export async function sendApprovedDraftsForWorkspace(workspaceId: string): Promise<SendSummary> {
  const mailbox = await getActiveMailboxForWorkspace(workspaceId);
  if (!mailbox) {
    return { sent: 0, suppressed: 0, skippedNoMailbox: true, limitReached: false, errors: [] };
  }

  const sentToday = await countSendsToday(mailbox.id);

  let remaining = mailbox.dailySendLimit - sentToday;
  if (remaining <= 0) {
    return { sent: 0, suppressed: 0, skippedNoMailbox: false, limitReached: true, errors: [] };
  }

  const drafts = await prisma.draftEmail.findMany({
    where: { status: "APPROVED", business: { workspaceId } },
    include: { business: true, campaign: true },
    orderBy: { createdAt: "asc" },
    take: remaining,
  });

  const accessToken = decryptToken(mailbox.encryptedAccessToken);
  const refreshToken = decryptToken(mailbox.encryptedRefreshToken);

  const errors: string[] = [];
  let sent = 0;
  let suppressed = 0;

  for (const draft of drafts) {
    if (remaining <= 0) break;

    const suppression = await prisma.unsubscribe.findUnique({ where: { email: draft.toEmail } });
    if (suppression) {
      await prisma.draftEmail.update({ where: { id: draft.id }, data: { status: "REJECTED" } });
      suppressed += 1;
      continue;
    }

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

      const [sentMessage] = await prisma.$transaction([
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

      if (draft.campaign.maxFollowups >= 1) {
        await prisma.followupSchedule.create({
          data: {
            sentMessageId: sentMessage.id,
            scheduledAt: new Date(Date.now() + draft.campaign.followupDelayHours * 60 * 60 * 1000),
          },
        });
      }

      sent += 1;
      remaining -= 1;
    } catch (error) {
      errors.push(`${draft.business.name}: ${error instanceof Error ? error.message : "send failed"}`);
    }
  }

  return { sent, suppressed, skippedNoMailbox: false, limitReached: remaining <= 0, errors };
}
