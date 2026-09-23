import { auth } from "@/auth";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { saveDraftEditAction, approveDraftAction, rejectDraftAction } from "./actions";

export default async function DraftsPage() {
  const session = await auth();
  const workspaceId = await getCurrentWorkspaceId(session!.user.id);

  const drafts = await prisma.draftEmail.findMany({
    where: { business: { workspaceId }, status: { in: ["PENDING", "EDITED"] } },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <h1>Drafts Awaiting Approval</h1>
      <p className="subtitle">
        Review, edit or approve generated outreach emails before anything is sent.
      </p>

      {drafts.length === 0 ? (
        <p className="empty-state">No drafts waiting on you right now.</p>
      ) : (
        <div className="prospect-list">
          {drafts.map((draft) => (
            <form key={draft.id} className="draft-card form-grid">
              <input type="hidden" name="draftId" value={draft.id} />
              <div className="draft-meta">
                <strong>{draft.business.name}</strong>
                <span className="hint">
                  to {draft.toEmail} · {draft.status}
                </span>
              </div>
              <label className="field">
                Subject
                <input name="subject" defaultValue={draft.subject} />
              </label>
              <label className="field">
                Body
                <textarea name="body" rows={10} defaultValue={draft.body} />
              </label>
              {draft.observedIssues.length > 0 && (
                <p className="hint">Observed issue(s): {draft.observedIssues.join(" · ")}</p>
              )}
              <div className="draft-actions">
                <button type="submit" formAction={saveDraftEditAction} className="btn-secondary">
                  Save edits
                </button>
                <button type="submit" formAction={approveDraftAction} className="btn-primary">
                  Approve
                </button>
                <button type="submit" formAction={rejectDraftAction} className="btn-secondary">
                  Reject
                </button>
              </div>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
