import { describe, expect, it } from "vitest";
import { createOAuthState, verifyOAuthState } from "./state";

describe("OAuth state token", () => {
  it("round-trips the user id", () => {
    const state = createOAuthState("user_123");
    expect(verifyOAuthState(state)).toBe("user_123");
  });

  it("rejects a tampered state", () => {
    const state = createOAuthState("user_123");
    const tampered = state.slice(0, -2) + "aa";
    expect(verifyOAuthState(tampered)).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(verifyOAuthState("not-a-real-state")).toBeNull();
  });
});
