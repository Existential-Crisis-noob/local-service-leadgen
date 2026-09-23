import { google } from "googleapis";
import { createGoogleOAuthClient } from "./googleOAuth";

export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string;
  fromName: string;
  fromEmail: string;
}

function encodeHeader(text: string): string {
  if (/^[\x00-\x7F]*$/.test(text)) return text;
  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`;
}

/** Builds the base64url-encoded RFC 2822 message Gmail's send API expects. */
export function buildRawMessage(email: OutgoingEmail): string {
  const headers = [
    `From: ${encodeHeader(email.fromName)} <${email.fromEmail}>`,
    `To: ${email.to}`,
    `Subject: ${encodeHeader(email.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
  ].join("\r\n");

  const message = `${headers}\r\n\r\n${email.body}`;

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export interface SendResult {
  gmailMessageId: string;
  gmailThreadId: string;
}

export async function sendGmailMessage(
  tokens: { accessToken: string; refreshToken: string },
  email: OutgoingEmail
): Promise<SendResult> {
  const client = createGoogleOAuthClient();
  client.setCredentials({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });

  const gmail = google.gmail({ version: "v1", auth: client });
  const raw = buildRawMessage(email);

  const response = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

  if (!response.data.id || !response.data.threadId) {
    throw new Error("Gmail send succeeded but did not return a message/thread id.");
  }

  return { gmailMessageId: response.data.id, gmailThreadId: response.data.threadId };
}
