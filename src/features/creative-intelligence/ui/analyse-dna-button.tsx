"use client";

import { useState, useTransition } from "react";
import { Microscope } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { analyseCreativeDnaAction } from "@/features/creative-intelligence/application/analyse-dna";

/**
 * Runs the analysis on demand rather than on a schedule.
 *
 * Every creative analysed is a paid vision call, so this stays a deliberate
 * act with a visible count. Putting it on the nightly sync would spend money
 * quietly, which is the wrong default for something whose value depends on
 * there being enough performance data to be worth reading.
 */
export function AnalyseDnaButton({ eligible }: { eligible: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, start] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size="sm"
        disabled={running || eligible === 0}
        onClick={() =>
          start(async () => {
            setError(null);
            setMessage(null);
            const result = await analyseCreativeDnaAction();
            if (result.error) setError(result.error);
            else setMessage(result.message);
          })
        }
      >
        <Microscope aria-hidden className="size-3.5" />
        {running ? "Reading creatives…" : "Analyse up to 10"}
      </Button>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && <p className="text-sm text-success">{message}</p>}
    </div>
  );
}
