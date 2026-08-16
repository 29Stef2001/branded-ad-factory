/**
 * Finding the right ad account in a long list. Pure — no IO.
 *
 * The account names that come back from Meta are not written for humans:
 * "1250 - 70007 - 025922 - ceylorin", "2067 - copper-soul - 025922 - RAM".
 * Across 44 of them, picking the one that belongs to this brand by eye is how
 * you end up syncing a different store for a fortnight — which is exactly what
 * happened here before this existed.
 *
 * This ranks candidates against the brand name so the UI can put the likely one
 * first. It suggests; it never selects. A confident-looking wrong guess is the
 * failure mode being avoided, not a shortcut worth taking.
 */

export type AccountCandidate = {
  adAccountId: string;
  name: string | null;
};

export type ScoredAccount = AccountCandidate & {
  /** 0..1. Zero means nothing in the name resembles the brand. */
  score: number;
  /** What matched, for the UI to show rather than assert a bare number. */
  reason: string | null;
};

/**
 * Reduces a name to comparable words.
 *
 * Meta account names are mostly account numbers, agency codes and separators.
 * Stripping the digits leaves the part a person would recognise, and splitting
 * on non-letters means "copper-soul", "copper_soul" and "Copper Soul" all
 * reduce to the same two tokens.
 */
export function tokenise(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token) => token.length > 2);
}

/** Tokens that appear in almost every agency-managed account name. */
const NOISE = new Set([
  "the",
  "and",
  "for",
  "llc",
  "ltd",
  "inc",
  "com",
  "net",
  "org",
  "shop",
  "store",
  "ads",
  "account",
  "main",
  "new",
  "old",
  "test",
]);

/**
 * Scores one account against the brand name.
 *
 * Deliberately simple: token overlap, weighted by how much of the brand name is
 * accounted for. Something cleverer — edit distance, fuzzy matching — would
 * produce plausible-looking matches for unrelated brands, and a wrong
 * suggestion that looks reasoned is worse than an obviously blank one.
 */
export function scoreAccount(
  account: AccountCandidate,
  brandName: string,
): ScoredAccount {
  const brandTokens = tokenise(brandName).filter((t) => !NOISE.has(t));
  const accountTokens = new Set(
    tokenise(account.name ?? "").filter((t) => !NOISE.has(t)),
  );

  if (brandTokens.length === 0 || accountTokens.size === 0) {
    return { ...account, score: 0, reason: null };
  }

  const matched = brandTokens.filter((token) => accountTokens.has(token));
  if (matched.length === 0) return { ...account, score: 0, reason: null };

  return {
    ...account,
    score: matched.length / brandTokens.length,
    reason: `Name contains ${matched.map((m) => `"${m}"`).join(" and ")}`,
  };
}

/**
 * Accounts ranked against the brand, best first.
 *
 * Everything is returned, not just the matches: with 44 accounts the user still
 * has to be able to find one this heuristic missed, and hiding the rest behind
 * a guess would make that impossible.
 */
export function rankAccounts(
  accounts: AccountCandidate[],
  brandName: string | null | undefined,
): ScoredAccount[] {
  if (!brandName) {
    return accounts.map((account) => ({ ...account, score: 0, reason: null }));
  }

  return accounts
    .map((account) => scoreAccount(account, brandName))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.name ?? "").localeCompare(b.name ?? "");
    });
}

/** Confidence at which the UI may highlight one account as the likely match. */
export const SUGGESTION_THRESHOLD = 0.5;

/**
 * The single account worth suggesting, or null.
 *
 * Returns nothing when two accounts score equally well — with names like
 * "0206 - harrison-cap" and "0207 - harrison-cap" that is a real case, and
 * picking one arbitrarily is precisely the silent mistake this module exists
 * to prevent.
 */
export function suggestedAccount(
  ranked: ScoredAccount[],
): ScoredAccount | null {
  const best = ranked[0];
  if (!best || best.score < SUGGESTION_THRESHOLD) return null;
  if (ranked[1]?.score === best.score) return null;
  return best;
}
