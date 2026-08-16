"use client";

import { useState, useTransition } from "react";
import { Plus, Rocket, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DarkPanel } from "@/components/layout/dark-panel";
import { StatusBadge } from "@/components/data/status-badge";
import { AdFields, type AdDraft } from "@/features/ad-launch/ui/ad-fields";
import { BulkImages } from "@/features/ad-launch/ui/bulk-images";
import {
  CONVERSION_EVENTS,
  OBJECTIVE_LABELS,
  requiresPixel,
  type Objective,
} from "@/features/ad-launch/domain/campaign-settings";
import {
  describeAdSetAction,
  launchBatchAction,
  listAccountCampaignsAction,
  listAccountPixelsAction,
  listCampaignAdSetsAction,
  type LaunchResult,
} from "@/features/ad-launch/application/launch-batch";

type Option = { id: string; label: string };

/** Explains a blocker once, rather than repeating it on every failed ad. */
const BLOCKER_TEXT: Record<string, string> = {
  development_mode:
    "The Meta app is still in Development mode, so Meta refuses to create the creative — the part that makes an ad visible. Campaign and ad set creation work. Switch the app to Live at developers.facebook.com.",
  account_disabled:
    "This ad account cannot run ads. Meta has disabled it, which no setting here can change.",
  business_blocked:
    "The Business behind this ad account is not permitted to advertise. That is a Meta policy decision about the business, not about this account or these settings.",
};

function newAd(): AdDraft {
  return {
    id: crypto.randomUUID(),
    primaryText: "",
    headline: "",
    description: "",
    callToAction: "SHOP_NOW",
    linkUrl: "",
    imageUrl: "",
    conceptId: null,
  };
}

export function LaunchBuilder({
  accounts,
  pages,
  pixels,
  defaultAccountId,
  defaultPageId,
}: {
  accounts: Option[];
  pages: Option[];
  pixels: Option[];
  defaultAccountId: string | null;
  defaultPageId: string | null;
}) {
  const [adAccountId, setAdAccountId] = useState(defaultAccountId ?? "");
  // Pixels belong to an account, so the list is state rather than a prop: it
  // is reloaded whenever the account changes.
  const [availablePixels, setAvailablePixels] = useState<Option[]>(pixels);
  const [pixelError, setPixelError] = useState<string | null>(null);
  const [loadingPixels, setLoadingPixels] = useState(false);
  const [pageId, setPageId] = useState(defaultPageId ?? "");
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState<Objective>("OUTCOME_SALES");
  const [dailyBudget, setDailyBudget] = useState("20");
  const [countries, setCountries] = useState("GB");
  const [ageMin, setAgeMin] = useState(25);
  const [ageMax, setAgeMax] = useState(65);
  const [startTime, setStartTime] = useState("");
  const [pixelId, setPixelId] = useState(pixels[0]?.id ?? "");
  const [customEventType, setCustomEventType] = useState("PURCHASE");
  const [adStatus, setAdStatus] = useState<"PAUSED" | "ACTIVE">("PAUSED");
  // Off by default. Threads is a placement most of these campaigns do not
  // want, and it is included automatically unless the platforms are named.
  const [includeThreads, setIncludeThreads] = useState(false);
  const [ads, setAds] = useState<AdDraft[]>([newAd()]);

  // Existing structure. These accounts push creatives into an ad set someone
  // has already tuned, so that is the default way of working rather than an
  // alternative buried behind a toggle.
  const [mode, setMode] = useState<"existing" | "new-adset" | "new">(
    "existing",
  );
  const [campaigns, setCampaigns] = useState<
    (Option & { hasBudget: boolean })[]
  >([]);
  const [campaignId, setCampaignId] = useState("");
  const [adSets, setAdSets] = useState<Option[]>([]);
  const [existingAdSetId, setExistingAdSetId] = useState("");
  const [adSetSummary, setAdSetSummary] = useState<string | null>(null);

  const [result, setResult] = useState<LaunchResult | null>(null);
  const [pending, startTransition] = useTransition();

  /**
   * Switches account and reloads its pixels.
   *
   * Done in the change handler rather than an effect: the reload is caused by
   * the choice, and the selected pixel is cleared first so a pixel from the
   * previous account can never be submitted while the new list is in flight.
   */
  const changeAccount = (nextAccountId: string) => {
    setAdAccountId(nextAccountId);
    setPixelId("");
    setPixelError(null);
    setAvailablePixels([]);
    if (!nextAccountId) return;

    // The campaign list belongs to the account too.
    setCampaigns([]);
    setCampaignId("");
    setAdSets([]);
    setExistingAdSetId("");
    setAdSetSummary(null);

    setLoadingPixels(true);
    startTransition(async () => {
      const [found, campaignList] = await Promise.all([
        listAccountPixelsAction(nextAccountId),
        listAccountCampaignsAction(nextAccountId),
      ]);
      setAvailablePixels(found.pixels);
      setPixelError(found.error);
      // Only auto-select when there is no ambiguity.
      if (found.pixels.length === 1) setPixelId(found.pixels[0].id);
      setCampaigns(campaignList.campaigns);
      setLoadingPixels(false);
    });
  };

  const changeCampaign = (nextCampaignId: string) => {
    setCampaignId(nextCampaignId);
    setAdSets([]);
    setExistingAdSetId("");
    setAdSetSummary(null);
    if (!nextCampaignId) return;

    startTransition(async () => {
      const found = await listCampaignAdSetsAction(nextCampaignId);
      setAdSets(found.adSets);
    });
  };

  /**
   * Shows what the chosen ad set already decides.
   *
   * Picking the wrong ad set is otherwise invisible until the money has moved:
   * its pixel, schedule and targeting silently become this batch's.
   */
  const changeAdSet = (nextAdSetId: string) => {
    setExistingAdSetId(nextAdSetId);
    setAdSetSummary(null);
    if (!nextAdSetId) return;

    startTransition(async () => {
      const { details } = await describeAdSetAction(nextAdSetId);
      if (!details) return;
      setAdSetSummary(
        [
          details.startTime
            ? `starts ${new Date(details.startTime).toLocaleString("en-GB")}`
            : "starts when switched on",
          details.pixelId
            ? `pixel ${details.pixelId} · ${details.customEventType}`
            : "no pixel",
          details.countries.length
            ? details.countries.join(", ")
            : "no country set",
          details.ageMin && details.ageMax
            ? `age ${details.ageMin}–${details.ageMax}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
    });
  };

  const updateAd = (id: string, patch: Partial<AdDraft>) =>
    setAds((current) =>
      current.map((ad) => (ad.id === id ? { ...ad, ...patch } : ad)),
    );

  const run = (dryRun: boolean) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await launchBatchAction({
        adAccountId,
        pageId,
        campaignName,
        objective,
        dailyBudget,
        countries,
        ageMin,
        ageMax,
        startTime: startTime ? new Date(startTime).toISOString() : null,
        pixelId: requiresPixel(objective) ? pixelId || null : null,
        customEventType,
        existingAdSetId: mode === "existing" ? existingAdSetId : null,
        existingCampaignId: mode === "new-adset" ? campaignId : null,
        includeThreads,
        existingCampaignHasBudget:
          campaigns.find((campaign) => campaign.id === campaignId)?.hasBudget ??
          false,
        ads: ads.map((ad) => ({
          primaryText: ad.primaryText,
          headline: ad.headline,
          description: ad.description,
          callToAction: ad.callToAction,
          linkUrl: ad.linkUrl,
          imageUrl: ad.imageUrl,
        })),
        adStatus,
        dryRun,
      });
      setResult(outcome);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <DarkPanel
        title="1 · Where it goes"
        description="The account and Page every ad in this batch is created on."
        contentClassName="grid gap-3 sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Ad account</span>
          <select
            value={adAccountId}
            onChange={(event) => changeAccount(event.target.value)}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            <option value="">Pick an account…</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Facebook Page</span>
          <select
            value={pageId}
            onChange={(event) => setPageId(event.target.value)}
            className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
          >
            <option value="">Pick a Page…</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.label}
              </option>
            ))}
          </select>
        </label>
      </DarkPanel>

      <DarkPanel
        title="2 · Campaign and ad set"
        description={
          mode === "existing"
            ? "Add these ads to an ad set that already runs. Its targeting, budget, schedule and pixel stay exactly as they are."
            : mode === "new-adset"
              ? "A new ad set inside a campaign that already exists. The campaign keeps its objective; the ad set brings its own targeting, schedule and pixel."
              : "Created together, always paused. The budget sits on the campaign, so Meta distributes it across ad sets itself."
        }
        contentClassName="flex flex-col gap-3"
      >
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "existing" ? "default" : "outline"}
            onClick={() => setMode("existing")}
          >
            Use an existing ad set
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "new-adset" ? "default" : "outline"}
            onClick={() => setMode("new-adset")}
          >
            New ad set in an existing campaign
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "new" ? "default" : "outline"}
            onClick={() => setMode("new")}
          >
            Create a new campaign
          </Button>
        </div>

        {mode === "new-adset" && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Campaign</span>
            <select
              value={campaignId}
              onChange={(event) => setCampaignId(event.target.value)}
              className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
            >
              <option value="">
                {campaigns.length === 0
                  ? "No campaigns found on this account"
                  : "Pick a campaign…"}
              </option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.label}
                </option>
              ))}
            </select>
            {campaignId && (
              <span className="text-xs text-muted-foreground">
                {campaigns.find((c) => c.id === campaignId)?.hasBudget
                  ? "This campaign holds the budget, so the ad set does not take one."
                  : "This campaign has no budget of its own, so the ad set needs the daily budget below."}
              </span>
            )}
          </label>
        )}

        {mode === "existing" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Campaign</span>
              <select
                value={campaignId}
                onChange={(event) => changeCampaign(event.target.value)}
                className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
              >
                <option value="">
                  {campaigns.length === 0
                    ? "No campaigns found on this account"
                    : "Pick a campaign…"}
                </option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Ad set</span>
              <select
                value={existingAdSetId}
                onChange={(event) => changeAdSet(event.target.value)}
                disabled={!campaignId}
                className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
              >
                <option value="">
                  {!campaignId
                    ? "Pick a campaign first"
                    : adSets.length === 0
                      ? "No ad sets in this campaign"
                      : "Pick an ad set…"}
                </option>
                {adSets.map((adSet) => (
                  <option key={adSet.id} value={adSet.id}>
                    {adSet.label}
                  </option>
                ))}
              </select>
            </label>

            {adSetSummary && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {/* Stated rather than assumed: choosing this ad set is choosing
                    all of it, and a wrong choice is invisible until the money
                    has moved. */}
                This ad set: {adSetSummary}
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {/* The campaign's own fields are only asked for when one is being
                created; an existing campaign already has them. */}
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-medium">Campaign name</span>
              <Input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder="Final stock — cuffs — GB"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Objective</span>
              <select
                value={objective}
                onChange={(event) =>
                  setObjective(event.target.value as Objective)
                }
                className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
              >
                {Object.entries(OBJECTIVE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Daily budget</span>
              <Input
                value={dailyBudget}
                onChange={(event) => setDailyBudget(event.target.value)}
                placeholder="20"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Countries</span>
              <Input
                value={countries}
                onChange={(event) => setCountries(event.target.value)}
                placeholder="GB, US"
              />
            </label>

            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-medium">Age from</span>
                <Input
                  type="number"
                  value={ageMin}
                  onChange={(event) => setAgeMin(Number(event.target.value))}
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-medium">to</span>
                <Input
                  type="number"
                  value={ageMax}
                  onChange={(event) => setAgeMax(Number(event.target.value))}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Start time</span>
              <Input
                type="datetime-local"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                Leave empty to start as soon as it is switched on.
              </span>
            </label>

            {requiresPixel(objective) && (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium">Pixel</span>
                  <select
                    value={pixelId}
                    onChange={(event) => setPixelId(event.target.value)}
                    disabled={loadingPixels}
                    className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
                  >
                    <option value="">
                      {loadingPixels
                        ? "Loading pixels…"
                        : availablePixels.length === 0
                          ? "No pixels on this account"
                          : "Pick a pixel…"}
                    </option>
                    {availablePixels.map((pixel) => (
                      <option key={pixel.id} value={pixel.id}>
                        {pixel.label}
                      </option>
                    ))}
                  </select>
                  {pixelError && (
                    <span className="text-xs text-destructive">
                      {pixelError}
                    </span>
                  )}
                  {!pixelError &&
                    !loadingPixels &&
                    availablePixels.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        This account has no pixel, so it cannot run a
                        conversion-optimised campaign.
                      </span>
                    )}
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium">Optimise for</span>
                  <select
                    value={customEventType}
                    onChange={(event) => setCustomEventType(event.target.value)}
                    className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
                  >
                    {CONVERSION_EVENTS.map((event) => (
                      <option key={event} value={event}>
                        {event.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        )}
      </DarkPanel>

      <DarkPanel
        title={`3 · Ads (${ads.length})`}
        description="Each one becomes its own ad in the new ad set."
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAds((current) => [...current, newAd()])}
          >
            <Plus aria-hidden className="size-3.5" />
            Add ad
          </Button>
        }
        contentClassName="flex flex-col gap-3"
      >
        <BulkImages
          onAdd={(urls) =>
            setAds((current) => {
              const added = urls.map((imageUrl) => ({ ...newAd(), imageUrl }));
              // An untouched first row is a placeholder, not content — keeping
              // it would leave an empty ad in the middle of the batch.
              const isBlank =
                current.length === 1 &&
                !current[0].imageUrl &&
                !current[0].headline &&
                !current[0].primaryText;
              return isBlank ? added : [...current, ...added];
            })
          }
        />

        {ads.map((ad, index) => (
          <AdFields
            key={ad.id}
            ad={ad}
            index={index}
            onChange={updateAd}
            onRemove={(id) =>
              setAds((current) => current.filter((item) => item.id !== id))
            }
            canRemove={ads.length > 1}
          />
        ))}
      </DarkPanel>

      <DarkPanel
        title="4 · Launch"
        description="A dry run asks Meta to validate everything and create nothing. Worth doing first — it is the only way to find out whether Meta accepts these settings without finding out the expensive way."
        contentClassName="flex flex-col gap-3"
      >
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={includeThreads}
            onChange={(event) => setIncludeThreads(event.target.checked)}
            disabled={mode === "existing"}
          />
          <span>
            Show these ads on Threads
            <span className="ml-2 text-xs text-muted-foreground">
              {mode === "existing"
                ? "The existing ad set decides its own placements — this does not apply."
                : includeThreads
                  ? "Meta places the ads wherever it likes, Threads included."
                  : "Facebook, Instagram, Audience Network and Messenger only. Naming the placements also turns off Advantage+ placements, so Meta will not add new surfaces on its own."}
            </span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={adStatus === "ACTIVE"}
            onChange={(event) =>
              setAdStatus(event.target.checked ? "ACTIVE" : "PAUSED")
            }
          />
          <span>
            Start the ads immediately
            <span className="ml-2 text-xs text-muted-foreground">
              {adStatus === "ACTIVE"
                ? "These ads will begin delivering and spending as soon as the ad set starts."
                : "Ads are created paused — you switch them on in Ads Manager."}
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(true)}
          >
            <ShieldCheck aria-hidden className="size-3.5" />
            {pending ? "Checking…" : "Dry run"}
          </Button>
          <Button type="button" disabled={pending} onClick={() => run(false)}>
            <Rocket aria-hidden className="size-3.5" />
            {pending
              ? "Launching…"
              : `Launch ${ads.length} ad${ads.length === 1 ? "" : "s"}`}
          </Button>
        </div>

        {result && <Outcome result={result} />}
      </DarkPanel>
    </div>
  );
}

function Outcome({ result }: { result: LaunchResult }) {
  const tone =
    result.status === "success"
      ? "success"
      : result.status === "partial"
        ? "warning"
        : "danger";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={result.status} tone={tone} />
        <span className="text-sm">{result.message}</span>
      </div>

      {result.blocker && (
        <Alert variant="destructive">
          <AlertDescription>{BLOCKER_TEXT[result.blocker]}</AlertDescription>
        </Alert>
      )}

      {result.problems.length > 0 && (
        <ul className="flex flex-col gap-1">
          {result.problems.map((problem, index) => (
            <li key={index} className="text-sm text-destructive">
              {problem.field.startsWith("ads.")
                ? `Ad ${Number(problem.field.split(".")[1]) + 1}: `
                : ""}
              {problem.message}
            </li>
          ))}
        </ul>
      )}

      {result.ads.length > 0 && (
        <div className="flex flex-col gap-1">
          {result.ads.map((ad) => (
            <div
              key={ad.position}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
            >
              <StatusBadge
                label={ad.status}
                tone={ad.status === "done" ? "success" : "danger"}
              />
              <span className="flex-1">
                {ad.headline || `Ad ${ad.position + 1}`}
              </span>
              {ad.error && (
                <span className="text-xs text-destructive">{ad.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
