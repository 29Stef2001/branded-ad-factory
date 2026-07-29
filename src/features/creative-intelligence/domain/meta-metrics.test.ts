import { describe, expect, it } from "vitest";
import {
  RESTATEMENT_WINDOW_DAYS,
  actionValue,
  isFinal,
  parseInsightRow,
} from "@/features/creative-intelligence/domain/meta-metrics";

describe("actionValue", () => {
  const actions = [
    { action_type: "purchase", value: "3" },
    { action_type: "omni_purchase", value: "5" },
    { action_type: "add_to_cart", value: "12" },
  ];

  it("takes the most specific alias, never the sum", () => {
    // omni_purchase aggregates pixel, app and offline and overlaps `purchase`.
    // Summing both is how a dashboard reports twice the real order count.
    expect(actionValue(actions, ["omni_purchase", "purchase"])).toBe(5);
    expect(actionValue(actions, ["purchase", "omni_purchase"])).toBe(3);
  });

  it("falls through the alias list until something matches", () => {
    expect(actionValue(actions, ["missing", "add_to_cart"])).toBe(12);
  });

  it("returns zero when nothing matches or there is nothing to search", () => {
    expect(actionValue(actions, ["lead"])).toBe(0);
    expect(actionValue(undefined, ["purchase"])).toBe(0);
    expect(actionValue([], ["purchase"])).toBe(0);
  });

  it("copes with Meta returning numbers as strings", () => {
    expect(actionValue([{ action_type: "x", value: "7.5" }], ["x"])).toBe(7.5);
    expect(actionValue([{ action_type: "x", value: 7.5 }], ["x"])).toBe(7.5);
  });

  it("treats an unparseable value as zero rather than NaN", () => {
    expect(actionValue([{ action_type: "x", value: "n/a" }], ["x"])).toBe(0);
  });
});

describe("parseInsightRow", () => {
  const row = {
    date_start: "2026-07-15",
    ad_id: "123",
    impressions: "4241",
    reach: "3800",
    frequency: "1.12",
    spend: "66.75",
    clicks: "324",
    inline_link_clicks: "280",
    outbound_clicks: [{ action_type: "outbound_click", value: "270" }],
    actions: [
      { action_type: "omni_purchase", value: "8" },
      { action_type: "omni_add_to_cart", value: "31" },
      { action_type: "omni_initiated_checkout", value: "14" },
      { action_type: "landing_page_view", value: "250" },
      { action_type: "post_engagement", value: "410" },
      { action_type: "lead", value: "2" },
    ],
    action_values: [
      { action_type: "omni_purchase", value: "640.50" },
      { action_type: "omni_add_to_cart", value: "2100.00" },
    ],
  };

  it("maps the full delivery, engagement and conversion set", () => {
    const parsed = parseInsightRow(row)!;

    expect(parsed).toMatchObject({
      statDate: "2026-07-15",
      metaAdId: "123",
      impressions: 4241,
      reach: 3800,
      frequency: 1.12,
      spend: 66.75,
      clicks: 324,
      linkClicks: 280,
      outboundClicks: 270,
      landingPageViews: 250,
      postEngagements: 410,
      purchases: 8,
      revenue: 640.5,
      addToCart: 31,
      addToCartValue: 2100,
      initiateCheckout: 14,
      leads: 2,
    });
  });

  it("returns zeros, not nulls, for an account with no conversion tracking", () => {
    // The current state of this account: delivery and clicks, nothing else.
    const parsed = parseInsightRow({
      date_start: "2026-07-15",
      ad_id: "123",
      impressions: "4241",
      clicks: "324",
      spend: "66.75",
    })!;

    expect(parsed.purchases).toBe(0);
    expect(parsed.revenue).toBe(0);
    expect(parsed.addToCart).toBe(0);
    expect(parsed.impressions).toBe(4241);
  });

  it("sums video metrics across their breakdowns", () => {
    const parsed = parseInsightRow({
      date_start: "2026-07-15",
      ad_id: "123",
      video_play_actions: [
        { action_type: "video_view", value: "100" },
        { action_type: "video_view_other", value: "50" },
      ],
    })!;

    expect(parsed.videoPlays).toBe(150);
  });

  it("rejects a row that cannot be keyed", () => {
    expect(parseInsightRow({ impressions: "100" })).toBeNull();
    expect(parseInsightRow({ ad_id: "123" })).toBeNull();
    expect(parseInsightRow({ date_start: "2026-07-15" })).toBeNull();
  });

  it("distinguishes a missing frequency from a zero one", () => {
    expect(
      parseInsightRow({ date_start: "d", ad_id: "1" })!.frequency,
    ).toBeNull();
    expect(
      parseInsightRow({ date_start: "d", ad_id: "1", frequency: "0" })!
        .frequency,
    ).toBe(0);
  });
});

describe("isFinal", () => {
  const today = new Date("2026-07-29T00:00:00Z");

  it("treats a recent day as still open to restatement", () => {
    expect(isFinal("2026-07-28", today)).toBe(false);
    expect(isFinal("2026-07-02", today)).toBe(false);
  });

  it("treats a day past the restatement window as final", () => {
    expect(isFinal("2026-06-01", today)).toBe(true);
  });

  it("uses the documented window boundary", () => {
    expect(RESTATEMENT_WINDOW_DAYS).toBe(28);
    // Exactly 28 days old is still inside the window.
    expect(isFinal("2026-07-01", today)).toBe(false);
    expect(isFinal("2026-06-30", today)).toBe(true);
  });
});
