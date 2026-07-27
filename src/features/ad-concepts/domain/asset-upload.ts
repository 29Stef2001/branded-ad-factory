/**
 * Server Actions receive uploads as opaque FormData entries, so the file is
 * validated here before anything touches Storage — an unchecked upload is a
 * cheap way to fill a bucket with arbitrary content.
 */

/** Formats the image generation pipeline can actually feed to OpenAI. */
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/**
 * 10 MB. Comfortably above a high-resolution product photo, and low enough that
 * a mistaken video upload is rejected rather than silently costing storage.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(",");

export type UploadValidation =
  { ok: true; file: File } | { ok: false; error: string };

export function validateUpload(
  value: FormDataEntryValue | null,
): UploadValidation {
  // An empty file input still submits a File with size 0, so "no file chosen"
  // has to be distinguished from "file chosen but broken".
  if (!(value instanceof File) || value.size === 0) {
    return { ok: false, error: "Choose an image file to upload." };
  }

  if (
    !ACCEPTED_IMAGE_TYPES.includes(
      value.type as (typeof ACCEPTED_IMAGE_TYPES)[number],
    )
  ) {
    return {
      ok: false,
      error: "Only PNG, JPEG and WebP images are supported.",
    };
  }

  if (value.size > MAX_UPLOAD_BYTES) {
    const mb = (value.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      error: `That file is ${mb} MB — the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    };
  }

  return { ok: true, file: value };
}
