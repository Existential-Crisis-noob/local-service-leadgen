import { PgBoss } from "pg-boss";
import { env } from "@/lib/env";

const globalForBoss = globalThis as unknown as { boss?: PgBoss };

export function getBoss(): PgBoss {
  if (!globalForBoss.boss) {
    globalForBoss.boss = new PgBoss(env.DATABASE_URL);
  }
  return globalForBoss.boss;
}

export const QUEUES = {
  discoverBusinesses: "discover-businesses",
  inspectWebsite: "inspect-website",
  findBusinessEmail: "find-business-email",
  generateDraft: "generate-draft",
  sendApprovedEmail: "send-approved-email",
  pollReplies: "poll-replies",
  sendFollowup: "send-followup",
} as const;

let started: Promise<PgBoss> | null = null;

/** Starts (or reuses) the shared pg-boss instance and ensures every known
 * queue exists. Safe to call from any request path or the worker process. */
export async function startBoss(): Promise<PgBoss> {
  if (!started) {
    const boss = getBoss();
    started = boss.start().then(async () => {
      for (const queueName of Object.values(QUEUES)) {
        await boss.createQueue(queueName);
      }
      return boss;
    });
  }
  return started;
}
