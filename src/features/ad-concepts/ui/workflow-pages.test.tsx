import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Concepts, Brand Profile and Brand Assets.
 *
 * Each of these components imports a Server Action, and importing one for real
 * pulls in the repository, the Supabase client and env validation. The actions
 * are stubbed to no-ops: what is under test here is what the user sees and can
 * reach, not what the action does with the form afterwards.
 */

vi.mock("@/features/ad-concepts/application/delete-concept", () => ({
  deleteConceptAction: vi.fn(),
}));
vi.mock("@/features/ad-concepts/application/generate-creative-image", () => ({
  generateCreativeImageAction: vi.fn(),
}));
vi.mock("@/features/ad-concepts/application/refine-concept", () => ({
  refineConceptAction: vi.fn(),
}));
vi.mock("@/features/ad-concepts/application/save-brand-profile", () => ({
  saveBrandProfileAction: vi.fn(),
}));
vi.mock("@/features/ad-concepts/application/manage-brand-assets", () => ({
  createBrandAssetAction: vi.fn(),
  updateBrandAssetAction: vi.fn(),
  deleteBrandAssetAction: vi.fn(),
  toggleBrandAssetActiveAction: vi.fn(),
  setBrandAssetPrimaryAction: vi.fn(),
  reorderBrandAssetAction: vi.fn(),
}));

const { ConceptCard } = await import("@/features/ad-concepts/ui/concept-card");
const { BrandProfileForm } =
  await import("@/features/ad-concepts/ui/brand-profile-form");
const { BrandAssetsManager } =
  await import("@/features/ad-concepts/ui/brand-assets-manager");

function concept(overrides = {}) {
  return {
    id: "c1",
    headline: "There Are 41 Pieces Left",
    hook: "She never did restocks.",
    body_copy: "Every piece came off one bench, shaped in solid copper.",
    visual_direction: "Tight documentary close-up.",
    call_to_action: "See what's left",
    created_at: "2026-07-29T08:00:00Z",
    creative_image_path: null,
    product_image_url: null,
    strategy_type: "moderate_variation",
    campaign_angle: "Genuine scarcity",
    brand_asset_requirements: ["product", "owner"],
    generation_status: "needs_review",
    generation_retry_count: 0,
    competitor_ads: null,
    original: null,
    promotional_message: { message: "FINAL STOCK" },
    ...overrides,
  };
}

describe("Concepts — concept card", () => {
  it("starts collapsed so a page of concepts stays scannable", () => {
    render(<ConceptCard concept={concept()} />);

    expect(screen.getByText("There Are 41 Pieces Left")).toBeInTheDocument();
    expect(screen.queryByText(/Visual direction:/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Details & actions/ }),
    ).toBeInTheDocument();
  });

  it("reveals the full concept and its actions on request", async () => {
    render(<ConceptCard concept={concept()} />);

    await userEvent.click(
      screen.getByRole("button", { name: /Details & actions/ }),
    );

    expect(screen.getByText(/Visual direction:/)).toBeInTheDocument();
    expect(screen.getByText(/Call to action:/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hide details" }),
    ).toBeInTheDocument();
  });

  it("shows the body copy exactly once in either state", async () => {
    // The collapsed preview is a clamped stand-in for the full copy, so leaving
    // it mounted printed the same paragraph twice.
    const { container } = render(<ConceptCard concept={concept()} />);
    const copy = "Every piece came off one bench, shaped in solid copper.";

    const count = () =>
      [...container.querySelectorAll("*")].filter(
        (el) => el.children.length === 0 && el.textContent?.trim() === copy,
      ).length;

    expect(count()).toBe(1);
    await userEvent.click(
      screen.getByRole("button", { name: /Details & actions/ }),
    );
    expect(count()).toBe(1);
  });

  it("names the status and strategy in words, never as stored values", () => {
    render(<ConceptCard concept={concept()} />);

    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("Moderate variation")).toBeInTheDocument();
    expect(screen.queryByText("needs_review")).not.toBeInTheDocument();
    expect(screen.queryByText("moderate_variation")).not.toBeInTheDocument();
  });

  it("distinguishes a failed generation from an image QA rejected", () => {
    render(<ConceptCard concept={concept({ generation_status: "failed" })} />);

    // "failed" means no image exists at all — a different problem from an
    // image that was generated and then judged.
    expect(screen.getByText("Generation failed")).toBeInTheDocument();
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
  });

  it("links through to the Prompt Builder for this concept", () => {
    render(<ConceptCard concept={concept()} />);

    expect(
      screen.getByRole("link", { name: /Open in Prompt Builder/ }),
    ).toHaveAttribute(
      "href",
      "/dashboard/creative-studio/prompt-builder?concept=c1",
    );
  });

  it("requires confirmation before deleting", async () => {
    render(<ConceptCard concept={concept()} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(
      screen.getByText("Delete this concept and its images?"),
    ).toBeInTheDocument();
  });

  it("shows the linked promotional message", () => {
    render(<ConceptCard concept={concept()} />);

    expect(screen.getByText(/FINAL STOCK/)).toBeInTheDocument();
  });
});

describe("Brand Profile — form", () => {
  it("offers every stored vocabulary value as a readable option", () => {
    render(<BrandProfileForm profile={null} />);

    const writingStyle = screen.getByLabelText(/Writing style/);
    expect(writingStyle.textContent).toContain("Direct response");
    expect(writingStyle.textContent).toContain("Storytelling");
    expect(writingStyle.textContent).not.toContain("direct_response");
  });

  it("uses the same labels the rest of the app uses", () => {
    // These option lists were hand-typed here and drifted from the shared
    // labels: "Business Card" against "Business card".
    render(<BrandProfileForm profile={null} />);

    expect(screen.getByLabelText(/Price positioning/).textContent).toContain(
      "Mid-market",
    );
  });

  it("lets the founder's gender be left unstated", () => {
    render(<BrandProfileForm profile={null} />);

    // Labelled "Gender" inside the Founder panel, so query by the field name.
    const gender = document.querySelector("#founderGender");
    expect(gender?.textContent).toContain("Prefer not to say");
  });

  it("renders an empty form for a brand that has none yet", () => {
    render(<BrandProfileForm profile={null} />);

    expect(screen.getByLabelText(/Brand name/)).toHaveValue("");
  });

  it("shows every field's current value when one exists", () => {
    render(
      <BrandProfileForm
        profile={
          {
            brand_name: "Copper & Soul",
            markets: ["US", "UK"],
            founder_name: "Marianne",
            writing_style: "storytelling",
          } as never
        }
      />,
    );

    expect(screen.getByLabelText(/Brand name/)).toHaveValue("Copper & Soul");
    expect(screen.getByLabelText(/Markets/)).toHaveValue("US, UK");
    expect(document.querySelector("#founderName")).toHaveValue("Marianne");
    expect(screen.getByLabelText(/Writing style/)).toHaveValue("storytelling");
  });
});

describe("Brand Assets — manager", () => {
  const asset = (overrides = {}) => ({
    id: "a1",
    asset_type: "owner",
    label: "Marianne at the bench",
    image_url: null,
    storage_path: "owner.png",
    is_primary: true,
    is_active: true,
    region: null,
    season: null,
    sort_order: 0,
    tags: [],
    displayUrl: "https://example.test/owner.png",
    ...overrides,
  });

  it("explains the absence rather than showing bare empty panels", () => {
    render(<BrandAssetsManager assets={[]} />);

    expect(screen.getByText("No brand assets yet")).toBeInTheDocument();
  });

  it("puts the assets generation must never invent first", () => {
    render(<BrandAssetsManager assets={[]} />);

    const headings = screen
      .getAllByRole("heading")
      .map((heading) => heading.textContent);

    expect(headings.slice(0, 3)).toEqual(["Owner", "Product", "Logo"]);
  });

  it("groups an asset under its own type", () => {
    render(<BrandAssetsManager assets={[asset() as never]} />);

    expect(screen.getByText("Marianne at the bench")).toBeInTheDocument();
  });

  it("says why the owner asset matters where it is missing", () => {
    render(<BrandAssetsManager assets={[]} />);

    expect(
      screen.getByText(/every generated image invents a different face/i),
    ).toBeInTheDocument();
  });
});
