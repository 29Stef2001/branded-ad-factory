import {
  accountBaseline,
  percentileRanks,
  scoreCreative,
  type MetricTotals,
} from "@/features/creative-intelligence/domain/scoring";
import {
  listCreativeLinks,
  totalsByEntity,
  upsertCreativeMetrics,
  type Db,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";

/**
 * Rolls the daily facts up per window and scores them.
 *
 * Deterministic and cheap — no AI, no external calls — so it can run over
 * everything every night rather than tracking what changed.
 */

/** Windows the dashboards and later modules read. 0 is lifetime. */
export const SCORING_WINDOWS = [7, 30, 90, 0] as const;

function daysBetween(from: string, to = new Date()): number {
  const start = new Date(`${from}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor((to.getTime() - start) / 86_400_000));
}

export async function scoreWindow(
  userId: string,
  windowDays: number,
  db?: Db,
): Promise<{ scored: number; attributed: number }> {
  const [totals, links] = await Promise.all([
    totalsByEntity(windowDays, userId, db),
    listCreativeLinks(userId, db),
  ]);

  // Only confirmed links attribute a creative. An unconfirmed proposal is a
  // guess, and a guess that enters scoring is indistinguishable afterwards
  // from a fact.
  const conceptByEntity = new Map(
    links
      .filter((link) => link.confirmed)
      .map((link) => [link.meta_entity_id, link.concept_id]),
  );

  // The baseline spans every ad that delivered, attributed or not: it describes
  // the account, and excluding unlinked ads would make it describe only the
  // half we happen to recognise.
  const baseline = accountBaseline(totals as MetricTotals[]);

  const scored = totals.map((entityTotals) => {
    const score = scoreCreative(entityTotals, baseline, {
      daysSinceLastServed: entityTotals.lastServedDate
        ? daysBetween(entityTotals.lastServedDate)
        : undefined,
    });

    return {
      ...score,
      conceptId: conceptByEntity.get(entityTotals.metaEntityId) ?? null,
      metaEntityId: entityTotals.metaEntityId,
      windowDays,
      totals: entityTotals as MetricTotals,
      percentileRank: null as number | null,
    };
  });

  const ranks = percentileRanks(
    scored.map((row) => ({
      id: row.metaEntityId,
      compositeScore: row.compositeScore,
      evidenceTier: row.evidenceTier,
    })),
  );

  for (const row of scored) {
    row.percentileRank = ranks.get(row.metaEntityId) ?? null;
  }

  await upsertCreativeMetrics(userId, scored, db);

  return {
    scored: scored.length,
    attributed: scored.filter((row) => row.conceptId !== null).length,
  };
}

export async function scoreAllWindows(
  userId: string,
  db?: Db,
): Promise<{ scored: number; attributed: number }> {
  let scored = 0;
  let attributed = 0;

  // Sequential rather than parallel: these all write the same table, and four
  // concurrent upserts of the same rows is a deadlock waiting to happen.
  for (const windowDays of SCORING_WINDOWS) {
    const result = await scoreWindow(userId, windowDays, db);
    if (windowDays === 30) {
      scored = result.scored;
      attributed = result.attributed;
    }
  }

  return { scored, attributed };
}
