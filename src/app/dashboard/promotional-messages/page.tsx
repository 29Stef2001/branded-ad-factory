import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DarkPanel } from "@/components/layout/dark-panel";
import { EmptyState } from "@/components/layout/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { ApprovedMessagesManager } from "@/features/ad-concepts/ui/approved-messages-manager";
import {
  getBrandProfile,
  listApprovedMessages,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export const metadata: Metadata = {
  title: "Promotional Messages — Branded Ad Factory",
};

export default async function PromotionalMessagesPage() {
  const [profile, messages] = await Promise.all([
    getBrandProfile(),
    listApprovedMessages(),
  ]);

  if (!profile) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Workflow" title="Promotional Messages" />
        <EmptyState
          title="Set up your brand profile first"
          description="Messages belong to a brand profile, and you don't have one yet."
          action={
            <Link
              href="/dashboard/brand-profile"
              className={buttonVariants({ size: "sm" })}
            >
              Go to brand profile
            </Link>
          }
        />
      </div>
    );
  }

  const enabled = messages.filter((message) => message.is_active).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Workflow"
        title="Promotional Messages"
        subtitle={`${enabled} of ${messages.length} enabled`}
        description="The only promotional wording generation is allowed to use. Every concept must pick one of these verbatim — it can never invent its own claim."
      />

      {enabled === 0 && (
        // This is a hard block rather than a warning: concept generation throws
        // when nothing is enabled, so saying so here beats failing later.
        <DarkPanel
          title="Concept generation is blocked"
          description="Enable at least one message below. Generation refuses to run without one, because every concept has to carry approved wording."
        />
      )}

      <ApprovedMessagesManager messages={messages} />
    </div>
  );
}
