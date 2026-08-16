"use client";

import { useState, useTransition } from "react";
import { Plus, Rocket, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DarkPanel } from "@/components/layout/dark-panel";
import { StatusBadge } from "@/components/data/status-badge";
import { AdFields, type AdDraft } from "@/features/ad-launch/ui/ad-fields";
import {
  CONVERSION_EVENTS,
  OBJECTIVE_LABELS,
  requiresPixel,
  type Objective,
} from "@/features/ad-launch/domain/campaign-settings";
import {
  launchBatchAction,
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
  const [ads, setAds] = useState<AdDraft[]>([newAd()]);

  const [result, setResult] = useState<LaunchResult | null>(null);
  const [pending, startTransition] = useTransition();

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
            onChange={(event) => setAdAccountId(event.target.value)}
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
        description="Created together, always paused. The budget sits on the campaign, so Meta distributes it across ad sets itself."
        contentClassName="grid gap-3 sm:grid-cols-2"
      >
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
            onChange={(event) => setObjective(event.target.value as Objective)}
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
                className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
              >
                <option value="">Pick a pixel…</option>
                {pixels.map((pixel) => (
                  <option key={pixel.id} value={pixel.id}>
                    {pixel.label}
                  </option>
                ))}
              </select>
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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
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
