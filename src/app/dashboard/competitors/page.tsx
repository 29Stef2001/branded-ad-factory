import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AddCompetitorForm } from "@/features/competitor-analysis/ui/add-competitor-form";
import { CompetitorList } from "@/features/competitor-analysis/ui/competitor-list";
import { listCompetitors } from "@/features/competitor-analysis/infrastructure/competitor-repository";

export const metadata: Metadata = {
  title: "Competitors — Branded Ad Factory",
};

export default async function CompetitorsPage() {
  const competitors = await listCompetitors();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Competitors</h1>
        <p className="text-muted-foreground">
          Track a competitor&apos;s Meta ads and generate AI analysis of their
          messaging.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Add a competitor</CardTitle>
            <CardDescription>
              Enter their Facebook Page ID to pull their currently running ads.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddCompetitorForm />
          </CardContent>
        </Card>

        <CompetitorList competitors={competitors} />
      </div>
    </div>
  );
}
