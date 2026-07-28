import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A single number with enough context to act on it. The sub-line is not
 * decoration — a count with no denominator or state ("12 concepts") tells you
 * nothing about whether anything needs doing.
 */
export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  href?: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col gap-1 rounded-xl border border-border bg-card p-4 transition-colors",
        href && "hover:border-primary/40",
      )}
    >
      <div className="flex items-center gap-2">
        {Icon && (
          <Icon
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        )}
        <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
          {label}
        </span>
      </div>
      <span
        className={cn(
          "text-2xl font-semibold tracking-tight tabular-nums",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
