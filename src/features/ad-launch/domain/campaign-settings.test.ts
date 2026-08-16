import { describe, expect, it } from "vitest";
import {
  optimizationGoalFor,
  parseCountries,
  requiresPixel,
  toMinorUnits,
  validateDraft,
  type BatchDraft,
} from "@/features/ad-launch/domain/campaign-settings";

function draft(overrides: Partial<BatchDraft> = {}): BatchDraft {
  return {
    adAccountId: "act_123",
    pageId: "page_1",
    campaignName: "Final stock",
    objective: "OUTCOME_SALES",
    dailyBudget: "20",
    countries: "GB",
    ageMin: 25,
    ageMax: 65,
    startTime: null,
    pixelId: "1709279657001941",
    customEventType: "PURCHASE",
    ads: [
      {
        primaryText: "Marianne is closing the workshop.",
        headline: "41 pieces left",
        description: "",
        callToAction: "SHOP_NOW",
        linkUrl: "https://copper-soul.com/collections/cuffs",
        imageUrl: "https://cdn.example.com/a.png",
      },
    ],
    ...overrides,
  };
}

describe("optimizationGoalFor", () => {
  it("pairs each objective with the goal Meta expects", () => {
    // Getting this wrong is error 1885760, which only appears at creation
    // time — the whole reason this is derived rather than chosen.
    expect(optimizationGoalFor("OUTCOME_SALES")).toBe("OFFSITE_CONVERSIONS");
    expect(optimizationGoalFor("OUTCOME_TRAFFIC")).toBe("LINK_CLICKS");
    expect(optimizationGoalFor("OUTCOME_AWARENESS")).toBe("REACH");
  });
});

describe("requiresPixel", () => {
  it("requires a pixel exactly where conversions are optimised for", () => {
    expect(requiresPixel("OUTCOME_SALES")).toBe(true);
    expect(requiresPixel("OUTCOME_LEADS")).toBe(true);
    expect(requiresPixel("OUTCOME_TRAFFIC")).toBe(false);
    expect(requiresPixel("OUTCOME_AWARENESS")).toBe(false);
  });
});

describe("toMinorUnits", () => {
  it("converts to the units Meta bills in", () => {
    // £20 sent as 20 buys twenty pence of delivery a day and looks like the
    // ad simply is not running.
    expect(toMinorUnits("20")).toBe(2000);
    expect(toMinorUnits("19.99")).toBe(1999);
    expect(toMinorUnits(5)).toBe(500);
  });

  it("rounds rather than truncating fractional pence", () => {
    expect(toMinorUnits("10.005")).toBe(1001);
  });

  it("rejects anything that is not a positive amount", () => {
    expect(toMinorUnits("0")).toBeNull();
    expect(toMinorUnits("-5")).toBeNull();
    expect(toMinorUnits("abc")).toBeNull();
    expect(toMinorUnits("")).toBeNull();
  });
});

describe("parseCountries", () => {
  it("accepts the separators people actually type", () => {
    expect(parseCountries("GB, US")).toEqual(["GB", "US"]);
    expect(parseCountries("gb us")).toEqual(["GB", "US"]);
    expect(parseCountries("GB,US,")).toEqual(["GB", "US"]);
  });

  it("drops anything that is not a two-letter code", () => {
    expect(parseCountries("GB, United Kingdom, US")).toEqual(["GB", "US"]);
    expect(parseCountries("123")).toEqual([]);
  });

  it("removes duplicates", () => {
    expect(parseCountries("GB, gb, GB")).toEqual(["GB"]);
  });
});

describe("validateDraft", () => {
  it("passes a complete draft", () => {
    expect(validateDraft(draft())).toEqual([]);
  });

  it("reports everything wrong at once", () => {
    // A form with eight ads should not be a game of fix-one, submit, repeat.
    const problems = validateDraft(
      draft({ campaignName: "", dailyBudget: "0", countries: "" }),
    );

    expect(problems.map((p) => p.field)).toEqual(
      expect.arrayContaining(["campaignName", "dailyBudget", "countries"]),
    );
  });

  it("requires a pixel for a sales campaign and not for traffic", () => {
    expect(
      validateDraft(draft({ pixelId: null })).some(
        (p) => p.field === "pixelId",
      ),
    ).toBe(true);

    expect(
      validateDraft(
        draft({ objective: "OUTCOME_TRAFFIC", pixelId: null }),
      ).some((p) => p.field === "pixelId"),
    ).toBe(false);
  });

  it("requires a Page, because no creative exists without one", () => {
    expect(
      validateDraft(draft({ pageId: "" })).some((p) => p.field === "pageId"),
    ).toBe(true);
  });

  it("rejects a start time in the past", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(
      validateDraft(draft({ startTime: past })).some(
        (p) => p.field === "startTime",
      ),
    ).toBe(true);
  });

  it("accepts a start time in the future", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(validateDraft(draft({ startTime: future }))).toEqual([]);
  });

  it("rejects an impossible age range", () => {
    expect(
      validateDraft(draft({ ageMin: 40, ageMax: 20 })).some(
        (p) => p.field === "age",
      ),
    ).toBe(true);
    expect(
      validateDraft(draft({ ageMin: 10, ageMax: 65 })).some(
        (p) => p.field === "age",
      ),
    ).toBe(true);
  });

  it("needs at least one ad", () => {
    expect(
      validateDraft(draft({ ads: [] })).some((p) => p.field === "ads"),
    ).toBe(true);
  });

  it("names which ad is at fault", () => {
    const problems = validateDraft(
      draft({
        ads: [draft().ads[0], { ...draft().ads[0], headline: "" }],
      }),
    );

    expect(problems.map((p) => p.field)).toContain("ads.1");
    expect(problems.map((p) => p.field)).not.toContain("ads.0");
  });

  it("rejects a URL without a scheme", () => {
    const problems = validateDraft(
      draft({
        ads: [{ ...draft().ads[0], linkUrl: "copper-soul.com/cuffs" }],
      }),
    );

    expect(problems.some((p) => p.message.includes("http://"))).toBe(true);
  });
});
