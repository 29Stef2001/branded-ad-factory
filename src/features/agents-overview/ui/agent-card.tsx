import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AgentCard({
  name,
  description,
  runs,
  successRate,
  comingSoon = false,
  connected,
}: {
  name: string;
  description: string;
  runs?: number;
  /** Not wired up yet — no failed-run tracking exists to compute this from. */
  successRate?: number;
  /** Shows a "Coming soon" badge instead of a live status/run count. */
  comingSoon?: boolean;
  /**
   * For agents whose natural state is "connected" rather than a run count
   * (e.g. an OAuth-linked account). When provided, this replaces the
   * runs-based status/content entirely.
   */
  connected?: boolean;
}) {
  const usesConnectionStatus = connected !== undefined;
  const isActive =
    !comingSoon && (usesConnectionStatus ? connected : (runs ?? 0) > 0);

  return (
    <Card className={comingSoon ? "opacity-70" : undefined}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{name}</CardTitle>
          <Badge
            variant={
              comingSoon ? "outline" : isActive ? "default" : "secondary"
            }
          >
            {comingSoon
              ? "Coming soon"
              : usesConnectionStatus
                ? isActive
                  ? "Connected"
                  : "Not connected"
                : isActive
                  ? "Active"
                  : "Idle"}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {!comingSoon && !usesConnectionStatus && (
        <CardContent className="flex items-baseline gap-4 text-sm">
          <div>
            <span className="text-2xl font-semibold tracking-tight">
              {runs}
            </span>{" "}
            <span className="text-muted-foreground">runs</span>
          </div>
          {successRate !== undefined && (
            <div>
              <span className="text-2xl font-semibold tracking-tight">
                {successRate}%
              </span>{" "}
              <span className="text-muted-foreground">success</span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
