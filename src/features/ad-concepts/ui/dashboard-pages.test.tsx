import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkflowProgress } from "@/features/ad-concepts/ui/workflow-progress";
import { AssembledPrompt } from "@/features/ad-concepts/ui/assembled-prompt";
import { ConceptPicker } from "@/features/ad-concepts/ui/concept-picker";
import { buildWorkflow } from "@/features/ad-concepts/domain/workflow";
import { buildImagePromptSections } from "@/features/ad-concepts/domain/image-prompt";
import { buildBrandContext } from "@/features/ad-concepts/domain/brand-context";
import { routerMock, setSearchParams } from "../../../../vitest.setup";

/**
 * The interactive surfaces of the critical pages.
 *
 * The pages themselves are async server components, which testing-library
 * cannot render — so these cover the client components those pages hand their
 * data to, which is where the behaviour actually lives. The server half is
 * covered by the domain suite that produces the data.
 */

function brandContext() {
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
    photography_style: null,
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
    founder_background: null,
    product_positioning: null,
    price_positioning: null,
    materials: [],
    usps: [],
    brand_values: [],
    words_to_always_use: [],
    words_to_never_use: [],
    image_generation_rules: null,
    copy_generation_rules: null,
    qa_expectations: null,
    qa_min_score: null,
  });
}

describe("Dashboard — workflow progress", () => {
  const complete = {
    hasProfile: true,
    completenessScore: 90,
    hasOwnerAsset: true,
    hasProductAsset: true,
    hasLogoAsset: true,
    assetsActive: 3,
    messagesEnabled: 10,
    conceptsTotal: 9,
    conceptsWithImage: 5,
    qaReviewed: 18,
    qaFailed: 13,
    metaCanLaunch: false,
  };

  it("marks exactly one step as current", () => {
    const steps = buildWorkflow({ ...complete, conceptsTotal: 0 });
    render(<WorkflowProgress steps={steps} />);

    expect(steps.filter((step) => step.state === "current")).toHaveLength(1);
  });

  it("reports progress as a fraction of the whole pipeline", () => {
    const steps = buildWorkflow(complete);
    render(<WorkflowProgress steps={steps} />);

    const done = steps.filter((step) => step.state === "done").length;
    expect(
      screen.getByText(`${done} of ${steps.length} steps complete`),
    ).toBeInTheDocument();
  });

  it("links every step so the strip is navigation, not decoration", () => {
    const steps = buildWorkflow(complete);
    render(<WorkflowProgress steps={steps} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(steps.length);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^\/dashboard/);
    }
  });

  it("shows Launch as blocked while Meta cannot create ads", () => {
    const steps = buildWorkflow({ ...complete, metaCanLaunch: false });
    const launch = steps.find((step) => step.key === "launch");

    expect(launch?.state).toBe("blocked");
  });
});

describe("Prompt Builder — concept picker", () => {
  const concepts = [
    {
      id: "c1",
      headline: "There Are 41 Pieces Left",
      strategy_type: "moderate_variation",
      generation_status: "needs_review",
      created_at: "2026-07-29T08:00:00Z",
    },
    {
      id: "c2",
      headline: "Her Last Day at This Bench",
      strategy_type: "exploration",
      generation_status: "approved",
      created_at: "2026-07-29T09:00:00Z",
    },
  ];

  it("never shows a raw enum to the user", () => {
    render(<ConceptPicker concepts={concepts} />);

    const select = screen.getByRole("combobox");
    expect(select.textContent).toContain("Moderate variation");
    expect(select.textContent).toContain("Needs review");
    expect(select.textContent).not.toContain("moderate_variation");
    expect(select.textContent).not.toContain("needs_review");
  });

  it("navigates to the chosen concept, keeping selection in the URL", async () => {
    render(<ConceptPicker concepts={concepts} />);

    await userEvent.selectOptions(screen.getByRole("combobox"), "c2");

    expect(routerMock.push).toHaveBeenCalledWith(
      "/dashboard/creative-studio/prompt-builder?concept=c2",
    );
  });

  it("clears the selection back to the bare page", async () => {
    render(<ConceptPicker concepts={concepts} />);

    await userEvent.selectOptions(screen.getByRole("combobox"), "");

    expect(routerMock.push).toHaveBeenCalledWith(
      "/dashboard/creative-studio/prompt-builder",
    );
  });

  it("reflects the concept already in the URL", () => {
    setSearchParams("concept=c2");
    render(<ConceptPicker concepts={concepts} />);

    expect(screen.getByRole("combobox")).toHaveValue("c2");
  });
});

describe("Prompt Builder — assembled prompt", () => {
  const sections = buildImagePromptSections(
    {
      brand: brandContext(),
      scenePrompt: "A worn bench with the last three cuffs.",
      promotionalMessage: "FINAL STOCK",
    },
    [{ role: "product" }, { role: "owner" }],
  );

  it("labels every section the page promises to show", () => {
    render(<AssembledPrompt sections={sections} />);

    for (const label of [
      "Creative brief",
      "Reference asset instructions",
      "Brand context",
      "Founder instructions",
      "Concept instructions",
      "Promotional message",
      "Language and market rules",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("marks exactly one section as the user's to edit", () => {
    render(<AssembledPrompt sections={sections} />);

    expect(screen.getAllByText("You edit this")).toHaveLength(1);
    expect(screen.getAllByText("Auto-added").length).toBeGreaterThan(1);
  });

  it("attaches the editable marker to the concept instructions", () => {
    render(<AssembledPrompt sections={sections} />);

    const editable = screen.getByText("You edit this").closest("section");
    expect(
      within(editable!).getByText("Concept instructions"),
    ).toBeInTheDocument();
  });

  it("copies the assembled prompt, not one section of it", async () => {
    render(<AssembledPrompt sections={sections} />);

    await userEvent.click(screen.getByRole("button", { name: /Copy all/ }));

    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(copied).toContain("Copper & Soul");
    expect(copied).toContain("Marianne");
    expect(copied).toContain("FINAL STOCK");
    expect(copied).toContain("All text visible anywhere in the image");
  });

  it("never puts its own section labels into the copied prompt", async () => {
    render(<AssembledPrompt sections={sections} />);

    await userEvent.click(screen.getByRole("button", { name: /Copy all/ }));

    const copied = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(copied).not.toContain("Founder instructions");
    expect(copied).not.toContain("Auto-added");
  });

  it("expands truncated sections on request", async () => {
    render(<AssembledPrompt sections={sections} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Show full text" }),
    );

    expect(
      screen.getByRole("button", { name: "Collapse sections" }),
    ).toBeInTheDocument();
  });
});
