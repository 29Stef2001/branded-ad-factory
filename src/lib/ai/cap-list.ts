/**
 * Keeps the first `n` items of a list a model produced.
 *
 * Exists because the alternative — `z.array(z.string()).max(n)` in a
 * structured-output schema — throws away the entire analysis when a model
 * returns one item too many. That is what happened: 149 of 193 competitor DNA
 * runs failed with "Too big: expected array to have <=5 items", so a complete,
 * correct reading of an ad was discarded because its sixth observation was
 * surplus to requirements. The Claude call had already been paid for.
 *
 * The distinction worth holding onto: a closed vocabulary is a correctness
 * constraint and belongs in the schema, because a hook type outside the list
 * is genuinely wrong and must be rejected. A cap on how many free-text notes
 * to keep is a storage preference, and a preference should trim, not fail.
 */
export function capList(values: string[] | undefined, n: number): string[] {
  return (values ?? []).slice(0, n);
}
