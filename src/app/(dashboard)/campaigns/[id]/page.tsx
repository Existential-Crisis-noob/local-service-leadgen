import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { getCampaign } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";
import { CampaignRunProgress } from "@/components/campaign-run-progress";
import {
  runOsmDiscoveryAction,
  importCsvAction,
  importUrlsAction,
  rerunInspectionAction,
} from "./actions";

const SOURCE_LABELS: Record<string, string> = {
  OSM: "OpenStreetMap / open data",
  CSV_IMPORT: "CSV import",
  URL_IMPORT: "Business website URLs",
  GOV_DIRECTORY: "Government / contractor dataset",
};

const FILTER_LABELS: Record<string, string> = {
  targetNoWebsite: "No website",
  targetBroken: "Broken website",
  targetMissingHttps: "Missing HTTPS",
  targetNotMobile: "Not mobile responsive",
  targetMissingContact: "Missing contact information",
  targetMissingQuote: "Missing quote action",
  targetOutdatedCopyright: "Outdated copyright",
  targetWeakService: "Weak service content",
  targetGoodWebsite: "Good website",
};

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
  const [businessCount, qualifiedCount, draftCount, websiteCount, unassessedCount, runs] = await Promise.all([
    prisma.business.count({ where: { campaignId: campaign.id } }),
    prisma.business.count({ where: { campaignId: campaign.id, score: { qualified: true } } }),
    prisma.draftEmail.count({
      where: { campaignId: campaign.id, status: { in: ["PENDING", "EDITED"] } },
    }),
    prisma.website.count({ where: { business: { campaignId: campaign.id } } }),
    prisma.website.count({ where: { business: { campaignId: campaign.id }, assessment: null } }),
    prisma.sourceConnectorRun.findMany({
      where: { campaignId: campaign.id },
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
  ]);

  const connectorProgress = runs.slice(0, 1).map((run) => ({
    id: run.id,
    connector: SOURCE_LABELS[run.connectorType] ?? run.connectorType,
    progress: run.progress,
    stage: run.stage,
    message: run.errorMessage ?? run.statusMessage,
    finished: Boolean(run.finishedAt),
    failed: Boolean(run.errorMessage),
  }));
  const inspectionProgress =
    websiteCount > 0
      ? [
          {
            id: "website-inspection",
            connector: "Website assessment",
            progress: Math.round(((websiteCount - unassessedCount) / websiteCount) * 100),
            stage: "inspecting",
            message: `${websiteCount - unassessedCount} of ${websiteCount} public websites assessed`,
            finished: unassessedCount === 0,
            failed: false,
          },
        ]
      : [];
  const recentProgress = [...connectorProgress, ...inspectionProgress];

  const automated = campaign.connectorType === "OSM";

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="eyebrow">{campaign.status} campaign</div>
          <h1>{campaign.name}</h1>
          <p className="subtitle">
            {campaign.industryKeywords.join(", ")} · {campaign.city}
            {campaign.region ? `, ${campaign.region}` : ""} · {campaign.radiusKm} km · {SOURCE_LABELS[campaign.connectorType]}
          </p>
        </div>
        <Link href="/campaigns/new" className="btn-primary">
          New campaign
        </Link>
      </div>

      <section className="metric-grid">
        <div className="metric-card">
          <div className="metric-label">Businesses saved</div>
          <div className="metric-value">{businessCount}</div>
          <div className="metric-foot">Deduplicated in this workspace</div>
        </div>
        <div className="metric-card highlight">
          <div className="metric-label">Qualified prospects</div>
          <div className="metric-value">{qualifiedCount}</div>
          <div className="metric-foot">Match selected website criteria</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Drafts awaiting review</div>
          <div className="metric-value">{draftCount}</div>
          <div className="metric-foot">Nothing sends without approval</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Websites awaiting inspection</div>
          <div className="metric-value">{unassessedCount}</div>
          <div className="metric-foot">Background worker queue</div>
        </div>
      </section>

      {error && <p className="auth-error">{error}</p>}
      {queued && (
        <p className="success-note">
          {queued === "already"
            ? "A discovery run is already active. Progress appears below."
            : "Discovery was queued successfully. Progress appears below and refreshes automatically."}
        </p>
      )}

      <CampaignRunProgress runs={recentProgress} />

      <section className="detail-card">
        <dl className="detail-grid">
          <dt>Search location</dt>
          <dd>{[campaign.city, campaign.region, campaign.postalCode, campaign.countryCode].filter(Boolean).join(", ")}</dd>
          <dt>Approved source</dt>
          <dd>{SOURCE_LABELS[campaign.connectorType] ?? campaign.connectorType}</dd>
          <dt>Prospect target</dt>
          <dd>{campaign.desiredProspectCount}</dd>
          <dt>Qualification conditions</dt>
          <dd>
            {Object.entries(filters)
              .filter(([, enabled]) => enabled)
              .map(([key]) => FILTER_LABELS[key] ?? key)
              .join(" · ") || "None selected"}
          </dd>
          <dt>Email and follow-up</dt>
          <dd>
            {campaign.maxEmailLength} characters · {campaign.followupDelayHours} hour delay · {campaign.maxFollowups} maximum follow-up
          </dd>
          <dt>Prospect database</dt>
          <dd>
            <Link href={`/prospects?campaignId=${campaign.id}`}>View all {businessCount}</Link>
            {" · "}
            <Link href={`/prospects/qualified?campaignId=${campaign.id}`}>View {qualifiedCount} qualified</Link>
          </dd>
        </dl>
      </section>

      <h2>Collect and inspect</h2>
      <div className="campaign-actions">
        {automated && (
          <form action={runOsmDiscoveryAction.bind(null, campaign.id)}>
            <button type="submit" className="btn-primary">
              Run OpenStreetMap discovery
            </button>
          </form>
        )}
        <form action={rerunInspectionAction.bind(null, campaign.id)}>
          <button type="submit" className="btn-secondary">
            Inspect unassessed websites
          </button>
        </form>
      </div>

      {campaign.connectorType === "CSV_IMPORT" && (
        <form action={importCsvAction} className="form-section form-grid" encType="multipart/form-data">
          <input type="hidden" name="campaignId" value={campaign.id} />
          <label className="field">
            CSV file
            <input type="file" name="csvFile" accept=".csv,text/csv" required />
            <span className="hint">
              Recognized columns: name, phone, address, city, region, postal code, website, email and category. Imported email addresses are recorded as supplied by the user.
            </span>
          </label>
          <button type="submit" className="btn-primary">Import CSV</button>
        </form>
      )}

      {campaign.connectorType === "URL_IMPORT" && (
        <form action={importUrlsAction} className="form-section form-grid">
          <input type="hidden" name="campaignId" value={campaign.id} />
          <label className="field">
            Business-owned public website URLs
            <textarea name="urls" rows={7} required />
            <span className="hint">One URL per line. Each URL is classified before any page is inspected.</span>
          </label>
          <button type="submit" className="btn-primary">Classify and import URLs</button>
        </form>
      )}

      {campaign.connectorType === "GOV_DIRECTORY" && (
        <p className="empty-state">
          No government/contractor-directory dataset is connected yet — this source isn&apos;t
          available in the MVP.
        </p>
      )}

      <h2>Connector history</h2>
      {runs.length === 0 ? (
        <p className="empty-state">No discovery or import has run for this campaign yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Connector</th>
                <th>Status</th>
                <th>Saved</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td>{run.startedAt.toLocaleString()}</td>
                  <td><span className="source-chip">{SOURCE_LABELS[run.connectorType] ?? run.connectorType}</span></td>
                  <td>
                    <span className={`status-pill ${run.finishedAt && !run.errorMessage ? "active" : ""}`}>
                      {run.errorMessage ? "Failed" : run.finishedAt ? "Complete" : run.stage}
                    </span>
                  </td>
                  <td>{run.candidateCount}</td>
                  <td>{run.errorMessage ?? run.statusMessage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
