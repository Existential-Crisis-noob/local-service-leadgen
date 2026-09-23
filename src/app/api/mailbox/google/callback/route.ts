import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeCodeForTokens } from "@/lib/mailbox/googleOAuth";
import { verifyOAuthState } from "@/lib/mailbox/state";
import { encryptToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceId } from "@/lib/workspace";
import { logActivity } from "@/lib/activityLog";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (oauthError) {
    return NextResponse.redirect(new URL(`/sent?mailboxError=${encodeURIComponent(oauthError)}`, request.url));
  }

  const stateUserId = state ? verifyOAuthState(state) : null;
  if (!code || !stateUserId || stateUserId !== session.user.id) {
    return NextResponse.redirect(new URL("/sent?mailboxError=invalid_state", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const existing = await prisma.mailboxConnection.findFirst({
      where: { userId: session.user.id, provider: "GMAIL", disconnectedAt: null },
    });

    const data = {
      emailAddress: tokens.emailAddress,
      encryptedAccessToken: encryptToken(tokens.accessToken),
      encryptedRefreshToken: encryptToken(tokens.refreshToken),
    };

    const mailbox = existing
      ? await prisma.mailboxConnection.update({ where: { id: existing.id }, data })
      : await prisma.mailboxConnection.create({
          data: { userId: session.user.id, provider: "GMAIL", ...data },
        });

    const workspaceId = await getCurrentWorkspaceId(session.user.id);
    await logActivity({
      workspaceId,
      actorUserId: session.user.id,
      action: "mailbox.connected",
      entityType: "MailboxConnection",
      entityId: mailbox.id,
      metadata: { emailAddress: mailbox.emailAddress },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.redirect(new URL(`/sent?mailboxError=${encodeURIComponent(message)}`, request.url));
  }

  return NextResponse.redirect(new URL("/sent?mailboxConnected=1", request.url));
}
