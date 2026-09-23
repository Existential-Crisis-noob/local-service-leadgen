import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl } from "./publicFetch";

describe("assertPublicHttpUrl", () => {
  it.each([
    "http://localhost/admin",
    "http://127.0.0.1:3000",
    "http://192.168.1.10",
    "http://service.internal",
  ])("rejects private or local targets: %s", async (url) => {
    await expect(assertPublicHttpUrl(url)).rejects.toThrow(/private|local/i);
  });

  it("rejects URLs that contain credentials", async () => {
    await expect(assertPublicHttpUrl("https://user:password@example.com")).rejects.toThrow(
      /credentials/i
    );
  });
});
