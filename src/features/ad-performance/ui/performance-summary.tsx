import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AccountInsights } from "@/features/ad-performance/infrastructure/meta-insights-client";

export function PerformanceSummary({
  insights,
  adAccountId,
}: {
  insights: AccountInsights;
  adAccountId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Last 30 days</CardTitle>
        <CardDescription>
          Account-level totals from your connected Meta ad account (
          {adAccountId}).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric
          label="Impressions"
          value={insights.impressions.toLocaleString()}
        />
        <Metric label="Clicks" value={insights.clicks.toLocaleString()} />
        <Metric label="Spend" value={`$${insights.spend.toFixed(2)}`} />
        <Metric label="CTR" value={`${insights.ctr.toFixed(2)}%`} />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
