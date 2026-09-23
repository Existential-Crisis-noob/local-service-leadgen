import { describe, expect, it } from "vitest";
import { parseCsvBusinesses } from "./csv";

describe("parseCsvBusinesses", () => {
  it("parses a well-formed CSV with aliased headers", () => {
    const csv = [
      "Business Name,Phone,City,Website",
      "Acme Roofing,403-555-0100,Calgary,https://acmeroofing.example.com",
    ].join("\n");

    const { candidates, errors } = parseCsvBusinesses(csv);

    expect(errors).toHaveLength(0);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      name: "Acme Roofing",
      phone: "403-555-0100",
      city: "Calgary",
      websiteUrl: "https://acmeroofing.example.com/",
    });
  });

  it("drops a rejected website URL but keeps the row, with an error explaining why", () => {
    const csv = ["name,website", "Acme Roofing,https://www.facebook.com/acmeroofing"].join("\n");

    const { candidates, errors } = parseCsvBusinesses(csv);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].websiteUrl).toBeUndefined();
    expect(errors[0]).toMatch(/facebook/i);
  });

  it("skips rows missing a business name", () => {
    const csv = ["name,city", ",Calgary"].join("\n");

    const { candidates, errors } = parseCsvBusinesses(csv);

    expect(candidates).toHaveLength(0);
    expect(errors[0]).toMatch(/missing a business name/i);
  });
});
