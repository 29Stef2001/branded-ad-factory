import { describe, expect, it } from "vitest";
import {
  rankAccounts,
  scoreAccount,
  suggestedAccount,
  tokenise,
} from "@/features/creative-intelligence/domain/account-matching";

/**
 * Fixtures taken from the real account list, which is what makes them useful:
 * these names are agency codes with a brand buried in the middle.
 */
const REAL_ACCOUNTS = [
  {
    adAccountId: "act_840682808463889",
    name: "1250 - 70007 - 025922 - ceylorin",
  },
  {
    adAccountId: "act_4337432336508633",
    name: "2067 - copper-soul - 025922 - RAM",
  },
  { adAccountId: "act_265410514186416", name: "Stef de Boer" },
  { adAccountId: "act_1100862221342429", name: "Luxano" },
  {
    adAccountId: "act_1077846084812104",
    name: "0217 - 70033 - harrison-cap - 50",
  },
];

describe("tokenise", () => {
  it("keeps the words and drops the account numbers", () => {
    expect(tokenise("2067 - copper-soul - 025922 - RAM")).toEqual([
      "copper",
      "soul",
      "ram",
    ]);
  });

  it("treats the separators Meta names use as equivalent", () => {
    expect(tokenise("copper-soul")).toEqual(tokenise("Copper Soul"));
    expect(tokenise("copper_soul")).toEqual(tokenise("copper-soul"));
  });

  it("drops fragments too short to mean anything", () => {
    expect(tokenise("a b cd efg")).toEqual(["efg"]);
  });
});

describe("scoreAccount", () => {
  it("scores a full brand-name match highest", () => {
    const scored = scoreAccount(REAL_ACCOUNTS[1], "Copper & Soul");

    expect(scored.score).toBe(1);
    expect(scored.reason).toContain("copper");
    expect(scored.reason).toContain("soul");
  });

  it("gives an unrelated account nothing", () => {
    expect(scoreAccount(REAL_ACCOUNTS[0], "Copper & Soul").score).toBe(0);
    expect(scoreAccount(REAL_ACCOUNTS[0], "Copper & Soul").reason).toBeNull();
  });

  it("scores a partial match proportionally", () => {
    const scored = scoreAccount(
      { adAccountId: "act_1", name: "1234 - copper - 5678" },
      "Copper & Soul",
    );

    expect(scored.score).toBe(0.5);
  });

  it("ignores the ampersand rather than treating it as a word", () => {
    // "Copper & Soul" is two meaningful tokens, not three.
    expect(scoreAccount(REAL_ACCOUNTS[1], "Copper & Soul").score).toBe(1);
  });

  it("returns zero when either side has nothing to compare", () => {
    expect(scoreAccount({ adAccountId: "a", name: null }, "Copper").score).toBe(
      0,
    );
    expect(scoreAccount(REAL_ACCOUNTS[1], "").score).toBe(0);
  });

  it("does not match on words every agency account shares", () => {
    const scored = scoreAccount(
      { adAccountId: "act_x", name: "0001 - store - shop - ads" },
      "The Store Shop",
    );

    expect(scored.score).toBe(0);
  });
});

describe("rankAccounts", () => {
  it("puts the right account first out of the real list", () => {
    // The mistake this prevents: act_840682808463889 (ceylorin) was connected
    // and synced for weeks while Copper & Soul sat further down the list.
    const ranked = rankAccounts(REAL_ACCOUNTS, "Copper & Soul");

    expect(ranked[0].adAccountId).toBe("act_4337432336508633");
  });

  it("returns every account, not just the matches", () => {
    // With 44 accounts the user still has to be able to find one the
    // heuristic missed.
    expect(rankAccounts(REAL_ACCOUNTS, "Copper & Soul")).toHaveLength(
      REAL_ACCOUNTS.length,
    );
  });

  it("leaves the list alone when there is no brand name to match on", () => {
    const ranked = rankAccounts(REAL_ACCOUNTS, null);

    expect(ranked.map((a) => a.adAccountId)).toEqual(
      REAL_ACCOUNTS.map((a) => a.adAccountId),
    );
    expect(ranked.every((a) => a.score === 0)).toBe(true);
  });
});

describe("suggestedAccount", () => {
  it("suggests the clear winner", () => {
    const suggestion = suggestedAccount(
      rankAccounts(REAL_ACCOUNTS, "Copper & Soul"),
    );

    expect(suggestion?.adAccountId).toBe("act_4337432336508633");
  });

  it("suggests nothing when two accounts match equally well", () => {
    // Real case: "0206 - harrison-cap" and "0207 - harrison-cap" both exist.
    // Picking one arbitrarily is the silent mistake worth refusing.
    const ranked = rankAccounts(
      [
        { adAccountId: "act_1", name: "0206 - 70033 - harrison-cap - 50" },
        { adAccountId: "act_2", name: "0207 - 70033 - harrison-cap - 50" },
      ],
      "Harrison Cap",
    );

    expect(ranked[0].score).toBe(1);
    expect(suggestedAccount(ranked)).toBeNull();
  });

  it("suggests nothing when the best match is weak", () => {
    const ranked = rankAccounts(REAL_ACCOUNTS, "Totally Different Brand");

    expect(suggestedAccount(ranked)).toBeNull();
  });

  it("suggests nothing for an empty list", () => {
    expect(suggestedAccount([])).toBeNull();
  });
});
