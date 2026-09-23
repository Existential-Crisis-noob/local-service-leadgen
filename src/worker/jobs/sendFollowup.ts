import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { sendGmailMessage } from "@/lib/mailbox/gmail";
import { generateFollowupEmail } from "@/lib/email/templateGenerator";
import { countSendsToday } from "@/lib/mailbox/dailySendCount";
import { env } from "@/lib/env";

/**
 * Sends every due, non-canceled follow-up. Re-checks for a reply and for
 * suppression right before sending (either could have happened after the
 * follow-up was scheduled) and respects the mailbox's daily limit —
 * anything skipped for the daily limit is simply retried on the next run.
 */
export async function sendDueFollowups() {
  const due = await prisma.followupSchedule.findMany({
    where: { canceled: false, sentAt: null, scheduledAt: { lte: new Date() } },
    include: {
      sentMessage: {
        include: {
          draft: { include: { business: { include: { contacts: true } } } },
          mailboxConnection: true,
          replies: true,
        },
      },
    },
  });

  for (const schedule of due) {
    const sent = schedule.sentMessage;

    if (sent.replies.length > 0) {
      await prisma.followupSchedule.update({
        where: { id: schedule.id },
        data: { canceled: true, cancelReason: "Reply received" },
      });
      continue;
    }

    const suppression = await prisma.unsubscribe.findUnique({ where: { email: sent.draft.toEmail } });
    if (suppression) {
      await prisma.followupSchedule.update({
        where: { id: schedule.id },
        data: { canceled: true, cancelReason: "Recipient unsubscribed" },
      });
      continue;
    }

    if (sent.mailboxConnection.disconnectedAt) continue;

    const sentToday = await countSendsToday(sent.mailboxConnectionId);
    if (sentToday >= sent.mailboxConnection.dailySendLimit) continue;

    try {
      const contact = sent.draft.business.contacts.find((c) => c.email === sent.draft.toEmail);
      const unsubscribeUrl = `${env.AUTH_URL}/unsubscribe/${contact?.id ?? sent.draft.toEmail}`;

      const followupEmail = generateFollowupEmail(
        { subject: sent.draft.subject, body: sent.draft.body },
        sent.mailboxConnection.emailAddress,
        unsubscribeUrl
      );

      await sendGmailMessage(
        {
          accessToken: decryptToken(sent.mailboxConnection.encryptedAccessToken),
          refreshToken: decryptToken(sent.mailboxConnection.encryptedRefreshToken),
        },
        {
          to: sent.draft.toEmail,
          subject: followupEmail.subject,
          body: followupEmail.body,
          fromName: sent.mailboxConnection.emailAddress,
          fromEmail: sent.mailboxConnection.emailAddress,
        },
        { threadId: sent.gmailThreadId }
      );

      await prisma.followupSchedule.update({ where: { id: schedule.id }, data: { sentAt: new Date() } });
    } catch (error) {
      console.error(`[send-followup] failed for schedule=${schedule.id}`, error);
    }
  }
}
