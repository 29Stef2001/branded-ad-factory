import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  claimCompetitorResearchJob,
  finishCompetitorResearchJob,
  listActiveCompetitorsForResearch,
  markCompetitorSynced,
  type CompetitorForResearch,
} from "@/features/competitor-analysis/infrastructure/competitor-repository";
import { researchCompetitorAds } from "@/features/competitor-analysis/application/research-competitor";
import { analyseCompetitorDnaForCompetitor } from "@/features/competitor-analysis/application/analyse-competitor-dna";
import { env } from "@/lib/env";

/**
 * Scheduled competitor research: refresh each tracked competitor's ads, then
 * read DNA for whatever is new.
 *
 * Structurally a copy of sync-performance/route.ts's budgeting — GET,
 * CRON_SECRET-gated, service-role client, time-sliced rather than exhaustive —
 * so a scheduled competitor refresh and a hand-triggered one cannot drift
 * apart in what they actually do. Grouped by user because job_runs' claim is
 * per (user_id, job_name): one claim per user covers that user's whole set of
 * competitors for this pass, not one claim per competitor.
 */

export const maxDuration = 60;

const HANDLER_BUDGET_MS = 45_000;
const MIN_COMPETITOR_BUDGET_MS = 5_000;
/** Bounds Claude spend: at most this many new DNA analyses per competitor per run. */
const DNA_LIMIT_PER_COMPETITOR = 10;

function authorised(request: NextRequest): boolean {
  if (!env.CRON_SECRET) return false;
  return request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

type UserResult = {
  userId: string;
  competitors: number;
  adsFetched: number;
  analysed: number;
  failed: number;
  skipped: number;
  /** One line per competitor per provider — what each source found or why not. */
  providerNotes: string[];
  error?: string;
};

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    );
  }

  const deadline = Date.now() + HANDLER_BUDGET_MS;
  const admin = createAdminClient();

  let competitors: CompetitorForResearch[];
  try {
    competitors = await listActiveCompetitorsForResearch(admin);
  } catch (error) {
    console.error(
      "Competitor research cron could not list competitors",
      error,
    );
    return NextResponse.json(
      { error: "Could not list competitors" },
      { status: 500 },
    );
  }

  const byUser = new Map<string, CompetitorForResearch[]>();
  for (const competitor of competitors) {
    const list = byUser.get(competitor.user_id) ?? [];
    list.push(competitor);
    byUser.set(competitor.user_id, list);
  }
  const users = [...byUser.entries()];

  const results: UserResult[] = [];
  let deferredUsers = 0;

  for (const [index, [userId, userCompetitors]] of users.entries()) {
    if (deadline - Date.now() < MIN_COMPETITOR_BUDGET_MS) {
      deferredUsers = users.length - index;
      break;
    }

    const job = await claimCompetitorResearchJob(userId, "cron", admin);
    if (!job) {
      // A run is already in flight for this user — reported, not retried.
      results.push({
        userId,
        competitors: userCompetitors.length,
        adsFetched: 0,
        analysed: 0,
        failed: 0,
        skipped: userCompetitors.length,
        providerNotes: [],
        error: "A research run is already in progress.",
      });
      continue;
    }

    let adsFetched = 0;
    let analysed = 0;
    let failed = 0;
    let skipped = 0;
    const providerNotes: string[] = [];

    try {
      // Sequential on purpose: Meta rate-limits per app, and firing every
      // competitor at once is the fastest way to get throttled for all of
      // them — same reasoning as sync-performance's account loop.
      for (const [ci, competitor] of userCompetitors.entries()) {
        if (deadline - Date.now() < MIN_COMPETITOR_BUDGET_MS) {
          skipped += userCompetitors.length - ci;
          break;
        }

        try {
          // Never throws — a provider finding nothing (Meta out of scope,
          // others not configured) is a normal outcome, not a failure to
          // catch here. See researchCompetitorAds.
          const research = await researchCompetitorAds(
            competitor.id,
            {
              name: competitor.name,
              metaPageId: competitor.meta_page_id,
              websiteUrl: competitor.website_url,
            },
            admin,
          );
          adsFetched += research.totalAdsFound;
          for (const result of research.results) {
            providerNotes.push(
              `${competitor.name}/${result.provider}: ${result.message}`,
            );
          }

          const dna = await analyseCompetitorDnaForCompetitor(
            userId,
            competitor.id,
            DNA_LIMIT_PER_COMPETITOR,
            admin,
          );
          analysed += dna.analysed;
          failed += dna.failed;

          await markCompetitorSynced(competitor.id, admin);
        } catch (error) {
          // One competitor's hiccup must not stall the rest — reported, not
          // thrown, so the loop keeps going.
          failed += 1;
          console.error("Competitor research failed for one competitor", {
            competitorId: competitor.id,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await finishCompetitorResearchJob(
        job.id,
        { status: "succeeded", processedCount: adsFetched },
        admin,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await finishCompetitorResearchJob(
        job.id,
        { status: "failed", error: message },
        admin,
      );
      results.push({
        userId,
        competitors: userCompetitors.length,
        adsFetched,
        analysed,
        failed,
        skipped,
        providerNotes,
        error: message,
      });
      continue;
    }

    results.push({
      userId,
      competitors: userCompetitors.length,
      adsFetched,
      analysed,
      failed,
      skipped,
      providerNotes,
    });
  }

  return NextResponse.json(
    {
      users: users.length,
      processed: results.length,
      deferredUsers,
      results,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
