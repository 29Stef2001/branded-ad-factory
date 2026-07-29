import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { sectionFor } from "@/components/shell/nav-config";
import { DarkPanel } from "@/components/layout/dark-panel";
import { EmptyState } from "@/components/layout/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { PrimaryTabs } from "@/components/layout/tabs";
import { buttonVariants } from "@/components/ui/button";
import {
  getSignedImageUrls,
  listQaReviews,
} from "@/features/ad-concepts/infrastructure/ad-concepts-repository";

export const metadata: Metadata = {
  title: "Image QA — Branded Ad Factory",
};

const FILTERS = ["all", "failed", "passed"] as const;
type Filter = (typeof FILTERS)[number];

function isFilter(value: string | undefined): value is Filter {
  return FILTERS.includes(value as Filter);
}

export default async function ImageQaPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: raw } = await searchParams;
  const filter: Filter = isFilter(raw) ? raw : "all";

  const reviews = await listQaReviews(filter);

  // Signed in one batch rather than per row.
  const paths = reviews
    .map((review) => review.imagePath)
    .filter((path): path is string => path !== null);
  const urls = await getSignedImageUrls([...new Set(paths)]);

  const base = "/dashboard/creative-studio/image-qa";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={sectionFor("creative-studio/image-qa")}
        title="Image QA"
        subtitle={`${reviews.length} reviewed`}
        description="Every generated image is reviewed automatically. This is everything that has been judged, newest first — the failures are where the work is."
      />

      <PrimaryTabs
        label="QA filter"
        items={[
          { label: "All", href: base },
          { label: "Needs review", href: `${base}?filter=failed` },
          { label: "Passed", href: `${base}?filter=passed` },
        ]}
      />

      {reviews.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title={
            filter === "failed"
              ? "Nothing has failed QA"
              : "No images reviewed yet"
          }
          description={
            filter === "failed"
              ? "Every reviewed image passed. Failures appear here with the issues found and a suggested prompt fix."
              : "QA runs automatically after each image is generated. Generate one and its verdict shows up here."
          }
          action={
            <Link
              href="/dashboard/concepts"
              className={buttonVariants({ size: "sm" })}
            >
              Go to concepts
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => {
            const imageUrl = review.imagePath
              ? (urls.get(review.imagePath) ?? null)
              : null;

            return (
              <DarkPanel
                key={review.id}
                title={review.conceptHeadline}
                description={`Attempt ${review.attemptNumber} · ${new Date(review.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`}
                actions={
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={
                        review.qaScore !== null
                          ? `${review.qaPassed ? "pass" : "fail"} · ${review.qaScore}/10`
                          : review.qaPassed
                            ? "pass"
                            : "fail"
                      }
                      tone={review.qaPassed ? "success" : "danger"}
                    />
                    <Link
                      href={`/dashboard/creative-studio/prompt-builder?concept=${review.conceptId}`}
                      className={buttonVariants({
                        size: "sm",
                        variant: "outline",
                      })}
                    >
                      Open
                    </Link>
                  </div>
                }
                contentClassName="flex flex-col gap-3 sm:flex-row"
              >
                {imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL
                  <img
                    src={imageUrl}
                    alt={review.conceptHeadline}
                    className="size-32 shrink-0 rounded-md object-cover ring-1 ring-foreground/10"
                  />
                )}

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {review.qaNotes && (
                    <p className="text-sm text-muted-foreground">
                      {review.qaNotes}
                    </p>
                  )}

                  {review.detectedIssues.length > 0 && (
                    <ul className="flex flex-col gap-1">
                      {review.detectedIssues.slice(0, 4).map((issue) => (
                        <li
                          key={issue}
                          className="flex gap-1.5 text-xs text-warning"
                        >
                          <span aria-hidden>•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                      {review.detectedIssues.length > 4 && (
                        <li className="text-xs text-muted-foreground">
                          + {review.detectedIssues.length - 4} more
                        </li>
                      )}
                    </ul>
                  )}

                  {review.suggestedPrompt && (
                    <details className="rounded border border-border bg-background/60 px-2 py-1.5">
                      <summary className="cursor-pointer text-xs font-medium">
                        Suggested prompt fix
                      </summary>
                      <p className="mt-1.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                        {review.suggestedPrompt}
                      </p>
                    </details>
                  )}
                </div>
              </DarkPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
