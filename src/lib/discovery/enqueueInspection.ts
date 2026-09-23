import { prisma } from "@/lib/prisma";
import { startBoss, QUEUES } from "@/lib/queue/boss";

/** Queues an inspect-website job for every website in the campaign that
 * hasn't been assessed yet. Safe to call repeatedly. */
export async function enqueueInspectionForCampaign(campaignId: string): Promise<number> {
  const websites = await prisma.website.findMany({
    where: { business: { campaignId }, assessment: null },
    select: { id: true },
  });

  if (websites.length === 0) return 0;

  const boss = await startBoss();
  for (const website of websites) {
    await boss.send(QUEUES.inspectWebsite, { websiteId: website.id });
  }

  return websites.length;
}
