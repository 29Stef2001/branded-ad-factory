/**
 * The choices offered when generating creatives. Pure — no IO.
 *
 * Each option maps to something the image API actually accepts. Offering a
 * size the model cannot produce would fail after the money is spent, so the
 * list is the intersection of what a media buyer wants and what can be
 * delivered rather than a wishlist.
 */

export const CREATIVE_COUNTS = [1, 3, 5, 10, 15, 20] as const;

export type CreativeFormat = {
  id: string;
  label: string;
  /** What the image API is asked for. */
  size: "1024x1024" | "1024x1536" | "1536x1024";
};

/**
 * Feed square first because it is the safest placement: it renders without
 * cropping in the feed, in the sidebar and in search, where a 9:16 story
 * creative gets letterboxed or cut.
 */
export const CREATIVE_FORMATS: CreativeFormat[] = [
  { id: "square", label: "Feed square 1:1 (recommended)", size: "1024x1024" },
  { id: "portrait", label: "Feed portrait 4:5", size: "1024x1536" },
  { id: "story", label: "Story / Reels 9:16", size: "1024x1536" },
  { id: "landscape", label: "Landscape 1.91:1", size: "1536x1024" },
];

export function formatById(id: string): CreativeFormat {
  return (
    CREATIVE_FORMATS.find((format) => format.id === id) ?? CREATIVE_FORMATS[0]
  );
}

/**
 * Resolution is presented as a choice because it is a real trade-off —
 * sharper images cost more and take longer — but both values are ones the
 * model returns, not an upscale promised and not delivered.
 */
export const RESOLUTIONS = [
  { id: "high", label: "1080p (sharp)", quality: "high" as const },
  {
    id: "standard",
    label: "Standard (faster, cheaper)",
    quality: "medium" as const,
  },
];

export function resolutionById(id: string) {
  return (
    RESOLUTIONS.find((resolution) => resolution.id === id) ?? RESOLUTIONS[0]
  );
}

/**
 * Pulls Meta Ad Library links out of pasted text.
 *
 * People paste a column of links with stray words around them, so this reads
 * what is there rather than demanding a clean list. Only Ad Library URLs are
 * kept: a competitor's homepage is not an ad and would be scanned for nothing.
 */
export function parseAdLibraryLinks(input: string): string[] {
  const urls = input.match(/https?:\/\/[^\s,]+/g) ?? [];
  return [
    ...new Set(
      urls
        .map((url) => url.replace(/[.,;]+$/, ""))
        .filter((url) => /facebook\.com\/ads\/library/i.test(url)),
    ),
  ];
}

/** The Ad Library's own id for an ad, which is what the API is queried by. */
export function adArchiveIdFrom(url: string): string | null {
  const match = url.match(/[?&]id=(\d+)/);
  return match ? match[1] : null;
}
