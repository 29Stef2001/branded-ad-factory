import { describe, expect, it } from "vitest";
import { deriveExternalId } from "@/features/hermes-gateway/domain/ad-submission";

describe("deriveExternalId", () => {
  it("is stable across repeated submissions of the same ad", () => {
    const ad = {
      snapshotUrl: "https://facebook.com/ads/library/?id=123",
      bodyText: "Hand-hammered solid copper, worn for decades.",
      creativeImageUrl: "https://example.com/img.jpg",
      landingPageUrl: "https://example.com/shop",
    };
    expect(deriveExternalId(ad)).toBe(deriveExternalId({ ...ad }));
  });

  it("differs when the identifying fields differ", () => {
    const a = deriveExternalId({ snapshotUrl: "https://a.example.com" });
    const b = deriveExternalId({ snapshotUrl: "https://b.example.com" });
    expect(a).not.toBe(b);
  });

  it("does not change when a field that legitimately varies between visits changes", () => {
    // pageName/linkDescription/isActive can shift between research passes
    // without it being a different ad — only the fields deriveExternalId
    // actually hashes should affect the id.
    const base = {
      snapshotUrl: "https://facebook.com/ads/library/?id=123",
      bodyText: "Same ad, different day.",
    };
    const firstVisit = deriveExternalId({
      ...base,
      pageName: "Brand Page",
      linkDescription: "shop now",
      isActive: true,
    });
    const secondVisit = deriveExternalId({
      ...base,
      pageName: "Brand Page (renamed)",
      linkDescription: "50% off today",
      isActive: false,
    });
    expect(firstVisit).toBe(secondVisit);
  });

  it("treats missing and empty-string fields the same way, deterministically", () => {
    const withUndefined = deriveExternalId({ bodyText: undefined });
    const withNull = deriveExternalId({ bodyText: null });
    expect(withUndefined).toBe(withNull);
  });
});
