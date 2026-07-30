/**
 * dHash — a 64-bit perceptual fingerprint of an image. Pure; no IO, no decoding.
 *
 * The fallback half of attribution. A cryptographic checksum is useless here:
 * Meta re-encodes and resizes everything it serves, so the bytes that come back
 * never match the bytes that went up, and MD5 of the two differs completely
 * even though the picture is identical.
 *
 * dHash compares each pixel with its right-hand neighbour and records only
 * whether it got brighter. That survives re-encoding, rescaling and mild
 * compression, because it depends on the shape of the gradient rather than on
 * exact values.
 *
 * Deliberately the difference hash rather than the average hash: aHash keys off
 * the mean brightness of the whole image, so re-exporting at a different
 * exposure moves every bit at once. dHash only cares about local direction.
 */

/** Grid is 9x8: 8 comparisons per row across 8 rows = 64 bits. */
const WIDTH = 9;
const HEIGHT = 8;

export const HASH_WIDTH = WIDTH;
export const HASH_HEIGHT = HEIGHT;
/** 64 bits as hex. */
export const HASH_LENGTH = 16;

/**
 * Hashes a greyscale bitmap that has already been resized to 9x8.
 *
 * Resizing and greyscaling need an image decoder, which belongs in
 * infrastructure. Keeping the arithmetic separate is what makes the part that
 * can be wrong testable without a PNG.
 */
export function dHashFromGreyscale(pixels: Uint8Array | number[]): string {
  if (pixels.length !== WIDTH * HEIGHT) {
    throw new Error(
      `dHash expects ${WIDTH * HEIGHT} greyscale samples, received ${pixels.length}.`,
    );
  }

  let bits = "";
  for (let row = 0; row < HEIGHT; row++) {
    for (let col = 0; col < WIDTH - 1; col++) {
      const left = pixels[row * WIDTH + col];
      const right = pixels[row * WIDTH + col + 1];
      bits += left > right ? "1" : "0";
    }
  }

  // Nibble at a time, so the result is exactly HASH_LENGTH hex characters and
  // comparable with the Hamming distance in attribution.ts.
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/** Rec. 601 luma — how a human eye weighs the channels, not a flat average. */
export function toGreyscale(
  rgba: Uint8Array | Uint8ClampedArray | number[],
): number[] {
  const grey: number[] = [];
  for (let i = 0; i < rgba.length; i += 4) {
    grey.push(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
  }
  return grey;
}

/** True when the string could be one of our hashes. */
export function isValidHash(value: string | null | undefined): boolean {
  return (
    typeof value === "string" &&
    new RegExp(`^[0-9a-f]{${HASH_LENGTH}}$`).test(value)
  );
}
