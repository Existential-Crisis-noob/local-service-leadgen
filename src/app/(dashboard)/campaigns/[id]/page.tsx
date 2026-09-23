import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { getCampaign } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";
import {
  runOsmDiscoveryAction,
  importCsvAction,
  importUrlsAction,
  rerunInspectionAction,
} from "./actions";

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; queued?: string }>;
}) {
  const { id } = await params;
  const { error, queued } = await searchParams;
  const session = await auth();
  const workspaceId = await getCurrentWorkspaceId(session!.user.id);
  const campaign = await getCampaign(workspaceId, id);

  if (!campaign) notFound();

  const filters = (campaign.websiteQualityFilter ?? {}) as Record<string, boolean>;

  const [businessCount, runs] = await Promise.all([
    prisma.business.count({ where: { campaignId: campaign.id } }),
    prisma.sourceConnectorRun.findMany({
      where: { campaignId: campaign.id },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

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

        <dt>Businesses collected</dt>
        <dd>
          <Link href={`/prospects?campaignId=${campaign.id}`}>{businessCount} businesses</Link>
          {" · "}
          <Link href={`/prospects/qualified?campaignId=${campaign.id}`}>view scored</Link>
        </dd>
      </dl>

      {error && <p className="auth-error">{error}</p>}
      {queued && (
        <p className="empty-state">
          Discovery queued. Make sure <code>npm run worker</code> is running, then refresh this
          page in a bit.
        </p>
      )}

      <h2>Collect prospects</h2>
      {campaign.connectorType === "OSM" && (
        <form action={runOsmDiscoveryAction.bind(null, campaign.id)}>
          <button type="submit" className="btn-primary">
            Run OpenStreetMap discovery
          </button>
        </form>
      )}

      {campaign.connectorType === "CSV_IMPORT" && (
        <form action={importCsvAction} className="form-grid" encType="multipart/form-data">
          <input type="hidden" name="campaignId" value={campaign.id} />
          <label className="field">
            CSV file
            <input type="file" name="csvFile" accept=".csv,text/csv" required />
            <span className="hint">
              Columns recognized: name, phone, address, city, region, postal code, website,
              email, category.
            </span>
          </label>
          <button type="submit" className="btn-primary">
            Import CSV
          </button>
        </form>
      )}

      {campaign.connectorType === "URL_IMPORT" && (
        <form action={importUrlsAction} className="form-grid">
          <input type="hidden" name="campaignId" value={campaign.id} />
          <label className="field">
            Business website URLs (one per line)
            <textarea name="urls" rows={6} placeholder="https://acmeroofing.example.com" />
          </label>
          <button type="submit" className="btn-primary">
            Import URLs
          </button>
        </form>
      )}

      {campaign.connectorType === "GOV_DIRECTORY" && (
        <p className="empty-state">
          No government/contractor-directory dataset is connected yet — this source isn&apos;t
          available in the MVP.
        </p>
      )}

      <form action={rerunInspectionAction.bind(null, campaign.id)}>
        <button type="submit" className="btn-secondary">
          Inspect unassessed websites
        </button>
      </form>

      <h2>Recent connector runs</h2>
      {runs.length === 0 ? (
        <p className="empty-state">No runs yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Started</th>
              <th>Connector</th>
              <th>Collected</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{run.startedAt.toLocaleString()}</td>
                <td>{run.connectorType}</td>
                <td>{run.finishedAt ? run.candidateCount : "running…"}</td>
                <td>{run.errorMessage ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
