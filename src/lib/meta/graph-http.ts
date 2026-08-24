/**
 * Shared Meta Graph API HTTP plumbing.
 *
 * Extracted from creative-intelligence's meta-graph-client so
 * competitor-analysis's Ad Library client does not have to re-pay for the same
 * fix twice: Meta does not always answer with JSON (a gateway error, a WAF
 * challenge or a maintenance page arrives as HTML), and `response.json()` on
 * that throws a bare `SyntaxError` that names no account, no path and no
 * status. Reading as text first and classifying the failure is what makes a
 * background job able to tell a transient error from a permanent one and
 * decide whether to retry.
 */

export const GRAPH_API_VERSION = "v25.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class MetaApiError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
    readonly isRateLimit: boolean,
    readonly isTokenError: boolean,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

/** Throttling codes. Meta wants a pause, not a retry storm. */
export const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80000, 80004]);
/** The token is gone or was revoked — retrying will never help. */
export const TOKEN_ERROR_CODES = new Set([190, 102, 463, 467]);

export async function graphGet<T>(
  path: string,
  params: Record<string, string>,
  accessToken: string,
): Promise<T> {
  const search = new URLSearchParams({ ...params, access_token: accessToken });
  const response = await fetch(`${GRAPH_BASE}/${path}?${search.toString()}`);

  // Read as text first — see the module comment for why.
  const raw = await response.text();
  let body: {
    error?: { message?: string; code?: number; type?: string };
    [key: string]: unknown;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    throw new MetaApiError(
      `Meta answered ${response.status} with ${
        response.headers.get("content-type") ?? "no content type"
      } instead of JSON for ${path}: ${raw.slice(0, 200).replace(/\s+/g, " ")}`,
      null,
      // A 429 or 5xx behind an HTML page is worth retrying; a 4xx is not.
      response.status === 429 || response.status >= 500,
      false,
    );
  }

  if (!response.ok || body.error) {
    const code = body.error?.code ?? null;
    throw new MetaApiError(
      // The path is part of the message: "Unsupported get request" is
      // meaningless until you know which object refused.
      `${body.error?.message ?? `Meta request failed (HTTP ${response.status}).`} (${path})`,
      code,
      code !== null && RATE_LIMIT_CODES.has(code),
      code !== null && TOKEN_ERROR_CODES.has(code),
    );
  }

  return body as T;
}

export type Paged<T> = {
  data: T[];
  paging?: { cursors?: { after?: string }; next?: string };
};

export type Page<T> = {
  items: T[];
  /** Pass back as `after` to continue. Null when the last page was reached. */
  nextCursor: string | null;
};

export function pageOf<T, R>(body: Paged<T>, map: (item: T) => R): Page<R> {
  return {
    items: body.data.map(map),
    // `next` is what says another page exists; a cursor alone is returned even
    // on the final page, so keying off it would loop forever.
    nextCursor: body.paging?.next ? (body.paging.cursors?.after ?? null) : null,
  };
}
