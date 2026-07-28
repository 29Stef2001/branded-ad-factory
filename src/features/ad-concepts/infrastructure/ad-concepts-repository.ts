import { createClient } from "@/lib/supabase/server";
import type {
  BrandAssetType,
  Concept,
  ConceptV2,
  GenerationStatus,
} from "@/features/ad-concepts/domain/schemas";

export type BrandColors = {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
};

/**
 * Bumped whenever the shape of Brand DNA changes, so a later migration can
 * find rows written against an older shape rather than inferring it.
 */
export const BRAND_PROFILE_SCHEMA_VERSION = 1;

export type BrandProfile = {
  schema_version: number;
  updated_by: string | null;
  updated_at: string;
  migration_source: string | null;
  /** Experimental values. Never rendered into a prompt — see brand-context.ts. */
  metadata: Record<string, unknown>;

  brand_name: string;
  brand_category: string | null;
  markets: string[];
  languages: string[];
  brand_story: string | null;
  brand_mission: string | null;

  target_audience: string;
  tone_attributes: string[];
  tone_notes: string | null;
  writing_style: string | null;

  visual_style: string | null;
  photography_style: string | null;
  brand_colors: BrandColors | null;
  typography_notes: string | null;
  logo_rules: string | null;
  emboss_style: string | null;
  emboss_custom_notes: string | null;
  foil_style: string | null;
  foil_custom_notes: string | null;
  logo_image_url: string | null;

  founder_name: string | null;
  founder_gender: string | null;
  founder_age: number | null;
  founder_background: string | null;

  product_positioning: string | null;
  price_positioning: string | null;
  materials: string[];
  usps: string[];
  brand_values: string[];

  words_to_always_use: string[];
  words_to_never_use: string[];

  image_generation_rules: string | null;
  copy_generation_rules: string | null;
  qa_expectations: string | null;
  qa_min_score: number | null;
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
  tags: string[];
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
  qa_score: number | null;
  detected_issues: string[];
  qa_suggested_prompt: string | null;
  reviewed_at: string | null;
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
      "schema_version, updated_by, updated_at, migration_source, metadata, brand_name, brand_category, markets, languages, brand_story, brand_mission, target_audience, tone_attributes, tone_notes, writing_style, visual_style, photography_style, brand_colors, typography_notes, logo_rules, emboss_style, emboss_custom_notes, foil_style, foil_custom_notes, logo_image_url, founder_name, founder_gender, founder_age, founder_background, product_positioning, price_positioning, materials, usps, brand_values, words_to_always_use, words_to_never_use, image_generation_rules, copy_generation_rules, qa_expectations, qa_min_score",
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

export type BrandProfileInput = {
  brandName: string;
  brandCategory: string;
  markets: string[];
  languages: string[];
  brandStory?: string;
  brandMission?: string;
  targetAudience: string;
  toneAttributes: string[];
  toneNotes?: string;
  writingStyle?: string;
  visualStyle?: string;
  photographyStyle?: string;
  brandColors?: BrandColors;
  typographyNotes?: string;
  logoRules?: string;
  embossStyle?: string;
  embossCustomNotes?: string;
  foilStyle?: string;
  foilCustomNotes?: string;
  logoImageUrl?: string;
  founderName?: string;
  founderGender?: string;
  founderAge?: number;
  founderBackground?: string;
  productPositioning?: string;
  pricePositioning?: string;
  materials: string[];
  usps: string[];
  brandValues: string[];
  wordsToAlwaysUse: string[];
  wordsToNeverUse: string[];
  imageGenerationRules?: string;
  copyGenerationRules?: string;
  qaExpectations?: string;
  qaMinScore?: number;
};

export async function upsertBrandProfile(
  userId: string,
  profile: BrandProfileInput,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("brand_profiles").upsert(
    {
      user_id: userId,
      schema_version: BRAND_PROFILE_SCHEMA_VERSION,
      updated_by: userId,
      // A human just saved this, so it is no longer an unreviewed backfill.
      migration_source: "form",
      brand_name: profile.brandName,
      brand_category: profile.brandCategory,
      markets: profile.markets,
      languages: profile.languages,
      brand_story: profile.brandStory ?? null,
      brand_mission: profile.brandMission ?? null,
      target_audience: profile.targetAudience,
      tone_attributes: profile.toneAttributes,
      tone_notes: profile.toneNotes ?? null,
      writing_style: profile.writingStyle ?? null,
      visual_style: profile.visualStyle ?? null,
      photography_style: profile.photographyStyle ?? null,
      brand_colors: profile.brandColors ?? null,
      typography_notes: profile.typographyNotes ?? null,
      logo_rules: profile.logoRules ?? null,
      emboss_style: profile.embossStyle ?? "none",
      emboss_custom_notes: profile.embossCustomNotes ?? null,
      foil_style: profile.foilStyle ?? "none",
      foil_custom_notes: profile.foilCustomNotes ?? null,
      logo_image_url: profile.logoImageUrl ?? null,
      founder_name: profile.founderName ?? null,
      founder_gender: profile.founderGender ?? null,
      founder_age: profile.founderAge ?? null,
      founder_background: profile.founderBackground ?? null,
      product_positioning: profile.productPositioning ?? null,
      price_positioning: profile.pricePositioning ?? null,
      materials: profile.materials,
      usps: profile.usps,
      brand_values: profile.brandValues,
      words_to_always_use: profile.wordsToAlwaysUse,
      words_to_never_use: profile.wordsToNeverUse,
      image_generation_rules: profile.imageGenerationRules ?? null,
      copy_generation_rules: profile.copyGenerationRules ?? null,
      qa_expectations: profile.qaExpectations ?? null,
      qa_min_score: profile.qaMinScore ?? null,
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
      "generation_prompt_override, final_generation_prompt, visual_direction, brand_asset_requirements, structured_concept, promotional_message:approved_promotional_messages(message)",
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
    // A hand-edited prompt wins over the generated one, which in turn wins over
    // visual_direction for concepts created before structured output existed.
    finalGenerationPrompt:
      data.generation_prompt_override ??
      data.final_generation_prompt ??
      data.visual_direction,
    brandAssetRequirements: data.brand_asset_requirements ?? [],
    promotionalMessage: promotionalMessage?.message ?? null,
    messagePlacement: structured?.messagePlacement ?? null,
    textStyle: structured?.textStyle ?? null,
  };
}

/**
 * Retried because this upload happens *after* the image has been generated and
 * paid for. Observed failing twice in four runs with a bare "fetch failed"
 * from the Storage client — a network-level blip on a ~1.7 MB body, not a
 * rejection. Without a retry each blip discards a finished image and the user
 * pays again to get back to the same point.
 *
 * Only three attempts, with a short backoff: this sits inside a request that
 * has already taken over a minute, so retrying for long enough to hit a
 * serverless timeout would trade one failure for a worse one.
 */
export async function uploadConceptImage(
  path: string,
  image: Buffer,
): Promise<void> {
  const attempts = 3;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const supabase = await createClient();
    const { error } = await supabase.storage
      .from(CREATIVE_IMAGES_BUCKET)
      .upload(path, image, { contentType: "image/png", upsert: true });

    if (!error) return;

    if (attempt === attempts) throw error;

    console.warn(
      `Creative image upload failed (attempt ${attempt}/${attempts}), retrying`,
      { path, error },
    );
    await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
  }
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
  "id, asset_type, label, image_url, storage_path, is_primary, is_active, region, season, sort_order, tags";

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
/**
 * Pulls an uploaded asset's bytes straight out of Storage for use as a
 * generation reference.
 *
 * Deliberately not routed through fetchExternalImage and its host allowlist:
 * that guard exists to stop the server fetching user-supplied URLs, whereas
 * this path is a private bucket the user's own RLS policy already gates. Going
 * out over HTTP to a signed URL would be slower and would need the Supabase
 * host allowlisted, widening the very check that protects the paste-a-URL path.
 */
export async function downloadBrandAssetFile(
  path: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BRAND_ASSETS_BUCKET)
    .download(path);

  if (error) throw error;
  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || "image/png",
  };
}

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
  tags?: string[];
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
    tags: input.tags ?? [],
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
    tags?: string[];
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
      ...(input.tags !== undefined && { tags: input.tags }),
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
  status: GenerationStatus;
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
    status?: GenerationStatus;
    imagePath?: string;
    qaScores?: Record<string, number>;
    qaPassed?: boolean;
    qaNotes?: string;
    qaScore?: number;
    detectedIssues?: string[];
    qaSuggestedPrompt?: string;
    reviewedAt?: string;
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
      ...(input.qaScore !== undefined && { qa_score: input.qaScore }),
      ...(input.detectedIssues !== undefined && {
        detected_issues: input.detectedIssues,
      }),
      ...(input.qaSuggestedPrompt !== undefined && {
        qa_suggested_prompt: input.qaSuggestedPrompt,
      }),
      ...(input.reviewedAt !== undefined && { reviewed_at: input.reviewedAt }),
      ...(input.failureReason !== undefined && {
        failure_reason: input.failureReason,
      }),
    })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Attempt numbers are per concept and sequential, so the next one is simply the
 * count so far plus one. `head: true` keeps this a count query rather than
 * pulling every previous attempt back just to measure the list.
 */
export type ConceptSummary = {
  id: string;
  headline: string;
  strategy_type: string | null;
  generation_status: string | null;
  created_at: string;
};

/** Just enough to populate the Prompt Builder's concept picker. */
export async function listConceptSummaries(): Promise<ConceptSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ad_concepts")
    .select("id, headline, strategy_type, generation_status, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as ConceptSummary[];
}

export type ConceptPromptDetail = {
  id: string;
  headline: string;
  strategy_type: string | null;
  campaign_angle: string | null;
  visual_direction: string;
  final_generation_prompt: string | null;
  generation_prompt_override: string | null;
  structured_concept: Record<string, unknown> | null;
  brand_asset_requirements: string[];
  promotional_message_id: string | null;
  promotional_message: { message: string } | null;
  generation_status: string | null;
  creative_image_path: string | null;
};

export async function getConceptPromptDetail(
  id: string,
): Promise<ConceptPromptDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ad_concepts")
    .select(
      "id, headline, strategy_type, campaign_angle, visual_direction, final_generation_prompt, generation_prompt_override, structured_concept, brand_asset_requirements, promotional_message_id, generation_status, creative_image_path, promotional_message:approved_promotional_messages(message)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as unknown as ConceptPromptDetail | null;
}

/** Passing null clears the edit, restoring the model's original prompt. */
export async function setGenerationPromptOverride(
  conceptId: string,
  prompt: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_concepts")
    .update({ generation_prompt_override: prompt })
    .eq("id", conceptId);

  if (error) throw error;
}

export async function countGenerationAttempts(
  conceptId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("creative_generations")
    .select("*", { count: "exact", head: true })
    .eq("concept_id", conceptId);

  if (error) throw error;
  return count ?? 0;
}

export async function listGenerationsForConcept(
  conceptId: string,
): Promise<CreativeGenerationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_generations")
    .select(
      "id, concept_id, attempt_number, status, image_path, selected_reference_roles, qa_scores, qa_passed, qa_notes, qa_score, detected_issues, qa_suggested_prompt, reviewed_at, retry_reason, failure_reason, created_at",
    )
    .eq("concept_id", conceptId)
    .order("attempt_number", { ascending: true });

  if (error) throw error;
  return data as unknown as CreativeGenerationRow[];
}

export async function updateConceptGenerationStatus(
  conceptId: string,
  status: GenerationStatus,
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

export type DashboardStats = {
  assetsTotal: number;
  assetsActive: number;
  hasOwnerAsset: boolean;
  hasProductAsset: boolean;
  hasLogoAsset: boolean;
  conceptsTotal: number;
  conceptsWithImage: number;
  generationsTotal: number;
  qaPassed: number;
  qaFailed: number;
  qaUnreviewed: number;
  messagesTotal: number;
  messagesEnabled: number;
};

/**
 * Counts for the dashboard, as head-only queries so the page costs a handful of
 * counts rather than pulling every row back to measure it.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();
  const HEAD = { count: "exact" as const, head: true };

  const [assets, messages] = await Promise.all([
    listBrandAssets(),
    listApprovedMessages(),
  ]);

  // Written out rather than routed through a generic helper: the Supabase
  // builder changes type after each filter, so a shared wrapper ends up fighting
  // its own generics for no real saving.
  const [
    conceptsTotal,
    conceptsWithImage,
    generationsTotal,
    qaPassed,
    qaFailed,
    qaUnreviewed,
  ] = await Promise.all([
    supabase.from("ad_concepts").select("*", HEAD),
    supabase
      .from("ad_concepts")
      .select("*", HEAD)
      .not("creative_image_path", "is", null),
    supabase.from("creative_generations").select("*", HEAD),
    supabase
      .from("creative_generations")
      .select("*", HEAD)
      .eq("qa_passed", true),
    supabase
      .from("creative_generations")
      .select("*", HEAD)
      .eq("qa_passed", false),
    supabase
      .from("creative_generations")
      .select("*", HEAD)
      .is("qa_passed", null),
  ]);

  for (const result of [
    conceptsTotal,
    conceptsWithImage,
    generationsTotal,
    qaPassed,
    qaFailed,
    qaUnreviewed,
  ]) {
    if (result.error) throw result.error;
  }

  return {
    assetsTotal: assets.length,
    assetsActive: assets.filter((a) => a.is_active).length,
    hasOwnerAsset: assets.some((a) => a.asset_type === "owner" && a.is_active),
    hasProductAsset: assets.some(
      (a) => a.asset_type === "product" && a.is_active,
    ),
    hasLogoAsset: assets.some((a) => a.asset_type === "logo" && a.is_active),
    conceptsTotal: conceptsTotal.count ?? 0,
    conceptsWithImage: conceptsWithImage.count ?? 0,
    generationsTotal: generationsTotal.count ?? 0,
    qaPassed: qaPassed.count ?? 0,
    qaFailed: qaFailed.count ?? 0,
    qaUnreviewed: qaUnreviewed.count ?? 0,
    messagesTotal: messages.length,
    messagesEnabled: messages.filter((m) => m.is_active).length,
  };
}

export type ActivityItem = {
  id: string;
  attemptNumber: number;
  status: string;
  qaScore: number | null;
  qaPassed: boolean | null;
  createdAt: string;
  conceptHeadline: string;
  conceptId: string;
};

/** The most recent generation attempts, newest first. */
export async function listRecentActivity(limit = 8): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("creative_generations")
    .select(
      "id, attempt_number, status, qa_score, qa_passed, created_at, concept_id, ad_concepts(headline)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (
    data as unknown as Array<{
      id: string;
      attempt_number: number;
      status: string;
      qa_score: number | null;
      qa_passed: boolean | null;
      created_at: string;
      concept_id: string;
      ad_concepts: { headline: string } | null;
    }>
  ).map((row) => ({
    id: row.id,
    attemptNumber: row.attempt_number,
    status: row.status,
    qaScore: row.qa_score,
    qaPassed: row.qa_passed,
    createdAt: row.created_at,
    conceptId: row.concept_id,
    conceptHeadline: row.ad_concepts?.headline ?? "Deleted concept",
  }));
}

export type QaReviewItem = {
  id: string;
  conceptId: string;
  conceptHeadline: string;
  attemptNumber: number;
  status: string;
  qaScore: number | null;
  qaPassed: boolean | null;
  qaNotes: string | null;
  detectedIssues: string[];
  suggestedPrompt: string | null;
  imagePath: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

/**
 * Reviewed attempts across every concept, newest first.
 *
 * Exists because QA results were only visible one concept at a time: with
 * fifteen concepts there was no way to see what needed attention without
 * opening each in turn.
 */
export async function listQaReviews(
  filter: "all" | "failed" | "passed" = "all",
): Promise<QaReviewItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("creative_generations")
    .select(
      "id, concept_id, attempt_number, status, qa_score, qa_passed, qa_notes, detected_issues, qa_suggested_prompt, image_path, reviewed_at, created_at, ad_concepts(headline)",
    )
    .not("qa_passed", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (filter === "failed") query = query.eq("qa_passed", false);
  if (filter === "passed") query = query.eq("qa_passed", true);

  const { data, error } = await query;
  if (error) throw error;

  return (
    data as unknown as Array<{
      id: string;
      concept_id: string;
      attempt_number: number;
      status: string;
      qa_score: number | null;
      qa_passed: boolean | null;
      qa_notes: string | null;
      detected_issues: string[];
      qa_suggested_prompt: string | null;
      image_path: string | null;
      reviewed_at: string | null;
      created_at: string;
      ad_concepts: { headline: string } | null;
    }>
  ).map((row) => ({
    id: row.id,
    conceptId: row.concept_id,
    conceptHeadline: row.ad_concepts?.headline ?? "Deleted concept",
    attemptNumber: row.attempt_number,
    status: row.status,
    qaScore: row.qa_score,
    qaPassed: row.qa_passed,
    qaNotes: row.qa_notes,
    detectedIssues: row.detected_issues ?? [],
    suggestedPrompt: row.qa_suggested_prompt,
    imagePath: row.image_path,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  }));
}
