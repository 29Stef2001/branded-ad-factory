import { describe, expect, it } from "vitest";
import { capList } from "@/lib/ai/cap-list";

describe("capList", () => {
  it("keeps a list that is already within the cap", () => {
    expect(capList(["a", "b"], 5)).toEqual(["a", "b"]);
  });

  it("trims the surplus instead of rejecting the list", () => {
    // The whole point: a model returning six observations used to fail schema
    // validation and lose the entire paid analysis. Now it keeps five.
    expect(capList(["a", "b", "c", "d", "e", "f", "g"], 5)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("keeps the first items, which is the order the model ranked them in", () => {
    expect(capList(["most important", "second", "third"], 2)).toEqual([
      "most important",
      "second",
    ]);
  });

  it("treats a missing list as empty rather than throwing", () => {
    expect(capList(undefined, 5)).toEqual([]);
  });

  it("handles an empty list", () => {
    expect(capList([], 5)).toEqual([]);
  });
});
