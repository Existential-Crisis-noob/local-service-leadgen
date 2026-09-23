"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { decryptToken } from "@/lib/crypto";
import { sendApprovedDraftsForWorkspace } from "@/lib/mailbox/sendApprovedDrafts";

export async function sendApprovedAction() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const workspaceId = await getCurrentWorkspaceId(session.user.id);
  const summary = await sendApprovedDraftsForWorkspace(workspaceId);

  const params = new URLSearchParams();
  params.set("sent", String(summary.sent));
  if (summary.skippedNoMailbox) params.set("noMailbox", "1");
  if (summary.limitReached) params.set("limitReached", "1");
  if (summary.errors.length > 0) params.set("sendErrors", summary.errors.slice(0, 3).join(" | "));

  redirect(`/sent?${params.toString()}`);
}

export async function disconnectMailboxAction(formData: FormData) {
  const mailboxId = String(formData.get("mailboxId"));

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const mailbox = await prisma.mailboxConnection.findFirst({
    where: { id: mailboxId, userId: session.user.id },
  });
  if (!mailbox) redirect("/sent");

  try {
    const accessToken = decryptToken(mailbox.encryptedAccessToken);
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`, {
      method: "POST",
    });
  } catch {
    // Best-effort revoke — clearing the local tokens below is what matters.
  }

  await prisma.mailboxConnection.update({
    where: { id: mailbox.id },
    data: { disconnectedAt: new Date(), encryptedAccessToken: "", encryptedRefreshToken: "" },
  });

  redirect("/sent");
}
