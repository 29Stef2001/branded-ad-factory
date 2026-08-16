"use server";

import { revalidatePath } from "next/cache";
import {
  fetchAdAccounts,
  fetchPages,
} from "@/features/creative-intelligence/infrastructure/meta-graph-client";
import {
  listAdAccounts,
  selectAllActiveAdAccounts,
  setAdAccountSelected,
  setDefaultAdAccount,
  setDefaultPage,
  upsertAdAccounts,
  upsertPages,
  type Db,
} from "@/features/creative-intelligence/infrastructure/creative-intelligence-repository";
import { getConnection } from "@/features/ad-performance/infrastructure/ad-performance-repository";
import { requireUserId } from "@/features/ad-concepts/application/require-user";
import type { ActionState } from "@/features/ad-concepts/application/types";

const ACCOUNTS_PATH = "/dashboard/intelligence/accounts";

/**
 * Mirrors every ad account and Page the token can reach.
 *
 * Paginates to exhaustion rather than taking a first page: this workspace's
 * token sees 44 accounts and 25 Pages, and a truncated catalogue is worse than
 * none — it looks complete while quietly hiding the account someone is
 * looking for.
 */
export async function discoverAccountsAndPages(
  userId: string,
  connection: { access_token: string },
  db?: Db,
): Promise<{ accounts: number; pages: number; pagesError: string | null }> {
  let accountCount = 0;
  let cursor: string | undefined;

  do {
    const page = await fetchAdAccounts(connection.access_token, cursor);
    await upsertAdAccounts(userId, page.items, db);
    accountCount += page.items.length;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  // Pages are fetched separately and allowed to fail on their own: without
  // pages_show_list this throws, and losing the account catalogue to a missing
  // Page permission would be the wrong trade.
  let pageCount = 0;
  let pagesError: string | null = null;
  try {
    let pageCursor: string | undefined;
    do {
      const page = await fetchPages(connection.access_token, pageCursor);
      await upsertPages(userId, page.items, db);
      pageCount += page.items.length;
      pageCursor = page.nextCursor ?? undefined;
    } while (pageCursor);
  } catch (error) {
    pagesError =
      error instanceof Error ? error.message : "Could not list Pages.";
  }

  return { accounts: accountCount, pages: pageCount, pagesError };
}

export async function discoverAccountsAction(
  _prev: ActionState,
): Promise<ActionState> {
  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  const connection = await getConnection();
  if (!connection) {
    return { status: "error", message: "No Meta account is connected." };
  }

  try {
    const result = await discoverAccountsAndPages(userId, connection);
    revalidatePath(ACCOUNTS_PATH);

    return {
      status: "success",
      message:
        `Found ${result.accounts} ad accounts and ${result.pages} Pages.` +
        (result.pagesError
          ? ` Pages could not be read: ${result.pagesError}`
          : ""),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Discovery failed.",
    };
  }
}

/**
 * Selects every account that can run ads.
 *
 * Disabled accounts stay unselected: 14 of this workspace's 44 are disabled,
 * several by Meta policy, and they can be neither launched into nor usefully
 * synced.
 */
export async function selectAllActiveAction(
  _prev: ActionState,
): Promise<ActionState> {
  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  const selected = await selectAllActiveAdAccounts(userId);
  revalidatePath(ACCOUNTS_PATH);

  return {
    status: "success",
    message: `${selected} active account${selected === 1 ? "" : "s"} selected. Disabled accounts were left out — they cannot run ads.`,
  };
}

export async function toggleAdAccountAction(
  adAccountId: string,
  selected: boolean,
  _prev: ActionState,
): Promise<ActionState> {
  const { denied } = await requireUserId();
  if (denied) return denied;

  await setAdAccountSelected(adAccountId, selected);
  revalidatePath(ACCOUNTS_PATH);
  return { status: "success", message: selected ? "Selected." : "Deselected." };
}

export async function setDefaultAccountAction(
  adAccountId: string,
  _prev: ActionState,
): Promise<ActionState> {
  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  await setDefaultAdAccount(userId, adAccountId);
  revalidatePath(ACCOUNTS_PATH);
  return { status: "success", message: "Default account set." };
}

export async function setDefaultPageAction(
  pageId: string,
  _prev: ActionState,
): Promise<ActionState> {
  const { userId, denied } = await requireUserId();
  if (denied) return denied;

  await setDefaultPage(userId, pageId);
  revalidatePath(ACCOUNTS_PATH);
  return { status: "success", message: "Default Page set." };
}

/** Every ad account known, for the selection screen. */
export async function getAdAccounts() {
  return listAdAccounts();
}
