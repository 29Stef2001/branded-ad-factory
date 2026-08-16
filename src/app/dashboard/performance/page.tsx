import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/layout/page-header";
import { sectionFor } from "@/components/shell/nav-config";
import { ConnectMetaButton } from "@/features/ad-performance/ui/connect-meta-button";
import { ReconnectMetaButton } from "@/features/ad-performance/ui/reconnect-meta-button";
import { PermissionStatus } from "@/features/ad-performance/ui/permission-status";
import { PerformanceSummary } from "@/features/ad-performance/ui/performance-summary";
import { getConnection } from "@/features/ad-performance/infrastructure/ad-performance-repository";
import { getAccountInsights } from "@/features/ad-performance/infrastructure/meta-insights-client";
import {
  getPermissionReport,
  isRevokedTokenError,
} from "@/features/ad-launch/infrastructure/meta-capability-client";

export const metadata: Metadata = {
  title: "Meta Ad Account — Branded Ad Factory",
};

export default async function MetaAdAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const { error, connected } = await searchParams;
  const connection = await getConnection();
  const isExpired = Boolean(
    connection && new Date(connection.token_expires_at) < new Date(),
  );

  let insights = null;
  let fetchError: string | null = null;
  let granted: string[] | null = null;
  let permissionError: string | null = null;

  if (connection && !isExpired) {
    // Both calls are attempted even when the first fails: the permission
    // report is what explains *why* insights failed, so losing it to an early
    // return would leave the page saying something went wrong and nothing else.
    const [insightsResult, permissionResult] = await Promise.allSettled([
      getAccountInsights(connection.ad_account_id, connection.access_token),
      getPermissionReport(connection.access_token),
    ]);

    if (insightsResult.status === "fulfilled") {
      insights = insightsResult.value;
    } else {
      fetchError =
        insightsResult.reason instanceof Error
          ? insightsResult.reason.message
          : "Failed to load performance data.";
    }

    if (permissionResult.status === "fulfilled") {
      granted = permissionResult.value.granted;
    } else {
      permissionError =
        permissionResult.reason instanceof Error
          ? permissionResult.reason.message
          : "Could not read permissions.";
    }
  }

  const revoked = Boolean(
    (fetchError && isRevokedTokenError(fetchError)) ||
    (permissionError && isRevokedTokenError(permissionError)),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={sectionFor("performance")}
        title="Meta Ad Account"
        subtitle={connection?.ad_account_id ?? undefined}
        description="The Meta connection everything else reads from: performance data, attribution and — once Meta grants the permissions — launching."
        actions={connection ? <ReconnectMetaButton variant="outline" /> : null}
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {connected && !revoked && !permissionError && (
        <Alert>
          <AlertDescription>
            Reconnected. Check below that the permissions you need actually came
            through — they are set on the Facebook Login configuration, not by
            this app.
          </AlertDescription>
        </Alert>
      )}

      {revoked ? (
        // The case that had no button before: the token is dead but its
        // recorded expiry is months away, so nothing on the page offered a fix.
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>
              This Meta connection has been revoked — usually because the
              Business Integration was removed on Meta&apos;s side. Performance
              data cannot load until it is authorised again.
            </span>
            <ReconnectMetaButton />
          </AlertDescription>
        </Alert>
      ) : (
        fetchError && (
          <Alert variant="destructive">
            <AlertDescription>{fetchError}</AlertDescription>
          </Alert>
        )
      )}

      {!connection ? (
        <div className="flex flex-col gap-3">
          <ConnectMetaButton />
        </div>
      ) : isExpired ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>
            <AlertDescription>
              Your Meta connection has expired. Reconnect to keep tracking
              performance.
            </AlertDescription>
          </Alert>
          <ReconnectMetaButton />
        </div>
      ) : (
        <>
          {insights && (
            <PerformanceSummary
              insights={insights}
              adAccountId={connection.ad_account_id}
            />
          )}
          {!revoked && (
            <PermissionStatus granted={granted} error={permissionError} />
          )}
        </>
      )}
    </div>
  );
}
