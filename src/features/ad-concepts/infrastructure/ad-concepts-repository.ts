import { createClient } from "@/lib/supabase/server";
import type {
  BrandAssetType,
  Concept,
  ConceptV2,
} from "@/features/ad-concepts/domain/schemas";

export type BrandColors = {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
};

export type BrandProfile = {
  brand_name: string;
  industry: string;
  tone: string;
  target_audience: string;
  unique_selling_points: string;
  logo_image_url: string | null;
  brand_colors: BrandColors | null;
  typography_notes: string | null;
  emboss_style: string | null;
  emboss_custom_notes: string | null;
  foil_style: string | null;
  foil_custom_notes: string | null;
};

export type BrandAssetRow = {
  id: string;
  asset_type: BrandAssetType;
  label: string | null;
  /** Null when the asset was uploaded rather than linked. */
  image_url: string | null;
  /** Null when the asset was linked rather than uploaded. */
  storage_path: string | null;
  is_primary: boolean;
  is_active: boolean;
  region: string | null;
  season: string | null;
  sort_order: number;
};

/**
 * A row plus whatever URL should actually be rendered for it — a fresh signed
 * URL for uploads, the stored link otherwise. Resolved server-side per request,
 * the same shape the concepts page already uses for creative images.
 */
export type BrandAssetWithUrl = BrandAssetRow & { displayUrl: string | null };

export type ApprovedMessageRow = {
  id: string;
  message: string;
  is_active: boolean;
  sort_order: number;
  category: string | null;
  usage_notes: string | null;
  region: string | null;
  campaign: string | null;
};

export type CreativeGenerationRow = {
  id: string;
  concept_id: string;
  attempt_number: number;
  status: string;
  image_path: string | null;
  selected_reference_roles: string[];
  qa_scores: Record<string, number> | null;
  qa_passed: boolean | null;
  qa_notes: string | null;
  retry_reason: string | null;
  failure_reason: string | null;
  created_at: string;
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
  strategy_type: string | null;
  campaign_angle: string | null;
  brand_asset_requirements: string[];
  generation_status: string | null;
  generation_retry_count: number;
  competitor_ads: { competitors: { name: string } | null } | null;
  original: { headline: string } | null;
  promotional_message: { message: string } | null;
};

const CREATIVE_IMAGES_BUCKET = "ad-creative-images";

export async function getBrandProfile(): Promise<BrandProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_profiles")
    .select(
      "brand_name, industry, tone, target_audience, unique_selling_points, logo_image_url, brand_colors, typography_notes, emboss_style, emboss_custom_notes, foil_style, foil_custom_notes",
    )
    .maybeSingle();

  if (error) throw error;
  return data as BrandProfile | null;
}

async function getBrandProfileId(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_profiles")
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
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
    brandColors?: BrandColors;
    typographyNotes?: string;
    embossStyle?: string;
    embossCustomNotes?: string;
    foilStyle?: string;
    foilCustomNotes?: string;
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
      brand_colors: profile.brandColors ?? null,
      typography_notes: profile.typographyNotes ?? null,
      emboss_style: profile.embossStyle ?? "none",
      emboss_custom_notes: profile.embossCustomNotes ?? null,
      foil_style: profile.foilStyle ?? "none",
      foil_custom_notes: profile.foilCustomNotes ?? null,
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

// Resolves a concept's chosen promotional message to its row id by exact text
// match. Claude is instructed to return one of the brand's enabled messages
// verbatim; this is the app-side enforcement that it actually did, per "never
// invent promotional copy outside the approved list" — a non-match means the
// concept is inserted with no linked message rather than silently trusting an
// unapproved string.
async function findApprovedMessageIdByText(
  brandProfileId: string,
  message: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approved_promotional_messages")
    .select("id")
    .eq("brand_profile_id", brandProfileId)
    .eq("message", message)
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function insertConcepts(
  userId: string,
  brief: string,
  inspirationAdId: string | null,
  concepts: ConceptV2[],
) {
  const brandProfileId = await getBrandProfileId();
  if (!brandProfileId) throw new Error("Brand profile not found.");

  const rows = await Promise.all(
    concepts.map(async (concept) => ({
      user_id: userId,
      brief,
      inspired_by_ad_id: inspirationAdId,
      headline: concept.headline,
      hook: concept.hook,
      body_copy: concept.bodyCopy,
      visual_direction: concept.visualDirection,
      call_to_action: concept.callToAction,
      strategy_type: concept.strategyType,
      campaign_angle: concept.campaignAngle,
      promotional_message_id: await findApprovedMessageIdByText(
        brandProfileId,
        concept.primaryPromotionalMessage,
      ),
      brand_asset_requirements: concept.brandAssetRequirements,
      structured_concept: {
        emotionalDriver: concept.emotionalDriver,
        scene: concept.scene,
        subject: concept.subject,
        productPlacement: concept.productPlacement,
        messagePlacement: concept.messagePlacement,
        cameraStyle: concept.cameraStyle,
        lighting: concept.lighting,
        composition: concept.composition,
        textStyle: concept.textStyle,
        elementsToPreserve: concept.elementsToPreserve,
        elementsToVary: concept.elementsToVary,
      },
      final_generation_prompt: concept.finalGenerationPrompt,
    })),
  );

  const supabase = await createClient();
  const { error } = await supabase.from("ad_concepts").insert(rows);

  if (error) throw error;
}

const CONCEPT_ROW_SELECT =
  "id, headline, hook, body_copy, visual_direction, call_to_action, created_at, creative_image_path, product_image_url, strategy_type, campaign_angle, brand_asset_requirements, generation_status, generation_retry_count, competitor_ads(competitors(name)), original:ad_concepts!refined_from_concept_id(headline), promotional_message:approved_promotional_messages(message)";

export async function listConcepts(): Promise<ConceptRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ad_concepts")
    .select(CONCEPT_ROW_SELECT)
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

export type ConceptGenerationInput = {
  finalGenerationPrompt: string;
  brandAssetRequirements: string[];
  promotionalMessage: string | null;
  messagePlacement: string | null;
  textStyle: string | null;
};

export async function getConceptForGeneration(
  id: string,
): Promise<ConceptGenerationInput | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ad_concepts")
    .select(
      "final_generation_prompt, visual_direction, brand_asset_requirements, structured_concept, promotional_message:approved_promotional_messages(message)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const structured = data.structured_concept as {
    messagePlacement?: string;
    textStyle?: string;
  } | null;
  const promotionalMessage = data.promotional_message as unknown as {
    message: string;
  } | null;

  return {
    finalGenerationPrompt:
      data.final_generation_prompt ?? data.visual_direction,
    brandAssetRequirements: data.brand_asset_requirements ?? [],
    promotionalMessage: promotionalMessage?.message ?? null,
    messagePlacement: structured?.messagePlacement ?? null,
    textStyle: structured?.textStyle ?? null,
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

// ---------------------------------------------------------------------------
// Brand assets
// ---------------------------------------------------------------------------

const BRAND_ASSET_SELECT =
  "id, asset_type, label, image_url, storage_path, is_primary, is_active, region, season, sort_order";

const BRAND_ASSETS_BUCKET = "brand-assets";

/** Signed URLs are minted per render; an hour outlives any realistic page view. */
const SIGNED_URL_TTL_SECONDS = 3600;

export async function listBrandAssets(): Promise<BrandAssetRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_assets")
    .select(BRAND_ASSET_SELECT)
    .order("asset_type", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data as BrandAssetRow[];
}

/**
 * Assets with their render URLs resolved in one batch, so a page with twenty
 * uploaded assets signs twenty paths in a single round trip rather than twenty.
 */
export async function listBrandAssetsWithUrls(): Promise<BrandAssetWithUrl[]> {
  const assets = await listBrandAssets();

  const paths = assets
    .map((asset) => asset.storage_path)
    .filter((path): path is string => path !== null);

  const signed = await getSignedBrandAssetUrls(paths);

  return assets.map((asset) => ({
    ...asset,
    displayUrl: asset.storage_path
      ? (signed.get(asset.storage_path) ?? null)
      : asset.image_url,
  }));
}

async function getSignedBrandAssetUrls(
  paths: string[],
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BRAND_ASSETS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error) throw error;

  const urls = new Map<string, string>();
  for (const entry of data) {
    if (entry.path && entry.signedUrl) urls.set(entry.path, entry.signedUrl);
  }
  return urls;
}

export async function uploadBrandAssetFile(
  userId: string,
  file: File,
): Promise<string> {
  const supabase = await createClient();

  // The path is prefixed with the user id because that first segment is what
  // the storage RLS policy checks; the random suffix keeps two uploads of the
  // same filename from overwriting each other.
  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(BRAND_ASSETS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw error;
  return path;
}

/**
 * Best-effort cleanup so deleting an asset doesn't strand its file in the
 * bucket. Failure is swallowed deliberately: an orphaned object costs storage,
 * whereas surfacing the error would leave the user staring at a row they
 * already deleted, wondering whether it worked.
 */
export async function removeBrandAssetFile(path: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(BRAND_ASSETS_BUCKET)
    .remove([path]);

  // Logged rather than thrown, and never silent: the user has already deleted
  // the row and surfacing this would only confuse them, but a cleanup that
  // fails without a trace leaves orphaned files nobody ever finds.
  if (error) {
    console.error("Failed to remove brand asset file", { path, error });
  }
}

export async function listActiveBrandAssets(): Promise<BrandAssetRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_assets")
    .select(BRAND_ASSET_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data as BrandAssetRow[];
}

async function unsetExistingPrimary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandProfileId: string,
  assetType: BrandAssetType,
) {
  const { error } = await supabase
    .from("brand_assets")
    .update({ is_primary: false })
    .eq("brand_profile_id", brandProfileId)
    .eq("asset_type", assetType)
    .eq("is_primary", true);

  if (error) throw error;
}

export async function createBrandAsset(input: {
  assetType: BrandAssetType;
  label?: string;
  /** Exactly one of imageUrl / storagePath, matching the table's check constraint. */
  imageUrl?: string;
  storagePath?: string;
  isPrimary: boolean;
  isActive: boolean;
  region?: string;
  season?: string;
}): Promise<void> {
  const brandProfileId = await getBrandProfileId();
  if (!brandProfileId) throw new Error("Brand profile not found.");

  const supabase = await createClient();
  if (input.isPrimary) {
    await unsetExistingPrimary(supabase, brandProfileId, input.assetType);
  }

  const { error } = await supabase.from("brand_assets").insert({
    brand_profile_id: brandProfileId,
    asset_type: input.assetType,
    label: input.label ?? null,
    image_url: input.imageUrl ?? null,
    storage_path: input.storagePath ?? null,
    is_primary: input.isPrimary,
    is_active: input.isActive,
    region: input.region ?? null,
    season: input.season ?? null,
  });

  if (error) throw error;
}

export async function updateBrandAsset(
  id: string,
  input: {
    label?: string;
    imageUrl?: string;
    storagePath?: string;
    isPrimary?: boolean;
    isActive?: boolean;
    region?: string;
    season?: string;
  },
): Promise<void> {
  const supabase = await createClient();

  if (input.isPrimary) {
    const { data: existing, error: fetchError } = await supabase
      .from("brand_assets")
      .select("brand_profile_id, asset_type")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (existing) {
      await unsetExistingPrimary(
        supabase,
        existing.brand_profile_id,
        existing.asset_type as BrandAssetType,
      );
    }
  }

  // Swapping the image source has to clear the other column: the table's check
  // constraint allows exactly one of image_url / storage_path to be set, so
  // writing one without nulling the other would be rejected outright.
  const imageSource =
    input.storagePath !== undefined
      ? { storage_path: input.storagePath, image_url: null }
      : input.imageUrl !== undefined
        ? { image_url: input.imageUrl, storage_path: null }
        : {};

  const { error } = await supabase
    .from("brand_assets")
    .update({
      ...(input.label !== undefined && { label: input.label }),
      ...imageSource,
      ...(input.isPrimary !== undefined && { is_primary: input.isPrimary }),
      ...(input.isActive !== undefined && { is_active: input.isActive }),
      ...(input.region !== undefined && { region: input.region }),
      ...(input.season !== undefined && { season: input.season }),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteBrandAsset(id: string): Promise<void> {
  const supabase = await createClient();

  // Read the path before deleting the row — afterwards there is nothing left
  // pointing at the file, and it would sit in the bucket forever.
  const { data: existing } = await supabase
    .from("brand_assets")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("brand_assets").delete().eq("id", id);
  if (error) throw error;

  if (existing?.storage_path) await removeBrandAssetFile(existing.storage_path);
}

export async function reorderBrandAsset(
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const supabase = await createClient();
  const { data: target, error: targetError } = await supabase
    .from("brand_assets")
    .select("brand_profile_id, asset_type, sort_order")
    .eq("id", id)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target) return;

  const { data: siblings, error: siblingsError } = await supabase
    .from("brand_assets")
    .select("id, sort_order")
    .eq("brand_profile_id", target.brand_profile_id)
    .eq("asset_type", target.asset_type)
    .order("sort_order", { ascending: true });

  if (siblingsError) throw siblingsError;

  const index = siblings.findIndex((row) => row.id === id);
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  const neighbor = siblings[neighborIndex];
  if (!neighbor) return;

  const { error: updateTargetError } = await supabase
    .from("brand_assets")
    .update({ sort_order: neighbor.sort_order })
    .eq("id", id);
  if (updateTargetError) throw updateTargetError;

  const { error: updateNeighborError } = await supabase
    .from("brand_assets")
    .update({ sort_order: target.sort_order })
    .eq("id", neighbor.id);
  if (updateNeighborError) throw updateNeighborError;
}

// Prefers the new brand_assets primary logo; falls back to the legacy
// brand_profiles.logo_image_url column for brands that haven't migrated yet
// (or whose backfill somehow didn't run) — see the create_brand_assets
// migration's backfill for the normal path.
export async function getPrimaryLogoUrl(): Promise<string | null> {
  const supabase = await createClient();
  const { data: asset, error: assetError } = await supabase
    .from("brand_assets")
    .select("image_url")
    .eq("asset_type", "logo")
    .eq("is_primary", true)
    .eq("is_active", true)
    .maybeSingle();

  if (assetError) throw assetError;
  if (asset) return asset.image_url;

  const { data: profile, error: profileError } = await supabase
    .from("brand_profiles")
    .select("logo_image_url")
    .maybeSingle();

  if (profileError) throw profileError;
  return profile?.logo_image_url ?? null;
}

// ---------------------------------------------------------------------------
// Approved promotional messages
// ---------------------------------------------------------------------------

const APPROVED_MESSAGE_SELECT =
  "id, message, is_active, sort_order, category, usage_notes, region, campaign";

export async function listApprovedMessages(): Promise<ApprovedMessageRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approved_promotional_messages")
    .select(APPROVED_MESSAGE_SELECT)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data as ApprovedMessageRow[];
}

export async function listEnabledApprovedMessages(): Promise<
  ApprovedMessageRow[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approved_promotional_messages")
    .select(APPROVED_MESSAGE_SELECT)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data as ApprovedMessageRow[];
}

export async function createApprovedMessage(input: {
  message: string;
  isActive: boolean;
  category?: string;
  usageNotes?: string;
  region?: string;
  campaign?: string;
}): Promise<void> {
  const brandProfileId = await getBrandProfileId();
  if (!brandProfileId) throw new Error("Brand profile not found.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("approved_promotional_messages")
    .insert({
      brand_profile_id: brandProfileId,
      message: input.message,
      is_active: input.isActive,
      category: input.category ?? null,
      usage_notes: input.usageNotes ?? null,
      region: input.region ?? null,
      campaign: input.campaign ?? null,
    });

  if (error) throw error;
}

export async function updateApprovedMessage(
  id: string,
  input: {
    message?: string;
    isActive?: boolean;
    category?: string;
    usageNotes?: string;
    region?: string;
    campaign?: string;
  },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("approved_promotional_messages")
    .update({
      ...(input.message !== undefined && { message: input.message }),
      ...(input.isActive !== undefined && { is_active: input.isActive }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.usageNotes !== undefined && { usage_notes: input.usageNotes }),
      ...(input.region !== undefined && { region: input.region }),
      ...(input.campaign !== undefined && { campaign: input.campaign }),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function deleteApprovedMessage(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("approved_promotional_messages")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderApprovedMessage(
  id: string,
  direction: "up" | "down",
): Promise<void> {
  const supabase = await createClient();
  const { data: target, error: targetError } = await supabase
    .from("approved_promotional_messages")
    .select("brand_profile_id, sort_order")
    .eq("id", id)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target) return;

  const { data: siblings, error: siblingsError } = await supabase
    .from("approved_promotional_messages")
    .select("id, sort_order")
    .eq("brand_profile_id", target.brand_profile_id)
    .order("sort_order", { ascending: true });

  if (siblingsError) throw siblingsError;

  const index = siblings.findIndex((row) => row.id === id);
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  const neighbor = siblings[neighborIndex];
  if (!neighbor) return;

  const { error: updateTargetError } = await supabase
    .from("approved_promotional_messages")
    .update({ sort_order: neighbor.sort_order })
    .eq("id", id);
  if (updateTargetError) throw updateTargetError;

  const { error: updateNeighborError } = await supabase
    .from("approved_promotional_messages")
    .update({ sort_order: target.sort_order })
    .eq("id", neighbor.id);
  if (updateNeighborError) throw updateNeighborError;
}

// ---------------------------------------------------------------------------
// Creative generations (one row per attempt)
// ---------------------------------------------------------------------------

export async function insertGenerationAttempt(input: {
  conceptId: string;
  attemptNumber: number;
  status: string;
  imagePath?: string;
  selectedReferenceRoles: string[];
  qaScores?: Record<string, number>;
  qaPassed?: boolean;
  qaNotes?: string;
  retryReason?: string;
  failureReason?: string;
}): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_generations")
    .insert({
      concept_id: input.conceptId,
      attempt_number: input.attemptNumber,
      status: input.status,
      image_path: input.imagePath ?? null,
      selected_reference_roles: input.selectedReferenceRoles,
      qa_scores: input.qaScores ?? null,
      qa_passed: input.qaPassed ?? null,
      qa_notes: input.qaNotes ?? null,
      retry_reason: input.retryReason ?? null,
      failure_reason: input.failureReason ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function updateGenerationAttempt(
  id: string,
  input: {
    status?: string;
    imagePath?: string;
    qaScores?: Record<string, number>;
    qaPassed?: boolean;
    qaNotes?: string;
    failureReason?: string;
  },
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("creative_generations")
    .update({
      ...(input.status !== undefined && { status: input.status }),
      ...(input.imagePath !== undefined && { image_path: input.imagePath }),
      ...(input.qaScores !== undefined && { qa_scores: input.qaScores }),
      ...(input.qaPassed !== undefined && { qa_passed: input.qaPassed }),
      ...(input.qaNotes !== undefined && { qa_notes: input.qaNotes }),
      ...(input.failureReason !== undefined && {
        failure_reason: input.failureReason,
      }),
    })
    .eq("id", id);

  if (error) throw error;
}

export async function listGenerationsForConcept(
  conceptId: string,
): Promise<CreativeGenerationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_generations")
    .select(
      "id, concept_id, attempt_number, status, image_path, selected_reference_roles, qa_scores, qa_passed, qa_notes, retry_reason, failure_reason, created_at",
    )
    .eq("concept_id", conceptId)
    .order("attempt_number", { ascending: true });

  if (error) throw error;
  return data as unknown as CreativeGenerationRow[];
}

export async function updateConceptGenerationStatus(
  conceptId: string,
  status: string,
  retryCount: number,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_concepts")
    .update({
      generation_status: status,
      generation_retry_count: retryCount,
    })
    .eq("id", conceptId);

  if (error) throw error;
}
