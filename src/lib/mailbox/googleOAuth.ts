import { google } from "googleapis";
import { env } from "@/lib/env";

// Sending scope only — this is a separate consent from app login, and the
// app never asks for more than it needs to send mail on the user's behalf.
export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export function getRedirectUri(): string {
  return `${env.AUTH_URL}/api/mailbox/google/callback`;
}

export function createGoogleOAuthClient() {
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, getRedirectUri());
}

export function getGoogleAuthUrl(state: string): string {
  const client = createGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GMAIL_SEND_SCOPE, "https://www.googleapis.com/auth/userinfo.email"],
    state,
  });
}

export interface ExchangedTokens {
  accessToken: string;
  refreshToken: string;
  emailAddress: string;
}

export async function exchangeCodeForTokens(code: string): Promise<ExchangedTokens> {
  const client = createGoogleOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      "Google didn't return a refresh token — disconnect any existing grant for this app and try connecting again."
    );
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();

  if (!data.email) {
    throw new Error("Could not determine the Gmail address for this connection.");
  }

  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, emailAddress: data.email };
}
