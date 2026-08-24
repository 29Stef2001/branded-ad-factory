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
 * plus the one write path (`competitor_discover`) that only ever proposes
 * candidates for human review, never commits them.
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

/**
 * TEMPORARY diagnostic logging for the "No authorization provided" report —
 * never the token values themselves, only presence/length/match. mcp-handler
 * throws that exact message for every `verifyToken` failure (missing header,
 * malformed header, wrong token, or unset env vars alike) — see
 * node_modules/mcp-handler/dist/index.js's `withMcpAuth`, which always
 * reports "No authorization provided" once `required: true` and `!authInfo`,
 * regardless of which of those it actually was. The message itself cannot
 * distinguish the cases; this log can. Remove once the real cause is found.
 */
function logAuthDiagnostics(
  req: Request,
  bearerToken: string | undefined,
): void {
  const authHeader = req.headers.get("Authorization");
  const envToken = env.HERMES_MCP_TOKEN;
  console.log("[mcp-auth-diagnostic]", {
    authorizationHeaderPresent: authHeader !== null,
    bearerPrefixPresent: Boolean(bearerToken),
    tokenLength: bearerToken?.length ?? 0,
    envTokenPresent: Boolean(envToken),
    envTokenLength: envToken?.length ?? 0,
    envUserIdPresent: Boolean(env.HERMES_MCP_USER_ID),
    comparisonResult:
      bearerToken && envToken
        ? bearerToken === envToken
          ? "match"
          : "no-match"
        : "not-compared",
  });
}

async function verifyToken(
  req: Request,
  bearerToken?: string,
): Promise<{ token: string; clientId: string; scopes: string[]; extra: Record<string, unknown> } | undefined> {
  logAuthDiagnostics(req, bearerToken);

  if (!bearerToken || !env.HERMES_MCP_TOKEN || !env.HERMES_MCP_USER_ID) {
    return undefined;
  }
  // Fixed-length-independent-ish comparison isn't the point at this scale —
  // this is a single-tenant bearer secret, not a public OAuth surface — but
  // a plain `!==` is still the correct, simplest check here.
  if (bearerToken !== env.HERMES_MCP_TOKEN) {
    return undefined;
  }
  return {
    token: bearerToken,
    clientId: "hermes-agent",
    scopes: ["read:creative-factory"],
    extra: { userId: env.HERMES_MCP_USER_ID },
  };
}

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true as const,
  };
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
        return errorResult(error instanceof Error ? error.message : "Unknown error.");
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
        return errorResult(error instanceof Error ? error.message : "Unknown error.");
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
        return errorResult(error instanceof Error ? error.message : "Unknown error.");
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
        return errorResult(error instanceof Error ? error.message : "Unknown error.");
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
        return errorResult(error instanceof Error ? error.message : "Unknown error.");
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
        return errorResult(error instanceof Error ? error.message : "Unknown error.");
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
        return errorResult(error instanceof Error ? error.message : "Unknown error.");
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
        return errorResult(error instanceof Error ? error.message : "Unknown error.");
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
        return errorResult(error instanceof Error ? error.message : "Unknown error.");
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
