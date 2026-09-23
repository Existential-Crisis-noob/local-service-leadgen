"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { decryptToken } from "@/lib/crypto";
import { sendGmailMessage } from "@/lib/mailbox/gmail";

async function requireReply(replyId: string) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const workspaceId = await getCurrentWorkspaceId(session.user.id);
  const reply = await prisma.reply.findFirst({
    where: { id: replyId, sentMessage: { draft: { business: { workspaceId } } } },
    include: { sentMessage: { include: { draft: true, mailboxConnection: true } } },
  });
  if (!reply) redirect("/replies");

  return reply;
}

export async function sendManualReplyAction(formData: FormData) {
  const replyId = String(formData.get("replyId"));
  const message = String(formData.get("message") ?? "").trim();
  const reply = await requireReply(replyId);

  if (!message) {
    redirect(`/replies?error=${encodeURIComponent("Write a reply before sending.")}`);
  }

  const mailbox = reply.sentMessage.mailboxConnection;
  if (mailbox.disconnectedAt) {
    redirect(`/replies?error=${encodeURIComponent("This reply's mailbox is disconnected.")}`);
  }

  const subject = reply.sentMessage.draft.subject.startsWith("Re:")
    ? reply.sentMessage.draft.subject
    : `Re: ${reply.sentMessage.draft.subject}`;

  await sendGmailMessage(
    {
      accessToken: decryptToken(mailbox.encryptedAccessToken),
      refreshToken: decryptToken(mailbox.encryptedRefreshToken),
    },
    {
      to: reply.sentMessage.draft.toEmail,
      subject,
      body: message,
      fromName: mailbox.emailAddress,
      fromEmail: mailbox.emailAddress,
    },
    { threadId: reply.sentMessage.gmailThreadId }
  );

  await prisma.reply.update({ where: { id: reply.id }, data: { status: "HANDLED" } });
  redirect("/replies");
}

export async function markHandledAction(formData: FormData) {
  const replyId = String(formData.get("replyId"));
  await requireReply(replyId);
  await prisma.reply.update({ where: { id: replyId }, data: { status: "HANDLED" } });
  redirect("/replies");
}
