"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { INDUSTRY_OPTIONS } from "@/lib/campaigns";
import { logActivity } from "@/lib/activityLog";

const campaignSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  industries: z.array(z.enum(INDUSTRY_OPTIONS)),
  otherKeywords: z.string().optional(),
  city: z.string().min(1, "City is required"),
  region: z.string().optional(),
  postalCode: z.string().optional(),
  countryCode: z.string().min(2).max(2),
  radiusKm: z.coerce.number().positive().max(500),
  connectorType: z.enum(["OSM", "CSV_IMPORT", "URL_IMPORT", "GOV_DIRECTORY"]),
  desiredProspectCount: z.coerce.number().int().positive().max(1000),
  maxEmailLength: z.coerce.number().int().positive().max(3000),
  followupDelayHours: z.coerce.number().int().positive().max(720),
  maxFollowups: z.coerce.number().int().min(0).max(1),
});

export async function createCampaignAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const parsed = campaignSchema.safeParse({
    name: formData.get("name"),
    industries: formData.getAll("industries").map(String),
    otherKeywords: formData.get("otherKeywords") ?? undefined,
    city: formData.get("city"),
    region: formData.get("region") || undefined,
    postalCode: formData.get("postalCode") || undefined,
    countryCode: formData.get("countryCode") || "CA",
    radiusKm: formData.get("radiusKm"),
    connectorType: formData.get("connectorType"),
    desiredProspectCount: formData.get("desiredProspectCount"),
    maxEmailLength: formData.get("maxEmailLength"),
    followupDelayHours: formData.get("followupDelayHours"),
    maxFollowups: formData.get("maxFollowups"),
  });

  if (!parsed.success) {
    redirect(`/campaigns/new?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }

  const data = parsed.data;
  const extraKeywords = (data.otherKeywords ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const industryKeywords = Array.from(new Set([...data.industries, ...extraKeywords]));
  if (industryKeywords.length === 0) {
    redirect(
      `/campaigns/new?error=${encodeURIComponent("Enter at least one industry or service keyword.")}`
    );
  }
  const workspaceId = await getCurrentWorkspaceId(session.user.id);

  const campaign = await prisma.campaign.create({
    data: {
      workspaceId,
      name: data.name,
      industryKeywords,
      city: data.city,
      region: data.region,
      postalCode: data.postalCode,
      countryCode: data.countryCode.toUpperCase(),
      radiusKm: data.radiusKm,
      connectorType: data.connectorType,
      connectorConfig: {},
      desiredProspectCount: data.desiredProspectCount,
      websiteQualityFilter: {
        targetNoWebsite: formData.has("targetNoWebsite"),
        targetBroken: formData.has("targetBroken"),
        targetMissingHttps: formData.has("targetMissingHttps"),
        targetNotMobile: formData.has("targetNotMobile"),
        targetMissingContact: formData.has("targetMissingContact"),
        targetMissingQuote: formData.has("targetMissingQuote"),
        targetOutdatedCopyright: formData.has("targetOutdatedCopyright"),
        targetWeakService: formData.has("targetWeakService"),
        targetGoodWebsite: formData.has("targetGoodWebsite"),
      },
      maxEmailLength: data.maxEmailLength,
      followupDelayHours: data.followupDelayHours,
      maxFollowups: data.maxFollowups,
    },
  });

  await logActivity({
    workspaceId,
    actorUserId: session.user.id,
    action: "campaign.created",
    entityType: "Campaign",
    entityId: campaign.id,
    metadata: { name: campaign.name, connectorType: campaign.connectorType },
  });

  redirect(`/campaigns/${campaign.id}`);
}
