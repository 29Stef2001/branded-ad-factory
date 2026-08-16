import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { sectionFor } from "@/components/shell/nav-config";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LaunchBuilder } from "@/features/ad-launch/ui/launch-builder";
import { getConnection } from "@/features/ad-performance/infrastructure/ad-performance-repository";
import { listPixels } from "@/features/ad-launch/infrastructure/meta-launch-client";
import {
  listPages,
  listSelectedAdAccounts,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import { canRunAds } from "@/features/creative-intelligence/domain/account-status";

export const metadata: Metadata = {
  title: "Launch ads — Branded Ad Factory",
};

// Uploading images and creating ads one at a time takes real time on a batch.
export const maxDuration = 300;

export default async function LaunchBuilderPage() {
  const [accounts, pages, connection] = await Promise.all([
    listSelectedAdAccounts(),
    listPages(),
    getConnection(),
  ]);

  // Only accounts that can actually run ads: offering a disabled one would
  // produce a failure Meta explains and this app could have prevented.
  const usable = accounts.filter((account) =>
    canRunAds(account.account_status),
  );
  const defaultAccount =
    usable.find((account) => account.is_default) ?? usable[0] ?? null;

  let pixels: { id: string; label: string }[] = [];
  let pixelError: string | null = null;

  if (connection && defaultAccount) {
    try {
      const found = await listPixels(
        defaultAccount.ad_account_id,
        connection.access_token,
      );
      pixels = found.map((pixel) => ({ id: pixel.id, label: pixel.name }));
    } catch (error) {
      pixelError =
        error instanceof Error ? error.message : "Could not read pixels.";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={sectionFor("ad-factory/launch/builder")}
        title="Launch ads"
        description="One campaign, one ad set, as many ads as you add. Everything is created in Meta in a single pass — paused unless you say otherwise."
      />

      {usable.length === 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            No ad account is selected that can run ads. Pick one under
            Intelligence → Ad Accounts first.
          </AlertDescription>
        </Alert>
      )}

      {pages.length === 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            No Facebook Page found. Every ad creative must name a Page, so
            launching needs at least one.
          </AlertDescription>
        </Alert>
      )}

      {pixelError && (
        <Alert>
          <AlertDescription>
            Could not read the pixels on this account: {pixelError}
          </AlertDescription>
        </Alert>
      )}

      <LaunchBuilder
        accounts={usable.map((account) => ({
          id: account.ad_account_id,
          label: account.name ?? account.ad_account_id,
        }))}
        pages={pages.map((page) => ({
          id: page.page_id,
          label: page.name ?? page.page_id,
        }))}
        pixels={pixels}
        defaultAccountId={defaultAccount?.ad_account_id ?? null}
        defaultPageId={pages.find((page) => page.is_default)?.page_id ?? null}
      />
    </div>
  );
}
