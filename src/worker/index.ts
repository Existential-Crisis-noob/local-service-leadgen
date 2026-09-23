import { startBoss, QUEUES } from "@/lib/queue/boss";
import { discoverBusinesses, type DiscoverBusinessesPayload } from "./jobs/discoverBusinesses";
import { inspectWebsite, type InspectWebsitePayload } from "./jobs/inspectWebsite";
import { pollReplies } from "./jobs/pollReplies";
import { sendDueFollowups } from "./jobs/sendFollowup";

const POLL_REPLIES_CRON = "*/15 * * * *";
const SEND_FOLLOWUPS_CRON = "*/15 * * * *";

async function main() {
  const boss = await startBoss();
  console.log("[worker] pg-boss started");

  await boss.work<DiscoverBusinessesPayload>(QUEUES.discoverBusinesses, async (jobs) => {
    for (const job of jobs) {
      console.log(`[worker] discover-businesses campaign=${job.data.campaignId}`);
      await discoverBusinesses(job.data);
    }
  });

  await boss.work<InspectWebsitePayload>(QUEUES.inspectWebsite, async (jobs) => {
    for (const job of jobs) {
      console.log(`[worker] inspect-website website=${job.data.websiteId}`);
      await inspectWebsite(job.data);
    }
  });

  await boss.work(QUEUES.pollReplies, async () => {
    console.log("[worker] poll-replies");
    await pollReplies();
  });

  await boss.work(QUEUES.sendFollowup, async () => {
    console.log("[worker] send-followup");
    await sendDueFollowups();
  });

  await boss.schedule(QUEUES.pollReplies, POLL_REPLIES_CRON);
  await boss.schedule(QUEUES.sendFollowup, SEND_FOLLOWUPS_CRON);

  boss.on("error", (err: Error) => console.error("[worker] pg-boss error", err));

  process.on("SIGINT", async () => {
    await boss.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[worker] fatal", err);
  process.exit(1);
});
