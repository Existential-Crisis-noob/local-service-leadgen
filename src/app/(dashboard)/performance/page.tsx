import { auth } from "@/auth";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";

const CATEGORY_LABELS: Record<string, string> = {
  NO_WEBSITE: "No website",
  BROKEN: "Broken",
  POOR_OUTDATED: "Poor/outdated",
  WEAK_MARKETING: "Weak marketing",
  GOOD: "Good",
  NO_PUBLIC_EMAIL: "No public email",
};

export default async function PerformancePage() {
  const session = await auth();
  const workspaceId = await getCurrentWorkspaceId(session!.user.id);

  const [campaigns, connectorBreakdown] = await Promise.all([
    prisma.campaign.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } }),
    prisma.business.groupBy({
      by: ["sourceConnector"],
      where: { workspaceId },
      _count: { _all: true },
    }),
  ]);

  const campaignStats = await Promise.all(
    campaigns.map(async (campaign) => {
      const [businessCount, scoreBreakdown, draftCount, approvedCount, sentCount, repliesCount, followupsSentCount] =
        await Promise.all([
          prisma.business.count({ where: { campaignId: campaign.id } }),
          prisma.prospectScore.groupBy({
            by: ["category"],
            where: { business: { campaignId: campaign.id } },
            _count: { _all: true },
          }),
          prisma.draftEmail.count({ where: { campaignId: campaign.id } }),
          prisma.draftEmail.count({ where: { campaignId: campaign.id, status: "APPROVED" } }),
          prisma.sentMessage.count({ where: { draft: { campaignId: campaign.id } } }),
          prisma.reply.count({ where: { sentMessage: { draft: { campaignId: campaign.id } } } }),
          prisma.followupSchedule.count({
            where: { sentAt: { not: null }, sentMessage: { draft: { campaignId: campaign.id } } },
          }),
        ]);

      return {
        campaign,
        businessCount,
        scoreBreakdown,
        draftCount,
        approvedCount,
        sentCount,
        repliesCount,
        followupsSentCount,
      };
    })
  );

  return (
    <div>
      <h1>Source &amp; Campaign Performance</h1>
      <p className="subtitle">Aggregate counts by connector and campaign.</p>

      <h2>By source connector</h2>
      {connectorBreakdown.length === 0 ? (
        <p className="empty-state">No businesses collected yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Connector</th>
              <th>Businesses</th>
            </tr>
          </thead>
          <tbody>
            {connectorBreakdown.map((row) => (
              <tr key={row.sourceConnector}>
                <td>{row.sourceConnector}</td>
                <td>{row._count._all}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>By campaign</h2>
      {campaignStats.length === 0 ? (
        <p className="empty-state">No campaigns yet.</p>
      ) : (
        <div className="prospect-list">
          {campaignStats.map((stats) => (
            <div key={stats.campaign.id} className="draft-card">
              <div className="draft-meta">
                <strong>{stats.campaign.name}</strong>
                <span className="hint">{stats.campaign.status}</span>
              </div>
              <dl className="detail-grid">
                <dt>Businesses collected</dt>
                <dd>{stats.businessCount}</dd>

                <dt>Scored</dt>
                <dd>
                  {stats.scoreBreakdown.length === 0
                    ? "—"
                    : stats.scoreBreakdown
                        .map((s) => `${CATEGORY_LABELS[s.category] ?? s.category}: ${s._count._all}`)
                        .join(" · ")}
                </dd>

                <dt>Drafts generated</dt>
                <dd>{stats.draftCount}</dd>

                <dt>Approved (awaiting send)</dt>
                <dd>{stats.approvedCount}</dd>

                <dt>Sent</dt>
                <dd>{stats.sentCount}</dd>

                <dt>Follow-ups sent</dt>
                <dd>{stats.followupsSentCount}</dd>

                <dt>Replies received</dt>
                <dd>{stats.repliesCount}</dd>
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
