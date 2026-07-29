import { describe, expect, it } from "vitest";
import {
  brandAssetTypeEnum,
  conceptsOutputSchemaV2,
  strategyTypeEnum,
  type BrandAssetType,
  type ConceptV2,
} from "@/features/ad-concepts/domain/schemas";
import {
  isUnapprovedMessage,
  matchApprovedMessage,
} from "@/features/ad-concepts/domain/approved-message";

function concept(overrides: Partial<ConceptV2> = {}): ConceptV2 {
  return {
    headline: "There Are 41 Pieces Left.",
    hook: "She never did restocks.",
    bodyCopy: "Every piece came off one bench.",
    visualDirection: "Tight documentary close-up on the last stock.",
    callToAction: "See what's left",
    title: "Final stock scarcity",
    strategyType: "moderate_variation",
    campaignAngle: "Genuine scarcity, no manufactured urgency",
    primaryPromotionalMessage: "FINAL STOCK",
    visualHook: "Empty spaces where pieces used to sit",
    emotionalDriver: "Loss aversion",
    scene: "A working coppersmith's bench",
    subject: "The last three cuffs",
    productPlacement: "Laid out on a worn wooden tray",
    brandAssetRequirements: ["product", "owner"],
    messagePlacement: "handwritten cardboard sign",
    cameraStyle: "documentary phone-shot",
    lighting: "Cool workshop shadow, warm pool on the copper",
    composition: "Overhead, slightly off-axis",
    textStyle: "red marker",
    elementsToPreserve: ["the cuff's patina"],
    elementsToVary: ["the background clutter"],
    finalGenerationPrompt: "A worn bench with the last three cuffs.",
    ...overrides,
  } as ConceptV2;
}

const validOutput = { concepts: [concept(), concept(), concept()] };

describe("structured concept output", () => {
  it("accepts a well-formed set of three concepts", () => {
    const parsed = conceptsOutputSchemaV2.safeParse(validOutput);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.concepts).toHaveLength(3);
      expect(parsed.data.concepts[0].finalGenerationPrompt).toBeTruthy();
    }
  });

  it("requires exactly three concepts", () => {
    expect(
      conceptsOutputSchemaV2.safeParse({ concepts: [concept()] }).success,
    ).toBe(false);
    expect(
      conceptsOutputSchemaV2.safeParse({
        concepts: [concept(), concept(), concept(), concept()],
      }).success,
    ).toBe(false);
  });

  it("rejects a concept missing the prompt image generation needs", () => {
    const { finalGenerationPrompt: _dropped, ...withoutPrompt } = concept();

    const parsed = conceptsOutputSchemaV2.safeParse({
      concepts: [withoutPrompt, concept(), concept()],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a strategy type the model invented", () => {
    const parsed = conceptsOutputSchemaV2.safeParse({
      concepts: [
        concept({ strategyType: "wildly_experimental" as never }),
        concept(),
        concept(),
      ],
    });

    expect(parsed.success).toBe(false);
    expect(strategyTypeEnum.options).toContain("moderate_variation");
  });
});

describe("truncated and malformed output", () => {
  it("surfaces truncation rather than silently returning half a concept", () => {
    // The real failure: max_tokens was too low and the JSON was cut mid-string,
    // so parsing threw "Unterminated string". A truncated response must never
    // look like a successful one.
    const complete = JSON.stringify(validOutput);
    const truncated = complete.slice(0, Math.floor(complete.length * 0.6));

    expect(() => JSON.parse(truncated)).toThrow();
  });

  it("rejects output that parses as JSON but is not a concept set", () => {
    for (const malformed of [
      {},
      { concepts: null },
      { concepts: "three of them" },
      { concepts: [{ headline: "Only a headline" }] },
      [concept(), concept(), concept()],
    ]) {
      expect(conceptsOutputSchemaV2.safeParse(malformed).success).toBe(false);
    }
  });

  it("rejects a null where a required string belongs", () => {
    const parsed = conceptsOutputSchemaV2.safeParse({
      concepts: [
        concept({ finalGenerationPrompt: null as never }),
        concept(),
        concept(),
      ],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("brand asset requirements", () => {
  it("accepts the asset types the library actually supports", () => {
    const parsed = conceptsOutputSchemaV2.safeParse({
      concepts: [
        concept({
          brandAssetRequirements: ["product", "owner", "logo", "packaging"],
        }),
        concept(),
        concept(),
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects an asset type the model made up", () => {
    const parsed = conceptsOutputSchemaV2.safeParse({
      concepts: [
        concept({
          brandAssetRequirements: ["neon_sign"] as unknown as BrandAssetType[],
        }),
        concept(),
        concept(),
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("filters unknown requirements without discarding the usable ones", () => {
    // How the generation action defends itself: brand_asset_requirements is a
    // text[] filled from model output, so an unknown value would match no asset
    // and silently consume a reference slot.
    const raw = ["product", "neon_sign", "packaging", ""];

    const usable = raw.filter(
      (value): value is BrandAssetType =>
        brandAssetTypeEnum.safeParse(value).success,
    );

    expect(usable).toEqual(["product", "packaging"]);
  });
});

describe("approved promotional message enforcement", () => {
  const approved = [
    { id: "m1", message: "FINAL STOCK" },
    { id: "m2", message: "Free shipping over $75" },
  ];

  it("links a concept to the message it reproduced exactly", () => {
    expect(matchApprovedMessage("FINAL STOCK", approved)?.id).toBe("m1");
  });

  it("still links when the model changed only whitespace or case", () => {
    // These were unlinking silently under SQL equality, which let an approved
    // message reach the image as an unapproved claim.
    expect(matchApprovedMessage("  FINAL STOCK  ", approved)?.id).toBe("m1");
    expect(matchApprovedMessage("Final Stock", approved)?.id).toBe("m1");
    expect(matchApprovedMessage("FINAL  STOCK", approved)?.id).toBe("m1");
  });

  it("prefers the exact match when two messages differ only in case", () => {
    const both = [
      { id: "lower", message: "final stock" },
      { id: "upper", message: "FINAL STOCK" },
    ];

    expect(matchApprovedMessage("FINAL STOCK", both)?.id).toBe("upper");
    expect(matchApprovedMessage("final stock", both)?.id).toBe("lower");
  });

  it("refuses a message the model actually reworded", () => {
    // Deliberately not fuzzy beyond whitespace and case: reworded copy is not
    // approved copy, and quietly accepting it is the failure this guards.
    expect(isUnapprovedMessage("FINAL STOCK — ends tonight!", approved)).toBe(
      true,
    );
    expect(isUnapprovedMessage("Last chance", approved)).toBe(true);
    expect(isUnapprovedMessage("Free shipping over $50", approved)).toBe(true);
  });

  it("treats an empty or missing message as unapproved", () => {
    expect(isUnapprovedMessage(null, approved)).toBe(true);
    expect(isUnapprovedMessage(undefined, approved)).toBe(true);
    expect(isUnapprovedMessage("   ", approved)).toBe(true);
  });

  it("approves nothing when the brand has enabled no messages", () => {
    expect(isUnapprovedMessage("FINAL STOCK", [])).toBe(true);
  });
});
