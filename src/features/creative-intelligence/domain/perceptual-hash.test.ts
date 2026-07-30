import { describe, expect, it } from "vitest";
import {
  HASH_LENGTH,
  dHashFromGreyscale,
  isValidHash,
  toGreyscale,
} from "@/features/creative-intelligence/domain/perceptual-hash";
import { hammingDistance } from "@/features/creative-intelligence/domain/attribution";

/** A 9x8 greyscale grid from a per-pixel function. */
function grid(fn: (col: number, row: number) => number): number[] {
  const pixels: number[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 9; col++) pixels.push(fn(col, row));
  }
  return pixels;
}

describe("dHashFromGreyscale", () => {
  it("produces a 64-bit hash as 16 hex characters", () => {
    const hash = dHashFromGreyscale(grid((col) => col * 20));

    expect(hash).toHaveLength(HASH_LENGTH);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("records the direction of each gradient", () => {
    // Every pixel darker than the one to its right: no bit set anywhere.
    expect(dHashFromGreyscale(grid((col) => col * 20))).toBe("0".repeat(16));
    // Every pixel brighter than its right-hand neighbour: all bits set.
    expect(dHashFromGreyscale(grid((col) => 200 - col * 20))).toBe(
      "f".repeat(16),
    );
  });

  it("is unchanged by a uniform brightness shift", () => {
    // The property that matters: re-exporting an image a little brighter must
    // not change its identity. An average hash would fail this.
    const original = grid((col, row) => 40 + col * 10 + row * 3);
    const brighter = original.map((value) => value + 30);

    expect(dHashFromGreyscale(brighter)).toBe(dHashFromGreyscale(original));
  });

  it("is nearly unchanged by mild per-pixel noise", () => {
    // Stands in for what re-encoding does to an image.
    const original = grid((col, row) => 40 + col * 12 + row * 5);
    const noisy = original.map((value, index) =>
      index % 3 === 0 ? value + 2 : value - 1,
    );

    const distance = hammingDistance(
      dHashFromGreyscale(original),
      dHashFromGreyscale(noisy),
    );

    expect(distance).not.toBeNull();
    expect(distance!).toBeLessThanOrEqual(6);
  });

  it("differs sharply between unrelated images", () => {
    const gradient = dHashFromGreyscale(grid((col) => col * 25));
    const inverted = dHashFromGreyscale(grid((col) => 200 - col * 25));

    expect(hammingDistance(gradient, inverted)).toBe(64);
  });

  it("refuses a grid of the wrong size rather than hashing garbage", () => {
    expect(() => dHashFromGreyscale([1, 2, 3])).toThrow(/72 greyscale samples/);
    expect(() => dHashFromGreyscale(new Array(71).fill(0))).toThrow();
  });
});

describe("toGreyscale", () => {
  it("weights the channels the way an eye does", () => {
    // Pure green reads far brighter than pure blue at the same value.
    const [red] = toGreyscale([255, 0, 0, 255]);
    const [green] = toGreyscale([0, 255, 0, 255]);
    const [blue] = toGreyscale([0, 0, 255, 255]);

    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });

  it("ignores the alpha channel", () => {
    expect(toGreyscale([100, 100, 100, 0])[0]).toBeCloseTo(
      toGreyscale([100, 100, 100, 255])[0],
      5,
    );
  });

  it("converts one sample per pixel", () => {
    expect(toGreyscale(new Array(4 * 72).fill(128))).toHaveLength(72);
  });
});

describe("isValidHash", () => {
  it("accepts a well-formed hash", () => {
    expect(isValidHash("f0f0f0f0f0f0f0f0")).toBe(true);
  });

  it("rejects anything that could not have come from dHash", () => {
    expect(isValidHash("f0f0")).toBe(false);
    expect(isValidHash("F0F0F0F0F0F0F0F0")).toBe(false);
    expect(isValidHash("zzzzzzzzzzzzzzzz")).toBe(false);
    expect(isValidHash(null)).toBe(false);
    expect(isValidHash(undefined)).toBe(false);
  });
});
