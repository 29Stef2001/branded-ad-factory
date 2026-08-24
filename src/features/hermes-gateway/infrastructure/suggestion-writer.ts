import type { DiscoveredCompetitor } from "@/features/hermes-gateway/domain/discovery-schema";
import type { Db } from "@/features/competitor-analysis/infrastructure/competitor-repository";

/**
 * Writes one discovered candidate to `suggested_competitors`, and only that
 * — kept separate from `discovery-client.ts` (the Claude call) so this, the
 * part that fixes the race condition described below, can be unit tested
 * without pulling in `env.ts`/the Anthropic client.
 *
 * One candidate, one insert, one authoritative answer from Postgres about
 * whether it was new. Earlier testing found that two overlapping
 * `competitor_discover()` calls (a client retry after a slow response, or
 * two concurrent Hermes tool calls) could both read "this name isn't
 * suggested yet" and both insert — a read-then-write race no amount of
 * in-memory checking can close, because the gap is between two separate
 * database round trips in two separate processes.
 *
 * The fix: `suggested_competitors` has a unique index on
 * `(user_id, lower(btrim(name)))` (see the accompanying migration), and
 * `error?.code === "23505"` here is that constraint winning a race, not a
 * failure — the exact pattern `recordAnalysisRun`/`recordCompetitorAnalysisRun`
 * already use for the same reason against `analysis_runs`' cache index.
 */
export async function insertSuggestionIfNew(
  db: Db,
  userId: string,
  candidate: DiscoveredCompetitor,
): Promise<boolean> {
  const { error } = await db.from("suggested_competitors").insert({
    user_id: userId,
    name: candidate.name,
    website_url: candidate.websiteUrl,
    competitor_type: candidate.competitorType,
    relevance_score: candidate.relevanceScore,
    relevance_reasoning: candidate.relevanceReasoning,
    reason: candidate.relevanceReasoning,
    source: "agent_discovery" as const,
    discovered_at: new Date().toISOString(),
  });

  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}
