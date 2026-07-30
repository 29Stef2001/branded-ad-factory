import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * That the rollup pages through the fact table.
 *
 * PostgREST caps a response at 1000 rows and this table grows by one row per ad
 * per day, so a lifetime window passes the cap within weeks. Truncated totals
 * are the worst kind of bug here: the numbers stay plausible, the scoring is
 * quietly computed from part of the data, and nothing surfaces.
 */

const PAGE_SIZE = 1000;

let totalRows = 0;
const rangesRequested: [number, number][] = [];

function row(index: number) {
  return {
    meta_entity_id: `ad-${index % 40}`,
    stat_date: "2026-07-15",
    impressions: 10,
    clicks: 1,
    link_clicks: 1,
    spend: 0.5,
    purchases: 0,
    revenue: 0,
    add_to_cart: 0,
    initiate_checkout: 0,
    landing_page_views: 0,
  };
}

/** A builder that behaves like PostgREST: never more than PAGE_SIZE per call. */
function queryBuilder() {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    gte: () => builder,
    range: (from: number, to: number) => {
      rangesRequested.push([from, to]);
      const slice: ReturnType<typeof row>[] = [];
      for (let i = from; i <= Math.min(to, totalRows - 1); i++)
        slice.push(row(i));
      return Promise.resolve({ data: slice, error: null });
    },
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ from: () => queryBuilder() }),
}));

const { totalsByEntity } =
  await import("@/features/creative-intelligence/infrastructure/creative-intelligence-repository");

beforeEach(() => {
  rangesRequested.length = 0;
  totalRows = 0;
});

describe("totalsByEntity paging", () => {
  it("reads a single page when the data fits", async () => {
    totalRows = 120;

    await totalsByEntity(30);

    expect(rangesRequested).toEqual([[0, PAGE_SIZE - 1]]);
  });

  it("keeps paging past the 1000-row ceiling", async () => {
    // 38 ads over a 28-day window is 1,064 rows — already past the cap.
    totalRows = 1064;

    await totalsByEntity(0);

    expect(rangesRequested).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("sums every page, not just the first", async () => {
    totalRows = 2500;

    const totals = await totalsByEntity(0);
    const impressions = totals.reduce((sum, t) => sum + t.impressions, 0);

    // 2,500 rows at 10 impressions each. A truncated read would report 10,000
    // and look perfectly reasonable.
    expect(impressions).toBe(25_000);
  });

  it("stops on a short page rather than requesting forever", async () => {
    totalRows = 1500;

    await totalsByEntity(0);

    expect(rangesRequested).toHaveLength(2);
  });

  it("handles an empty table without a second request", async () => {
    totalRows = 0;

    const totals = await totalsByEntity(30);

    expect(totals).toEqual([]);
    expect(rangesRequested).toHaveLength(1);
  });
});
