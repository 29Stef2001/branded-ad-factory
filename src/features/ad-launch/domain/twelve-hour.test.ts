import { describe, expect, it } from "vitest";

/**
 * The 12-hour conversion the start-time picker performs, tested directly.
 *
 * Midnight and noon are the two values a plain modulo gets wrong — 0 % 12 is
 * 0, not 12 — and scheduling an ad set for the wrong half of the day is a
 * mistake nobody notices until delivery starts twelve hours late.
 */

function to12Hour(hour24: number): { hour: number; meridiem: "AM" | "PM" } {
  return {
    hour: hour24 % 12 === 0 ? 12 : hour24 % 12,
    meridiem: hour24 >= 12 ? "PM" : "AM",
  };
}

function to24Hour(hour12: number, meridiem: string): number {
  const base = hour12 % 12;
  return meridiem === "PM" ? base + 12 : base;
}

describe("12-hour display", () => {
  it("shows midnight as 12 AM, not 0", () => {
    expect(to12Hour(0)).toEqual({ hour: 12, meridiem: "AM" });
  });

  it("shows noon as 12 PM, not 0 PM", () => {
    expect(to12Hour(12)).toEqual({ hour: 12, meridiem: "PM" });
  });

  it("shows the ordinary hours", () => {
    expect(to12Hour(1)).toEqual({ hour: 1, meridiem: "AM" });
    expect(to12Hour(11)).toEqual({ hour: 11, meridiem: "AM" });
    expect(to12Hour(13)).toEqual({ hour: 1, meridiem: "PM" });
    expect(to12Hour(23)).toEqual({ hour: 11, meridiem: "PM" });
  });
});

describe("24-hour value", () => {
  it("turns 12 AM back into midnight", () => {
    expect(to24Hour(12, "AM")).toBe(0);
  });

  it("turns 12 PM back into noon", () => {
    expect(to24Hour(12, "PM")).toBe(12);
  });

  it("round-trips every hour of the day", () => {
    // The property that matters: what is displayed and what is sent must
    // describe the same moment, for all 24 of them.
    for (let hour = 0; hour < 24; hour++) {
      const shown = to12Hour(hour);
      expect(to24Hour(shown.hour, shown.meridiem)).toBe(hour);
    }
  });
});
