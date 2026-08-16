/**
 * Telling a video apart from an image. Pure — no IO.
 *
 * Meta needs to know before anything is uploaded: videos go to /advideos and
 * become a video_data creative, images go to /adimages and become link_data.
 * Getting it wrong is not a degraded ad, it is a rejected one.
 */

const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mov",
  ".m4v",
  ".avi",
  ".webm",
  ".mkv",
  ".mpeg",
  ".mpg",
];

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];

export type MediaKind = "image" | "video" | "unknown";

/**
 * What kind of file a URL points at.
 *
 * Decided from the path rather than by fetching, so the form can label things
 * as they are typed. A signed Storage URL carries a query string, which is why
 * the extension is read from the path alone.
 */
export function mediaKindFor(url: string): MediaKind {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // Not a parseable URL — fall back to matching the raw string, which still
    // works for the common case of a plain path.
  }

  const lower = path.toLowerCase();
  if (VIDEO_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    return "video";
  }
  if (IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension))) {
    return "image";
  }
  // Unknown rather than assumed: guessing image for a video uploads it to the
  // wrong endpoint and fails with an error about the file, not the guess.
  return "unknown";
}

export function isVideo(url: string): boolean {
  return mediaKindFor(url) === "video";
}
