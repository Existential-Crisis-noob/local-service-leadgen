import { startBoss } from "@/lib/queue/boss";

async function main() {
  const boss = await startBoss();
  console.log("[worker] pg-boss started, queues will be registered as phases land");

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
