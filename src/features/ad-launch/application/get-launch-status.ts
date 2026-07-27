import { getConnection } from "@/features/ad-performance/infrastructure/ad-performance-repository";
import {
  getLaunchCapability,
  type LaunchCapability,
} from "@/features/ad-launch/infrastructure/meta-capability-client";

/**
 * Everything the launch panel needs to decide what it may offer, resolved
 * server-side so the access token never reaches the client.
 */
export type LaunchStatus =
  | { state: "not_connected" }
  | { state: "token_expired"; adAccountId: string }
  | { state: "read_only"; adAccountId: string; granted: string[] }
  | { state: "capability_unknown"; adAccountId: string; reason: string }
  | { state: "ready"; adAccountId: string };

export async function getLaunchStatus(): Promise<LaunchStatus> {
  const connection = await getConnection();
  if (!connection) return { state: "not_connected" };

  const { ad_account_id: adAccountId } = connection;

  if (new Date(connection.token_expires_at) < new Date()) {
    return { state: "token_expired", adAccountId };
  }

  let capability: LaunchCapability;
  try {
    capability = await getLaunchCapability(connection.access_token);
  } catch (error) {
    return {
      state: "capability_unknown",
      adAccountId,
      reason:
        error instanceof Error ? error.message : "Permission check failed.",
    };
  }

  switch (capability.state) {
    case "ready":
      return { state: "ready", adAccountId };
    case "missing_permission":
      return { state: "read_only", adAccountId, granted: capability.granted };
    case "unknown":
      return {
        state: "capability_unknown",
        adAccountId,
        reason: capability.reason,
      };
  }
}
