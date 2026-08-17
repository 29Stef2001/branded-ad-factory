"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Package, Save, Store } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DarkPanel } from "@/components/layout/dark-panel";
import { StatusBadge } from "@/components/data/status-badge";
import { saveStoreFieldsAction } from "@/features/ad-launch/application/save-store-fields";
import { initialActionState } from "@/features/ad-concepts/application/types";

/**
 * The store fields, editable here as well as in Brand Profile.
 *
 * Both write the same row. Editing in two places is a convenience; storing in
 * two places is how a brand ends up with two different stories. This form
 * touches only the six fields it shows and leaves the founder, the language
 * rules and the QA expectations alone — those are what keep generated work on
 * brand, and a partial form that saved everything would quietly erase them.
 */
export function StoreFields({
  brandName,
  sells,
  story,
  offer,
  audience,
  tone,
  completeness,
  hasProfile,
  productCount,
  hasOwnerPhoto,
  hasLogo,
}: {
  brandName: string;
  sells: string;
  story: string;
  offer: string;
  audience: string;
  tone: string;
  completeness: number | null;
  hasProfile: boolean;
  productCount: number;
  hasOwnerPhoto: boolean;
  hasLogo: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveStoreFieldsAction,
    initialActionState,
  );

  return (
    <>
      <DarkPanel
        title="0 · My store"
        description="What every creative is written for. The same fields as Brand Profile, saved to the same place — edit them wherever you happen to be."
        actions={
          <Link
            href="/dashboard/brand-profile"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            <Store aria-hidden className="size-3.5" />
            All brand fields
          </Link>
        }
        contentClassName="flex flex-col gap-3"
      >
        {!hasProfile && (
          <Alert variant="destructive">
            <AlertDescription>
              No brand profile yet. Create one under Brand Profile first — it
              asks for a few fields this page does not.
            </AlertDescription>
          </Alert>
        )}

        <form action={action} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Store name</span>
              <Input name="brandName" defaultValue={brandName} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Sells</span>
              <Input
                name="sells"
                defaultValue={sells}
                placeholder="Handcrafted copper jewellery"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Story / positioning</span>
            <Textarea name="story" rows={3} defaultValue={story} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Offer / promo</span>
              <Input
                name="offer"
                defaultValue={offer}
                placeholder="Closing sale, up to 90% off"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Audience</span>
              <Input
                name="audience"
                defaultValue={audience}
                placeholder="Women 45+ who value handmade"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Tone</span>
            <Input
              name="toneAttributes"
              defaultValue={tone}
              placeholder="personal, heartfelt, nostalgic"
            />
            <span className="text-xs text-muted-foreground">
              Comma separated.
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" disabled={pending || !hasProfile}>
              <Save aria-hidden className="size-3.5" />
              {pending ? "Saving…" : "Save store profile"}
            </Button>
            {completeness !== null && (
              <span className="text-xs text-muted-foreground">
                Brand profile {completeness}% complete
                {completeness < 100 &&
                  " — missing fields make the copy vaguer, not wrong"}
              </span>
            )}
          </div>

          {state.status === "error" && state.message && (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}
          {state.status === "success" && state.message && (
            <p className="text-sm text-success">{state.message}</p>
          )}
        </form>
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
