/**
 * Tags are typed as free text in one box, so parsing lives here rather than in
 * each form: the add and edit paths must normalise identically or the same tag
 * typed twice stops matching itself.
 */

/** Suggestions offered in the UI. Not a closed set — any tag is accepted. */
export const SUGGESTED_TAGS = [
  "founder",
  "owner",
  "product",
  "jewelry",
  "packaging",
  "premium",
  "lifestyle",
  "western",
  "christmas",
  "usa",
] as const;

const MAX_TAG_LENGTH = 32;
const MAX_TAGS = 20;

/**
 * Lowercased and de-duplicated, because matching is case-insensitive and a
 * duplicate tag would score the same asset twice.
 */
export function parseTags(input: FormDataEntryValue | null): string[] {
  if (typeof input !== "string") return [];

  const seen = new Set<string>();
  for (const raw of input.split(",")) {
    const tag = raw.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (tag) seen.add(tag);
    if (seen.size >= MAX_TAGS) break;
  }
  return [...seen];
}

export function formatTags(tags: string[]): string {
  return tags.join(", ");
}
