/**
 * Renders the fact/hypothesis split competitor DNA reads out of ad copy.
 *
 * Kept as two visibly separate lists rather than one, on purpose: collapsing
 * "the ad says X" and "this is probably aimed at Y" into one bullet list is
 * exactly the flattening that makes ad_analyses's free text impossible to
 * trust at a glance.
 */
export function ObservedVsInferredList({
  observedFacts,
  inferredHypotheses,
}: {
  observedFacts: string[];
  inferredHypotheses: string[];
}) {
  if (observedFacts.length === 0 && inferredHypotheses.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {observedFacts.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Observed
          </p>
          <ul className="mt-1 list-disc pl-4 text-sm">
            {observedFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </div>
      )}
      {inferredHypotheses.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Inferred
          </p>
          <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
            {inferredHypotheses.map((hypothesis) => (
              <li key={hypothesis}>{hypothesis}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
