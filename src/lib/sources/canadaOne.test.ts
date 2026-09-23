import { afterEach, describe, expect, it, vi } from "vitest";
import { CanadaOneConnector } from "./canadaOne";

afterEach(() => vi.unstubAllGlobals());

describe("CanadaOneConnector", () => {
  it("returns in-radius public directory records but never trusts the directory email", async () => {
    const record = {
      company_id: "43836",
      company_name: "Verified Roofing Business",
      company_url: "https://verified-roofing.test",
      description: "Roofing services in Calgary",
      keywords: "roofing, roof repair",
      telephone: "403-555-0199",
      email: "directory-only@example.net",
      display_address: "1",
      "1_address_1": "100 Service Road",
      "1_city": "Calgary",
      "1_province": "AB",
      "1_postal": "T2P 1J9",
      lat: "51.0505",
      lng: "-114.0705",
    };

    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("nominatim.openstreetmap.org")) {
        return new Response(JSON.stringify([{ lat: "51.05", lon: "-114.07" }]), { status: 200 });
      }
      if (init?.method === "POST") {
        return new Response("", {
          status: 302,
          headers: {
            "set-cookie": "PHPSESSID=test-session; path=/",
            location: "/business/index.html/CanadaOne/directory/map/p/1",
          },
        });
      }
      return new Response(`<script>var results = ${JSON.stringify([record])};</script>`, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const candidates = await new CanadaOneConnector().discover({
      city: "Calgary",
      region: "AB",
      postalCode: null,
      countryCode: "CA",
      radiusKm: 30,
      industryKeywords: ["roofing"],
      desiredCount: 1,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      name: "Verified Roofing Business",
      city: "Calgary",
      region: "AB",
      postalCode: "T2P 1J9",
      websiteUrl: "https://verified-roofing.test/",
    });
    expect(candidates[0].email).toBeUndefined();
  });

  it("rejects non-Canadian campaigns and missing province codes", async () => {
    const connector = new CanadaOneConnector();
    await expect(
      connector.discover({
        city: "Seattle",
        region: "WA",
        countryCode: "US",
        radiusKm: 30,
        industryKeywords: ["roofing"],
        desiredCount: 5,
      })
    ).rejects.toThrow(/Canadian/i);
  });
});
