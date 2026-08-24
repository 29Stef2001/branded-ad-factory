import {
  BarChart3,
  House,
  TrendingUp,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type NavLeaf = {
  label: string;
  /** Path under /dashboard, or "" for the dashboard index itself. */
  segment: string;
  icon?: LucideIcon;
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  items: NavLeaf[];
};

export type NavEntry = NavLeaf | NavGroup;

export function isGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

/**
 * Single source of truth for dashboard navigation: the desktop sidebar and the
 * mobile drawer both read this tree, and page headers derive their section from
 * it via sectionFor().
 *
 * Only production-ready pages appear. Modules without a working backend are
 * deliberately absent rather than shown as "soon": a navigation full of dead
 * ends reads as a roadmap, and a user cannot tell which half of it is real.
 * They return here when they are built.
 */
export const NAV_TREE: NavEntry[] = [
  { label: "Dashboard", segment: "", icon: House },
  {
    // Ordered as the work is actually done, not by subject. A first-time user
    // who follows this list top to bottom cannot hit a blocked step: messages
    // sit above Concepts because concept generation refuses to run without an
    // enabled one, which their own ordering would only reveal on failure.
    label: "Workflow",
    icon: Workflow,
    items: [
      { label: "Brand Profile", segment: "brand-profile" },
      {
        label: "Brand Assets",
        segment: "creative-studio/brand-assets",
      },
      {
        label: "Promotional Messages",
        segment: "promotional-messages",
      },
      { label: "Concepts", segment: "concepts" },
      {
        label: "Prompt Builder",
        segment: "creative-studio/prompt-builder",
      },
      {
        label: "Image QA",
        segment: "creative-studio/image-qa",
      },
      {
        label: "Launch in Meta",
        segment: "ad-factory/launch",
      },
      {
        label: "Launch ads",
        segment: "ad-factory/launch/builder",
      },
    ],
  },
  {
    // Creative Intelligence: the platform's shared performance layer. Only the
    // pages that are actually built appear, per the rule the rest of the
    // navigation already follows.
    label: "Intelligence",
    icon: BarChart3,
    items: [
      { label: "Creative Performance", segment: "intelligence" },
      { label: "Ad Accounts", segment: "intelligence/accounts" },
      { label: "Creative DNA", segment: "intelligence/dna" },
      {
        label: "Attribution",
        segment: "intelligence/attribution",
      },
      {
        // Phase 1's composed view: our winners next to competitor patterns
        // and the whitespace between them. A leaf here rather than its own
        // top-level group — it reads what Intelligence already computes, and
        // a single-page group would be sprawl until later phases add more.
        label: "Creative Factory",
        segment: "intelligence/creative-factory",
      },
    ],
  },
  {
    label: "Insights",
    icon: TrendingUp,
    items: [
      { label: "All Agents", segment: "agents" },
      {
        label: "Competitor Intelligence",
        segment: "competitors",
      },
      { label: "Meta Ad Account", segment: "performance" },
    ],
  },
];

export function hrefFor(item: NavLeaf): string {
  return item.segment ? `/dashboard/${item.segment}` : "/dashboard";
}

/**
 * The section a page belongs to, for its header eyebrow.
 *
 * Derived from the tree rather than typed per page, because typing it drifted:
 * Brand Profile, Brand Assets and Prompt Builder each announced "Creative
 * Studio" while sitting in Workflow beside Image QA, which announced
 * "Workflow". The eyebrow tells the user where they are, so it has to be the
 * same fact the sidebar highlights, not a second copy of it. The URL is not
 * that fact either — several Workflow pages live under /creative-studio/ for
 * historical reasons.
 */
export function sectionFor(segment: string): string | undefined {
  const group = NAV_TREE.find(
    (entry) =>
      isGroup(entry) && entry.items.some((item) => item.segment === segment),
  );
  return group && isGroup(group) ? group.label : undefined;
}
