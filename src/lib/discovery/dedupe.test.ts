import { describe, expect, it } from "vitest";
import { computeDedupeKey } from "./dedupe";

describe("computeDedupeKey", () => {
  it("prefers the website hostname", () => {
    const key = computeDedupeKey({
      name: "Acme Roofing",
      websiteUrl: "https://www.acmeroofing.example.com/contact",
      phone: "403-555-0100",
    });
    expect(key).toBe("website:acmeroofing.example.com");
  });

  it("falls back to a normalized phone number when there's no website", () => {
    const key = computeDedupeKey({ name: "Acme Roofing", phone: "(403) 555-0100" });
    expect(key).toBe("phone:4035550100");
  });

  it("falls back to normalized name + city as a last resort", () => {
    const key = computeDedupeKey({ name: "Acme Roofing Inc.", city: "Calgary" });
    expect(key).toBe("name:acme roofing inc|calgary");
  });

  it("produces the same key for the same business found via different connectors", () => {
    const a = computeDedupeKey({ name: "Acme Roofing", websiteUrl: "https://acmeroofing.example.com" });
    const b = computeDedupeKey({ name: "ACME ROOFING LTD", websiteUrl: "https://www.acmeroofing.example.com/about" });
    expect(a).toBe(b);
  });
});
