import {
  createMcpHandler,
  withMcpAuth,
  type McpHandlerOptions,
} from "mcp-handler";
import { z } from "zod";
import { env } from "@/lib/env";
import { createAdminClient, canRunHermesGateway } from "@/lib/supabase/admin";
import {
  approvalGetStatusInput,
  competitorAdsSubmitInput,
  competitorDiscoverInput,
  competitorGetCreativeDnaInput,
  competitorGetWhitespaceInput,
  competitorResearchInput,
  factoryGetStatusInput,
  metaGetCreativeDnaInput,
  metaGetWinnersInput,
} from "@/features/hermes-gateway/domain/tool-schemas";
import {
  approvalGetStatus,
  competitorAdsSubmit,
  competitorGetCreativeDna,
  competitorGetWhitespace,
  competitorList,
  competitorResearch,
  factoryGetStatus,
  metaGetCreativeDna,
  metaGetWinners,
} from "@/features/hermes-gateway/application/tools";
import { competitorDiscover } from "@/features/hermes-gateway/application/competitor-discover";

/**
 * The Hermes Agent MCP gateway — read-only Creative Factory intelligence,
 * plus two write paths: `competitor_discover` (only ever proposes candidates
 * for human review, never commits them) and `competitor_ads_submit` (ads
 * Hermes itself observed via its own browser automation — e.g. browsing
 * Meta's public Ad Library website or a competitor's site directly — which
 * this app never fetches server-side; see that tool's module comment in
 * hermes-gateway/application/tools.ts for why that split matters).
 *
 * Nothing here duplicates business logic: every tool is a call into the same
 * application-layer functions the web app's Server Actions call. This route
 * is an auth boundary and a schema boundary, not a second backend.
 *
 * Auth: a single static bearer token (`HERMES_MCP_TOKEN`) maps to a single
 * workspace user (`HERMES_MCP_USER_ID`) — this app has one workspace, so
 * "which tenant" is a fixed mapping rather than something negotiated per
 * request. See `docs/hermes-gateway.md`-equivalent reasoning in
 * `src/lib/env.ts`.
 *
 * Deliberately absent from this file: anything that publishes, activates a
 * campaign, or increases budget. Those tools do not exist here — not
 * "disabled," not exposed at all, so there is nothing for a compromised or
 * confused Hermes session to call even by mistake.
 */

const NOT_CONFIGURED = new Response(
  JSON.stringify({ error: "Hermes MCP gateway is not configured." }),
  { status: 503, headers: { "content-type": "application/json" } },
);

type AuthCheck =
  { ok: true; token: string; userId: string } | { ok: false; reason: string };

/**
 * Whether this request may proceed, and if not, why — in words, for the log.
 *
 * mcp-handler answers every `verifyToken` failure with the same sentence — "No
 * authorization provided" — whether the header was missing, the token was
 * wrong, or the deployment simply has no `HERMES_MCP_TOKEN` set. See
 * `withMcpAuth`: once `required: true` and `!authInfo`, that string is the
 * entire reply, and the four causes are indistinguishable from outside.
 * Chasing one of them through that message cost an afternoon, so the cause is
 * named here instead. The name of the cause only — never a token, not even its
 * length: the caller is told nothing new, and the log is where the answer goes.
 */
function checkAuth(bearerToken: string | undefined): AuthCheck {
  if (!bearerToken)
    return { ok: false, reason: "no bearer token in the Authorization header" };
  if (!env.HERMES_MCP_TOKEN)
    return {
      ok: false,
      reason: "HERMES_MCP_TOKEN is not set on this deployment",
    };
  if (!env.HERMES_MCP_USER_ID)
    return {
      ok: false,
      reason: "HERMES_MCP_USER_ID is not set on this deployment",
    };
  // A plain `!==` rather than a constant-time compare: this is a single-tenant
  // bearer secret behind a redeploy, not a public OAuth surface.
  if (bearerToken !== env.HERMES_MCP_TOKEN)
    return {
      ok: false,
      reason: "the bearer token does not match HERMES_MCP_TOKEN",
    };
  return { ok: true, token: bearerToken, userId: env.HERMES_MCP_USER_ID };
}

async function verifyToken(
  _req: Request,
  bearerToken?: string,
): Promise<
  | {
      token: string;
      clientId: string;
      scopes: string[];
      extra: Record<string, unknown>;
    }
  | undefined
> {
  const check = checkAuth(bearerToken);
  if (!check.ok) {
    console.warn(`[mcp-auth] refused — ${check.reason}`);
    return undefined;
  }
  return {
    token: check.token,
    clientId: "hermes-agent",
    scopes: ["read:creative-factory"],
    extra: { userId: check.userId },
  };
}

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function errorResult(message: string) {
  return {
    content: [
      { type: "text" as const, text: JSON.stringify({ error: message }) },
    ],
    isError: true as const,
  };
}

/**
 * What actually went wrong, in words, whatever was thrown.
 *
 * Every tool used to report `error instanceof Error ? error.message :
 * "Unknown error."`, and Supabase does not throw Errors — a PostgrestError is
 * a plain object carrying `message`, `code`, `details` and `hint`. So a real
 * database failure reached the agent as the string "Unknown error." and
 * nothing else. That happened: every competitor_ads_submit call failed with
 * 42P10 (an unusable ON CONFLICT target), the agent retried six times with
 * different payloads, concluded the endpoint was broken server-side, and had
 * no way to learn otherwise. The database had been saying exactly what was
 * wrong the whole time.
 *
 * The code is included because it is the part worth searching for, and the
 * caller is a tenant-scoped agent reading its own workspace's errors — not a
 * public surface where a Postgres error code would leak anything.
 */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const e = error as { message?: string; code?: string; details?: string };
    if (e.message) {
      return [e.message, e.code && `(${e.code})`, e.details]
        .filter(Boolean)
        .join(" ");
    }
  }
  return `Unrecognised failure: ${String(error)}`;
}

const options: McpHandlerOptions = {
  serverInfo: { name: "creative-factory-mcp", version: "0.1.0" },
};

const handler = createMcpHandler((server) => {
  server.registerTool(
    "meta_get_winners",
    {
      title: "Meta Get Winners",
      description:
        "Our own ranked, scored Meta creatives — real spend/CTR/ROAS evidence, not a proxy signal.",
      inputSchema: metaGetWinnersInput,
    },
    async (input, ctx) => {
      const userId = ctx.http?.authInfo?.extra?.userId as string;
      const db = createAdminClient();
      try {
        return textResult(await metaGetWinners(input, userId, db));
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "meta_get_creative_dna",
    {
      title: "Meta Get Creative DNA",
      description:
        "Closed-vocabulary DNA (hook, angle, awareness level, offer, why it works) for our own analysed creatives on the given ad accounts.",
      inputSchema: metaGetCreativeDnaInput,
    },
    async (input, ctx) => {
      const userId = ctx.http?.authInfo?.extra?.userId as string;
      const db = createAdminClient();
      try {
        return textResult(await metaGetCreativeDna(input, userId, db));
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "competitor_list",
    {
      title: "Competitor List",
      description: "Every competitor this workspace tracks.",
      inputSchema: z.object({}),
    },
    async (_input, ctx) => {
      const userId = ctx.http?.authInfo?.extra?.userId as string;
      const db = createAdminClient();
      try {
        return textResult(await competitorList(userId, db));
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "competitor_research",
    {
      title: "Competitor Research",
      description:
        "Fans out to every configured competitor-ad provider for one competitor. Never fails the whole call when a provider has nothing — an empty/not_covered result from one provider is reported, not thrown.",
      inputSchema: competitorResearchInput,
    },
    async (input, ctx) => {
      const userId = ctx.http?.authInfo?.extra?.userId as string;
      const db = createAdminClient();
      try {
        return textResult(await competitorResearch(input, userId, db));
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "competitor_ads_submit",
    {
      title: "Competitor Ads Submit",
      description:
        "Records ads YOU (Hermes) observed directly — via your own browser automation, e.g. browsing Meta's public Ad Library website or a competitor's own site. This app never fetches arbitrary URLs server-side, so this is how ads you find get into the same pipeline the other providers feed: deduplicated, and automatically read for Creative DNA (hook, angle, offer, CTA) afterward. The competitor must already be tracked — use competitor_list or competitor_discover first. Report only what a page actually showed you; leave a field out rather than guessing.",
      inputSchema: competitorAdsSubmitInput,
    },
    async (input, ctx) => {
      const userId = ctx.http?.authInfo?.extra?.userId as string;
      const db = createAdminClient();
      try {
        return textResult(await competitorAdsSubmit(input, userId, db));
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "competitor_get_creative_dna",
    {
      title: "Competitor Get Creative DNA",
      description:
        "Closed-vocabulary DNA read from competitor ad copy — same vocabulary as our own Creative DNA, so the two are comparable.",
      inputSchema: competitorGetCreativeDnaInput,
    },
    async (_input, ctx) => {
      const userId = ctx.http?.authInfo?.extra?.userId as string;
      const db = createAdminClient();
      try {
        return textResult(await competitorGetCreativeDna(userId, db));
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "competitor_get_whitespace",
    {
      title: "Competitor Get Whitespace",
      description:
        "Diffs our own Creative DNA against competitors' on the shared vocabulary: shared patterns, where competitors lean, and whitespace where we lean and they barely do.",
      inputSchema: competitorGetWhitespaceInput,
    },
    async (_input, ctx) => {
      const userId = ctx.http?.authInfo?.extra?.userId as string;
      const db = createAdminClient();
      try {
        return textResult(await competitorGetWhitespace(userId, db));
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "factory_get_status",
    {
      title: "Factory Get Status",
      description:
        "A snapshot of both intelligence pipelines: last sync/research run, counts of tracked competitors, pending suggestions, and analysed creatives on each side.",
      inputSchema: factoryGetStatusInput,
    },
    async (_input, ctx) => {
      const userId = ctx.http?.authInfo?.extra?.userId as string;
      const db = createAdminClient();
      try {
        return textResult(await factoryGetStatus(userId, db));
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "approval_get_status",
    {
      title: "Approval Get Status",
      description:
        "Status of one launch batch. No dedicated Approval Service exists yet (Phase 3) — this reports launch-batch creation status, not a real approval-gate state.",
      inputSchema: approvalGetStatusInput,
    },
    async (input, ctx) => {
      const userId = ctx.http?.authInfo?.extra?.userId as string;
      const db = createAdminClient();
      try {
        return textResult(await approvalGetStatus(input, userId, db));
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );

  server.registerTool(
    "competitor_discover",
    {
      title: "Competitor Discover",
      description:
        "Generates candidate competitors from this workspace's brand context (brand_profiles), classified DIRECT/INDIRECT/ADJACENT/ASPIRATIONAL with a relevance score and reasoning. Writes to the suggested_competitors review queue — never inserts directly into tracked competitors. A human (or a later, separate approval tool) still has to approve each one.",
      inputSchema: competitorDiscoverInput,
    },
    async (input, ctx) => {
      const userId = ctx.http?.authInfo?.extra?.userId as string;
      const db = createAdminClient();
      try {
        return textResult(await competitorDiscover(input, userId, db));
      } catch (error) {
        return errorResult(describeError(error));
      }
    },
  );
}, options);

const authedHandler = withMcpAuth(handler, verifyToken, {
  required: true,
  requiredScopes: ["read:creative-factory"],
});

async function route(request: Request): Promise<Response> {
  if (!canRunHermesGateway()) return NOT_CONFIGURED;
  return authedHandler(request);
}

export { route as GET, route as POST };
