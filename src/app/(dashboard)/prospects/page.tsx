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
      include: { websites: true },
      orderBy: { collectedAt: "desc" },
      take: 200,
    }),
    campaignId ? prisma.campaign.findUnique({ where: { id: campaignId } }) : null,
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
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Website</th>
              <th>Phone</th>
              <th>Location</th>
              <th>Source</th>
              <th>Collected</th>
            </tr>
          </thead>
          <tbody>
            {businesses.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
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
                <td>{b.sourceConnector}</td>
                <td>{b.collectedAt.toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
