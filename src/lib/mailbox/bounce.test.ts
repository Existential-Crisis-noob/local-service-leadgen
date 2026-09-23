import { describe, expect, it } from "vitest";
import { isBounceMessage } from "./bounce";

describe("isBounceMessage", () => {
  it("detects a mailer-daemon sender", () => {
    expect(isBounceMessage("Mail Delivery Subsystem <mailer-daemon@google.com>", "Failure")).toBe(true);
  });

  it("detects a postmaster sender", () => {
    expect(isBounceMessage("postmaster@example.com", "Notice")).toBe(true);
  });

  it("detects a delivery-failure subject even from an unusual sender", () => {
    expect(isBounceMessage("system@somehost.com", "Delivery Status Notification (Failure)")).toBe(true);
  });

  it("does not flag a genuine reply", () => {
    expect(isBounceMessage("Jane Doe <jane@acmeroofing.biz>", "Re: Quick note about your website")).toBe(
      false
    );
  });
});
