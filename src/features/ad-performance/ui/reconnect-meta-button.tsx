import { RefreshCw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Starts a fresh Facebook Login for Business flow.
 *
 * Separate from ConnectMetaButton because the two say different things: one is
 * an invitation, the other is a repair. When a token has been revoked — which
 * happens whenever the Business Integration is removed on Meta's side — every
 * call fails with "The user has not authorized application", and the only fix
 * is to authorise again. A button labelled "Connect" next to an account that
 * looks connected reads as a no-op, so people do not press it.
 *
 * The new token replaces the old one: the connection upserts on user_id, so
 * there is never a moment with two tokens and no way to tell which is live.
 *
 * Styled as an anchor rather than wrapped in `Button`. `Button` renders a
 * native <button> and warns when it is asked to render something else — the
 * same reason the launch panel applies these variants to its links directly.
 */
export function ReconnectMetaButton({
  label = "Reconnect Meta",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline";
}) {
  return (
    <a
      href="/api/meta/oauth/start"
      className={buttonVariants({ size: "sm", variant })}
    >
      <RefreshCw aria-hidden className="size-3.5" />
      {label}
    </a>
  );
}
