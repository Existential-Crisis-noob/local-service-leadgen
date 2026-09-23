import { describe, expect, it } from "vitest";
import { runPageSpeedAudit, toScore100 } from "./pagespeed";

describe("toScore100", () => {
  it("converts a 0-1 Lighthouse score to a 0-100 integer", () => {
    expect(toScore100(0.87)).toBe(87);
    expect(toScore100(1)).toBe(100);
    expect(toScore100(0)).toBe(0);
  });

  it("returns null for a missing score", () => {
    expect(toScore100(null)).toBeNull();
    expect(toScore100(undefined)).toBeNull();
  });
});

describe("runPageSpeedAudit", () => {
  it("returns null without a configured API key, never throwing", async () => {
    // vitest.config.mts doesn't set PAGESPEED_API_KEY, so it defaults to "".
    const result = await runPageSpeedAudit("https://example.com");
    expect(result).toBeNull();
  });
});
