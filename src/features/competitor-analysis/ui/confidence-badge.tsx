import { StatusBadge, type StatusTone } from "@/components/data/status-badge";
import type { CompetitorDnaConfidence } from "@/features/competitor-analysis/domain/competitor-dna";

/**
 * How much text there was to classify from — not evidence tier's sibling.
 *
 * Deliberately a different concept, shown with a different badge: evidence
 * tier (creative-intelligence/ui/evidence-badge.tsx) is about sample size —
 * how much delivery a creative has had. This is about text richness — how
 * much copy there was to read a hook and angle out of. Competitor ads have
 * neither spend nor impressions to gate on, only their own word count.
 */

const LABELS: Record<CompetitorDnaConfidence, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

const TONES: Record<CompetitorDnaConfidence, StatusTone> = {
  low: "muted",
  medium: "warning",
  high: "success",
};

export function ConfidenceBadge({
  confidence,
}: {
  confidence: CompetitorDnaConfidence | string;
}) {
  const key = (
    confidence in LABELS ? confidence : "low"
  ) as CompetitorDnaConfidence;
  return <StatusBadge label={LABELS[key]} tone={TONES[key]} />;
}
