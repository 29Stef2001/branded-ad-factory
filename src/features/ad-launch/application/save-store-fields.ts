"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  fetchStoreProducts,
  fetchStoreSnapshot,
} from "@/features/ad-launch/infrastructure/store-client";
import { requireUserId } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/ad-concepts/application/types";

/**
 * Saves the handful of store fields shown on the launch page.
 *
 * A patch rather than a full save. The Brand Profile form writes every column
 * at once, which is right there — it shows every column. Reusing it here would
 * blank the thirty fields this page does not show: the founder, the language
 * rules, the QA expectations. Those are what keep generated work on brand, and
 * losing them to a convenience edit would be a silent, expensive mistake.
 *
 * Writes to `brand_profiles`, the same row Brand Profile edits. Editing in two
 * places is fine; storing in two places is not.
 */
export async function saveStoreFieldsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  const brandName = String(formData.get("brandName") ?? "").trim();
  if (!brandName) {
    return { status: "error", message: "The store needs a name." };
  }

  const text = (key: string) => {
    const value = String(formData.get(key) ?? "").trim();
    return value.length > 0 ? value : null;
  };

  const tone = String(formData.get("toneAttributes") ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("brand_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) {
    return { status: "error", message: readError.message };
  }

  if (!existing) {
    // Creating a profile needs the columns the table requires, and this form
    // does not collect them. Sending the user to the full form is honest;
    // inventing values to satisfy a constraint would not be.
    return {
      status: "error",
      message:
        "No brand profile yet. Create one under Brand Profile first — it asks for a few fields this page does not.",
    };
  }

  const { error } = await supabase
    .from("brand_profiles")
    .update({
      brand_name: brandName,
      product_positioning: text("sells"),
      brand_story: text("story"),
      brand_mission: text("offer"),
      target_audience: text("audience") ?? "",
      ...(tone.length > 0 ? { tone_attributes: tone } : {}),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) return { status: "error", message: error.message };

  revalidatePath("/dashboard/ad-factory/launch/builder");
  revalidatePath("/dashboard/brand-profile");
  return { status: "success", message: "Store profile saved." };
}

/**
 * Reads a store from its own website.
 *
 * Returns the fields rather than saving them: the user should see what was
 * found and correct it before it becomes the thing every creative is written
 * against. A silent overwrite of a brand profile is not a convenience.
 */
export async function fetchStoreAction(storeUrl: string): Promise<{
  storeName: string | null;
  sells: string | null;
  productCount: number;
  error: string | null;
}> {
  const { denied } = await requireUserId();
  if (denied) {
    return {
      storeName: null,
      sells: null,
      productCount: 0,
      error: denied.message ?? "Not signed in.",
    };
  }

  try {
    const snapshot = await fetchStoreSnapshot(storeUrl);
    return {
      storeName: snapshot.storeName,
      sells: snapshot.sells,
      productCount: snapshot.products.length,
      error: null,
    };
  } catch (error) {
    return {
      storeName: null,
      sells: null,
      productCount: 0,
      error:
        error instanceof Error ? error.message : "Could not read that store.",
    };
  }
}

/**
 * Imports the store's real products as brand assets.
 *
 * The whole point is that creatives show items the shop actually sells. An
 * existing product with the same image is skipped rather than duplicated, so
 * running this twice does not fill the library with copies.
 */
export async function importStoreProductsAction(
  storeUrl: string,
): Promise<{ imported: number; skipped: number; error: string | null }> {
  const { userId, denied } = await requireUserId();
  if (denied) {
    return {
      imported: 0,
      skipped: 0,
      error: denied.message ?? "Not signed in.",
    };
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("brand_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) {
    return {
      imported: 0,
      skipped: 0,
      error: "Create a brand profile first — products hang off it.",
    };
  }

  let products;
  try {
    products = await fetchStoreProducts(storeUrl, 60);
  } catch (error) {
    return {
      imported: 0,
      skipped: 0,
      error:
        error instanceof Error ? error.message : "Could not read products.",
    };
  }

  const withImages = products.filter((product) => product.imageUrl);
  if (withImages.length === 0) {
    return { imported: 0, skipped: 0, error: "No products with images found." };
  }

  const { data: existing } = await supabase
    .from("brand_assets")
    .select("image_url")
    .eq("brand_profile_id", profile.id);

  const known = new Set(
    (existing ?? [])
      .map((asset) => asset.image_url)
      .filter((url): url is string => Boolean(url)),
  );

  const toInsert = withImages
    .filter((product) => !known.has(product.imageUrl!))
    .map((product, index) => ({
      brand_profile_id: profile.id,
      asset_type: "product",
      label: product.title.slice(0, 120),
      image_url: product.imageUrl!,
      is_active: true,
      is_primary: false,
      sort_order: index,
    }));

  if (toInsert.length === 0) {
    return { imported: 0, skipped: withImages.length, error: null };
  }

  const { error } = await supabase.from("brand_assets").insert(toInsert);
  if (error) return { imported: 0, skipped: 0, error: error.message };

  revalidatePath("/dashboard/ad-factory/launch/builder");
  revalidatePath("/dashboard/creative-studio/brand-assets");

  return {
    imported: toInsert.length,
    skipped: withImages.length - toInsert.length,
    error: null,
  };
}
