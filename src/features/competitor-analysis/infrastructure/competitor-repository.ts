import { createClient } from "@/lib/supabase/server";
import type { MetaAd } from "@/features/competitor-analysis/infrastructure/meta-ad-library-client";
import type { AdAnalysis } from "@/features/competitor-analysis/domain/schemas";
import type { Tables } from "@/types/supabase";

export type Competitor = Pick<
  Tables<"competitors">,
  "id" | "name" | "meta_page_id" | "created_at"
>;

/**
 * An ad plus its embedded analysis. The ad columns come from the generated
 * Row; the embed cannot, because PostgREST joins are query-specific.
 */
export type CompetitorAdWithAnalysis = Pick<
  Tables<"competitor_ads">,
  | "id"
  | "page_name"
  | "ad_creative_body"
  | "ad_creative_link_title"
  | "ad_creative_link_description"
  | "ad_snapshot_url"
  | "ad_delivery_start_time"
> & {
  ad_analyses: Pick<
    Tables<"ad_analyses">,
    | "messaging_angle"
    | "hook"
    | "tone"
    | "target_audience"
    | "call_to_action"
    | "summary"
  > | null;
};

export async function createCompetitor(
  userId: string,
  name: string,
  metaPageId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitors")
    .insert({ user_id: userId, name, meta_page_id: metaPageId })
    .select("id")
    .single();

  if (error) throw error;
  return data as { id: string };
}

export async function listCompetitors(): Promise<Competitor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitors")
    .select("id, name, meta_page_id, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getCompetitor(id: string): Promise<Competitor | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitors")
    .select("id, name, meta_page_id, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertAds(competitorId: string, ads: MetaAd[]) {
  if (ads.length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("competitor_ads").upsert(
    ads.map((ad) => ({
      competitor_id: competitorId,
      meta_ad_archive_id: ad.metaAdArchiveId,
      page_name: ad.pageName,
      ad_creative_body: ad.adCreativeBody,
      ad_creative_link_title: ad.adCreativeLinkTitle,
      ad_creative_link_description: ad.adCreativeLinkDescription,
      ad_snapshot_url: ad.adSnapshotUrl,
      ad_delivery_start_time: ad.adDeliveryStartTime,
    })),
    { onConflict: "meta_ad_archive_id" },
  );

  if (error) throw error;
}

export async function listAdsWithAnalysis(
  competitorId: string,
): Promise<CompetitorAdWithAnalysis[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitor_ads")
    .select(
      "id, page_name, ad_creative_body, ad_creative_link_title, ad_creative_link_description, ad_snapshot_url, ad_delivery_start_time, ad_analyses(messaging_angle, hook, tone, target_audience, call_to_action, summary)",
    )
    .eq("competitor_id", competitorId)
    .order("ad_delivery_start_time", { ascending: false });

  if (error) throw error;
  return data as unknown as CompetitorAdWithAnalysis[];
}

export async function getAd(adId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitor_ads")
    .select(
      "id, ad_creative_body, ad_creative_link_title, ad_creative_link_description, competitor_id",
    )
    .eq("id", adId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveAnalysis(adId: string, analysis: AdAnalysis) {
  const supabase = await createClient();
  const { error } = await supabase.from("ad_analyses").upsert(
    {
      ad_id: adId,
      messaging_angle: analysis.messagingAngle,
      hook: analysis.hook,
      tone: analysis.tone,
      target_audience: analysis.targetAudience,
      call_to_action: analysis.callToAction,
      summary: analysis.summary,
    },
    { onConflict: "ad_id" },
  );

  if (error) throw error;
}
