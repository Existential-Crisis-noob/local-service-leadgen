import { describe, expect, it } from "vitest";
import { classifyUrl } from "./classify";

describe("classifyUrl", () => {
  it("allows an ordinary business website", () => {
    const result = classifyUrl("https://acmeroofing.example.com/contact");
    expect(result.kind).toBe("business_website");
  });

  it("strips www when computing the hostname", () => {
    const result = classifyUrl("https://www.acmeroofing.example.com");
    expect(result).toMatchObject({ kind: "business_website", hostname: "acmeroofing.example.com" });
  });

  it.each([
    "https://www.facebook.com/acmeroofing",
    "https://m.facebook.com/acmeroofing",
    "https://instagram.com/acmeroofing",
    "https://www.kijiji.ca/v-item/1234",
    "https://www.google.com/maps/place/acme",
    "https://www.yelp.com/biz/acme-roofing",
  ])("rejects unsupported marketplace/social/map URLs: %s", (url) => {
    const result = classifyUrl(url);
    expect(result.kind).toBe("rejected");
    if (result.kind === "rejected") {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("rejects login-walled pages by path", () => {
    const result = classifyUrl("https://example.com/account/login");
    expect(result).toMatchObject({ kind: "rejected" });
    if (result.kind === "rejected") {
      expect(result.reason).toMatch(/login/i);
    }
  });

  it("rejects known login-wall domains", () => {
    const result = classifyUrl("https://accounts.google.com/signin");
    expect(result.kind).toBe("rejected");
  });

  it("rejects invalid URLs", () => {
    const result = classifyUrl("not a url");
    expect(result.kind).toBe("rejected");
  });

  it("rejects non-http(s) protocols", () => {
    const result = classifyUrl("ftp://example.com/file");
    expect(result.kind).toBe("rejected");
  });
});
