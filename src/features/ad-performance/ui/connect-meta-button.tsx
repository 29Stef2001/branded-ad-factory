import { buttonVariants } from "@/components/ui/button";

/**
 * Starts the first Facebook Login for Business connection.
 *
 * Styled as an anchor rather than wrapped in `Button`: `Button` renders a
 * native <button> and warns when asked to render an <a> instead, which is what
 * `render={<a …>}` was doing here. Same reason the launch panel applies these
 * variants to its links directly.
 */
export function ConnectMetaButton() {
  return (
    <a href="/api/meta/oauth/start" className={buttonVariants({ size: "sm" })}>
      Connect Meta Ads
    </a>
  );
}
