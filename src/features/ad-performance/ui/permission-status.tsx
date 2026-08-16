import { Check, X } from "lucide-react";
import { DarkPanel } from "@/components/layout/dark-panel";
import { ReconnectMetaButton } from "@/features/ad-performance/ui/reconnect-meta-button";
import { REQUIRED_PERMISSIONS } from "@/features/ad-launch/infrastructure/meta-capability-client";

/**
 * What the current Meta connection is actually allowed to do.
 *
 * Shown after reconnecting because a completed OAuth redirect is not evidence
 * of anything: this app uses Facebook Login for Business, where the granted
 * scopes come from the login configuration in Meta's dashboard rather than
 * from the authorize request. Reconnecting against a configuration that only
 * asks for `ads_read` succeeds perfectly and still cannot create an ad.
 *
 * Without this panel that failure is invisible until the first launch attempt,
 * which is far too late to learn the login was configured wrong.
 */
export function PermissionStatus({
  granted,
  error,
}: {
  granted: string[] | null;
  error?: string | null;
}) {
  if (error) {
    return (
      <DarkPanel
        title="Could not read this connection's permissions"
        description={error}
        actions={<ReconnectMetaButton variant="outline" />}
      />
    );
  }

  const missing = REQUIRED_PERMISSIONS.filter(
    (entry) => !granted?.includes(entry.permission),
  );

  return (
    <DarkPanel
      title="Connection permissions"
      description={
        missing.length === 0
          ? "This connection can read performance data and create ads."
          : `${missing.length} of ${REQUIRED_PERMISSIONS.length} permissions are missing. These come from the Facebook Login for Business configuration, not from this app — add them there, then reconnect.`
      }
      actions={<ReconnectMetaButton variant="outline" />}
      contentClassName="flex flex-col gap-1.5"
    >
      {REQUIRED_PERMISSIONS.map((entry) => {
        const has = granted?.includes(entry.permission) ?? false;
        return (
          <div
            key={entry.permission}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            {has ? (
              <Check aria-hidden className="size-3.5 shrink-0 text-success" />
            ) : (
              <X aria-hidden className="size-3.5 shrink-0 text-destructive" />
            )}
            <span className="font-mono text-[13px]">{entry.permission}</span>
            <span className="text-muted-foreground">— {entry.purpose}</span>
          </div>
        );
      })}
    </DarkPanel>
  );
}
