import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Images,
  Lightbulb,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DarkPanel } from "@/components/layout/dark-panel";
import { MetricCard } from "@/components/data/metric-card";
import { StatusBadge } from "@/components/data/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { BrandCompletenessPanel } from "@/features/ad-concepts/ui/brand-completeness-panel";
import { assessBrandCompleteness } from "@/features/ad-concepts/domain/brand-completeness";
import { recommendNextAction } from "@/features/ad-concepts/domain/next-action";
import {
  GENERATION_STATUS_LABELS,
  GENERATION_STATUS_TONES,
  labelFor,
} from "@/features/ad-concepts/domain/labels";
import { buildWorkflow } from "@/features/ad-concepts/domain/workflow";
import { WorkflowProgress } from "@/features/ad-concepts/ui/workflow-progress";
import { getLaunchStatus } from "@/features/ad-launch/application/get-launch-status";
import {
  getBrandProfile,
  failStaleGenerations,
  getDashboardStats,
  listRecentActivity,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export const metadata: Metadata = { title: "Dashboard — Branded Ad Factory" };

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function DashboardPage() {
  // Runs before the counts are read, so an interrupted attempt is not
  // reported as in-progress work that will never finish.
  await failStaleGenerations();

  const [profile, stats, activity, launchStatus] = await Promise.all([
    getBrandProfile(),
    getDashboardStats(),
    listRecentActivity(),
    getLaunchStatus(),
  ]);

  const completeness = assessBrandCompleteness(profile);
  const nextAction = recommendNextAction({
    hasProfile: profile !== null,
    completeness,
    hasOwnerAsset: stats.hasOwnerAsset,
    hasProductAsset: stats.hasProductAsset,
    hasLogoAsset: stats.hasLogoAsset,
    messagesEnabled: stats.messagesEnabled,
    conceptsTotal: stats.conceptsTotal,
    conceptsWithImage: stats.conceptsWithImage,
    qaFailed: stats.qaFailed,
  });

  const workflow = buildWorkflow({
    hasProfile: profile !== null,
    completenessScore: completeness.score,
    hasOwnerAsset: stats.hasOwnerAsset,
    hasProductAsset: stats.hasProductAsset,
    hasLogoAsset: stats.hasLogoAsset,
    assetsActive: stats.assetsActive,
    messagesEnabled: stats.messagesEnabled,
    conceptsTotal: stats.conceptsTotal,
    conceptsWithImage: stats.conceptsWithImage,
    qaReviewed: stats.qaPassed + stats.qaFailed,
    qaFailed: stats.qaFailed,
    metaCanLaunch: launchStatus.state === "ready",
  });

  const missingAssetTypes = [
    !stats.hasOwnerAsset && "owner",
    !stats.hasProductAsset && "product",
    !stats.hasLogoAsset && "logo",
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={profile?.brand_name ?? "No brand yet"}
        title="Dashboard"
        description="Where this brand stands, and what is worth doing next."
      />

      {/* The recommendation leads, because a dashboard full of numbers still
          leaves the reader deciding what to do with them. */}
      <DarkPanel
        title="Recommended next"
        actions={
          <StatusBadge
            label={nextAction.severity}
            tone={
              nextAction.severity === "blocking"
                ? "danger"
                : nextAction.severity === "important"
                  ? "warning"
                  : "muted"
            }
          />
        }
        contentClassName="flex flex-wrap items-end justify-between gap-4"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-base font-semibold tracking-tight">
            {nextAction.title}
          </p>
          <p className="max-w-prose text-sm text-muted-foreground">
            {nextAction.reason}
          </p>
        </div>
        <Link href={nextAction.href} className={buttonVariants({ size: "sm" })}>
          {nextAction.cta}
        </Link>
      </DarkPanel>

      <WorkflowProgress steps={workflow} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Brand profile"
          value={`${completeness.score}%`}
          sub={`${completeness.filledCount} of ${completeness.totalCount} fields`}
          icon={Sparkles}
          href="/dashboard/brand-profile"
          tone={completeness.score >= 85 ? "success" : "warning"}
        />
        <MetricCard
          label="Brand assets"
          value={stats.assetsActive}
          sub={
            missingAssetTypes.length
              ? `missing: ${missingAssetTypes.join(", ")}`
              : "owner, product and logo present"
          }
          icon={Images}
          href="/dashboard/creative-studio/brand-assets"
          tone={missingAssetTypes.length ? "warning" : "success"}
        />
        <MetricCard
          label="Concepts"
          value={stats.conceptsTotal}
          sub={`${stats.conceptsWithImage} with an image`}
          icon={Lightbulb}
          href="/dashboard/concepts"
        />
        <MetricCard
          label="Messages"
          value={stats.messagesEnabled}
          sub={`${stats.messagesTotal} total, ${stats.messagesTotal - stats.messagesEnabled} disabled`}
          icon={MessageSquare}
          href="/dashboard/promotional-messages"
          tone={stats.messagesEnabled === 0 ? "danger" : "default"}
        />
      </div>

      {/* An all-time "QA failed" count answered no question worth asking: it
          mixed today's problem with every experiment ever run, so it only ever
          went up and never told anyone to do anything. These three say what is
          outstanding now and what the last week actually looked like. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Needs review now"
          value={stats.needsReviewNow}
          sub={
            stats.needsReviewNow > 0
              ? "rejected by QA, each with a suggested fix"
              : "nothing waiting on you"
          }
          icon={BadgeCheck}
          href="/dashboard/creative-studio/image-qa?filter=failed"
          tone={stats.needsReviewNow > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Passed, last 7 days"
          value={stats.qaPassedLast7Days}
          sub={`${stats.qaPassed} all time`}
          icon={BadgeCheck}
          href="/dashboard/creative-studio/image-qa?filter=passed"
          tone={stats.qaPassedLast7Days > 0 ? "success" : "default"}
        />
        <MetricCard
          label="Failed QA, last 7 days"
          value={stats.qaFailedLast7Days}
          sub={`${stats.qaFailed} all time`}
          icon={BadgeCheck}
          href="/dashboard/creative-studio/image-qa?filter=failed"
          tone={stats.qaFailedLast7Days > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Generations, last 7 days"
          value={stats.qaPassedLast7Days + stats.qaFailedLast7Days}
          // A generation that errored produced no image at all, which is a
          // different problem from one QA rejected — worth not conflating.
          sub={
            stats.generationFailedLast7Days > 0
              ? `${stats.generationFailedLast7Days} errored before producing an image`
              : `${stats.generationsTotal} attempts all time`
          }
          icon={Images}
          // Deliberately not toned by the error count: the number shown is the
          // total, and colouring it danger made 18 successful generations read
          // as 18 failures. The errors are named in the sub-line instead, and
          // "Needs review now" is the card that asks for action.
          tone="default"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DarkPanel
          title="Recent activity"
          description={
            activity.length === 0
              ? "Nothing generated yet"
              : `Last ${activity.length} generation attempts`
          }
          contentClassName="flex flex-col gap-2"
        >
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Generation attempts appear here as soon as one runs — successful
              or not.
            </p>
          ) : (
            activity.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/creative-studio/prompt-builder?concept=${item.conceptId}`}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 transition-colors hover:border-primary/40"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {item.conceptHeadline}
                </span>
                <span className="text-xs text-muted-foreground">
                  attempt {item.attemptNumber}
                </span>
                <StatusBadge
                  label={
                    item.qaScore !== null
                      ? `${labelFor(GENERATION_STATUS_LABELS, item.status)} · ${item.qaScore}`
                      : labelFor(GENERATION_STATUS_LABELS, item.status)
                  }
                  tone={GENERATION_STATUS_TONES[item.status] ?? "neutral"}
                />
                <span className="w-16 text-right text-xs text-muted-foreground">
                  {timeAgo(item.createdAt)}
                </span>
              </Link>
            ))
          )}
        </DarkPanel>

        <BrandCompletenessPanel completeness={completeness} compact />
      </div>
    </div>
  );
}
