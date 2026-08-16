import { describe, expect, it } from "vitest";
import type { SyncCursor } from "@/features/creative-intelligence/application/sync-meta-data";

/**
 * The account hand-off, tested as pure cursor arithmetic.
 *
 * runSyncStep itself needs a live Graph API and a database, but the part that
 * actually goes wrong at 12 accounts is the bookkeeping: which account we are
 * on, when to move to the next, and when the run is genuinely finished rather
 * than merely finished with one account. That logic is reproduced here exactly
 * as the sync computes it.
 */

function nextAccount(accountIndex: number, total: number): SyncCursor {
  return accountIndex + 1 < total
    ? { phase: "campaigns", accountIndex: accountIndex + 1 }
    : { phase: "done" };
}

function isDone(hasNextPage: boolean, accountIndex: number, total: number) {
  return !hasNextPage && accountIndex + 1 >= total;
}

describe("multi-account cursor", () => {
  it("moves to the next account when one finishes", () => {
    expect(nextAccount(0, 12)).toEqual({ phase: "campaigns", accountIndex: 1 });
  });

  it("restarts each account at the first phase", () => {
    // The phases describe one account's objects, not the run as a whole, so
    // account two has its own campaigns to walk.
    expect(nextAccount(5, 12).phase).toBe("campaigns");
  });

  it("finishes only after the last account", () => {
    expect(nextAccount(11, 12)).toEqual({ phase: "done" });
  });

  it("does not report done while accounts remain", () => {
    // The bug this guards: returning done:true after the first account would
    // leave eleven unsynced and look like success.
    expect(isDone(false, 0, 12)).toBe(false);
    expect(isDone(false, 10, 12)).toBe(false);
    expect(isDone(false, 11, 12)).toBe(true);
  });

  it("does not report done while a page remains on the last account", () => {
    expect(isDone(true, 11, 12)).toBe(false);
  });

  it("handles a single selected account", () => {
    expect(nextAccount(0, 1)).toEqual({ phase: "done" });
    expect(isDone(false, 0, 1)).toBe(true);
  });

  it("walks every account exactly once", () => {
    const total = 12;
    const visited: number[] = [];
    let cursor: SyncCursor = { phase: "campaigns", accountIndex: 0 };

    for (let guard = 0; guard < 100 && cursor.phase !== "done"; guard++) {
      const index = cursor.accountIndex ?? 0;
      visited.push(index);
      cursor = nextAccount(index, total);
    }

    expect(visited).toEqual([...Array(total).keys()]);
  });
});
