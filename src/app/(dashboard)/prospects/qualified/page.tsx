import Link from "next/link";
import { auth } from "@/auth";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";

const CATEGORY_LABELS: Record<string, string> = {
  NO_WEBSITE: "No website",
  BROKEN: "Broken website",
  POOR_OUTDATED: "Poor / outdated website",
  WEAK_MARKETING: "Weak marketing (flyer-kit)",
  GOOD: "Good website (low priority)",
  NO_PUBLIC_EMAIL: "No public email",
};

export default async function QualifiedProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ campaignId?: string }>;
}) {
  const { campaignId } = await searchParams;
  const session = await auth();
  const workspaceId = await getCurrentWorkspaceId(session!.user.id);

  const businesses = await prisma.business.findMany({
    where: {
      workspaceId,
      score: { qualified: true },
      ...(campaignId ? { campaignId } : {}),
    },
    include: {
      score: true,
      websites: { include: { assessment: true } },
      contacts: true,
    },
    orderBy: { score: { score: "desc" } },
    take: 200,
  });

  return (
    <div>
      <h1>Qualified Prospects</h1>
      <p className="subtitle">
        Scored prospects with the evidence behind each score.
        {campaignId && (
          <>
            {" "}
            · <Link href="/prospects/qualified">clear filter</Link>
          </>
        )}
      </p>

      {businesses.length === 0 ? (
        <p className="empty-state">
          No scored prospects yet — scoring runs automatically after discovery/import (no
          website) or after website inspection finishes.
        </p>
      ) : (
        <div className="prospect-list">
          {businesses.map((b) => (
            <details key={b.id} className="prospect-card">
              <summary>
                <span className="prospect-name">{b.name}</span>
                <span className="prospect-category">{CATEGORY_LABELS[b.score!.category] ?? b.score!.category}</span>
                <span className="prospect-score">score {b.score!.score}</span>
              </summary>
              <ul className="reasons">
                {b.score!.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
              <p className="hint">
                Source: {b.sourceConnector}
                {b.sourceUrl && (
                  <>
                    {" · "}
                    <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer">
                      view source record
                    </a>
                  </>
                )} · collected{" "}
                {b.collectedAt.toLocaleDateString()}
              </p>
              {b.websites[0]?.url && (
                <p className="hint">
                  Website:{" "}
                  <a href={b.websites[0].url} target="_blank" rel="noopener noreferrer">
                    {b.websites[0].url}
                  </a>
                </p>
              )}
              {b.contacts[0]?.email && <p className="hint">Contact: {b.contacts[0].email}</p>}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
