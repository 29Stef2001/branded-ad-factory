import { createClient } from "@/lib/supabase/server";
import type { Concept } from "@/features/ad-concepts/domain/schemas";

export type BrandProfile = {
  brand_name: string;
  industry: string;
  tone: string;
  target_audience: string;
  unique_selling_points: string;
  logo_image_url: string | null;
};

export type InspirationOption = {
  id: string;
  competitorName: string;
  adCreativeBody: string | null;
  messagingAngle: string;
};

export type ConceptRow = {
  id: string;
  headline: string;
  hook: string;
  body_copy: string;
  visual_direction: string;
  call_to_action: string;
  created_at: string;
  creative_image_path: string | null;
  product_image_url: string | null;
  competitor_ads: { competitors: { name: string } | null } | null;
  original: { headline: string } | null;
};

const CREATIVE_IMAGES_BUCKET = "ad-creative-images";

export async function getBrandProfile(): Promise<BrandProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_profiles")
    .select(
      "brand_name, industry, tone, target_audience, unique_selling_points, logo_image_url",
    )
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertBrandProfile(
  userId: string,
  profile: {
    brandName: string;
    industry: string;
    tone: string;
    targetAudience: string;
    uniqueSellingPoints: string;
    logoImageUrl?: string;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("brand_profiles").upsert(
    {
      user_id: userId,
      brand_name: profile.brandName,
      industry: profile.industry,
      tone: profile.tone,
      target_audience: profile.targetAudience,
      unique_selling_points: profile.uniqueSellingPoints,
      logo_image_url: profile.logoImageUrl ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}

export async function listAnalyzedAdsForInspiration(): Promise<
  InspirationOption[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitor_ads")
    .select(
      "id, ad_creative_body, competitors(name), ad_analyses!inner(messaging_angle)",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (
    data as unknown as Array<{
      id: string;
      ad_creative_body: string | null;
      competitors: { name: string } | null;
      ad_analyses: { messaging_angle: string };
    }>
  ).map((row) => ({
    id: row.id,
    adCreativeBody: row.ad_creative_body,
    competitorName: row.competitors?.name ?? "Unknown",
    messagingAngle: row.ad_analyses.messaging_angle,
  }));
}

export async function getInspirationAd(
  adId: string,
): Promise<InspirationOption | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitor_ads")
    .select(
      "id, ad_creative_body, competitors(name), ad_analyses!inner(messaging_angle)",
    )
    .eq("id", adId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as {
    id: string;
    ad_creative_body: string | null;
    competitors: { name: string } | null;
    ad_analyses: { messaging_angle: string };
  };

  return {
    id: row.id,
    adCreativeBody: row.ad_creative_body,
    competitorName: row.competitors?.name ?? "Unknown",
    messagingAngle: row.ad_analyses.messaging_angle,
  };
}

export async function insertConcepts(
  userId: string,
  brief: string,
  inspirationAdId: string | null,
  concepts: Concept[],
) {
  const supabase = await createClient();
  const { error } = await supabase.from("ad_concepts").insert(
    concepts.map((concept) => ({
      user_id: userId,
      brief,
      inspired_by_ad_id: inspirationAdId,
      headline: concept.headline,
      hook: concept.hook,
      body_copy: concept.bodyCopy,
      visual_direction: concept.visualDirection,
      call_to_action: concept.callToAction,
    })),
  );

  if (error) throw error;
}

export async function listConcepts(): Promise<ConceptRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ad_concepts")
    .select(
      "id, headline, hook, body_copy, visual_direction, call_to_action, created_at, creative_image_path, product_image_url, competitor_ads(competitors(name)), original:ad_concepts!refined_from_concept_id(headline)",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as unknown as ConceptRow[];
}

export async function getSignedImageUrls(
  paths: string[],
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(CREATIVE_IMAGES_BUCKET)
    .createSignedUrls(paths, 3600);

  if (error) throw error;

  const urls = new Map<string, string>();
  for (const entry of data) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}

export type ConceptFields = {
  headline: string;
  hook: string;
  bodyCopy: string;
  visualDirection: string;
  callToAction: string;
};

export async function getConcept(id: string): Promise<ConceptFields | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ad_concepts")
    .select("headline, hook, body_copy, visual_direction, call_to_action")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    headline: data.headline,
    hook: data.hook,
    bodyCopy: data.body_copy,
    visualDirection: data.visual_direction,
    callToAction: data.call_to_action,
  };
}

export async function uploadConceptImage(
  path: string,
  image: Buffer,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(CREATIVE_IMAGES_BUCKET)
    .upload(path, image, { contentType: "image/png", upsert: true });

  if (error) throw error;
}

export async function setConceptImagePath(
  id: string,
  path: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_concepts")
    .update({ creative_image_path: path })
    .eq("id", id);

  if (error) throw error;
}

export async function setConceptProductImageUrl(
  id: string,
  url: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_concepts")
    .update({ product_image_url: url })
    .eq("id", id);

  if (error) throw error;
}

export async function insertRefinedConcept(
  userId: string,
  originalConceptId: string,
  instruction: string,
  concept: Concept,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("ad_concepts").insert({
    user_id: userId,
    brief: instruction,
    refined_from_concept_id: originalConceptId,
    headline: concept.headline,
    hook: concept.hook,
    body_copy: concept.bodyCopy,
    visual_direction: concept.visualDirection,
    call_to_action: concept.callToAction,
  });

  if (error) throw error;
}
