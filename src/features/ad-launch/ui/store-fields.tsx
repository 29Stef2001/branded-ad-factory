"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Download, Package, Save, Store } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DarkPanel } from "@/components/layout/dark-panel";
import { StatusBadge } from "@/components/data/status-badge";
import {
  fetchStoreAction,
  importStoreProductsAction,
  saveStoreFieldsAction,
} from "@/features/ad-launch/application/save-store-fields";
import { initialActionState } from "@/features/ad-concepts/application/types";

/**
 * Small uppercase labels, matching the rest of this page's mastheads.
 *
 * A shared component rather than the class list repeated on eight fields: one
 * of them drifting is how a form starts looking hand-assembled.
 */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground/70 uppercase">
      {children}
    </span>
  );
}

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

  const [storeUrl, setStoreUrl] = useState("");
  const [fetched, setFetched] = useState<{
    storeName: string;
    sells: string;
  } | null>(null);
  const [storeMessage, setStoreMessage] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  return (
    <>
      <DarkPanel
        title="0 · My store"
        description="New creatives are written for your store, its story and its products. Fetch the store once."
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

        <div className="flex flex-col gap-1">
          <FieldLabel>Store URL</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={storeUrl}
              onChange={(event) => setStoreUrl(event.target.value)}
              placeholder="https://your-store.com"
              className="min-w-56 flex-1"
            />
            <Button
              type="button"
              size="sm"
              disabled={busy || !storeUrl.trim()}
              onClick={() => {
                setStoreError(null);
                setStoreMessage(null);
                startBusy(async () => {
                  const result = await fetchStoreAction(storeUrl);
                  if (result.error) return setStoreError(result.error);
                  // Filled in rather than saved: the user should see what was
                  // found and correct it before every creative is written
                  // against it.
                  setFetched({
                    storeName: result.storeName ?? "",
                    sells: result.sells ?? "",
                  });
                  setStoreMessage(
                    `Read the store — ${result.productCount} products listed. Check the fields below, then save.`,
                  );
                });
              }}
            >
              <Download aria-hidden className="size-3.5" />
              {busy ? "Reading…" : "Fetch store"}
            </Button>
          </div>
          {storeMessage && (
            <span className="text-xs text-success">{storeMessage}</span>
          )}
          {storeError && (
            <span className="text-xs text-destructive">{storeError}</span>
          )}
        </div>

        <form action={action} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <FieldLabel>Store name</FieldLabel>
              <Input
                name="brandName"
                key={fetched?.storeName ?? "name"}
                defaultValue={fetched?.storeName || brandName}
              />
            </label>
            <label className="flex flex-col gap-1">
              <FieldLabel>Sells</FieldLabel>
              <Input
                name="sells"
                key={fetched?.sells ?? "sells"}
                defaultValue={fetched?.sells || sells}
                placeholder="Handcrafted copper jewellery"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <FieldLabel>Story / positioning</FieldLabel>
            <Textarea name="story" rows={4} defaultValue={story} />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <FieldLabel>Offer / promo</FieldLabel>
              <Input
                name="offer"
                defaultValue={offer}
                placeholder="Closing sale, up to 90% off"
              />
            </label>
            <label className="flex flex-col gap-1">
              <FieldLabel>Audience</FieldLabel>
              <Input
                name="audience"
                defaultValue={audience}
                placeholder="Women 45+ who value handmade"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <FieldLabel>Tone</FieldLabel>
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
        description="Fetch your real products so creatives are made for items you actually sell, not invented ones."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || !storeUrl.trim()}
              onClick={() => {
                setStoreError(null);
                setStoreMessage(null);
                startBusy(async () => {
                  const result = await importStoreProductsAction(storeUrl);
                  if (result.error) return setStoreError(result.error);
                  setStoreMessage(
                    `Imported ${result.imported} product${result.imported === 1 ? "" : "s"}` +
                      (result.skipped > 0
                        ? `, skipped ${result.skipped} already there.`
                        : "."),
                  );
                });
              }}
            >
              <Download aria-hidden className="size-3.5" />
              {busy ? "Importing…" : "Fetch products"}
            </Button>
            <Link
              href="/dashboard/creative-studio/brand-assets"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              <Package aria-hidden className="size-3.5" />
              Manage
            </Link>
          </div>
        }
        contentClassName="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-center gap-2">
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
        </div>
      </DarkPanel>
    </>
  );
}
