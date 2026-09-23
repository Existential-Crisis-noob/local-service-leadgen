import { describe, expect, it } from "vitest";
import { buildOverpassQuery, parseOverpassElements } from "./osm";

describe("buildOverpassQuery", () => {
  it("maps a known industry keyword to its OSM craft tag", () => {
    const query = buildOverpassQuery({ lat: 51.05, lon: -114.07 }, 30000, ["roofing"]);
    expect(query).toContain(`node["craft"="roofer"](`);
    expect(query).toContain(`way["craft"="roofer"](`);
    expect(query).not.toContain("around:");
  });

  it("falls back to a name search for unmapped keywords", () => {
    const query = buildOverpassQuery({ lat: 51.05, lon: -114.07 }, 30000, ["landscaping"]);
    expect(query).toContain(`node["name"~"landscaping",i](`);
  });
});

describe("parseOverpassElements", () => {
  it("extracts a candidate business from a tagged node", () => {
    const candidates = parseOverpassElements([
      {
        type: "node",
        lat: 51.05,
        lon: -114.07,
        tags: {
          name: "Acme Roofing",
          craft: "roofer",
          phone: "+1-403-555-0100",
          website: "https://acmeroofing.example.com",
          "addr:housenumber": "123",
          "addr:street": "Main St",
          "addr:city": "Calgary",
        },
      },
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      name: "Acme Roofing",
      phone: "+1-403-555-0100",
      address: "123 Main St",
      city: "Calgary",
      websiteUrl: "https://acmeroofing.example.com",
    });
  });

  it("skips elements with no name tag", () => {
    const candidates = parseOverpassElements([{ type: "node", lat: 1, lon: 2, tags: { craft: "roofer" } }]);
    expect(candidates).toHaveLength(0);
  });

  it("uses the center point for way elements", () => {
    const candidates = parseOverpassElements([
      { type: "way", center: { lat: 51.1, lon: -114.2 }, tags: { name: "Acme Masonry" } },
    ]);
    expect(candidates[0]).toMatchObject({ lat: 51.1, lon: -114.2 });
  });
});
