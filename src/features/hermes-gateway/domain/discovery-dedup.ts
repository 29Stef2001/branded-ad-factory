/**
 * Pure name-normalization used to decide whether two discovery candidates
 * are "the same brand" — trim + lowercase, matching exactly what the
 * database's unique index on `suggested_competitors (user_id, lower(btrim(name)))`
 * enforces. Kept identical on purpose: the in-memory pre-filter and the
 * database constraint have to agree on what counts as a duplicate, or a
 * candidate that passes the pre-filter could still bounce off the database
 * with a confusing mismatch between what the code expected and what
 * actually happened.
 *
 * This function is a pre-filter, not the safety guarantee — see
 * application/competitor-discover.ts's module comment for why the real
 * guarantee has to live in the database, not here.
 */
export function normalizeCompetitorName(name: string): string {
  return name.trim().toLowerCase();
}

export function isKnownName(
  name: string,
  knownNames: ReadonlySet<string>,
): boolean {
  return knownNames.has(normalizeCompetitorName(name));
}
