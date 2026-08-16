"use server";

import {
  BILLING_EVENT,
  optimizationGoalFor,
  parseCountries,
  toMinorUnits,
  validateDraft,
  type BatchDraft,
} from "@/features/ad-launch/domain/campaign-settings";
import {
  MetaLaunchError,
  createAd,
  createAdCreative,
  createAdSet,
  createCampaign,
  getAdSetDetails,
  listAdSets,
  listCampaigns,
  listPixels,
  uploadAdImage,
  type LaunchStatus,
} from "@/features/ad-launch/infrastructure/meta-launch-client";
import { getConnection } from "@/features/ad-performance/infrastructure/ad-performance-repository";
import {
  getSignedImageUrls,
  listConcepts,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { recordBatch } from "@/features/ad-launch/infrastructure/launch-repository";
import { requireUserId } from "@/features/ad-concepts/application/require-user";

/**
 * Builds a campaign, an ad set and every ad in one pass.
 *
 * Ordered so that nothing partial is left behind if it can be helped: the
 * campaign and ad set are created first, and only then are ads attempted one
 * at a time. An ad failing leaves the ones before it intact and reports which
 * failed, because thirty ads where the eleventh is rejected is the normal case,
 * not the exception.
 */

export type AdResult = {
  position: number;
  headline: string;
  status: "done" | "failed";
  adMetaId: string | null;
  error: string | null;
  /** Meta's subcode, so one cause behind many failures is visible. */
  subcode: number | null;
};

export type LaunchResult = {
  status: "success" | "partial" | "failed" | "invalid";
  message: string;
  problems: { field: string; message: string }[];
  campaignId: string | null;
  adSetId: string | null;
  ads: AdResult[];
  /** Set when the whole batch failed for one reason worth explaining. */
  blocker: "development_mode" | "account_disabled" | "business_blocked" | null;
};

const empty: Omit<LaunchResult, "status" | "message"> = {
  problems: [],
  campaignId: null,
  adSetId: null,
  ads: [],
  blocker: null,
};

function blockerFor(error: unknown): LaunchResult["blocker"] {
  if (!(error instanceof MetaLaunchError)) return null;
  if (error.isDevelopmentModeBlock) return "development_mode";
  if (error.isAccountDisabled) return "account_disabled";
  // 2446325: the Business behind the account is not permitted to advertise.
  // Distinct from a disabled account — the account is fine, the business is not.
  if (error.subcode === 2446325) return "business_blocked";
  return null;
}

function describe(error: unknown): string {
  if (error instanceof MetaLaunchError) {
    return error.userMessage
      ? `${error.message} — ${error.userMessage}`
      : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Fetches an image so it can be handed to Meta.
 *
 * Meta will not pull from an arbitrary URL; the bytes have to be uploaded to
 * the ad account first, which is what returns the hash a creative refers to.
 */
async function fetchImageBytes(
  url: string,
): Promise<{ filename: string; bytes: Uint8Array }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch the image (HTTP ${response.status}).`);
  }
  const buffer = new Uint8Array(await response.arrayBuffer());
  const name = new URL(url).pathname.split("/").pop() || "creative.png";
  return { filename: name, bytes: buffer };
}

export async function launchBatchAction(
  draft: BatchDraft & {
    adStatus: LaunchStatus;
    dryRun: boolean;
    /**
     * Launch into an ad set that already exists.
     *
     * When set, no campaign or ad set is created: the targeting, budget,
     * schedule and pixel are whatever that ad set already carries. This is how
     * these accounts are actually used — creatives are added to an ad set
     * someone has already tuned.
     */
    existingAdSetId?: string | null;
    /**
     * Build a new ad set inside a campaign that already exists.
     *
     * The middle case, and the common one: the campaign holds the budget and
     * the objective, and a new ad set brings its own targeting, schedule and
     * pixel. Creating a fresh campaign for every test would scatter the budget
     * across campaigns that were meant to share it.
     */
    existingCampaignId?: string | null;
    /**
     * Whether that campaign carries the budget.
     *
     * Exactly one level may hold it. A CBO campaign rejects an ad set with its
     * own budget, and a campaign without one rejects an ad set that has none —
     * so this cannot be guessed, and getting it wrong fails at creation with an
     * error that does not name the cause.
     */
    existingCampaignHasBudget?: boolean;
    includeThreads?: boolean;
  },
): Promise<LaunchResult> {
  const { userId, denied } = await requireUserId();
  if (denied) {
    return {
      ...empty,
      status: "failed",
      message: denied.message ?? "Not signed in.",
    };
  }

  const usingExisting = Boolean(draft.existingAdSetId);
  const usingExistingCampaign =
    !usingExisting && Boolean(draft.existingCampaignId);
  // Campaign and ad set fields describe something that will not be created
  // when an existing ad set is chosen, so validating them would reject a
  // perfectly good batch for fields nobody filled in.
  const problems = usingExisting
    ? validateDraft({
        ...draft,
        campaignName: draft.campaignName || "existing",
        dailyBudget: draft.dailyBudget || "1",
        countries: draft.countries || "GB",
        pixelId: draft.pixelId ?? "inherited",
      })
    : usingExistingCampaign
      ? // The campaign already exists, so its name and budget are not being
        // set here — but the ad set's targeting and pixel are, and those are
        // validated as normal.
        validateDraft({
          ...draft,
          campaignName: draft.campaignName || "existing",
          dailyBudget: draft.dailyBudget || "1",
        })
      : validateDraft(draft);
  if (problems.length > 0) {
    return {
      ...empty,
      status: "invalid",
      message: `${problems.length} thing${problems.length === 1 ? "" : "s"} to fix before launching.`,
      problems,
    };
  }

  const connection = await getConnection();
  if (!connection) {
    return {
      ...empty,
      status: "failed",
      message: "No Meta account is connected.",
    };
  }

  const token = connection.access_token;
  const account = draft.adAccountId;
  const { dryRun } = draft;

  let campaignId: string | null = null;
  let adSetId: string | null = null;

  // Launching into an existing ad set skips creation entirely: its targeting,
  // budget, schedule and pixel are already set and are not ours to redefine.
  if (usingExisting) {
    adSetId = draft.existingAdSetId ?? null;
  }

  if (!usingExisting) {
    try {
      if (usingExistingCampaign) {
        campaignId = draft.existingCampaignId ?? null;
      } else {
        const campaign = await createCampaign(
          account,
          token,
          {
            name: draft.campaignName,
            objective: draft.objective,
            dailyBudgetMinor: toMinorUnits(draft.dailyBudget),
          },
          dryRun,
        );
        campaignId = campaign.id ?? null;
      }

      // A validate-only campaign returns no id, and an ad set cannot be checked
      // without a real parent. Rather than validate against an empty id — which
      // fails for a reason that has nothing to do with the draft — the dry run
      // stops here and says what it did and did not cover.
      if (dryRun && !campaignId) {
        return {
          ...empty,
          status: "success",
          campaignId: null,
          message:
            "Campaign settings are valid. The ad set and ads cannot be checked without a real campaign to attach them to, so this dry run stops here.",
        };
      }

      const adSet = await createAdSet(
        account,
        token,
        {
          name: `${draft.campaignName} — ad set`,
          campaignId: campaignId ?? "",
          // Exactly one level holds the budget. A new campaign always takes it
          // here, so its ad set must not; an existing campaign might not have
          // one, in which case the ad set has to — Meta rejects both the
          // duplicate and the absence, with errors that do not name the cause.
          dailyBudgetMinor:
            usingExistingCampaign && !draft.existingCampaignHasBudget
              ? toMinorUnits(draft.dailyBudget)
              : null,
          countries: parseCountries(draft.countries),
          ageMin: draft.ageMin,
          ageMax: draft.ageMax,
          startTime: draft.startTime,
          endTime: null,
          pixelId: draft.pixelId,
          customEventType: draft.customEventType,
          optimizationGoal: optimizationGoalFor(draft.objective),
          billingEvent: BILLING_EVENT,
          includeThreads: draft.includeThreads ?? false,
        },
        dryRun,
      );
      adSetId = adSet.id ?? null;
    } catch (error) {
      return {
        ...empty,
        status: "failed",
        campaignId,
        message: describe(error),
        blocker: blockerFor(error),
      };
    }
  }

  const results: AdResult[] = [];

  for (const [index, ad] of draft.ads.entries()) {
    try {
      const image = await fetchImageBytes(ad.imageUrl);
      const imageHash = await uploadAdImage(account, token, image);

      const creative = await createAdCreative(
        account,
        token,
        {
          name: `${draft.campaignName} — ${ad.headline}`.slice(0, 100),
          pageId: draft.pageId,
          imageHash,
          primaryText: ad.primaryText,
          headline: ad.headline,
          description: ad.description || null,
          linkUrl: ad.linkUrl,
          callToAction: ad.callToAction,
          instagramActorId: null,
        },
        dryRun,
      );

      const created = await createAd(
        account,
        token,
        {
          name: `${draft.campaignName} — ${ad.headline}`.slice(0, 100),
          adsetId: adSetId ?? "",
          creativeId: creative.id ?? "",
          status: draft.adStatus,
        },
        dryRun,
      );

      results.push({
        position: index,
        headline: ad.headline,
        status: "done",
        adMetaId: created.id ?? null,
        error: null,
        subcode: null,
      });
    } catch (error) {
      results.push({
        position: index,
        headline: ad.headline,
        status: "failed",
        adMetaId: null,
        error: describe(error),
        subcode: error instanceof MetaLaunchError ? error.subcode : null,
      });
    }
  }

  const succeeded = results.filter((r) => r.status === "done").length;
  const failed = results.length - succeeded;
  // One blocker behind every failure is worth stating once rather than
  // repeating on each row.
  const sharedBlocker =
    failed > 0 && succeeded === 0
      ? blockerFor(
          new MetaLaunchError(
            results[0]?.error ?? "",
            null,
            results[0]?.subcode ?? null,
            null,
          ),
        )
      : null;

  const verb = dryRun ? "would be created" : "created";
  const status =
    failed === 0 ? "success" : succeeded === 0 ? "failed" : "partial";

  try {
    await recordBatch(
      userId,
      {
        adAccountId: account,
        pageId: draft.pageId,
        campaignName: draft.campaignName,
        objective: draft.objective,
        dailyBudgetMinor: toMinorUnits(draft.dailyBudget),
        countries: parseCountries(draft.countries),
        ageMin: draft.ageMin,
        ageMax: draft.ageMax,
        startTime: draft.startTime,
        pixelId: draft.pixelId,
        customEventType: draft.customEventType,
        adStatus: draft.adStatus,
        dryRun,
        campaignMetaId: campaignId,
        adSetMetaId: adSetId,
        status: status === "success" ? "completed" : status,
        error: null,
      },
      results.map((result) => {
        const ad = draft.ads[result.position];
        return {
          ...result,
          primaryText: ad.primaryText,
          linkUrl: ad.linkUrl,
          imageUrl: ad.imageUrl,
          callToAction: ad.callToAction,
          description: ad.description || null,
          conceptId: null,
        };
      }),
    );
  } catch (error) {
    // The ads exist in Meta whether or not the record was written, so a failed
    // write must not turn a successful launch into a reported failure. It is
    // logged and the real outcome is returned.
    console.error("Could not record the launch batch", error);
  }

  return {
    problems: [],
    campaignId,
    adSetId,
    ads: results,
    blocker: sharedBlocker,
    status,
    message:
      failed === 0
        ? `${succeeded} ad${succeeded === 1 ? "" : "s"} ${verb}${dryRun ? " — nothing was actually created" : ` as ${draft.adStatus}`}.`
        : `${succeeded} ${verb}, ${failed} failed.`,
  };
}

/**
 * The pixels on one ad account.
 *
 * A Server Action rather than data passed down once, because pixels belong to
 * an account and the account is chosen in the form. Loading them for the
 * default account and leaving the list alone meant picking a different account
 * kept showing the first one's pixels — and binding an ad set to a pixel from
 * another account is the kind of mistake that reports conversions against the
 * wrong store.
 *
 * The token never leaves the server, which is the other reason this cannot be
 * a fetch from the client.
 */
export async function listAccountPixelsAction(
  adAccountId: string,
): Promise<{ pixels: { id: string; label: string }[]; error: string | null }> {
  const { denied } = await requireUserId();
  if (denied) return { pixels: [], error: denied.message ?? "Not signed in." };

  const connection = await getConnection();
  if (!connection) {
    return { pixels: [], error: "No Meta account is connected." };
  }

  try {
    const found = await listPixels(adAccountId, connection.access_token);
    return {
      pixels: found.map((pixel) => ({ id: pixel.id, label: pixel.name })),
      error: null,
    };
  } catch (error) {
    return { pixels: [], error: describe(error) };
  }
}

/**
 * Campaigns on an account, for launching into one that already runs.
 *
 * The builder only created new campaigns, which does not match how these
 * accounts are actually used: their ad sets are named things like "Adset (2)
 * … 30 Creatives", meaning creatives are pushed into an ad set that already
 * has targeting, a budget, a pixel and a schedule. Rebuilding all of that for
 * every batch would be both laborious and a good way to get one setting wrong.
 */
export async function listAccountCampaignsAction(adAccountId: string): Promise<{
  campaigns: { id: string; label: string; hasBudget: boolean }[];
  error: string | null;
}> {
  const { denied } = await requireUserId();
  if (denied)
    return { campaigns: [], error: denied.message ?? "Not signed in." };

  const connection = await getConnection();
  if (!connection)
    return { campaigns: [], error: "No Meta account is connected." };

  try {
    const found = await listCampaigns(adAccountId, connection.access_token);
    return {
      campaigns: found.map((campaign) => ({
        id: campaign.id,
        label: `${campaign.name}${campaign.status === "PAUSED" ? " (paused)" : ""}`,
        // A campaign-level budget means CBO, and an ad set under it must not
        // carry its own — worth knowing before the ad set is built.
        hasBudget: Boolean(campaign.dailyBudget || campaign.lifetimeBudget),
      })),
      error: null,
    };
  } catch (error) {
    return { campaigns: [], error: describe(error) };
  }
}

/** Ad sets under a campaign, with what each already decides for its ads. */
export async function listCampaignAdSetsAction(campaignId: string): Promise<{
  adSets: { id: string; label: string }[];
  error: string | null;
}> {
  const { denied } = await requireUserId();
  if (denied) return { adSets: [], error: denied.message ?? "Not signed in." };

  const connection = await getConnection();
  if (!connection)
    return { adSets: [], error: "No Meta account is connected." };

  try {
    const found = await listAdSets(campaignId, connection.access_token);
    return {
      adSets: found.map((adSet) => ({
        id: adSet.id,
        label: `${adSet.name}${adSet.status === "PAUSED" ? " (paused)" : ""}`,
      })),
      error: null,
    };
  } catch (error) {
    return { adSets: [], error: describe(error) };
  }
}

/** What an existing ad set already governs, so the choice can be verified. */
export async function describeAdSetAction(adSetId: string): Promise<{
  details: {
    startTime: string | null;
    pixelId: string | null;
    customEventType: string | null;
    optimizationGoal: string | null;
    dailyBudget: string | null;
    countries: string[];
    ageMin: number | null;
    ageMax: number | null;
  } | null;
  error: string | null;
}> {
  const { denied } = await requireUserId();
  if (denied)
    return { details: null, error: denied.message ?? "Not signed in." };

  const connection = await getConnection();
  if (!connection)
    return { details: null, error: "No Meta account is connected." };

  try {
    const details = await getAdSetDetails(adSetId, connection.access_token);
    return {
      details: {
        startTime: details.startTime,
        pixelId: details.pixelId,
        customEventType: details.customEventType,
        optimizationGoal: details.optimizationGoal,
        dailyBudget: details.dailyBudget,
        countries: details.countries,
        ageMin: details.ageMin,
        ageMax: details.ageMax,
      },
      error: null,
    };
  } catch (error) {
    return { details: null, error: describe(error) };
  }
}

/**
 * Approved creatives ready to be launched.
 *
 * The bridge between generating and launching. Without it the two halves of
 * this app are joined by copy-paste: the headline and body already exist, the
 * image is already in Storage, and retyping them is both work and a way to
 * launch wording that no longer matches what QA approved.
 *
 * Only concepts with an image are offered, since an ad without one cannot be
 * created — and the signed URL is what Meta will be told to fetch.
 */
export async function listLaunchableConceptsAction(): Promise<{
  concepts: {
    id: string;
    headline: string;
    bodyCopy: string;
    conceptCode: string | null;
    imageUrl: string;
    qaPassed: boolean;
  }[];
  error: string | null;
}> {
  const { denied } = await requireUserId();
  if (denied)
    return { concepts: [], error: denied.message ?? "Not signed in." };

  try {
    const concepts = await listConcepts();
    const withImages = concepts.filter(
      (concept) => concept.creative_image_path,
    );

    const signed = await getSignedImageUrls(
      withImages
        .map((concept) => concept.creative_image_path)
        .filter((path): path is string => path !== null),
    );

    return {
      concepts: withImages
        .map((concept) => {
          const imageUrl = signed.get(concept.creative_image_path ?? "");
          if (!imageUrl) return null;
          return {
            id: concept.id,
            headline: concept.headline,
            bodyCopy: concept.body_copy,
            conceptCode: concept.concept_code,
            imageUrl,
            // Shown rather than filtered on: a creative that failed QA is
            // still the user's to launch, but they should know which it is.
            qaPassed: concept.generation_status === "approved",
          };
        })
        .filter(
          (concept): concept is NonNullable<typeof concept> => concept !== null,
        ),
      error: null,
    };
  } catch (error) {
    return { concepts: [], error: describe(error) };
  }
}
