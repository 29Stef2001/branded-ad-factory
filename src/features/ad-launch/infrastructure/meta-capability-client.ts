const GRAPH_API_VERSION = "v25.0";

/**
 * Creating an ad — even a paused one that never serves — is a write, and needs
 * `ads_management`. Reading insights only needs `ads_read`, which is all the
 * existing Ad Performance Tracker ever required.
 */
const REQUIRED_LAUNCH_PERMISSION = "ads_management";

export type LaunchCapability =
  | { state: "ready" }
  | { state: "missing_permission"; granted: string[] }
  | { state: "unknown"; reason: string };

/**
 * Asks Meta what this token is actually allowed to do, rather than assuming.
 *
 * The OAuth flow uses a `config_id` (Facebook Login for Business), so the set of
 * granted scopes lives in the Meta app configuration and cannot be read from
 * this codebase — the only honest way to know is to ask Graph at runtime. That
 * matters because the failure mode otherwise is a launch button that looks
 * functional and returns permission errors only after the user commits.
 */
export async function getLaunchCapability(
  accessToken: string,
): Promise<LaunchCapability> {
  const params = new URLSearchParams({ access_token: accessToken });

  let body: {
    data?: Array<{ permission?: string; status?: string }>;
    error?: { message?: string };
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/permissions?${params.toString()}`,
    );
    body = await response.json();

    if (!response.ok || body.error) {
      // An unreachable or erroring Graph API is not the same as a denied
      // permission — reporting it as "missing" would send the user off to
      // request a scope they may already have.
      return {
        state: "unknown",
        reason: body.error?.message ?? `Graph API returned ${response.status}.`,
      };
    }
  } catch (error) {
    return {
      state: "unknown",
      reason:
        error instanceof Error
          ? error.message
          : "Could not reach the Graph API.",
    };
  }

  const granted = (body.data ?? [])
    .filter((entry) => entry.status === "granted")
    .map((entry) => entry.permission ?? "")
    .filter(Boolean);

  return granted.includes(REQUIRED_LAUNCH_PERMISSION)
    ? { state: "ready" }
    : { state: "missing_permission", granted };
}
