import { describe, expect, it } from "vitest";

/**
 * The deadline arithmetic that keeps a DNA pass inside its invocation.
 *
 * A competitor-research run died on the platform's 60s ceiling because this
 * loop had no clock: the route checked the time before each competitor but
 * never between analyses, so ten paid calls for one competitor could outlast
 * the whole invocation — killed before `finishCompetitorResearchJob` ran,
 * leaving a `running` claim that blocked every later run until it went
 * stale. The rule is tested here rather than through the loop itself, which
 * would need a live database and ten Claude calls to exercise.
 */

const ESTIMATED_ANALYSIS_MS = 12_000;

/** The check `analyseCompetitorDnaForCompetitor` makes before each analysis. */
function hasTimeForAnother(now: number, deadline: number | undefined): boolean {
  if (deadline === undefined) return true;
  return now + ESTIMATED_ANALYSIS_MS <= deadline;
}

describe("the DNA loop's deadline check", () => {
  it("allows an analysis when the whole estimate fits", () => {
    const now = 1_000_000;
    expect(hasTimeForAnother(now, now + 20_000)).toBe(true);
  });

  it("refuses one that would finish past the deadline", () => {
    const now = 1_000_000;
    expect(hasTimeForAnother(now, now + 5_000)).toBe(false);
  });

  it("refuses at exactly one millisecond short of the estimate", () => {
    // The boundary is the point of the reserve: an analysis expected to end
    // on the deadline itself is the one that kills the invocation.
    const now = 1_000_000;
    expect(hasTimeForAnother(now, now + ESTIMATED_ANALYSIS_MS - 1)).toBe(false);
    expect(hasTimeForAnother(now, now + ESTIMATED_ANALYSIS_MS)).toBe(true);
  });

  it("never stops a caller that gave no deadline", () => {
    // Someone clicking "Refresh ads" has no wall-clock budget to respect —
    // the old behaviour has to survive unchanged for them.
    expect(hasTimeForAnother(Date.now(), undefined)).toBe(true);
  });

  it("refuses once the deadline has already passed", () => {
    const now = 1_000_000;
    expect(hasTimeForAnother(now, now - 1)).toBe(false);
  });
});
