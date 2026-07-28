import Link from "next/link";
import { Check, ChevronRight, CircleDot, Lock } from "lucide-react";
import { DarkPanel } from "@/components/layout/dark-panel";
import { cn } from "@/lib/utils";
import type { WorkflowStep } from "@/features/ad-concepts/domain/workflow";

const ICONS = {
  done: Check,
  current: ChevronRight,
  blocked: Lock,
  todo: CircleDot,
} as const;

/**
 * The whole pipeline as one strip, with exactly one step marked current.
 *
 * The point is orientation: a first-time user should be able to tell where they
 * are and what comes next without reading anything else on the page.
 */
export function WorkflowProgress({ steps }: { steps: WorkflowStep[] }) {
  const doneCount = steps.filter((step) => step.state === "done").length;

  return (
    <DarkPanel
      title="Workflow"
      description={`${doneCount} of ${steps.length} steps complete`}
      contentClassName="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4"
    >
      {steps.map((step) => {
        const Icon = ICONS[step.state];
        return (
          <Link
            key={step.key}
            href={step.href}
            className={cn(
              "flex items-start gap-2 rounded-lg border px-3 py-2 transition-colors",
              step.state === "current"
                ? "border-primary/50 bg-primary/10"
                : "border-border bg-background/40 hover:border-primary/30",
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                "mt-0.5 size-3.5 shrink-0",
                step.state === "done" && "text-success",
                step.state === "current" && "text-primary",
                step.state === "blocked" && "text-warning",
                step.state === "todo" && "text-muted-foreground",
              )}
            />
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "truncate text-sm",
                  step.state === "current"
                    ? "font-medium text-foreground"
                    : step.state === "todo"
                      ? "text-muted-foreground"
                      : "text-foreground",
                )}
              >
                {step.label}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {step.detail}
              </span>
            </span>
          </Link>
        );
      })}
    </DarkPanel>
  );
}
