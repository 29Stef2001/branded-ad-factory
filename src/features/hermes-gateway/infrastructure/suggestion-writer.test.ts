import { describe, expect, it, vi } from "vitest";
import { insertSuggestionIfNew } from "@/features/hermes-gateway/infrastructure/suggestion-writer";
import type { DiscoveredCompetitor } from "@/features/hermes-gateway/domain/discovery-schema";
import type { Db } from "@/features/competitor-analysis/infrastructure/competitor-repository";

/**
 * Regression coverage for the race condition found in manual testing: two
 * overlapping `competitor_discover()` calls both inserted the same
 * candidate, because the old code checked "is this name already suggested?"
 * and inserted as two separate steps — a gap a second process could land in
 * between. The fix moves the guarantee to the database (a unique index on
 * `suggested_competitors (user_id, lower(btrim(name)))`, see the
 * accompanying migration) and makes `insertSuggestionIfNew` the single
 * place that turns Postgres's answer into a true/false result. These tests
 * cover that translation in isolation, without a live database.
 */

function candidate(overrides: Partial<DiscoveredCompetitor> = {}): DiscoveredCompetitor {
  return {
    name: "Sergio Lub",
    websiteUrl: "https://www.lub.com",
    competitorType: "DIRECT",
    relevanceScore: 88,
    relevanceReasoning: "Same material, same audience.",
    ...overrides,
  };
}

function fakeDb(insertResult: { error: { code: string } | null }): Db {
  const insert = vi.fn().mockResolvedValue(insertResult);
  const from = vi.fn().mockReturnValue({ insert });
  return { from } as unknown as Db;
}

describe("insertSuggestionIfNew", () => {
  it("returns true when the insert succeeds", async () => {
    const db = fakeDb({ error: null });
    await expect(
      insertSuggestionIfNew(db, "user-1", candidate()),
    ).resolves.toBe(true);
  });

  it("returns false — not an error — on a 23505 unique-violation", async () => {
    // This is the exact conflict a second, overlapping discovery call
    // produces once the database constraint is in place: Postgres refused
    // the duplicate, which is success from the caller's point of view (the
    // name is suggested, whichever call got there first), not a failure.
    const db = fakeDb({ error: { code: "23505" } });
    await expect(
      insertSuggestionIfNew(db, "user-1", candidate()),
    ).resolves.toBe(false);
  });

  it("re-throws any other database error rather than silently skipping it", async () => {
    const db = fakeDb({ error: { code: "42501" } });
    await expect(
      insertSuggestionIfNew(db, "user-1", candidate()),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("simulated concurrency: only one of two racing inserts for the same name succeeds", async () => {
    // Simulates what actually happens against Postgres: the first writer to
    // reach the unique index wins, the second gets 23505 — modelled here as
    // two calls sharing one mock "index" so the second always conflicts,
    // regardless of call order, the same guarantee the real constraint gives
    // regardless of which process's request the database sees first.
    let claimed = false;
    const insert = vi.fn().mockImplementation(async () => {
      if (claimed) return { error: { code: "23505" } };
      claimed = true;
      return { error: null };
    });
    const db = { from: vi.fn().mockReturnValue({ insert }) } as unknown as Db;

    const results = await Promise.all([
      insertSuggestionIfNew(db, "user-1", candidate()),
      insertSuggestionIfNew(db, "user-1", candidate()),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((r) => r === false)).toHaveLength(1);
  });
});
