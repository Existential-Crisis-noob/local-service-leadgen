import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { getCampaign } from "@/lib/campaigns";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const workspaceId = await getCurrentWorkspaceId(session!.user.id);
  const campaign = await getCampaign(workspaceId, id);

  if (!campaign) notFound();

  const filters = (campaign.websiteQualityFilter ?? {}) as Record<string, boolean>;

  return (
    <div>
      <h1>{campaign.name}</h1>
      <p className="subtitle">
        {campaign.status} · created {campaign.createdAt.toLocaleDateString()}
      </p>

      <dl className="detail-grid">
        <dt>Industries</dt>
        <dd>{campaign.industryKeywords.join(", ") || "—"}</dd>

        <dt>Location</dt>
        <dd>
          {[campaign.city, campaign.region, campaign.postalCode, campaign.countryCode]
            .filter(Boolean)
            .join(", ")}
        </dd>

        <dt>Radius</dt>
        <dd>{campaign.radiusKm} km</dd>

        <dt>Source</dt>
        <dd>{campaign.connectorType}</dd>

        <dt>Desired prospects</dt>
        <dd>{campaign.desiredProspectCount}</dd>

        <dt>Website-quality filters</dt>
        <dd>
          {Object.entries(filters)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(", ") || "None"}
        </dd>

        <dt>Max email length</dt>
        <dd>{campaign.maxEmailLength} characters</dd>

        <dt>Follow-up delay</dt>
        <dd>{campaign.followupDelayHours} hours</dd>

        <dt>Max follow-ups</dt>
        <dd>{campaign.maxFollowups}</dd>
      </dl>

      <p className="empty-state">
        Discovery, scoring and drafting aren&apos;t wired up yet — coming in
        the next phases.
      </p>
    </div>
  );
}
