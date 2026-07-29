import { describe, expect, it } from "vitest";
import {
  HASH_DISTANCE,
  canAutoConfirm,
  findAttributionCandidates,
  hammingDistance,
  isValidConceptCode,
  parseConceptCode,
} from "@/features/creative-intelligence/domain/attribution";

describe("parseConceptCode", () => {
  it("finds the code wherever it sits in the ad name", () => {
    expect(parseConceptCode("CS-ABC234 — Final stock cuffs")).toBe("CS-ABC234");
    expect(parseConceptCode("Retargeting | CS-ABC234 | v2")).toBe("CS-ABC234");
    expect(parseConceptCode("Final stock cuffs CS-ABC234")).toBe("CS-ABC234");
  });

  it("normalises case, because Ads Manager does not enforce any", () => {
    expect(parseConceptCode("cs-abc234 — cuffs")).toBe("CS-ABC234");
  });

  it("returns null when there is no code to find", () => {
    expect(parseConceptCode("Final stock cuffs")).toBeNull();
    expect(parseConceptCode("")).toBeNull();
  });

  it("rejects codes using the letters the alphabet deliberately omits", () => {
    // I, L, O and U are excluded so a code cannot be misread off a screen.
    expect(parseConceptCode("CS-ABCIOU")).toBeNull();
    expect(parseConceptCode("CS-OOO111")).toBeNull();
  });

  it("rejects a code of the wrong length rather than truncating it", () => {
    expect(parseConceptCode("CS-ABC23")).toBeNull();
    expect(parseConceptCode("CS-ABC2345")).toBeNull();
  });

  it("does not match a code embedded in a longer token", () => {
    expect(parseConceptCode("XCS-ABC234")).toBeNull();
    expect(parseConceptCode("CS-ABC234X")).toBeNull();
  });
});

describe("isValidConceptCode", () => {
  it("accepts a well-formed code and rejects everything else", () => {
    expect(isValidConceptCode("CS-ABC234")).toBe(true);
    expect(isValidConceptCode("cs-abc234")).toBe(false);
    expect(isValidConceptCode("CS-ABCIOU")).toBe(false);
    expect(isValidConceptCode("ABC234")).toBe(false);
  });
});

describe("hammingDistance", () => {
  it("counts differing bits", () => {
    expect(hammingDistance("00", "00")).toBe(0);
    expect(hammingDistance("0f", "00")).toBe(4);
    expect(hammingDistance("ff", "00")).toBe(8);
  });

  it("refuses hashes it cannot compare rather than reporting zero", () => {
    // Returning 0 for a malformed hash would read as a perfect match.
    expect(hammingDistance("abc", "ab")).toBeNull();
    expect(hammingDistance("", "")).toBeNull();
    expect(hammingDistance("zz", "00")).toBeNull();
  });
});

describe("findAttributionCandidates", () => {
  const concepts = [
    { id: "c1", conceptCode: "CS-ABC234", perceptualHash: "f0f0f0f0f0f0f0f0" },
    { id: "c2", conceptCode: "CS-XYZ789", perceptualHash: "f0f0f0f0f0f0f0f1" },
    { id: "c3", conceptCode: "CS-QRS456", perceptualHash: null },
  ];

  it("matches on the concept code with full confidence", () => {
    const candidates = findAttributionCandidates(
      { name: "CS-ABC234 — cuffs", perceptualHash: null },
      concepts,
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      conceptId: "c1",
      method: "concept_code",
      confidence: 1,
    });
  });

  it("stops at a code match rather than letting a fuzzy one compete", () => {
    // The ad's image happens to match c2 exactly, but the name says c1. The
    // deterministic signal wins outright; a close image is not evidence
    // against an exact identifier.
    const candidates = findAttributionCandidates(
      { name: "CS-ABC234 — cuffs", perceptualHash: "f0f0f0f0f0f0f0f1" },
      concepts,
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].conceptId).toBe("c1");
  });

  it("proposes nothing when the code matches no concept", () => {
    // Usually a typo in the ad name. Falling through to image matching would
    // quietly attribute it to the wrong creative.
    const candidates = findAttributionCandidates(
      { name: "CS-ZZZ999 — cuffs", perceptualHash: "f0f0f0f0f0f0f0f0" },
      concepts,
    );

    expect(candidates).toEqual([]);
  });

  it("falls back to the image when the name carries no code", () => {
    const candidates = findAttributionCandidates(
      { name: "Retargeting cuffs v2", perceptualHash: "f0f0f0f0f0f0f0f0" },
      concepts,
    );

    expect(candidates[0]).toMatchObject({
      conceptId: "c1",
      method: "perceptual_hash",
    });
    expect(candidates[0].confidence).toBeLessThan(1);
  });

  it("ranks closer images first", () => {
    const candidates = findAttributionCandidates(
      { name: "Retargeting cuffs", perceptualHash: "f0f0f0f0f0f0f0f0" },
      concepts,
    );

    expect(candidates.map((c) => c.conceptId)).toEqual(["c1", "c2"]);
    expect(candidates[0].confidence).toBeGreaterThan(candidates[1].confidence);
  });

  it("never claims certainty from an image match", () => {
    // Meta re-encodes what it serves, so identical hashes still only mean
    // "looks the same".
    const candidates = findAttributionCandidates(
      { name: "cuffs", perceptualHash: "f0f0f0f0f0f0f0f0" },
      concepts,
    );

    expect(candidates[0].confidence).toBeLessThan(1);
  });

  it("ignores images beyond the review distance", () => {
    const candidates = findAttributionCandidates(
      { name: "something else", perceptualHash: "0000000000000000" },
      concepts,
    );

    expect(candidates).toEqual([]);
  });

  it("proposes nothing for an ad with neither a code nor an image", () => {
    expect(
      findAttributionCandidates(
        { name: "cuffs", perceptualHash: null },
        concepts,
      ),
    ).toEqual([]);
  });

  it("skips concepts that have no hash to compare against", () => {
    const candidates = findAttributionCandidates(
      { name: "cuffs", perceptualHash: "f0f0f0f0f0f0f0f0" },
      concepts,
    );

    expect(candidates.map((c) => c.conceptId)).not.toContain("c3");
  });
});

describe("canAutoConfirm", () => {
  it("auto-confirms only deterministic matches", () => {
    expect(
      canAutoConfirm({
        conceptId: "c1",
        method: "concept_code",
        confidence: 1,
        reason: "",
      }),
    ).toBe(true);
    expect(
      canAutoConfirm({
        conceptId: "c1",
        method: "api_created",
        confidence: 1,
        reason: "",
      }),
    ).toBe(true);
  });

  it("never auto-confirms an image match, however close", () => {
    // A wrong link teaches a false lesson with full confidence, which is worse
    // than no link at all — so this one always waits for a human.
    expect(
      canAutoConfirm({
        conceptId: "c1",
        method: "perceptual_hash",
        confidence: 0.9,
        reason: "",
      }),
    ).toBe(false);
    expect(HASH_DISTANCE.auto).toBeLessThan(HASH_DISTANCE.review);
  });
});
