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
  uploadAdImage,
  type LaunchStatus,
} from "@/features/ad-launch/infrastructure/meta-launch-client";
import { getConnection } from "@/features/ad-performance/infrastructure/ad-performance-repository";
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
  draft: BatchDraft & { adStatus: LaunchStatus; dryRun: boolean },
): Promise<LaunchResult> {
  const { userId, denied } = await requireUserId();
  if (denied) {
    return {
      ...empty,
      status: "failed",
      message: denied.message ?? "Not signed in.",
    };
  }

  const problems = validateDraft(draft);
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

  try {
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
        // The campaign holds the budget (CBO), so the ad set must not.
        dailyBudgetMinor: null,
        countries: parseCountries(draft.countries),
        ageMin: draft.ageMin,
        ageMax: draft.ageMax,
        startTime: draft.startTime,
        endTime: null,
        pixelId: draft.pixelId,
        customEventType: draft.customEventType,
        optimizationGoal: optimizationGoalFor(draft.objective),
        billingEvent: BILLING_EVENT,
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
