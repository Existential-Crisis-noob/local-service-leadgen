import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGoogleAuthUrl } from "@/lib/mailbox/googleOAuth";
import { createOAuthState } from "@/lib/mailbox/state";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = createOAuthState(session.user.id);
  return NextResponse.redirect(getGoogleAuthUrl(state));
}
