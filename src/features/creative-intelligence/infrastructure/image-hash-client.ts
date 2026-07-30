import sharp from "sharp";
import {
  HASH_HEIGHT,
  HASH_WIDTH,
  dHashFromGreyscale,
} from "@/features/creative-intelligence/domain/perceptual-hash";

/**
 * Decodes an image far enough to fingerprint it.
 *
 * Only the decode lives here; the arithmetic is in domain/perceptual-hash so it
 * can be tested without a PNG. Downscaling to 9x8 is what makes the hash
 * survive Meta re-encoding what we uploaded — at that size compression
 * artefacts and resampling differences have nowhere left to show.
 *
 * `fit: "fill"` on purpose: preserving aspect ratio would make a 1:1 creative
 * and the same creative cropped to 4:5 hash differently, and Meta crops for
 * placements. Squashing both into the same grid keeps them comparable.
 */
export async function perceptualHashFromImage(
  image: Buffer,
): Promise<string | null> {
  try {
    const { data } = await sharp(image)
      // Alpha flattened against white: a transparent PNG would otherwise hash
      // against undefined RGB values wherever it is see-through.
      .flatten({ background: "#ffffff" })
      .greyscale()
      .resize(HASH_WIDTH, HASH_HEIGHT, { fit: "fill", kernel: "cubic" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    return dHashFromGreyscale(new Uint8Array(data));
  } catch (error) {
    // A hash is a convenience for the fallback attribution path, never a
    // requirement. Failing to compute one must not fail the upload that a paid
    // generation just produced.
    console.warn("Could not compute perceptual hash", error);
    return null;
  }
}

/** Fetches an image and hashes it. Used for Meta's ad thumbnails. */
export async function perceptualHashFromUrl(
  url: string,
): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;

    return perceptualHashFromImage(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.warn("Could not fetch image for hashing", { url, error });
    return null;
  }
}
