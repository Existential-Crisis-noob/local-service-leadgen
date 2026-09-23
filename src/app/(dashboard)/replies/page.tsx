import { auth } from "@/auth";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { prisma } from "@/lib/prisma";
import { sendManualReplyAction, markHandledAction } from "./actions";

export default async function RepliesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await auth();
  const workspaceId = await getCurrentWorkspaceId(session!.user.id);

  const replies = await prisma.reply.findMany({
    where: { status: "NEEDS_REVIEW", sentMessage: { draft: { business: { workspaceId } } } },
    include: { sentMessage: { include: { draft: { include: { business: true } } } } },
    orderBy: { receivedAt: "asc" },
  });

  return (
    <div>
      <h1>Replies Requiring Review</h1>
      <p className="subtitle">
        Conversations with an inbound reply. All future follow-ups are canceled automatically
        once a reply lands here.
      </p>

      {error && <p className="auth-error">{error}</p>}

      {replies.length === 0 ? (
        <p className="empty-state">No replies waiting on you.</p>
      ) : (
        <div className="prospect-list">
          {replies.map((reply) => (
            <form key={reply.id} className="draft-card form-grid">
              <input type="hidden" name="replyId" value={reply.id} />
              <div className="draft-meta">
                <strong>{reply.sentMessage.draft.business.name}</strong>
                <span className="hint">{reply.receivedAt.toLocaleString()}</span>
              </div>
              <p className="hint">Original subject: {reply.sentMessage.draft.subject}</p>
              <p className="reply-snippet">&ldquo;{reply.snippet}&rdquo;</p>
              <label className="field">
                Your reply
                <textarea name="message" rows={6} placeholder="Write your response…" />
              </label>
              <div className="draft-actions">
                <button type="submit" formAction={sendManualReplyAction} className="btn-primary">
                  Send reply
                </button>
                <button type="submit" formAction={markHandledAction} className="btn-secondary">
                  Mark handled (no reply needed)
                </button>
              </div>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
