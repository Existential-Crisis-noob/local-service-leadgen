import { prisma } from "@/lib/prisma";

export function listCampaigns(workspaceId: string) {
  return prisma.campaign.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
}

export function getCampaign(workspaceId: string, id: string) {
  return prisma.campaign.findFirst({ where: { workspaceId, id } });
}

export const INDUSTRY_OPTIONS = ["roofing", "masonry", "paving", "hvac"] as const;

export const CONNECTOR_OPTIONS = [
  {
    value: "OSM",
    label: "OpenStreetMap / open business data",
    description: "Geocodes your location and pulls tagged businesses from OpenStreetMap. No API key needed.",
  },
  {
    value: "CSV_IMPORT",
    label: "CSV import",
    description: "Upload a spreadsheet of businesses you've already collected.",
  },
  {
    value: "URL_IMPORT",
    label: "Business website URLs",
    description: "Paste specific business website URLs to inspect directly.",
  },
  {
    value: "GOV_DIRECTORY",
    label: "Government / contractor directory",
    description: "Coming soon — will connect once an open contractor-license dataset is wired up.",
  },
] as const;
