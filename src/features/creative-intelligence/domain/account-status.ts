/**
 * Meta's ad-account status codes, in plain words.
 *
 * Only status 1 can run ads. The rest are worth naming individually rather
 * than lumping into "not active", because the fix differs entirely: an
 * unsettled account needs a payment, while one disabled under
 * ADS_INTEGRITY_POLICY needs an appeal and may never come back.
 */
export const ACCOUNT_STATUS_LABELS: Record<number, string> = {
  1: "Active",
  2: "Disabled",
  3: "Unsettled",
  7: "Pending risk review",
  8: "Pending settlement",
  9: "In grace period",
  100: "Pending closure",
  101: "Closed",
};

/** Why Meta disabled an account, where it says. */
export const DISABLE_REASON_LABELS: Record<number, string> = {
  0: "",
  1: "Advertising policy",
  2: "IP review",
  3: "Payment risk",
  4: "Account shut down",
  5: "AFC review",
  6: "Business integrity review",
  7: "Permanently closed",
  8: "Unused reseller account",
  9: "Unused account",
};

export const ACTIVE_ACCOUNT_STATUS = 1;

export function canRunAds(accountStatus: number | null): boolean {
  return accountStatus === ACTIVE_ACCOUNT_STATUS;
}
