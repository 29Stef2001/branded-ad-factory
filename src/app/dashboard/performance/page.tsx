import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConnectMetaButton } from "@/features/ad-performance/ui/connect-meta-button";
import { PerformanceSummary } from "@/features/ad-performance/ui/performance-summary";
import { getConnection } from "@/features/ad-performance/infrastructure/ad-performance-repository";
import { getAccountInsights } from "@/features/ad-performance/infrastructure/meta-insights-client";

export const metadata: Metadata = {
  title: "Performance — Branded Ad Factory",
};

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const connection = await getConnection();
  const isExpired = Boolean(
    connection && new Date(connection.token_expires_at) < new Date(),
  );

  let insights = null;
  let fetchError: string | null = null;

  if (connection && !isExpired) {
    try {
      insights = await getAccountInsights(
        connection.ad_account_id,
        connection.access_token,
      );
    } catch (err) {
      fetchError =
        err instanceof Error ? err.message : "Failed to load performance data.";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
        <p className="text-muted-foreground">
          Track performance of your existing Meta ad account.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {fetchError && (
        <Alert variant="destructive">
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      )}

      {!connection || isExpired ? (
        <div className="flex flex-col gap-3">
          {isExpired && (
            <Alert>
              <AlertDescription>
                Your Meta connection has expired. Reconnect to keep tracking
                performance.
              </AlertDescription>
            </Alert>
          )}
          <ConnectMetaButton />
        </div>
      ) : (
        insights && <PerformanceSummary insights={insights} />
      )}
    </div>
  );
}
