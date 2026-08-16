const GRAPH_API_VERSION = "v25.0";

/**
 * Creating an ad — even a paused one that never serves — is a write, and needs
 * `ads_management`. Reading insights only needs `ads_read`, which is all the
 * existing Ad Performance Tracker ever required.
 */
const REQUIRED_LAUNCH_PERMISSION = "ads_management";

/**
 * Everything the full integration needs, and what each one buys.
 *
 * Listed here rather than in the OAuth request because this app uses Facebook
 * Login for Business: the authorize call carries a `config_id`, and the
 * permissions come from that configuration in Meta's dashboard. A `scope`
 * parameter is ignored. So this list cannot *ask* for anything — it exists to
 * check what actually came back and name what is missing, which is the only
 * way a user can tell a misconfigured login from a working one.
 */
export const REQUIRED_PERMISSIONS = [
  { permission: "ads_read", purpose: "Read performance data" },
  {
    permission: "ads_management",
    purpose: "Create campaigns, ad sets and ads",
  },
  {
    permission: "pages_show_list",
    purpose: "List the Pages you can advertise for",
  },
  { permission: "pages_manage_ads", purpose: "Attach a creative to a Page" },
  {
    permission: "business_management",
    purpose: "Read Business Manager details",
  },
] as const;

export type PermissionReport = {
  granted: string[];
  missing: { permission: string; purpose: string }[];
  canRead: boolean;
  canLaunch: boolean;
};

/**
 * What this token can and cannot do, in terms the UI can show directly.
 *
 * Throws rather than returning a partial answer: a permission list that failed
 * to load is not the same as a permission that was denied, and treating them
 * alike sends people off to re-request scopes they already hold.
 */
export async function getPermissionReport(
  accessToken: string,
): Promise<PermissionReport> {
  const capability = await getLaunchCapability(accessToken);

  if (capability.state === "unknown") {
    throw new Error(capability.reason);
  }

  const granted =
    capability.state === "ready"
      ? // "ready" only tells us ads_management is present; ask again for the
        // full list so the report is complete rather than inferred.
        await grantedPermissions(accessToken)
      : capability.granted;

  return {
    granted,
    missing: REQUIRED_PERMISSIONS.filter(
      (entry) => !granted.includes(entry.permission),
    ).map((entry) => ({
      permission: entry.permission,
      purpose: entry.purpose,
    })),
    canRead: granted.includes("ads_read"),
    canLaunch: granted.includes(REQUIRED_LAUNCH_PERMISSION),
  };
}

async function grantedPermissions(accessToken: string): Promise<string[]> {
  const params = new URLSearchParams({ access_token: accessToken });
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/permissions?${params.toString()}`,
  );
  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? "Could not read permissions.");
  }
  return (body.data ?? [])
    .filter((entry: { status?: string }) => entry.status === "granted")
    .map((entry: { permission?: string }) => entry.permission ?? "")
    .filter(Boolean);
}

/**
 * Whether a Graph error means the token is dead rather than the call is wrong.
 *
 * A revoked token is not an expired one: removing the Business Integration on
 * Meta's side invalidates it immediately while the recorded expiry still reads
 * months away. An expiry-date check therefore calls the connection healthy
 * while every request fails, which is exactly how a user ends up staring at an
 * error with no button that would fix it.
 *
 * Matched on the message because Graph reports all of these as code 190 with
 * assorted subcodes, and the subcode list is not stable enough to switch on.
 */
export function isRevokedTokenError(message: string): boolean {
  return (
    message.includes("has not authorized application") ||
    message.includes("Error validating access token") ||
    message.includes("Session has expired") ||
    message.includes("session is invalid")
  );
}

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
