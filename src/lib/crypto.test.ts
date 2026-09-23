import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./crypto";

describe("encryptToken / decryptToken", () => {
  it("round-trips a token", () => {
    const token = "ya29.a0ARrdaM-example-refresh-token";
    const encrypted = encryptToken(token);
    expect(encrypted).not.toContain(token);
    expect(decryptToken(encrypted)).toBe(token);
  });

  it("produces different ciphertext for the same input each time (random IV)", () => {
    const token = "same-token-value";
    expect(encryptToken(token)).not.toBe(encryptToken(token));
  });
});
