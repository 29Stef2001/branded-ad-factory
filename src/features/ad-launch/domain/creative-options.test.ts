import { describe, expect, it } from "vitest";
import {
  CREATIVE_FORMATS,
  adArchiveIdFrom,
  formatById,
  parseAdLibraryLinks,
  resolutionById,
} from "@/features/ad-launch/domain/creative-options";

describe("formatById", () => {
  it("returns the format asked for", () => {
    expect(formatById("portrait").size).toBe("1024x1536");
    expect(formatById("landscape").size).toBe("1536x1024");
  });

  it("falls back to feed square for anything unknown", () => {
    // Square renders without cropping in the feed, the sidebar and search,
    // which makes it the safe default when the choice is missing.
    expect(formatById("nonsense").id).toBe("square");
    expect(CREATIVE_FORMATS[0].id).toBe("square");
  });

  it("only offers sizes the image API accepts", () => {
    const allowed = new Set(["1024x1024", "1024x1536", "1536x1024"]);
    for (const format of CREATIVE_FORMATS) {
      expect(allowed.has(format.size)).toBe(true);
    }
  });
});

describe("resolutionById", () => {
  it("defaults to the sharp option", () => {
    expect(resolutionById("nonsense").quality).toBe("high");
    expect(resolutionById("standard").quality).toBe("medium");
  });
});

describe("parseAdLibraryLinks", () => {
  it("reads links out of pasted text with words around them", () => {
    const pasted = `
      this one did well https://www.facebook.com/ads/library/?id=123456
      and this https://www.facebook.com/ads/library/?id=789012 too
    `;

    expect(parseAdLibraryLinks(pasted)).toEqual([
      "https://www.facebook.com/ads/library/?id=123456",
      "https://www.facebook.com/ads/library/?id=789012",
    ]);
  });

  it("drops links that are not Ad Library ads", () => {
    // A competitor's homepage is not an ad, and scanning it finds nothing.
    expect(
      parseAdLibraryLinks(
        "https://competitor.com https://facebook.com/somepage",
      ),
    ).toEqual([]);
  });

  it("strips punctuation people leave on the end", () => {
    expect(
      parseAdLibraryLinks("https://www.facebook.com/ads/library/?id=123,"),
    ).toEqual(["https://www.facebook.com/ads/library/?id=123"]);
  });

  it("removes duplicates", () => {
    const one = "https://www.facebook.com/ads/library/?id=123";
    expect(parseAdLibraryLinks(`${one} ${one}`)).toEqual([one]);
  });

  it("returns nothing for empty input", () => {
    expect(parseAdLibraryLinks("")).toEqual([]);
    expect(parseAdLibraryLinks("   ")).toEqual([]);
  });
});

describe("adArchiveIdFrom", () => {
  it("reads the archive id the API is queried by", () => {
    expect(
      adArchiveIdFrom("https://www.facebook.com/ads/library/?id=1234567890"),
    ).toBe("1234567890");
  });

  it("returns null when there is no id to read", () => {
    expect(adArchiveIdFrom("https://www.facebook.com/ads/library/")).toBeNull();
  });
});
