import { StatusBadge } from "@/components/data/status-badge";
import type {
  EvidenceTier,
  PrimaryMetric,
} from "@/features/creative-intelligence/domain/scoring";

/**
 * How much a number is worth trusting, shown next to the number itself.
 *
 * The tier is not decoration. At this account's volume most creatives sit at
 * `directional` for weeks, and a ranking presented without that context reads
 * as a verdict when it is a hypothesis.
 */

const TIER_LABELS: Record<EvidenceTier, string> = {
  insufficient: "Collecting",
  directional: "Directional",
  confident: "Confident",
};

const TIER_TONES = {
  insufficient: "muted",
  directional: "warning",
  confident: "success",
} as const;

export const TIER_EXPLANATIONS: Record<EvidenceTier, string> = {
  insufficient:
    "Not enough delivery to say anything yet. Shown for completeness, excluded from ranking.",
  directional:
    "Enough to form a hypothesis, not enough to act on. Treat differences between creatives as unproven.",
  confident:
    "Enough delivery to compare against other creatives with reasonable confidence.",
};

export function EvidenceBadge({ tier }: { tier: EvidenceTier }) {
  return <StatusBadge label={TIER_LABELS[tier]} tone={TIER_TONES[tier]} />;
}

const METRIC_LABELS: Record<PrimaryMetric, string> = {
  roas: "Ranked on ROAS",
  cpa: "Ranked on cost per purchase",
  ctr: "Ranked on CTR",
};

export const METRIC_EXPLANATIONS: Record<PrimaryMetric, string> = {
  roas: "Revenue per dollar spent, shrunk toward the account average on low spend.",
  cpa: "Cost per purchase. Revenue takes over once there are 25 purchases in the window.",
  // The one that needs saying out loud.
  ctr: "No conversion data in this window, so clicks are all there is to rank on. Clicks are a weak proxy for revenue — the highest-CTR creative is often not the best earner.",
};

export function PrimaryMetricBadge({ metric }: { metric: PrimaryMetric }) {
  return (
    <StatusBadge
      label={METRIC_LABELS[metric]}
      tone={metric === "ctr" ? "warning" : "neutral"}
    />
  );
}
