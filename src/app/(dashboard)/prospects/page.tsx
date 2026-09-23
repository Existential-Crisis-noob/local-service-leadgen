import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";

export default async function AllProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string }>;
}) {
  const { campaignId } = await searchParams;
  const session = await auth();
  const workspaceId = await getCurrentWorkspaceId(session!.user.id);

  const [businesses, campaign] = await Promise.all([
    prisma.business.findMany({
      where: { workspaceId, ...(campaignId ? { campaignId } : {}) },
      include: { websites: true, score: true, contacts: true },
      orderBy: { collectedAt: "desc" },
      take: 200,
    }),
    campaignId ? prisma.campaign.findFirst({ where: { id: campaignId, workspaceId } }) : null,
  ]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>All Prospects</h1>
          <p className="subtitle">
            {campaign ? (
              <>
                Filtered to <strong>{campaign.name}</strong> ·{" "}
                <Link href="/prospects">clear filter</Link>
              </>
            ) : (
              "Every deduplicated business collected across campaigns."
            )}
          </p>
        </div>
      </div>

      {businesses.length === 0 ? (
        <p className="empty-state">
          No prospects yet. Run discovery or import businesses from a campaign.
        </p>
      ) : (
        <div className="table-wrap"><table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Website</th>
              <th>Phone</th>
              <th>Location</th>
              <th>Source</th>
              <th>Qualification</th>
              <th>Collected</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id}>
                <td><div className="business-cell"><strong>{b.name}</strong><span>{b.category ?? "Service business"}</span></div></td>
                <td>
                  {b.websites[0]?.url ? (
                    <a href={b.websites[0].url} target="_blank" rel="noopener noreferrer">
                      {b.websites[0].url}
                    </a>
                  ) : (
                    <span className="hint">No website</span>
                  )}
                </td>
                <td>{b.phone ?? "—"}</td>
                <td>{[b.city, b.region, b.postalCode].filter(Boolean).join(", ") || "—"}</td>
                <td>
                  {b.sourceUrl ? (
                    <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer">
                      <span className="source-chip">{b.sourceConnector}</span>
                    </a>
                  ) : <span className="source-chip">{b.sourceConnector}</span>}
                </td>
                <td>
                  {b.score ? (
                    <span className={`status-pill ${b.score.qualified ? "active" : ""}`}>
                      {b.score.qualified ? `Qualified · ${b.score.score}` : `Not qualified · ${b.score.score}`}
                    </span>
                  ) : <span className="hint">Inspection pending</span>}
                </td>
                <td>{b.collectedAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
    </div>
  );
}
