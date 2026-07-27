import {
  Bot,
  BookOpen,
  ChartLine,
  Factory,
  House,
  Palette,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

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
 * Live entries keep the paths they already have — routes are not being moved.
 * Unbuilt entries are nested under their group (e.g. /dashboard/ad-factory/
 * campaigns), which both reads better and keeps Knowledge's "Competitors" from
 * colliding with the existing /dashboard/competitors page.
 */
export const NAV_TREE: NavEntry[] = [
  { label: "Dashboard", segment: "", icon: House, status: "live" },
  {
    label: "Analytics",
    segment: "analytics",
    icon: ChartLine,
    status: "soon",
    blurb:
      "Cross-brand reporting over concepts, spend and creative performance.",
  },
  {
    label: "AI Agents",
    icon: Bot,
    items: [
      // Not in the requested list, but /dashboard/agents already exists and
      // works; without an entry it would be unreachable from the sidebar.
      { label: "All Agents", segment: "agents", status: "live" },
      {
        label: "Competitor Intelligence",
        segment: "competitors",
        status: "live",
      },
      {
        label: "Ad Intelligence",
        segment: "agents/ad-intelligence",
        status: "soon",
        blurb:
          "Aggregate patterns across analyzed ads — angles, offers and formats that recur.",
      },
      {
        label: "Creative Intelligence",
        segment: "agents/creative-intelligence",
        status: "soon",
        blurb:
          "Reads creative performance to explain which executions work and why.",
      },
      {
        label: "Media Buyer",
        segment: "agents/media-buyer",
        status: "soon",
        blurb: "Budget, bidding and scaling decisions across ad accounts.",
      },
      {
        label: "Compliance",
        segment: "agents/compliance",
        status: "soon",
        blurb: "Screens creative against ad-platform policy before launch.",
      },
      {
        label: "Research",
        segment: "agents/research",
        status: "soon",
        blurb: "Market, audience and category research workspace.",
      },
    ],
  },
  {
    label: "Creative Studio",
    icon: Palette,
    items: [
      // Brand profile, concept generation, refinement and the Creative
      // Generator all live on this page today.
      { label: "Concepts", segment: "concepts", status: "live" },
      {
        label: "Brand Assets",
        segment: "creative-studio/brand-assets",
        status: "live",
      },
      {
        label: "Image Generator",
        segment: "creative-studio/image-generator",
        status: "soon",
        blurb:
          "A standalone home for image generation, which currently runs per-concept on the Concepts page.",
      },
      {
        label: "Prompt Builder",
        segment: "creative-studio/prompt-builder",
        status: "soon",
        blurb:
          "Compose and save the prompt structures that drive image generation.",
      },
      {
        label: "Image QA",
        segment: "creative-studio/image-qa",
        status: "soon",
        blurb:
          "Review generated creative for product accuracy, branding and artefacts.",
      },
    ],
  },
  {
    label: "Ad Factory",
    icon: Factory,
    items: [
      {
        label: "Campaigns",
        segment: "ad-factory/campaigns",
        status: "soon",
        blurb: "Campaign briefs and their generated output.",
      },
      {
        label: "Variants",
        segment: "ad-factory/variants",
        status: "soon",
        blurb: "Individual ad variants produced from a campaign brief.",
      },
      {
        label: "Batches",
        segment: "ad-factory/batches",
        status: "soon",
        blurb: "Batch generation runs and their status.",
      },
      {
        label: "Launch in Meta",
        segment: "ad-factory/launch",
        status: "live",
      },
      {
        label: "Winning Ads",
        segment: "ad-factory/winning-ads",
        status: "soon",
        blurb: "Top performers promoted out of batch results.",
      },
    ],
  },
  {
    label: "Performance",
    icon: TrendingUp,
    items: [
      // The existing Meta ad account insights page.
      { label: "Meta Ad Account", segment: "performance", status: "live" },
      {
        label: "ROAS",
        segment: "performance/roas",
        status: "soon",
        blurb: "Return on ad spend by campaign, batch and creative.",
      },
      {
        label: "Creative Fatigue",
        segment: "performance/creative-fatigue",
        status: "soon",
        blurb: "Detects declining creative performance before it wastes spend.",
      },
      {
        label: "Attribution",
        segment: "performance/attribution",
        status: "soon",
        blurb: "Attribution modelling across touchpoints.",
      },
      {
        label: "LTV",
        segment: "performance/ltv",
        status: "soon",
        blurb: "Lifetime-value reporting by acquisition cohort.",
      },
    ],
  },
  {
    label: "Knowledge",
    icon: BookOpen,
    items: [
      {
        label: "Learnings",
        segment: "knowledge/learnings",
        status: "soon",
        blurb: "What worked and what didn't, captured as reusable learnings.",
      },
      {
        label: "Swipe Files",
        segment: "knowledge/swipe-files",
        status: "soon",
        blurb: "Saved reference ads and inspiration, organised by angle.",
      },
      {
        label: "Competitors",
        segment: "knowledge/competitors",
        status: "soon",
        blurb:
          "Reference profiles per competitor. Live competitor ad analysis is under AI Agents → Competitor Intelligence.",
      },
    ],
  },
  {
    label: "Operations",
    icon: Settings,
    items: [
      {
        label: "Tasks",
        segment: "operations/tasks",
        status: "soon",
        blurb: "Queued and running work across the pipeline.",
      },
      {
        label: "Costs",
        segment: "operations/costs",
        status: "soon",
        blurb: "Model and API spend per feature.",
      },
      {
        label: "Roadmap",
        segment: "operations/roadmap",
        status: "soon",
        blurb: "What is shipped, in progress and planned.",
      },
      {
        label: "Settings",
        segment: "operations/settings",
        status: "soon",
        blurb: "Workspace and integration settings.",
      },
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
