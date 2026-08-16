import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { isRevokedTokenError } from "@/features/ad-launch/infrastructure/meta-capability-client";
import { DarkPanel } from "@/components/layout/dark-panel";
import { StatusBadge, type StatusTone } from "@/components/data/status-badge";
import type { LaunchStatus } from "@/features/ad-launch/application/get-launch-status";

const STATUS_LABEL: Record<LaunchStatus["state"], string> = {
  not_connected: "Not connected",
  token_expired: "Token expired",
  read_only: "Read-only access",
  capability_unknown: "Status unknown",
  ready: "Ready — draft only",
};

const STATUS_TONE: Record<LaunchStatus["state"], StatusTone> = {
  not_connected: "muted",
  token_expired: "warning",
  read_only: "warning",
  capability_unknown: "muted",
  ready: "success",
};

/**
 * The Launch in Meta panel.
 *
 * Nothing here can publish a live ad, and the panel says so rather than
 * implying otherwise: the only mode the app will ever request is PAUSED/DRAFT,
 * and every state that cannot launch renders an explanation plus the actual
 * next step instead of a disabled-looking button.
 */
export function LaunchMetaPanel({ status }: { status: LaunchStatus }) {
  return (
    <DarkPanel
      title="Launch in Meta"
      description="Creates paused drafts only. Nothing is ever published automatically."
      actions={
        <StatusBadge
          label={STATUS_LABEL[status.state]}
          tone={STATUS_TONE[status.state]}
        />
      }
    >
      <div className="flex flex-col gap-4">
        {status.state !== "not_connected" && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Ad account</dt>
            <dd className="font-mono text-[13px]">{status.adAccountId}</dd>
            <dt className="text-muted-foreground">Launch mode</dt>
            <dd>
              PAUSED / DRAFT{" "}
              <span className="text-muted-foreground">(not configurable)</span>
            </dd>
          </dl>
        )}

        <StatusExplanation status={status} />
      </div>
    </DarkPanel>
  );
}

function StatusExplanation({ status }: { status: LaunchStatus }) {
  switch (status.state) {
    case "not_connected":
      return (
        <Setup
          title="No Meta ad account connected."
          body="Connect an ad account before anything can be drafted into it."
          action={
            // `Button` renders a <button>; a link needs an <a>, so the shared
            // variants are applied to Link directly rather than nesting one
            // inside the other.
            <Link
              href="/dashboard/performance"
              className={buttonVariants({ size: "sm" })}
            >
              Connect Meta account
            </Link>
          }
        />
      );

    case "token_expired":
      return (
        <Setup
          title="The stored Meta token has expired."
          body="Reconnect the account to refresh it. Nothing can be read or written until then."
          action={
            <Link
              href="/dashboard/performance"
              className={buttonVariants({ size: "sm" })}
            >
              Reconnect
            </Link>
          }
        />
      );

    case "read_only":
      return (
        <Setup
          title="This connection cannot create ads."
          body={
            <>
              Meta granted{" "}
              <span className="font-mono text-[13px]">
                {status.granted.join(", ") || "no relevant permissions"}
              </span>
              , which is enough to read performance data but not to create even
              a paused ad. That needs{" "}
              <span className="font-mono text-[13px]">ads_management</span>,
              which Meta only issues after App Review. Until then this panel
              stays read-only — there is no button here that would work.
            </>
          }
          action={
            <Link
              href="/dashboard/performance"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Review permissions
            </Link>
          }
        />
      );

    case "capability_unknown": {
      // A revoked token lands here, and previously offered no way out: the
      // panel explained that the check failed and stopped. Removing the
      // Business Integration on Meta's side is the common cause, and
      // reconnecting is the only repair — so say that, and link to it.
      const revoked = isRevokedTokenError(status.reason);

      return (
        <Setup
          title={
            revoked
              ? "This Meta connection has been revoked."
              : "Could not confirm what this connection may do."
          }
          body={
            revoked ? (
              <>
                Meta reports the app is no longer authorised, which usually
                means the Business Integration was removed. Reconnect to
                authorise it again — the new token replaces the old one.
              </>
            ) : (
              <>
                The permission check did not complete:{" "}
                <span className="text-foreground">{status.reason}</span>.
                Launching stays disabled rather than guessing — an assumed
                permission is how you end up with a half-created campaign.
              </>
            )
          }
          action={
            <Link
              href="/dashboard/performance"
              className={buttonVariants({ size: "sm" })}
            >
              Reconnect Meta
            </Link>
          }
        />
      );
    }

    case "ready":
      return (
        <Setup
          title="Draft creation is not implemented yet."
          body="This connection does hold ads_management, so drafting is possible in principle. The Graph API calls that would create the campaign, ad set and creative have not been written — this panel reports capability only."
        />
      );
  }
}

function Setup({
  title,
  body,
  action,
}: {
  title: string;
  body: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border px-4 py-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-prose text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}
