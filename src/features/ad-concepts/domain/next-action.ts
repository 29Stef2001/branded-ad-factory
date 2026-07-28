import type { BrandCompleteness } from "@/features/ad-concepts/domain/brand-completeness";

/**
 * The one thing most worth doing next.
 *
 * Ordered by what blocks or degrades everything downstream, not by what is
 * quickest. A brand with no owner photo will keep producing creatives with an
 * invented face no matter how many concepts get generated, so that outranks
 * "generate more concepts" even though generating is the more satisfying click.
 */

export type NextAction = {
  title: string;
  reason: string;
  href: string;
  cta: string;
  /** blocking = nothing useful can happen until this is done. */
  severity: "blocking" | "important" | "routine";
};

export type NextActionInput = {
  hasProfile: boolean;
  completeness: BrandCompleteness;
  hasOwnerAsset: boolean;
  hasProductAsset: boolean;
  hasLogoAsset: boolean;
  messagesEnabled: number;
  conceptsTotal: number;
  conceptsWithImage: number;
  qaFailed: number;
};

export function recommendNextAction(input: NextActionInput): NextAction {
  if (!input.hasProfile) {
    return {
      title: "Create your brand profile",
      reason:
        "Every module reads from it. Nothing can be generated until it exists.",
      href: "/dashboard/brand-profile",
      cta: "Set up brand profile",
      severity: "blocking",
    };
  }

  if (input.messagesEnabled === 0) {
    return {
      title: "Enable at least one promotional message",
      reason:
        "Concept generation refuses to run without one, because every concept must use approved wording.",
      href: "/dashboard/promotional-messages",
      cta: "Manage messages",
      severity: "blocking",
    };
  }

  if (!input.hasOwnerAsset) {
    return {
      title: "Upload a photo of your founder",
      reason:
        "Without it, every image featuring a person invents a different face — and may invent the wrong one entirely.",
      href: "/dashboard/creative-studio/brand-assets",
      cta: "Upload owner photo",
      severity: "important",
    };
  }

  if (!input.hasProductAsset) {
    return {
      title: "Upload real product photography",
      reason:
        "Generation currently invents the product rather than compositing yours.",
      href: "/dashboard/creative-studio/brand-assets",
      cta: "Upload product photos",
      severity: "important",
    };
  }

  if (!input.hasLogoAsset) {
    return {
      title: "Upload your logo",
      reason:
        "Packaging and signage in generated scenes will carry an invented mark.",
      href: "/dashboard/creative-studio/brand-assets",
      cta: "Upload logo",
      severity: "important",
    };
  }

  if (input.completeness.score < 70 && input.completeness.gaps[0]) {
    const gap = input.completeness.gaps[0];
    return {
      title: `Fill in ${gap.label.toLowerCase()}`,
      reason: gap.impact,
      href: "/dashboard/brand-profile",
      cta: "Complete profile",
      severity: "important",
    };
  }

  if (input.conceptsTotal === 0) {
    return {
      title: "Generate your first concepts",
      reason: "The brand is set up — nothing has been created from it yet.",
      href: "/dashboard/concepts",
      cta: "Generate concepts",
      severity: "routine",
    };
  }

  if (input.qaFailed > 0) {
    return {
      title: `Review ${input.qaFailed} image${input.qaFailed === 1 ? "" : "s"} that failed QA`,
      reason: "Each one has a suggested prompt fix waiting in Prompt Builder.",
      href: "/dashboard/creative-studio/image-qa?filter=failed",
      cta: "Review failures",
      severity: "important",
    };
  }

  if (input.conceptsWithImage < input.conceptsTotal) {
    const remaining = input.conceptsTotal - input.conceptsWithImage;
    return {
      title: `Generate images for ${remaining} concept${remaining === 1 ? "" : "s"}`,
      reason: "They have copy and a scene prompt but no creative yet.",
      href: "/dashboard/concepts",
      cta: "Go to concepts",
      severity: "routine",
    };
  }

  return {
    title: "Generate a new batch of concepts",
    reason:
      "Everything is set up and every concept has passed QA. More variants give more to test.",
    href: "/dashboard/concepts",
    cta: "Generate concepts",
    severity: "routine",
  };
}
