import { createClient } from "@/lib/supabase/server";

export type MetaAdAccountConnection = {
  ad_account_id: string;
  access_token: string;
  token_expires_at: string;
};

export async function getConnection(): Promise<MetaAdAccountConnection | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meta_ad_account_connections")
    .select("ad_account_id, access_token, token_expires_at")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveConnection(
  userId: string,
  adAccountId: string,
  accessToken: string,
  expiresAt: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("meta_ad_account_connections").upsert(
    {
      user_id: userId,
      ad_account_id: adAccountId,
      access_token: accessToken,
      token_expires_at: expiresAt,
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
}
