import { describe, expect, it } from "vitest";
import {
  MAX_REFERENCE_IMAGES,
  selectReferenceAssets,
  type BrandAssetCandidate,
} from "@/features/ad-concepts/domain/asset-selection";
import type { BrandAssetType } from "@/features/ad-concepts/domain/schemas";

let nextSortOrder = 0;

function asset(
  overrides: Partial<BrandAssetCandidate> & { asset_type: BrandAssetType },
): BrandAssetCandidate {
  return {
    id: overrides.id ?? `asset-${overrides.asset_type}-${nextSortOrder}`,
    label: null,
    image_url: null,
    storage_path: "path.png",
    is_primary: false,
    is_active: true,
    tags: [],
    region: null,
    season: null,
    sort_order: nextSortOrder++,
    ...overrides,
  };
}

/** Which asset filled a role, for concise assertions. */
function pick(
  result: ReturnType<typeof selectReferenceAssets<BrandAssetCandidate>>,
  role: string,
): string | null | undefined {
  return result.selected.find((entry) => entry.role === role)?.asset?.id;
}

describe("selectReferenceAssets — matching", () => {
  it("prefers an exact type match over an asset merely tagged with it", () => {
    const tagged = asset({
      id: "tagged",
      asset_type: "other",
      tags: ["packaging"],
    });
    const exact = asset({ id: "exact", asset_type: "packaging" });

    const result = selectReferenceAssets(
      ["packaging"],
      [tagged, exact],
      false,
      false,
    );

    expect(pick(result, "packaging")).toBe("exact");
  });

  it("falls back to the tag when no asset has the requested type", () => {
    const tagged = asset({
      id: "tagged",
      asset_type: "other",
      tags: ["Packaging"],
    });

    const result = selectReferenceAssets(["packaging"], [tagged], false, false);

    expect(pick(result, "packaging")).toBe("tagged");
  });

  it("ignores assets connected to the request by neither type nor tag", () => {
    const unrelated = asset({ id: "unrelated", asset_type: "storefront" });

    const result = selectReferenceAssets(
      ["packaging"],
      [unrelated],
      false,
      false,
    );

    expect(result.selected.some((entry) => entry.role === "packaging")).toBe(
      false,
    );
  });

  it("excludes inactive assets outright, even when nothing else matches", () => {
    const disabled = asset({
      id: "disabled",
      asset_type: "packaging",
      is_active: false,
      is_primary: true,
    });

    const result = selectReferenceAssets(
      ["packaging"],
      [disabled],
      false,
      false,
    );

    expect(result.selected).toHaveLength(0);
    expect(result.scores.packaging).toEqual([]);
  });
});

describe("selectReferenceAssets — ranking", () => {
  it("uses is_primary to break a tie between equal candidates", () => {
    const plain = asset({ id: "plain", asset_type: "product" });
    const primary = asset({
      id: "primary",
      asset_type: "product",
      is_primary: true,
    });

    const result = selectReferenceAssets([], [plain, primary], false, false);

    expect(pick(result, "product")).toBe("primary");
  });

  it("lets a season match beat the standing primary", () => {
    // is_primary means "use this when nothing better applies", so a specific
    // seasonal match has to outrank it — otherwise seasonal tagging is
    // decorative and a christmas campaign can never pick the christmas photo.
    const primary = asset({
      id: "primary",
      asset_type: "product",
      is_primary: true,
    });
    const seasonal = asset({
      id: "seasonal",
      asset_type: "product",
      season: "christmas",
    });

    const result = selectReferenceAssets(
      [],
      [primary, seasonal],
      false,
      false,
      {
        season: "christmas",
      },
    );

    expect(pick(result, "product")).toBe("seasonal");
  });

  it("lets a region match beat the standing primary", () => {
    const primary = asset({
      id: "primary",
      asset_type: "product",
      is_primary: true,
    });
    const regional = asset({
      id: "regional",
      asset_type: "product",
      region: "US",
    });

    const result = selectReferenceAssets(
      [],
      [primary, regional],
      false,
      false,
      {
        region: "us",
      },
    );

    expect(pick(result, "product")).toBe("regional");
  });

  it("lets context tags beat the standing primary", () => {
    const primary = asset({
      id: "primary",
      asset_type: "product",
      is_primary: true,
    });
    const tagged = asset({
      id: "tagged",
      asset_type: "product",
      tags: ["gifting", "winter"],
    });

    const result = selectReferenceAssets([], [primary, tagged], false, false, {
      tags: ["gifting", "winter"],
    });

    expect(pick(result, "product")).toBe("tagged");
  });

  it("caps the tag bonus so tag-stuffing cannot outrank a type match", () => {
    const stuffed = asset({
      id: "stuffed",
      asset_type: "other",
      tags: ["product", "a", "b", "c", "d", "e", "f"],
    });
    const real = asset({ id: "real", asset_type: "product" });

    const result = selectReferenceAssets([], [stuffed, real], false, false, {
      tags: ["a", "b", "c", "d", "e", "f"],
    });

    expect(pick(result, "product")).toBe("real");
  });

  it("does not penalise assets tagged for a different region or season", () => {
    const otherSeason = asset({
      id: "other-season",
      asset_type: "product",
      season: "summer",
    });

    const result = selectReferenceAssets([], [otherSeason], false, false, {
      season: "christmas",
    });

    // Still selected: most assets are season-agnostic, and punishing a mismatch
    // would push a perfectly good photo below nothing at all.
    expect(pick(result, "product")).toBe("other-season");
  });

  it("settles equal scores by the author's own sort order", () => {
    const second = asset({ id: "b", asset_type: "product", sort_order: 5 });
    const first = asset({ id: "a", asset_type: "product", sort_order: 1 });

    const result = selectReferenceAssets([], [second, first], false, false);

    expect(pick(result, "product")).toBe("a");
  });
});

describe("selectReferenceAssets — composition", () => {
  it("includes the owner whenever one exists, unasked", () => {
    // A creative featuring a different face every time is the failure this
    // prevents, so the owner is not left to the concept to remember.
    const owner = asset({ id: "owner", asset_type: "owner" });

    const result = selectReferenceAssets([], [owner], false, false);

    expect(pick(result, "owner")).toBe("owner");
  });

  it("defers product and logo to the caller when supplied directly", () => {
    const libraryProduct = asset({ id: "library", asset_type: "product" });

    const result = selectReferenceAssets([], [libraryProduct], true, true);
    const product = result.selected.find((entry) => entry.role === "product");
    const logo = result.selected.find((entry) => entry.role === "logo");

    // asset: null means "the caller resolves this one" — a URL pasted for this
    // concept is a deliberate choice and beats the library.
    expect(product?.asset).toBeNull();
    expect(logo?.asset).toBeNull();
  });

  it("never attaches the same asset to two roles", () => {
    const dual = asset({
      id: "dual",
      asset_type: "product",
      tags: ["packaging"],
    });

    const result = selectReferenceAssets(["packaging"], [dual], false, false);

    const ids = result.selected.map((entry) => entry.asset?.id).filter(Boolean);
    expect(ids).toEqual([...new Set(ids)]);
    expect(ids).toHaveLength(1);
  });

  it("deduplicates a repeated requirement", () => {
    const packaging = asset({ id: "pack", asset_type: "packaging" });

    const result = selectReferenceAssets(
      ["packaging", "packaging", "packaging"],
      [packaging],
      false,
      false,
    );

    expect(
      result.selected.filter((entry) => entry.role === "packaging"),
    ).toHaveLength(1);
  });

  it("never exceeds the reference budget", () => {
    const requirements: BrandAssetType[] = [
      "packaging",
      "storefront",
      "business_card",
      "thank_you_card",
      "shopping_bag",
      "icon",
    ];
    const assets = [
      asset({ id: "owner", asset_type: "owner" }),
      ...requirements.map((type) => asset({ id: type, asset_type: type })),
    ];

    const result = selectReferenceAssets(requirements, assets, true, true);

    expect(result.selected).toHaveLength(MAX_REFERENCE_IMAGES);
    expect(MAX_REFERENCE_IMAGES).toBe(5);
  });

  it("names crowded-out requirements in the overflow notes", () => {
    const requirements: BrandAssetType[] = [
      "packaging",
      "storefront",
      "business_card",
      "shopping_bag",
    ];
    const assets = [
      asset({ id: "owner", asset_type: "owner" }),
      ...requirements.map((type) =>
        asset({ id: type, asset_type: type, label: `The ${type}` }),
      ),
    ];

    const result = selectReferenceAssets(requirements, assets, true, true);

    // product + owner + logo + packaging fill the five slots with one contextual
    // asset; the rest are described in words rather than dropped in silence.
    expect(result.overflowNotes.length).toBeGreaterThan(0);
    expect(result.overflowNotes.join(" ")).toContain("The ");
  });

  it("reports a score breakdown for every role it considered", () => {
    const product = asset({
      id: "product",
      asset_type: "product",
      is_primary: true,
    });

    const result = selectReferenceAssets([], [product], false, false);

    expect(result.scores.product).toHaveLength(1);
    expect(result.scores.product[0].score).toBeGreaterThan(0);
    expect(result.scores.product[0].reasons.join(" ")).toContain("exact type");
  });
});
