/**
 * Turns provider and pipeline failures into something a user can act on.
 *
 * Without this the UI showed things like
 *   529 {"type":"error","error":{"type":"overloaded_error",...},"request_id":...}
 * which tells the reader nothing about whether to wait, retry, or fix their
 * data. The original error is never discarded — callers log it in full and
 * show only the translation.
 */
export type GenerationErrorKind =
  | "provider_overloaded"
  | "rate_limited"
  | "timeout"
  | "invalid_concept_data"
  | "content_rejected"
  | "quota"
  | "unknown";

export type UserFacingError = {
  kind: GenerationErrorKind;
  message: string;
  /** Whether trying again unchanged has a reasonable chance of working. */
  retryable: boolean;
};

function textOf(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function toUserFacingError(error: unknown): UserFacingError {
  const raw = textOf(error).toLowerCase();

  // Status codes are matched alongside the provider's own wording because the
  // SDKs surface them inconsistently — sometimes as a numeric prefix on the
  // message, sometimes only as an error type in the JSON body.
  if (raw.includes("overloaded") || raw.includes("529")) {
    return {
      kind: "provider_overloaded",
      message:
        "The AI provider is temporarily overloaded. Nothing was charged — try again in a minute.",
      retryable: true,
    };
  }

  if (
    raw.includes("rate limit") ||
    raw.includes("rate_limit") ||
    raw.includes("429")
  ) {
    return {
      kind: "rate_limited",
      message:
        "Too many requests in a short time. Wait a moment before generating again.",
      retryable: true,
    };
  }

  if (
    raw.includes("timeout") ||
    raw.includes("timed out") ||
    raw.includes("etimedout") ||
    raw.includes("aborted")
  ) {
    return {
      kind: "timeout",
      message:
        "Generation took too long and was cut off. Image generation can take up to two minutes — try again, and if it keeps failing the hosting timeout may be too low.",
      retryable: true,
    };
  }

  if (
    raw.includes("unterminated") ||
    raw.includes("failed to parse structured output") ||
    raw.includes("invalid json")
  ) {
    return {
      kind: "invalid_concept_data",
      message:
        "The model's response was cut off before it finished. This usually means the output limit is too low for the current concept schema.",
      retryable: true,
    };
  }

  if (
    raw.includes("content_policy") ||
    raw.includes("safety") ||
    raw.includes("rejected")
  ) {
    return {
      kind: "content_rejected",
      message:
        "The provider refused this prompt. Rewrite the scene description and try again.",
      retryable: false,
    };
  }

  if (
    raw.includes("insufficient") ||
    raw.includes("quota") ||
    raw.includes("billing") ||
    raw.includes("credit")
  ) {
    return {
      kind: "quota",
      message:
        "The AI provider rejected the request for billing reasons. Check the account's credit balance.",
      retryable: false,
    };
  }

  return {
    kind: "unknown",
    message:
      "Generation failed. The full error was written to the server logs.",
    retryable: true,
  };
}
