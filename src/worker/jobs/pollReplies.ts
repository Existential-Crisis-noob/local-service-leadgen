import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { getThreadLatestMessage } from "@/lib/mailbox/gmail";
import { isBounceMessage } from "@/lib/mailbox/bounce";

/**
 * Checks every open (no reply yet) sent thread for an inbound message.
 * On a reply: creates a Reply row for human review and cancels any
 * pending follow-up (brief: "If a reply arrives, cancel all future
 * follow-ups"). On a detected bounce: does the same, and additionally
 * suppresses the address going forward.
 */
export async function pollReplies() {
  const openSentMessages = await prisma.sentMessage.findMany({
    where: { replies: { none: {} } },
    include: { mailboxConnection: true, draft: true },
  });

  for (const sent of openSentMessages) {
    if (sent.mailboxConnection.disconnectedAt) continue;

    try {
      const threadInfo = await getThreadLatestMessage(
        {
          accessToken: decryptToken(sent.mailboxConnection.encryptedAccessToken),
          refreshToken: decryptToken(sent.mailboxConnection.encryptedRefreshToken),
        },
        sent.gmailThreadId
      );

      if (!threadInfo.hasReply) continue;

      const bounced = isBounceMessage(threadInfo.fromHeader, threadInfo.subjectHeader);
      const cancelReason = bounced ? "Bounced" : "Reply received";

      await prisma.$transaction([
        prisma.reply.create({
          data: { sentMessageId: sent.id, snippet: threadInfo.snippet },
        }),
        prisma.followupSchedule.updateMany({
          where: { sentMessageId: sent.id, sentAt: null, canceled: false },
          data: { canceled: true, cancelReason },
        }),
      ]);

      if (bounced) {
        await prisma.unsubscribe.upsert({
          where: { email: sent.draft.toEmail },
          create: { email: sent.draft.toEmail, reason: "Bounced" },
          update: {},
        });
      }
    } catch (error) {
      console.error(`[poll-replies] failed for sentMessage=${sent.id}`, error);
    }
  }
}
