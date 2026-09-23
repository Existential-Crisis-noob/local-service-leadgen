import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Signs a short-lived state token binding the OAuth callback to the user
 * who started the flow (CSRF protection for the mailbox-connect redirect). */
export function createOAuthState(userId: string): string {
  const nonce = randomBytes(8).toString("hex");
  const payload = `${userId}.${nonce}`;
  const signature = createHmac("sha256", env.AUTH_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyOAuthState(state: string): string | null {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const [userId, nonce, signature] = decoded.split(".");
    if (!userId || !nonce || !signature) return null;

    const expected = createHmac("sha256", env.AUTH_SECRET).update(`${userId}.${nonce}`).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    return userId;
  } catch {
    return null;
  }
}
