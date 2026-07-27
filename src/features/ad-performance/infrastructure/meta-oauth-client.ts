import { env } from "@/lib/env";

const GRAPH_API_VERSION = "v25.0";

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: redirectUri,
    config_id: env.META_LOGIN_CONFIG_ID,
    state,
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const body = await response.json();

  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? "Meta API request failed.");
  }

  return body as T;
}

export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    redirect_uri: redirectUri,
    code,
  });

  return fetchJson<TokenResponse>(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?${params.toString()}`,
  );
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });

  return fetchJson<TokenResponse>(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token?${params.toString()}`,
  );
}

export type AdAccount = { id: string; name: string };

export async function listAdAccounts(
  accessToken: string,
): Promise<AdAccount[]> {
  const params = new URLSearchParams({
    fields: "id,name",
    access_token: accessToken,
  });

  const body = await fetchJson<{ data: AdAccount[] }>(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/me/adaccounts?${params.toString()}`,
  );

  return body.data;
}
