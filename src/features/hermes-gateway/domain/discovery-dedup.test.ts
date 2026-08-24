import { describe, expect, it } from "vitest";
import {
  isKnownName,
  normalizeCompetitorName,
} from "@/features/hermes-gateway/domain/discovery-dedup";

describe("normalizeCompetitorName", () => {
  it("trims and lowercases", () => {
    expect(normalizeCompetitorName("  Sergio Lub  ")).toBe("sergio lub");
  });

  it("treats different casing as the same name", () => {
    expect(normalizeCompetitorName("SERGIO LUB")).toBe(
      normalizeCompetitorName("sergio lub"),
    );
  });

  // The database's unique index is on `lower(btrim(name))` — this has to
  // stay byte-for-byte the same rule, or a name the pre-filter waves through
  // could still bounce off the database as a surprise duplicate.
  it("matches the database's lower(btrim(name)) normalization exactly", () => {
    expect(normalizeCompetitorName("\tJames Avery\n")).toBe("james avery");
  });
});

describe("isKnownName", () => {
  it("is true for a name already in the known set, regardless of case/whitespace", () => {
    const known = new Set(["sergio lub", "james avery"]);
    expect(isKnownName("  Sergio Lub  ", known)).toBe(true);
    expect(isKnownName("JAMES AVERY", known)).toBe(true);
  });

  it("is false for a genuinely new name", () => {
    const known = new Set(["sergio lub"]);
    expect(isKnownName("Studebaker Metals", known)).toBe(false);
  });
});
