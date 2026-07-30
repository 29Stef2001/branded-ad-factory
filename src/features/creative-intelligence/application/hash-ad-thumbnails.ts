import { perceptualHashFromUrl } from "@/features/creative-intelligence/infrastructure/image-hash-client";
import {
  listAdsNeedingHash,
  setEntityPerceptualHash,
  type Db,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";

/**
 * Fingerprints Meta ad thumbnails, so the fallback attribution path has
 * something to compare against.
 *
 * Runs after ingestion rather than inside it. Fetching an image per ad is the
 * slowest thing in the whole sync, and it must not be able to stall the part
 * that actually matters — the numbers. A missing hash costs a suggestion; a
 * missing insight row costs a day of data.
 *
 * Bounded per pass and resumable by construction: it selects only ads that
 * still have no hash, so each run makes progress and re-running is safe. There
 * is no cursor to keep because the absence of a hash *is* the cursor.
 */

/** Small enough to stay well inside the sync's time budget. */
const BATCH_SIZE = 15;

export async function hashAdThumbnails(
  userId: string,
  db?: Db,
): Promise<{ hashed: number; failed: number; remaining: boolean }> {
  const ads = await listAdsNeedingHash(userId, db, BATCH_SIZE);
  if (ads.length === 0) return { hashed: 0, failed: 0, remaining: false };

  let hashed = 0;
  let failed = 0;

  // Sequential: these are external image fetches, and a burst of them is how a
  // CDN starts refusing.
  for (const ad of ads) {
    if (!ad.thumbnail_url) {
      failed += 1;
      continue;
    }

    const hash = await perceptualHashFromUrl(ad.thumbnail_url);
    if (!hash) {
      // Left unhashed rather than marked with a sentinel, so a transient
      // failure is retried on the next run instead of being remembered as a
      // permanent one.
      failed += 1;
      continue;
    }

    await setEntityPerceptualHash(ad.id, hash, db);
    hashed += 1;
  }

  return { hashed, failed, remaining: ads.length === BATCH_SIZE };
}
