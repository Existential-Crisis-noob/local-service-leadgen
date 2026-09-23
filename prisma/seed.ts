import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim();

  if (!email || !password || !name) {
    console.log(
      "No seed data created. Set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create a real local administrator account."
    );
    return;
  }

  if (password.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash },
    update: { name, passwordHash },
  });

  const membership = await prisma.workspaceMember.findFirst({ where: { userId: user.id } });
  if (!membership) {
    await prisma.workspace.create({
      data: {
        name: `${name}'s Workspace`,
        members: { create: { userId: user.id, role: "OWNER" } },
      },
    });
  }

  console.log(`Created local administrator account for ${email}. No campaigns or businesses were fabricated.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
