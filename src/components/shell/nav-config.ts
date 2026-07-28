import { House, TrendingUp, Workflow, type LucideIcon } from "lucide-react";

/**
 * "live" items route to a page backed by real data and real server actions.
 * "soon" items are navigable but render ComingSoonState — the sidebar shows
 * them muted with a badge so the UI never implies a backend that isn't there.
 */
export type NavStatus = "live" | "soon";

export type NavLeaf = {
  label: string;
  /** Path under /dashboard, or "" for the dashboard index itself. */
  segment: string;
  icon?: LucideIcon;
  status: NavStatus;
  /** Shown on the placeholder page so each stub explains its own intent. */
  blurb?: string;
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
 * Single source of truth for dashboard navigation: the desktop sidebar, the
 * mobile drawer, and the /dashboard/[...slug] placeholder route all read this
 * tree, so a route exists if and only if it is listed here.
 *
 * Only production-ready pages appear. Modules without a working backend are
 * deliberately absent rather than shown as "soon": a navigation full of dead
 * ends reads as a roadmap, and a user cannot tell which half of it is real.
 * They return here when they are built.
 */
export const NAV_TREE: NavEntry[] = [
  { label: "Dashboard", segment: "", icon: House, status: "live" },
  {
    // Ordered as the work is actually done, not by subject. A first-time user
    // who follows this list top to bottom cannot hit a blocked step: messages
    // sit above Concepts because concept generation refuses to run without an
    // enabled one, which their own ordering would only reveal on failure.
    label: "Workflow",
    icon: Workflow,
    items: [
      { label: "Brand Profile", segment: "brand-profile", status: "live" },
      {
        label: "Brand Assets",
        segment: "creative-studio/brand-assets",
        status: "live",
      },
      {
        label: "Promotional Messages",
        segment: "promotional-messages",
        status: "live",
      },
      { label: "Concepts", segment: "concepts", status: "live" },
      {
        label: "Prompt Builder",
        segment: "creative-studio/prompt-builder",
        status: "live",
      },
      {
        label: "Image QA",
        segment: "creative-studio/image-qa",
        status: "live",
      },
      {
        label: "Launch in Meta",
        segment: "ad-factory/launch",
        status: "live",
      },
    ],
  },
  {
    label: "Insights",
    icon: TrendingUp,
    items: [
      { label: "All Agents", segment: "agents", status: "live" },
      {
        label: "Competitor Intelligence",
        segment: "competitors",
        status: "live",
      },
      { label: "Meta Ad Account", segment: "performance", status: "live" },
    ],
  },
];

export const NAV_LEAVES: NavLeaf[] = NAV_TREE.flatMap((entry) =>
  isGroup(entry) ? entry.items : [entry],
);

export function hrefFor(item: NavLeaf): string {
  return item.segment ? `/dashboard/${item.segment}` : "/dashboard";
}

/** Resolves a /dashboard/[...slug] path back to its nav entry, if any. */
export function findLeafBySegment(segment: string): NavLeaf | undefined {
  return NAV_LEAVES.find((leaf) => leaf.segment === segment);
}
