import { auth } from "@/auth";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";

export default async function SuppressedPage() {
  const session = await auth();
  const workspaceId = await getCurrentWorkspaceId(session!.user.id);

  const suppressions = await prisma.unsubscribe.findMany({
    orderBy: { requestedAt: "desc" },
    take: 200,
  });

  const contacts = await prisma.businessContact.findMany({
    where: { email: { in: suppressions.map((s) => s.email) }, business: { workspaceId } },
    include: { business: true },
  });
  const businessByEmail = new Map(contacts.map((c) => [c.email, c.business.name]));

  return (
    <div>
      <h1>Unsubscribed / Suppressed</h1>
      <p className="subtitle">
        Addresses permanently excluded from all future sends (initial emails, follow-ups, and
        campaigns across workspaces).
      </p>

      {suppressions.length === 0 ? (
        <p className="empty-state">No suppressions yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Business (this workspace)</th>
              <th>Reason</th>
              <th>Requested</th>
            </tr>
          </thead>
          <tbody>
            {suppressions.map((s) => (
              <tr key={s.id}>
                <td>{s.email}</td>
                <td>{businessByEmail.get(s.email) ?? "—"}</td>
                <td>{s.reason ?? "—"}</td>
                <td>{s.requestedAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
