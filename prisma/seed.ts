import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "password123";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: { email: DEMO_EMAIL, name: "Demo User", passwordHash },
    update: {},
  });

  let workspace = await prisma.workspace.findFirst({ where: { members: { some: { userId: user.id } } } });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: { name: "Demo Workspace", members: { create: { userId: user.id, role: "OWNER" } } },
    });
  }

  const campaign = await prisma.campaign.upsert({
    where: { id: "seed-campaign-roofing-calgary" },
    create: {
      id: "seed-campaign-roofing-calgary",
      workspaceId: workspace.id,
      name: "Calgary roofers – demo",
      status: "ACTIVE",
      industryKeywords: ["roofing"],
      city: "Calgary",
      region: "AB",
      countryCode: "CA",
      radiusKm: 30,
      connectorType: "OSM",
      connectorConfig: {},
      desiredProspectCount: 50,
    },
    update: {},
  });

  const business = await prisma.business.upsert({
    where: { workspaceId_dedupeKey: { workspaceId: workspace.id, dedupeKey: "website:acmeroofing.example" } },
    create: {
      workspaceId: workspace.id,
      campaignId: campaign.id,
      name: "Acme Roofing (demo)",
      phone: "403-555-0100",
      city: "Calgary",
      region: "AB",
      sourceConnector: "OSM",
      sourceUrl: "https://www.openstreetmap.org/",
      dedupeKey: "website:acmeroofing.example",
      websites: { create: { url: "https://acmeroofing.example", discoveredVia: "OSM" } },
    },
    update: {},
  });

  await prisma.prospectScore.upsert({
    where: { businessId: business.id },
    create: {
      businessId: business.id,
      category: "POOR_OUTDATED",
      score: 85,
      reasons: [
        "Footer copyright year (2019) is outdated.",
        "Website is not served over HTTPS.",
      ],
    },
    update: {},
  });

  console.log(`Seeded demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
