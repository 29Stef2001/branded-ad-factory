import Link from "next/link";
import { Package, Store } from "lucide-react";
import { DarkPanel } from "@/components/layout/dark-panel";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/data/status-badge";

/**
 * The store and product context a launch is built on, shown but not edited.
 *
 * These are the first two blocks of the workflow the user sketched, and every
 * field in them already exists — in Brand Profile and Brand Assets, where the
 * concept generator, the image prompts and QA all read them from. Repeating
 * the inputs here would create a second copy that drifts from the first, and
 * the whole reason those modules produce on-brand work is that there is only
 * one. So this reflects them and links to where they are edited.
 */
export function StoreSummary({
  brandName,
  sells,
  audience,
  tone,
  offer,
  completeness,
  productCount,
  hasOwnerPhoto,
  hasLogo,
}: {
  brandName: string | null;
  sells: string | null;
  audience: string | null;
  tone: string[];
  offer: string | null;
  completeness: number | null;
  productCount: number;
  hasOwnerPhoto: boolean;
  hasLogo: boolean;
}) {
  return (
    <>
      <DarkPanel
        title="0 · My store"
        description="What every creative is written for. Edited in Brand Profile so the generator, the prompts and QA all read the same thing."
        actions={
          <Link
            href="/dashboard/brand-profile"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            <Store aria-hidden className="size-3.5" />
            Edit store profile
          </Link>
        }
        contentClassName="grid gap-3 sm:grid-cols-2"
      >
        <Field label="Store name" value={brandName} />
        <Field label="Sells" value={sells} />
        <Field label="Audience" value={audience} />
        <Field label="Offer / promo" value={offer} />
        <Field
          label="Tone"
          value={tone.length > 0 ? tone.join(", ") : null}
          className="sm:col-span-2"
        />
        {completeness !== null && (
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Brand profile {completeness}% complete.
            {completeness < 100 &&
              " Missing fields make the copy vaguer, not wrong."}
          </p>
        )}
      </DarkPanel>

      <DarkPanel
        title="0b · Products"
        description="Real product photos, so creatives show what you actually sell rather than something invented."
        actions={
          <Link
            href="/dashboard/creative-studio/brand-assets"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            <Package aria-hidden className="size-3.5" />
            Manage products
          </Link>
        }
        contentClassName="flex flex-wrap items-center gap-2"
      >
        <StatusBadge
          label={`${productCount} product photo${productCount === 1 ? "" : "s"}`}
          tone={productCount > 0 ? "success" : "warning"}
        />
        <StatusBadge
          label={hasOwnerPhoto ? "Owner photo" : "No owner photo"}
          tone={hasOwnerPhoto ? "success" : "muted"}
        />
        <StatusBadge
          label={hasLogo ? "Logo" : "No logo"}
          tone={hasLogo ? "success" : "muted"}
        />
      </DarkPanel>
    </>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ""}`}>
      <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
        {label}
      </span>
      <span className={value ? "text-sm" : "text-sm text-muted-foreground"}>
        {value || "not set"}
      </span>
    </div>
  );
}
