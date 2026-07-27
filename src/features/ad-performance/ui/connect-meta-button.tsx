import { Button } from "@/components/ui/button";

export function ConnectMetaButton() {
  return (
    <Button render={<a href="/api/meta/oauth/start">Connect Meta Ads</a>} />
  );
}
