import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { sectionFor } from "@/components/shell/nav-config";
import { DarkPanel } from "@/components/layout/dark-panel";
import { EmptyState } from "@/components/layout/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { AccountRow } from "@/features/creative-intelligence/ui/account-selector";
import { DiscoverButtons } from "@/features/creative-intelligence/ui/discover-buttons";
import {
  listAdAccounts,
  listPages,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import { getBrandProfile } from "@/features/ad-concepts/infrastructure/ad-concepts-repository";
import { rankAccounts } from "@/features/creative-intelligence/domain/account-matching";
import { canRunAds } from "@/features/creative-intelligence/domain/account-status";

export const metadata: Metadata = {
  title: "Ad Accounts — Branded Ad Factory",
};

export const maxDuration = 120;

export default async function AdAccountsPage() {
  const [accounts, pages, brandProfile] = await Promise.all([
    listAdAccounts(),
    listPages(),
    getBrandProfile(),
  ]);

  // Ranked against the brand name so a likely match surfaces, but every
  // account is still listed — with 44 of them, hiding the rest behind a guess
  // would make an account this heuristic missed impossible to find.
  const ranked = rankAccounts(
    accounts.map((account) => ({
      adAccountId: account.ad_account_id,
      name: account.name,
    })),
    brandProfile?.brand_name,
  );
  const reasonById = new Map(
    ranked.map((entry) => [entry.adAccountId, entry.reason]),
  );

  const active = accounts.filter((account) =>
    canRunAds(account.account_status),
  );
  const inactive = accounts.filter(
    (account) => !canRunAds(account.account_status),
  );
  const selected = accounts.filter((account) => account.is_selected);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={sectionFor("intelligence/accounts")}
        title="Ad Accounts"
        subtitle={
          accounts.length > 0
            ? `${selected.length} of ${active.length} active selected`
            : undefined
        }
        description="Which Meta ad accounts this workspace syncs and launches into. Only selected accounts are fetched — syncing every account would spend API quota on brands this workspace has nothing to do with, and pooling them would make every ranking meaningless."
        actions={<DiscoverButtons />}
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No ad accounts found yet"
          description="Fetch the accounts your Meta connection can reach. Nothing is selected automatically."
          action={<DiscoverButtons />}
        />
      ) : (
        <>
          <DarkPanel
            title={`${active.length} account${active.length === 1 ? "" : "s"} that can run ads`}
            description="Selected accounts are synced nightly and can be launched into. One is the default for new launches."
            contentClassName="flex flex-col gap-1.5"
          >
            {active.map((account) => (
              <AccountRow
                key={account.id}
                adAccountId={account.ad_account_id}
                name={account.name}
                currency={account.currency}
                accountStatus={account.account_status}
                isSelected={account.is_selected}
                isDefault={account.is_default}
                matchReason={reasonById.get(account.ad_account_id) ?? null}
              />
            ))}
          </DarkPanel>

          {inactive.length > 0 && (
            <DarkPanel
              title={`${inactive.length} account${inactive.length === 1 ? "" : "s"} that cannot run ads`}
              description="Disabled, closed or awaiting settlement at Meta. Shown so they are accounted for rather than silently missing — none of this is fixable from here."
              contentClassName="flex flex-col gap-1.5"
            >
              {inactive.map((account) => (
                <AccountRow
                  key={account.id}
                  adAccountId={account.ad_account_id}
                  name={account.name}
                  currency={account.currency}
                  accountStatus={account.account_status}
                  isSelected={account.is_selected}
                  isDefault={account.is_default}
                  matchReason={null}
                />
              ))}
            </DarkPanel>
          )}

          <DarkPanel
            title={`${pages.length} Facebook Page${pages.length === 1 ? "" : "s"}`}
            description={
              pages.length === 0
                ? "None found. Every ad creative must name a Page, so launching needs at least one — this is empty both when there genuinely is none and when pages_show_list was not granted."
                : "Every ad creative must name a Page. The default is used for new launches."
            }
            contentClassName="flex flex-col gap-1.5"
          >
            {pages.map((page) => (
              <div
                key={page.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span>{page.name ?? page.page_id}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {page.page_id}
                  </span>
                </div>
                {page.is_default && (
                  <StatusBadge label="Default" tone="accent" />
                )}
              </div>
            ))}
          </DarkPanel>
        </>
      )}
    </div>
  );
}
