import type { Metadata } from "next";
import { AgentCard } from "@/features/agents-overview/ui/agent-card";
import {
  countAdAnalyses,
  countAdConcepts,
  countRefinedConcepts,
  isMetaAdAccountConnected,
} from "@/features/agents-overview/infrastructure/agents-repository";

export const metadata: Metadata = {
  title: "Agents — Branded Ad Factory",
};

export default async function AgentsPage() {
  const [analysesCount, conceptsCount, refinedCount, metaConnected] =
    await Promise.all([
      countAdAnalyses(),
      countAdConcepts(),
      countRefinedConcepts(),
      isMetaAdAccountConnected(),
    ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-muted-foreground">
          An overview of the AI-powered features working on your behalf.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AgentCard
          name="Competitor Intelligence"
          description="Analyzes competitor ads pulled from the Meta Ad Library."
          runs={analysesCount}
        />
        <AgentCard
          name="Concept Generator"
          description="Generates on-brand ad concepts from a campaign brief."
          runs={conceptsCount}
        />
        <AgentCard
          name="Concept Refiner"
          description="Iterates on existing ad concepts based on your feedback."
          runs={refinedCount}
        />
        <AgentCard
          name="Campaign Manager"
          description="AI-assisted campaign building and scheduling across ad platforms."
          comingSoon
        />
        <AgentCard
          name="Ad Performance Tracker"
          description="Tracks performance of your connected Meta ad account."
          connected={metaConnected}
        />
      </div>
    </div>
  );
}
