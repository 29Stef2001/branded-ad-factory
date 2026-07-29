import { describe, expect, it } from "vitest";
import {
  buildImagePrompt,
  buildImagePromptSections,
  resolveScenePrompt,
} from "@/features/ad-concepts/domain/image-prompt";
import {
  buildBrandContext,
  type BrandContextInput,
} from "@/features/ad-concepts/domain/brand-context";

function brand(overrides: Partial<BrandContextInput> = {}) {
  return buildBrandContext({
    brand_name: "Copper & Soul",
    brand_category: "handmade copper jewellery",
    markets: ["US"],
    languages: ["en"],
    brand_story: null,
    brand_mission: null,
    target_audience: "US women 35-65",
    tone_attributes: ["warm"],
    tone_notes: null,
    writing_style: null,
    visual_style: "Warm workshop light",
    photography_style: "documentary",
    brand_colors: null,
    typography_notes: null,
    logo_rules: null,
    emboss_style: "none",
    emboss_custom_notes: null,
    foil_style: "none",
    foil_custom_notes: null,
    founder_name: "Marianne",
    founder_gender: "female",
    founder_age: 64,
    founder_background: "Coppersmith since 1995",
    product_positioning: null,
    price_positioning: null,
    materials: ["solid copper"],
    usps: [],
    brand_values: [],
    words_to_always_use: [],
    words_to_never_use: ["cheap"],
    image_generation_rules: "Never show a polished studio set.",
    copy_generation_rules: "No exclamation marks.",
    qa_expectations: null,
    qa_min_score: null,
    ...overrides,
  });
}

const scene = "A worn bench with the last three cuffs laid out.";

describe("resolveScenePrompt", () => {
  it("prefers a hand-written override above everything else", () => {
    expect(
      resolveScenePrompt({
        generationPromptOverride: "OVERRIDE",
        finalGenerationPrompt: "GENERATED",
        visualDirection: "DIRECTION",
      }),
    ).toBe("OVERRIDE");
  });

  it("falls back to the generated prompt when there is no override", () => {
    expect(
      resolveScenePrompt({
        generationPromptOverride: null,
        finalGenerationPrompt: "GENERATED",
        visualDirection: "DIRECTION",
      }),
    ).toBe("GENERATED");
  });

  it("falls back to visual direction for pre-structured-output concepts", () => {
    expect(
      resolveScenePrompt({
        generationPromptOverride: null,
        finalGenerationPrompt: null,
        visualDirection: "DIRECTION",
      }),
    ).toBe("DIRECTION");
  });

  it("treats a blank override as unset rather than as empty instructions", () => {
    // Clearing the textarea stores "" rather than null. That has to mean "use
    // the original", not "generate from nothing".
    expect(
      resolveScenePrompt({
        generationPromptOverride: "   ",
        finalGenerationPrompt: "GENERATED",
        visualDirection: "DIRECTION",
      }),
    ).toBe("GENERATED");
  });
});

describe("buildImagePromptSections", () => {
  it("includes every section the Prompt Builder promises to show", () => {
    const sections = buildImagePromptSections(
      {
        brand: brand(),
        scenePrompt: scene,
        promotionalMessage: "FINAL STOCK",
      },
      [{ role: "product" }, { role: "owner" }, { role: "logo" }],
    );

    expect(sections.map((section) => section.key)).toEqual([
      "brief",
      "references",
      "brand_context",
      "founder",
      "image_rules",
      "scene",
      "message",
      "language",
    ]);
  });

  it("marks only the concept scene as editable", () => {
    const sections = buildImagePromptSections({
      brand: brand(),
      scenePrompt: scene,
    });

    const editable = sections.filter((section) => section.editable);
    expect(editable).toHaveLength(1);
    expect(editable[0].key).toBe("scene");
  });

  it("puts the language rule last so it reads as overriding", () => {
    const sections = buildImagePromptSections({
      brand: brand(),
      scenePrompt: scene,
    });

    expect(sections[sections.length - 1].key).toBe("language");
  });

  it("omits optional sections the brand has not configured", () => {
    const bare = brand({
      visual_style: null,
      photography_style: null,
      founder_name: null,
      founder_gender: null,
      founder_age: null,
      founder_background: null,
      words_to_never_use: [],
      image_generation_rules: null,
    });

    const keys = buildImagePromptSections({
      brand: bare,
      scenePrompt: scene,
    }).map((section) => section.key);

    expect(keys).not.toContain("brand_context");
    expect(keys).not.toContain("founder");
    expect(keys).not.toContain("image_rules");
    expect(keys).toContain("scene");
    expect(keys).toContain("language");
  });
});

describe("buildImagePrompt", () => {
  it("carries brand context, founder, rules and the scene", () => {
    const prompt = buildImagePrompt({ brand: brand(), scenePrompt: scene });

    expect(prompt).toContain("Copper & Soul");
    expect(prompt).toContain("Warm workshop light");
    expect(prompt).toContain("Marianne");
    expect(prompt).toContain("Gender: female");
    expect(prompt).toContain("Never show a polished studio set.");
    expect(prompt).toContain(scene);
  });

  it("describes the founder even when no owner photo is attached", () => {
    // The image prompt used to learn about her only from an attached photo, so
    // with no photo the model invented whoever it liked — which is how a brand
    // with a female owner ended up advertised by a male craftsman.
    const prompt = buildImagePrompt({ brand: brand(), scenePrompt: scene }, []);

    expect(prompt).toContain("Marianne");
    expect(prompt).toContain("Gender: female");
  });

  it("applies the English rule for a US brand", () => {
    const prompt = buildImagePrompt({ brand: brand(), scenePrompt: scene });

    expect(prompt).toContain("All text visible anywhere in the image");
    expect(prompt).toContain("English");
  });

  it("follows the brand's own market rather than hardcoding English", () => {
    const prompt = buildImagePrompt({
      brand: brand({ languages: ["nl"], markets: ["NL"] }),
      scenePrompt: scene,
    });

    expect(prompt).toContain("Dutch");
    expect(prompt).not.toContain("English");
  });

  it("renders the approved message verbatim as physical signage", () => {
    const prompt = buildImagePrompt({
      brand: brand(),
      scenePrompt: scene,
      promotionalMessage: "FINAL STOCK",
      messagePlacement: "on a handwritten cardboard sign",
      textStyle: "red marker",
    });

    expect(prompt).toContain('"FINAL STOCK"');
    expect(prompt).toContain("never as a digital overlay");
    expect(prompt).toContain("Place it on a handwritten cardboard sign.");
    expect(prompt).toContain("Style: red marker.");
    expect(prompt).toContain("Reproduce the wording exactly");
  });

  it("forbids all text when the concept carries no approved message", () => {
    const prompt = buildImagePrompt({
      brand: brand(),
      scenePrompt: scene,
      promotionalMessage: null,
    });

    expect(prompt).toContain("Do not render any words");
  });

  it("tells the model to preserve the product and the logo exactly", () => {
    const prompt = buildImagePrompt({ brand: brand(), scenePrompt: scene }, [
      { role: "product" },
      { role: "logo" },
    ]);

    expect(prompt).toContain("Reference image 1");
    expect(prompt).toContain("must be preserved exactly as-is");
    expect(prompt).toContain("not an invented or generic substitute");
    expect(prompt).toContain("Reference image 2");
    expect(prompt).toContain("do not redesign, restyle, or reinterpret it");
  });

  it("numbers references in the order they are attached", () => {
    const prompt = buildImagePrompt({ brand: brand(), scenePrompt: scene }, [
      { role: "owner" },
      { role: "packaging", label: "Kraft box" },
    ]);

    expect(prompt).toContain("Reference image 1 shows the real owner");
    expect(prompt).toContain('Reference image 2 ("Kraft box")');
  });

  it("describes overflow assets in words rather than dropping them", () => {
    const prompt = buildImagePrompt({
      brand: brand(),
      scenePrompt: scene,
      overflowNotes: ["storefront: The shop door"],
    });

    expect(prompt).toContain("described rather than attached");
    expect(prompt).toContain("The shop door");
  });

  it("does not leak reference labels or keys as prompt headings", () => {
    // Section labels are for the UI. Sending them would put "Founder
    // instructions" into the image as literal text.
    const prompt = buildImagePrompt({ brand: brand(), scenePrompt: scene });

    expect(prompt).not.toContain("Founder instructions");
    expect(prompt).not.toContain("Language and market rules");
    expect(prompt).not.toContain("Concept instructions");
  });
});
