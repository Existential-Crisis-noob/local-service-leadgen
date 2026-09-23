import { auth } from "@/auth";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { sendApprovedAction, disconnectMailboxAction } from "./actions";

export default async function SentAndFollowupsPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    noMailbox?: string;
    limitReached?: string;
    sendErrors?: string;
    mailboxConnected?: string;
    mailboxError?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const workspaceId = await getCurrentWorkspaceId(session!.user.id);

  const owner = await prisma.workspaceMember.findFirst({
    where: { workspaceId, role: "OWNER" },
    orderBy: { createdAt: "asc" },
  });
  const mailbox = owner
    ? await prisma.mailboxConnection.findFirst({
        where: { userId: owner.userId, provider: "GMAIL", disconnectedAt: null },
      })
    : null;

  const [pendingCount, sentMessages] = await Promise.all([
    prisma.draftEmail.count({ where: { status: "APPROVED", business: { workspaceId } } }),
    prisma.sentMessage.findMany({
      where: { draft: { business: { workspaceId } } },
      include: { draft: { include: { business: true } }, followups: true },
      orderBy: { sentAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div>
      <h1>Sent &amp; Follow-ups</h1>
      <p className="subtitle">Sent messages and their scheduled follow-ups.</p>

      <div className="mailbox-status">
        <strong>Mailbox: </strong>
        {mailbox ? (
          <>
            Connected as {mailbox.emailAddress} (limit {mailbox.dailySendLimit}/day){" "}
            <form action={disconnectMailboxAction} className="inline-form">
              <input type="hidden" name="mailboxId" value={mailbox.id} />
              <button type="submit" className="btn-secondary">
                Disconnect
              </button>
            </form>
          </>
        ) : env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? (
          <a href="/api/mailbox/google/connect" className="btn-primary">
            Connect Gmail
          </a>
        ) : (
          <span className="hint">
            Not connected — set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET to enable Gmail sending.
          </span>
        )}
      </div>

      {params.mailboxConnected && <p className="empty-state">Gmail connected.</p>}
      {params.mailboxError && (
        <p className="auth-error">Couldn&apos;t connect Gmail: {params.mailboxError}</p>
      )}
      {params.sent && Number(params.sent) > 0 && (
        <p className="empty-state">Sent {params.sent} email(s).</p>
      )}
      {params.noMailbox && <p className="auth-error">Connect a Gmail mailbox before sending.</p>}
      {params.limitReached && (
        <p className="empty-state">Daily send limit reached — try again tomorrow.</p>
      )}
      {params.sendErrors && <p className="auth-error">{params.sendErrors}</p>}

      <form action={sendApprovedAction}>
        <button type="submit" className="btn-primary" disabled={pendingCount === 0}>
          Send {pendingCount} approved email(s)
        </button>
      </form>

      <h2>Sent</h2>
      {sentMessages.length === 0 ? (
        <p className="empty-state">Nothing sent yet.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Subject</th>
              <th>Sent</th>
              <th>Follow-ups</th>
            </tr>
          </thead>
          <tbody>
            {sentMessages.map((m) => (
              <tr key={m.id}>
                <td>{m.draft.business.name}</td>
                <td>{m.draft.subject}</td>
                <td>{m.sentAt.toLocaleString()}</td>
                <td>{m.followups.length === 0 ? "—" : `${m.followups.length} scheduled`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
