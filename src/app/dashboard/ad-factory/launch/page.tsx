import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getLaunchStatus } from "@/features/ad-launch/application/get-launch-status";
import { LaunchMetaPanel } from "@/features/ad-launch/ui/launch-meta-panel";

export const metadata: Metadata = {
  title: "Launch in Meta — Branded Ad Factory",
};

export default async function LaunchPage() {
  const status = await getLaunchStatus();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Ad Factory"
        title="Launch in Meta"
        description="Reports what the connected Meta account is actually permitted to do. Drafts only — this app never publishes a live ad."
      />
      <LaunchMetaPanel status={status} />
    </div>
  );
}
