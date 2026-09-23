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
    value: "CANADA_ONE",
    label: "CanadaOne business directory",
    description:
      "Searches CanadaOne's public Canadian directory through a dedicated, rate-limited connector. Province code required.",
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
] as const;
