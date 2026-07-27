import { createClient } from "@/lib/supabase/server";

export async function countAdAnalyses(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("ad_analyses")
    .select("*", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

export async function countAdConcepts(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("ad_concepts")
    .select("*", { count: "exact", head: true })
    .is("refined_from_concept_id", null);

  if (error) throw error;
  return count ?? 0;
}

export async function countRefinedConcepts(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("ad_concepts")
    .select("*", { count: "exact", head: true })
    .not("refined_from_concept_id", "is", null);

  if (error) throw error;
  return count ?? 0;
}
