import {
  renderBrandHeadline,
  renderBrandStyle,
  renderFounder,
  renderLanguageRule,
  renderRules,
  type BrandContext,
} from "@/features/ad-concepts/domain/brand-context";

/**
 * How the image generation prompt is assembled, as data rather than as one
 * opaque string.
 *
 * This moved out of the infrastructure client for two reasons. It could not be
 * tested there — importing that module constructs an OpenAI client from env at
 * load time — and the Prompt Builder could not show the user what generation
 * actually sends, because the assembly was buried behind the network call. The
 * page described its textarea as "the prompt image generation uses" while five
 * further sections were appended out of sight.
 *
 * Sections carry a stable key and a label so the UI can name each block and say
 * which one is editable. Only the concept scene is: everything else is derived
 * from the brand profile, and editing a copy of it here would create a second
 * source of truth for facts that already have one.
 */

export type PromptSectionKey =
  | "brief"
  | "references"
  | "brand_context"
  | "founder"
  | "image_rules"
  | "scene"
  | "message"
  | "language";

export type PromptSection = {
  key: PromptSectionKey;
  /** Heading shown in the Prompt Builder. Never sent to the model. */
  label: string;
  text: string;
  /** True only for the concept scene — the one block the user owns. */
  editable: boolean;
};

export type ImagePromptInput = {
  brand: BrandContext;
  /** The concept's scene description, already resolved by resolveScenePrompt. */
  scenePrompt: string;
  promotionalMessage?: string | null;
  messagePlacement?: string | null;
  textStyle?: string | null;
  /** Requirements that didn't fit the reference budget, described in words. */
  overflowNotes?: string[];
};

/** A reference image's job in the scene. The bytes stay in infrastructure. */
export type ReferenceDescriptor = {
  role: string;
  label?: string | null;
};

/**
 * Which text a concept generates from, in priority order: a hand-written
 * override beats the generator's own prompt, which beats the visual direction
 * that is all a pre-structured-output concept has.
 *
 * Extracted from an inline `??` chain in the repository so the precedence is
 * stated once and can be tested. Blank strings fall through as if unset —
 * clearing the override textarea stores "" rather than null, and that must mean
 * "use the original", not "generate from nothing".
 */
export function resolveScenePrompt(concept: {
  generationPromptOverride?: string | null;
  finalGenerationPrompt?: string | null;
  visualDirection: string;
}): string {
  const candidates = [
    concept.generationPromptOverride,
    concept.finalGenerationPrompt,
    concept.visualDirection,
  ];
  return candidates.find((value) => value?.trim())?.trim() ?? "";
}

/**
 * How each reference role is treated. Product and logo demand exact
 * preservation — those are the two the model is most tempted to "improve" —
 * while contextual assets guide how the brand's real materials look.
 */
function describeReference(
  reference: ReferenceDescriptor,
  index: number,
  brandName: string,
): string {
  const position = `Reference image ${index + 1}`;
  const named = reference.label ? ` ("${reference.label}")` : "";

  switch (reference.role) {
    case "product":
      return `${position} shows an actual "${brandName}" product that must be preserved exactly as-is — its shape, color, material, patina and details must not change. The jewellery visible in the scene must be this exact piece, not an invented or generic substitute. Change only the environment, lighting and styling around it — never the product itself.`;
    case "owner":
      return `${position} shows the real owner of "${brandName}". When a person appears in the scene, it is her — match her age, build, hair, and face as closely as you can, and do not substitute a different person or gender. She is the brand's actual owner, not a hired model.`;
    case "logo":
      return `${position} shows the real "${brandName}" brand logo — reproduce it faithfully, do not redesign, restyle, or reinterpret it. Where packaging, a box or a sign appears in the scene, show this exact logo on it.`;
    default:
      return `${position}${named} shows this brand's real ${reference.role.replace(/_/g, " ")}. Where that element appears in the scene, match this reference's actual appearance — its materials, colors and proportions — rather than inventing a generic version.`;
  }
}

/**
 * The full prompt as labelled sections, in the order the model receives them.
 *
 * Ordering is deliberate: the language rule is last so it reads as an
 * overriding constraint rather than one detail among many, and the scene sits
 * after the brand rules that constrain it.
 */
export function buildImagePromptSections(
  input: ImagePromptInput,
  references: ReferenceDescriptor[] = [],
): PromptSection[] {
  const sections: PromptSection[] = [
    {
      key: "brief",
      label: "Creative brief",
      text: `Create a high-quality advertising visual for ${renderBrandHeadline(input.brand)}.`,
      editable: false,
    },
  ];

  if (references.length > 0) {
    sections.push({
      key: "references",
      label: "Reference asset instructions",
      text: references
        .map((reference, index) =>
          describeReference(reference, index, input.brand.brandName),
        )
        .join("\n\n"),
      editable: false,
    });
  }

  const style = renderBrandStyle(input.brand);
  if (style) {
    sections.push({
      key: "brand_context",
      label: "Brand context",
      text: style,
      editable: false,
    });
  }

  // The founder was missing from the image prompt entirely: she was described
  // to the concept generator and to QA, but image generation only knew about
  // her when an owner photo happened to be attached. With no photo the model
  // invented whoever it liked — which is exactly how a brand with a female
  // owner ended up advertised by a male craftsman.
  const founder = renderFounder(input.brand);
  if (founder) {
    sections.push({
      key: "founder",
      label: "Founder instructions",
      text: founder,
      editable: false,
    });
  }

  const rules = renderRules(input.brand, "image");
  if (rules) {
    sections.push({
      key: "image_rules",
      label: "Image generation rules",
      text: rules,
      editable: false,
    });
  }

  const sceneParts = [`Scene: ${input.scenePrompt}`];
  if (input.overflowNotes?.length) {
    // Assets the concept asked for that didn't fit the reference budget.
    // Describing them beats dropping them silently.
    sceneParts.push(
      `Also present in the scene, described rather than attached: ${input.overflowNotes.join("; ")}.`,
    );
  }
  sections.push({
    key: "scene",
    label: "Concept instructions",
    text: sceneParts.join("\n\n"),
    editable: true,
  });

  // The promotional message is the one piece of text the image may carry, and
  // only as something physically in the scene — printed signage survives being
  // rendered by an image model far better than an overlay does.
  if (input.promotionalMessage) {
    const placement = input.messagePlacement
      ? ` Place it ${input.messagePlacement}.`
      : "";
    const style = input.textStyle ? ` Style: ${input.textStyle}.` : "";
    sections.push({
      key: "message",
      label: "Promotional message",
      text: `The scene must include this exact promotional message as real physical signage — printed, painted or lettered on a surface within the scene, never as a digital overlay: "${input.promotionalMessage}".${placement}${style} Reproduce the wording exactly, with no other words, headlines or text anywhere in the image.`,
      editable: false,
    });
  } else {
    sections.push({
      key: "message",
      label: "Promotional message",
      text: "Do not render any words, letters, headlines, or text overlays in the image, beyond a brand logo if one is supplied as a reference.",
      editable: false,
    });
  }

  sections.push({
    key: "language",
    label: "Language and market rules",
    text: renderLanguageRule(input.brand, "image"),
    editable: false,
  });

  return sections;
}

/** The sections joined exactly as the model receives them. */
export function assemblePrompt(sections: PromptSection[]): string {
  return sections
    .map((section) => section.text)
    .join("\n\n")
    .trim();
}

export function buildImagePrompt(
  input: ImagePromptInput,
  references: ReferenceDescriptor[] = [],
): string {
  return assemblePrompt(buildImagePromptSections(input, references));
}
