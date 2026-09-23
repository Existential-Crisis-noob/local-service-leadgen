import { describe, expect, it } from "vitest";
import { buildCandidatesFromUrls } from "./urlImport";

describe("buildCandidatesFromUrls", () => {
  it("accepts business website URLs and rejects unsupported ones", () => {
    const { candidates, rejected } = buildCandidatesFromUrls([
      "https://acmeroofing.example.com",
      "https://www.facebook.com/acmeroofing",
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].websiteUrl).toBe("https://acmeroofing.example.com/");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatch(/facebook/i);
  });

  it("deduplicates by hostname", () => {
    const { candidates } = buildCandidatesFromUrls([
      "https://acmeroofing.example.com/",
      "https://acmeroofing.example.com/contact",
      "https://www.acmeroofing.example.com/about",
    ]);

    expect(candidates).toHaveLength(1);
  });

  it("ignores blank lines", () => {
    const { candidates, rejected } = buildCandidatesFromUrls(["", "   ", "https://acme.example.com"]);
    expect(candidates).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });
});
