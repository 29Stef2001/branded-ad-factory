const GRAPH_API_VERSION = "v25.0";

export type AccountInsights = {
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
};

export async function getAccountInsights(
  adAccountId: string,
  accessToken: string,
): Promise<AccountInsights | null> {
  const params = new URLSearchParams({
    fields: "impressions,clicks,spend,ctr",
    date_preset: "last_30d",
    access_token: accessToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${adAccountId}/insights?${params.toString()}`,
  );
  const body = await response.json();

  if (!response.ok || body.error) {
    throw new Error(
      body.error?.message ?? "Failed to fetch ad account insights.",
    );
  }

  const row = body.data?.[0];
  if (!row) return null;

  return {
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    spend: Number(row.spend ?? 0),
    ctr: Number(row.ctr ?? 0),
  };
}
