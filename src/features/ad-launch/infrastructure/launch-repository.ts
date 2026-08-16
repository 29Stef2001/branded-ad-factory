import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/supabase";
import type { AdResult } from "@/features/ad-launch/application/launch-batch";

/**
 * Launch history.
 *
 * A batch of thirty fails in parts, so what happened is recorded rather than
 * shown once and lost on the next render — the only alternative recovery is
 * comparing Ads Manager against memory.
 */

export type LaunchBatchRow = Pick<
  Tables<"launch_batches">,
  | "id"
  | "ad_account_id"
  | "campaign_name"
  | "campaign_meta_id"
  | "adset_meta_id"
  | "objective"
  | "daily_budget_minor"
  | "countries"
  | "ad_status"
  | "dry_run"
  | "status"
  | "error"
  | "created_at"
>;

export type LaunchItemRow = Pick<
  Tables<"launch_items">,
  | "id"
  | "position"
  | "ad_name"
  | "headline"
  | "status"
  | "ad_meta_id"
  | "error"
  | "error_subcode"
>;

export async function recordBatch(
  userId: string,
  batch: {
    adAccountId: string;
    pageId: string;
    campaignName: string;
    objective: string;
    dailyBudgetMinor: number | null;
    countries: string[];
    ageMin: number;
    ageMax: number;
    startTime: string | null;
    pixelId: string | null;
    customEventType: string;
    adStatus: string;
    dryRun: boolean;
    campaignMetaId: string | null;
    adSetMetaId: string | null;
    status: string;
    error: string | null;
  },
  items: (AdResult & {
    primaryText: string;
    linkUrl: string;
    imageUrl: string;
    callToAction: string;
    description: string | null;
    conceptId: string | null;
  })[],
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("launch_batches")
    .insert({
      user_id: userId,
      ad_account_id: batch.adAccountId,
      page_id: batch.pageId,
      campaign_name: batch.campaignName,
      adset_name: `${batch.campaignName} — ad set`,
      campaign_meta_id: batch.campaignMetaId,
      adset_meta_id: batch.adSetMetaId,
      objective: batch.objective,
      daily_budget_minor: batch.dailyBudgetMinor,
      countries: batch.countries,
      age_min: batch.ageMin,
      age_max: batch.ageMax,
      start_time: batch.startTime,
      pixel_id: batch.pixelId,
      custom_event_type: batch.customEventType,
      ad_status: batch.adStatus,
      dry_run: batch.dryRun,
      status: batch.status,
      error: batch.error,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;

  if (items.length > 0) {
    const { error: itemsError } = await supabase.from("launch_items").insert(
      items.map((item) => ({
        batch_id: data.id,
        position: item.position,
        ad_name: `${batch.campaignName} — ${item.headline}`.slice(0, 100),
        primary_text: item.primaryText,
        headline: item.headline,
        description: item.description,
        call_to_action: item.callToAction,
        link_url: item.linkUrl,
        image_url: item.imageUrl,
        concept_id: item.conceptId,
        ad_meta_id: item.adMetaId,
        status: item.status,
        error: item.error,
        error_subcode: item.subcode,
      })),
    );
    if (itemsError) throw itemsError;
  }

  return data.id;
}

export async function listRecentBatches(limit = 10): Promise<LaunchBatchRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("launch_batches")
    .select(
      "id, ad_account_id, campaign_name, campaign_meta_id, adset_meta_id, objective, daily_budget_minor, countries, ad_status, dry_run, status, error, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function listBatchItems(
  batchId: string,
): Promise<LaunchItemRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("launch_items")
    .select(
      "id, position, ad_name, headline, status, ad_meta_id, error, error_subcode",
    )
    .eq("batch_id", batchId)
    .order("position", { ascending: true });

  if (error) throw error;
  return data;
}
