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

function authorizedClient(tokens: { accessToken: string; refreshToken: string }) {
  const client = createGoogleOAuthClient();
  client.setCredentials({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken });
  return client;
}

/** Sends a message. Pass `threadId` to keep a follow-up or manual reply in
 * the same Gmail thread as the original. */
export async function sendGmailMessage(
  tokens: { accessToken: string; refreshToken: string },
  email: OutgoingEmail,
  options?: { threadId?: string }
): Promise<SendResult> {
  const gmail = google.gmail({ version: "v1", auth: authorizedClient(tokens) });
  const raw = buildRawMessage(email);

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId: options?.threadId },
  });

  if (!response.data.id || !response.data.threadId) {
    throw new Error("Gmail send succeeded but did not return a message/thread id.");
  }

  return { gmailMessageId: response.data.id, gmailThreadId: response.data.threadId };
}

export interface ThreadCheckResult {
  hasReply: boolean;
  fromHeader: string;
  subjectHeader: string;
  snippet: string;
}

/** Checks whether a sent thread now has an inbound message beyond the one
 * we sent — the signal used for reply detection and follow-up cancellation. */
export async function getThreadLatestMessage(
  tokens: { accessToken: string; refreshToken: string },
  threadId: string
): Promise<ThreadCheckResult> {
  const gmail = google.gmail({ version: "v1", auth: authorizedClient(tokens) });

  const { data } = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: ["From", "Subject"],
  });

  const messages = data.messages ?? [];
  if (messages.length < 2) {
    return { hasReply: false, fromHeader: "", subjectHeader: "", snippet: "" };
  }

  const last = messages[messages.length - 1];
  const headers = last.payload?.headers ?? [];
  const fromHeader = headers.find((h) => h.name === "From")?.value ?? "";
  const subjectHeader = headers.find((h) => h.name === "Subject")?.value ?? "";

  return { hasReply: true, fromHeader, subjectHeader, snippet: last.snippet ?? "" };
}
