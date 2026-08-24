import type { Metadata } from "next";
import { Microscope } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { sectionFor } from "@/components/shell/nav-config";
import { DarkPanel } from "@/components/layout/dark-panel";
import { EmptyState } from "@/components/layout/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { AnalyseDnaButton } from "@/features/creative-intelligence/ui/analyse-dna-button";
import {
  listCreativeFeatures,
  listCreativesForDna,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import { getCurrentUser } from "@/features/auth/infrastructure/auth-repository";
import { dnaLabel } from "@/features/creative-intelligence/domain/creative-dna";
import { DnaAccountPicker } from "@/features/creative-intelligence/ui/dna-account-picker";
import { listSelectedAdAccounts } from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import { canRunAds } from "@/features/creative-intelligence/domain/account-status";

export const metadata: Metadata = {
  title: "Creative DNA — Branded Ad Factory",
};

// Ten vision calls in a row is not a fast request.
export const maxDuration = 300;

export default async function CreativeDnaPage({
  searchParams,
}: {
  searchParams: Promise<{ accounts?: string }>;
}) {
  const { accounts: accountsParam } = await searchParams;
  const user = await getCurrentUser();

  const accounts = (await listSelectedAdAccounts()).filter((row) =>
    canRunAds(row.account_status),
  );
  // Nothing is read until a choice is made: patterns belong to a brand, and
  // pooling unrelated accounts counts unrelated hooks as one finding.
  const selected = (accountsParam ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  // Every eligible creative, so each account can show how much there is to
  // read before it is picked.
  const allEligible = user
    ? await listCreativesForDna(
        user.id,
        ["confident", "directional"],
        500,
        accounts.map((row) => row.ad_account_id),
      )
    : [];

  const [features, eligible] = await Promise.all([
    listCreativeFeatures(selected),
    user && selected.length > 0
      ? listCreativesForDna(
          user.id,
          ["confident", "directional"],
          200,
          selected,
        )
      : Promise.resolve([]),
  ]);

  const analysed = new Set(features.map((f) => f.meta_entity_id));
  const remaining = eligible.filter(
    (c) => !analysed.has(c.metaEntityId),
  ).length;

  // What the vocabulary is actually made of. This is the point of the whole
  // exercise: not what one ad is, but which patterns recur.
  const counts = (key: keyof (typeof features)[number]) => {
    const tally = new Map<string, number>();
    for (const row of features) {
      const value = row[key];
      if (typeof value !== "string" || !value) continue;
      tally.set(value, (tally.get(value) ?? 0) + 1);
    }
    return [...tally.entries()].sort((a, b) => b[1] - a[1]);
  };

  const hooks = counts("hook_type");
  const angles = counts("angle");
  const patterns = counts("visual_pattern");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={sectionFor("intelligence/dna")}
        title="Creative DNA"
        subtitle={
          features.length > 0 ? `${features.length} analysed` : undefined
        }
        description="What your best creatives are actually doing — hook, angle, awareness level, composition — recorded in one vocabulary so patterns can be compared across hundreds of ads rather than admired one at a time."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <DnaAccountPicker
              accounts={accounts.map((row) => ({
                id: row.ad_account_id,
                label: row.name ?? row.ad_account_id,
                eligible: allEligible.filter(
                  (creative) => creative.adAccountId === row.ad_account_id,
                ).length,
              }))}
              selected={selected}
            />
            <AnalyseDnaButton eligible={remaining} adAccountIds={selected} />
          </div>
        }
      />

      {selected.length === 0 ? (
        <EmptyState
          icon={Microscope}
          title="Pick one or more ad accounts"
          description="Patterns belong to a brand. Reading every account together would count a jewellery hook and a headwear hook as the same finding — but several accounts for one brand belong together, so pick as many as share a brand."
        />
      ) : features.length === 0 ? (
        <EmptyState
          icon={Microscope}
          title="No creative analysed yet"
          description={
            remaining > 0
              ? `${remaining} creatives on the selected account${selected.length === 1 ? "" : "s"} have enough delivery to be worth reading. Each one is a vision call, so this runs ten at a time.`
              : "No creative on the selected accounts has enough delivery yet. Analysis needs at least directional evidence — a creative with a handful of impressions would only describe noise."
          }
          action={
            <AnalyseDnaButton eligible={remaining} adAccountIds={selected} />
          }
        />
      ) : (
        <>
          {/* Patterns first: one ad's DNA is a curiosity, the tally is the
              thing that eventually answers a question. */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Tally title="Hooks" entries={hooks} />
            <Tally title="Angles" entries={angles} />
            <Tally title="Visual patterns" entries={patterns} />
          </div>

          {features.length < 10 && (
            <p className="text-xs text-muted-foreground">
              {features.length} creatives is too few to read a pattern from —
              these tallies describe what has been analysed, not what works.
              They start meaning something in the dozens.
            </p>
          )}

          <DarkPanel
            title="Analysed creatives"
            description="Newest first."
            contentClassName="flex flex-col gap-2"
          >
            {features.map((feature) => (
              <div
                key={feature.id}
                className="flex flex-col gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {feature.ad_name ?? "Unnamed ad"}
                  </span>
                  {feature.hook_type && (
                    <StatusBadge
                      label={dnaLabel(feature.hook_type)}
                      tone="accent"
                    />
                  )}
                  {feature.angle && (
                    <StatusBadge
                      label={dnaLabel(feature.angle)}
                      tone="neutral"
                    />
                  )}
                  {feature.awareness_level && (
                    <StatusBadge
                      label={dnaLabel(feature.awareness_level)}
                      tone="muted"
                    />
                  )}
                </div>

                {feature.hook_text && (
                  <p className="text-sm text-muted-foreground italic">
                    “{feature.hook_text}”
                  </p>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Composition: {dnaLabel(feature.composition)}</span>
                  <span>Pattern: {dnaLabel(feature.visual_pattern)}</span>
                  <span>Offer: {dnaLabel(feature.offer_type)}</span>
                  <span>Proof: {dnaLabel(feature.proof_type)}</span>
                  <span>Driver: {dnaLabel(feature.emotional_driver)}</span>
                </div>

                {feature.why_it_works && feature.why_it_works.length > 0 && (
                  <ul className="flex flex-col gap-0.5 text-sm">
                    {feature.why_it_works.map((reason) => (
                      <li key={reason} className="text-muted-foreground">
                        — {reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </DarkPanel>
        </>
      )}
    </div>
  );
}

function Tally({
  title,
  entries,
}: {
  title: string;
  entries: [string, number][];
}) {
  return (
    <DarkPanel title={title} contentClassName="flex flex-col gap-1.5">
      {entries.length === 0 ? (
        <span className="text-sm text-muted-foreground">Nothing yet</span>
      ) : (
        entries.map(([value, count]) => (
          <div
            key={value}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span>{dnaLabel(value)}</span>
            <span className="text-muted-foreground tabular-nums">{count}</span>
          </div>
        ))
      )}
    </DarkPanel>
  );
}
