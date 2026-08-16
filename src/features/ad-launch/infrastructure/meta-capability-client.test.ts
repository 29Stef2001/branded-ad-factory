import { describe, expect, it } from "vitest";
import {
  REQUIRED_PERMISSIONS,
  isRevokedTokenError,
} from "@/features/ad-launch/infrastructure/meta-capability-client";

describe("isRevokedTokenError", () => {
  it("recognises the message a removed Business Integration produces", () => {
    // Verbatim from the live failure: the token's recorded expiry was still
    // two months away, so an expiry check called the connection healthy while
    // every request failed and the page offered no way to fix it.
    expect(
      isRevokedTokenError(
        "Error validating access token: The user has not authorized application 4393362910913394.",
      ),
    ).toBe(true);
  });

  it("recognises the other shapes Graph uses for a dead token", () => {
    expect(isRevokedTokenError("Session has expired on Tuesday")).toBe(true);
    expect(
      isRevokedTokenError("The session is invalid because the user logged out"),
    ).toBe(true);
  });

  it("does not treat an ordinary API error as revocation", () => {
    // These need a different fix — asking the user to reconnect would be
    // wrong advice, and reconnecting would not help.
    expect(
      isRevokedTokenError("(#100) Requires business_management permission"),
    ).toBe(false);
    expect(isRevokedTokenError("(#17) User request limit reached")).toBe(false);
    expect(isRevokedTokenError("Unsupported get request.")).toBe(false);
    expect(isRevokedTokenError("")).toBe(false);
  });
});

describe("REQUIRED_PERMISSIONS", () => {
  it("covers reading, launching and Page access", () => {
    const names = REQUIRED_PERMISSIONS.map((entry) => entry.permission);

    expect(names).toContain("ads_read");
    expect(names).toContain("ads_management");
    expect(names).toContain("business_management");
    // An ad creative must name a Page, so these are not optional extras.
    expect(names).toContain("pages_show_list");
    expect(names).toContain("pages_manage_ads");
  });

  it("explains what each permission is for", () => {
    // The list is rendered to the user; a bare scope name tells them nothing
    // about why reconnecting without it will not help.
    for (const entry of REQUIRED_PERMISSIONS) {
      expect(entry.purpose.length).toBeGreaterThan(10);
    }
  });
});
