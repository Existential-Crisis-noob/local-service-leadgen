import { prisma } from "@/lib/prisma";

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Total messages sent today through this mailbox — initial sends and
 * follow-ups both count against the same daily limit. */
export async function countSendsToday(mailboxConnectionId: string): Promise<number> {
  const today = startOfToday();

  const [initialSends, followupSends] = await Promise.all([
    prisma.sentMessage.count({ where: { mailboxConnectionId, sentAt: { gte: today } } }),
    prisma.followupSchedule.count({
      where: { sentAt: { gte: today }, sentMessage: { mailboxConnectionId } },
    }),
  ]);

  return initialSends + followupSends;
}
