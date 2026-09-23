import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { listCampaigns } from "@/lib/campaigns";

export default async function CampaignsPage() {
  const session = await auth();
  const workspaceId = await getCurrentWorkspaceId(session!.user.id);
  const campaigns = await listCampaigns(workspaceId);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Campaigns</h1>
          <p className="subtitle">
            Create a campaign to start discovering and qualifying prospects.
          </p>
        </div>
        <Link href="/campaigns/new" className="btn-primary">
          New Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <p className="empty-state">No campaigns yet. Create your first one.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Industries</th>
              <th>Location</th>
              <th>Radius</th>
              <th>Source</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/campaigns/${c.id}`}>{c.name}</Link>
                </td>
                <td>{c.status}</td>
                <td>{c.industryKeywords.join(", ")}</td>
                <td>{[c.city, c.region, c.postalCode].filter(Boolean).join(", ")}</td>
                <td>{c.radiusKm} km</td>
                <td>{c.connectorType}</td>
                <td>{c.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
