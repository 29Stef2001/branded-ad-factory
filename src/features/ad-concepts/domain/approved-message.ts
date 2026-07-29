/**
 * Matching a concept's promotional message back to an approved one.
 *
 * The model is told to reproduce one of the brand's enabled messages exactly,
 * and mostly does — but "mostly" was being enforced by SQL equality, so a
 * message returned with a trailing space, a different capitalisation or a
 * doubled internal space linked to nothing at all. The concept still saved,
 * generated an image with that wording rendered as signage, and only failed at
 * QA as an unapproved claim, one paid render later.
 *
 * Normalising here catches the near-misses. It deliberately does not fuzzy
 * match beyond whitespace and case: a message the model actually reworded is
 * not approved copy, and quietly accepting it is the failure this guards.
 */

export type ApprovedMessage = { id: string; message: string };

function normalise(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * The approved message this text refers to, or null when it refers to none.
 * Exact matches win over normalised ones, so two messages differing only in
 * case still resolve to the one actually written.
 */
export function matchApprovedMessage(
  text: string | null | undefined,
  approved: ApprovedMessage[],
): ApprovedMessage | null {
  if (!text?.trim()) return null;

  const exact = approved.find((candidate) => candidate.message === text);
  if (exact) return exact;

  const target = normalise(text);
  return (
    approved.find((candidate) => normalise(candidate.message) === target) ??
    null
  );
}

/** True when the text is not any of the brand's approved messages. */
export function isUnapprovedMessage(
  text: string | null | undefined,
  approved: ApprovedMessage[],
): boolean {
  return matchApprovedMessage(text, approved) === null;
}
