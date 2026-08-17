"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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
